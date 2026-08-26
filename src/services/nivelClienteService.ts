import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  orderBy, 
  limit, 
  Firestore 
} from "firebase/firestore";
import { UserLevel } from "../types";
import { logAction } from "../lib/audit";

export interface RegraNivel {
  id?: string;
  nivel: string;
  percentual: number;
  minimo: number;
}

export const REGRAS_PADRAO_NIVEL: RegraNivel[] = [
  { nivel: "Diamante", percentual: 12, minimo: 1200.01 },
  { nivel: "Ouro", percentual: 10, minimo: 801 },
  { nivel: "Prata", percentual: 7, minimo: 401 },
  { nivel: "Bronze", percentual: 5, minimo: 0 },
];

/**
 * Busca as regras de níveis cadastradas em 'regras_cashback' ou retorna as regras padrão.
 * As regras são ordenadas de forma decrescente pelo valor mínimo (maior mínimo primeiro).
 */
export async function obterRegrasNivel(db: Firestore): Promise<RegraNivel[]> {
  try {
    const snap = await getDocs(collection(db, "regras_cashback"));
    if (!snap.empty) {
      const regras: RegraNivel[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nivel: data.nivel || "Bronze",
          percentual: Number(data.percentual || 0),
          minimo: Number(data.minimo || 0),
        };
      });

      // Ordenar decrescente por valor mínimo
      regras.sort((a, b) => b.minimo - a.minimo);
      return regras;
    }
  } catch (err) {
    console.warn("Erro ao buscar regras_cashback no Firestore, usando padrão:", err);
  }

  return [...REGRAS_PADRAO_NIVEL].sort((a, b) => b.minimo - a.minimo);
}

/**
 * Determina o nível do cliente de acordo com o valor da última compra baixada.
 * Compara com as regras cadastradas (ou padrão).
 */
export function determinarNivelPorValor(
  valorCompra: number,
  regras: RegraNivel[] = REGRAS_PADRAO_NIVEL
): UserLevel {
  const valor = Math.max(0, Number(valorCompra) || 0);

  // Garantir ordenação decrescente por minimo
  const regrasOrdenadas = [...regras].sort((a, b) => b.minimo - a.minimo);

  for (const regra of regrasOrdenadas) {
    if (valor >= Number(regra.minimo || 0)) {
      const n = (regra.nivel || "").toLowerCase().trim();
      if (n.includes("diamante")) return "Diamante";
      if (n.includes("ouro") || n.includes("gold")) return "Ouro";
      if (n.includes("prata") || n.includes("silver")) return "Prata";
      if (n.includes("bronze")) return "Bronze";
      
      // Se tiver outro nome que comece com maiúscula
      const formatted = regra.nivel.charAt(0).toUpperCase() + regra.nivel.slice(1).toLowerCase();
      if (["Bronze", "Prata", "Ouro", "Diamante"].includes(formatted)) {
        return formatted as UserLevel;
      }
    }
  }

  return "Bronze";
}

/**
 * Função utilitária para calcular a categoria de cashback (Bronze, Prata, Ouro, Diamante)
 * baseada no total de compras do mês ou valor da compra:
 * - Bronze: de R$ 1,00 até R$ 400,00 (ou <= 400)
 * - Prata: de R$ 401,00 até R$ 800,00 (> 400 e <= 800)
 * - Ouro: de R$ 801,00 até R$ 1.200,00 (> 800 e <= 1200)
 * - Diamante: compras acima de R$ 1.200,00 (> 1200)
 *
 * @param totalComprasMes Valor total acumulado de compras no mês ou valor da compra
 * @param regras Regras opcionais personalizadas do Firestore
 * @returns UserLevel ("Bronze" | "Prata" | "Ouro" | "Diamante")
 */
export function calculateCashbackTier(
  totalComprasMes: number,
  regras?: RegraNivel[]
): UserLevel {
  const total = Math.max(0, Number(totalComprasMes) || 0);

  if (regras && regras.length > 0) {
    return determinarNivelPorValor(total, regras);
  }

  if (total > 1200) {
    return "Diamante";
  } else if (total > 800) {
    return "Ouro";
  } else if (total > 400) {
    return "Prata";
  } else {
    return "Bronze";
  }
}

/**
 * Calcula o total de compras com pagamento baixado ("Recebido") no mês corrente para um cliente.
 */
export async function obterTotalComprasMesCliente(
  db: Firestore,
  clienteId: string,
  anoMes?: string // YYYY-MM
): Promise<number> {
  try {
    const targetMonth = anoMes || new Date().toISOString().slice(0, 7);
    const qContas = query(
      collection(db, "contas_receber"),
      where("clienteId", "==", clienteId),
      where("status", "==", "Recebido")
    );
    const contasSnap = await getDocs(qContas);
    if (contasSnap.empty) return 0;

    let total = 0;
    for (const d of contasSnap.docs) {
      const item = d.data();
      const dt = String(item.recebidoEm || item.updatedAt || item.createdAt || "");
      if (dt.startsWith(targetMonth)) {
        total += Number(item.valorRecebido || item.valor || 0);
      }
    }
    return total;
  } catch (err) {
    console.warn("[NivelCliente] Erro ao obter total de compras do mês:", err);
    return 0;
  }
}

/**
 * Recalcula e atualiza o nível do cliente no Firestore (users/{userId}) 
 * com base na última compra cujo recebimento foi baixado ("Recebido" / "Pago").
 */
export async function recalcularNivelClientePorRecebimento(
  db: Firestore,
  clienteIdOrIdentifier: string,
  valorRecebido?: number,
  infoOrigem?: { pedidoId?: string; descricao?: string }
): Promise<{
  sucesso: boolean;
  alterou: boolean;
  nivelAnterior: string;
  novoNivel: UserLevel;
  valorCompra: number;
  userId?: string;
  userName?: string;
}> {
  if (!clienteIdOrIdentifier || typeof clienteIdOrIdentifier !== "string") {
    return {
      sucesso: false,
      alterou: false,
      nivelAnterior: "Bronze",
      novoNivel: "Bronze",
      valorCompra: 0,
    };
  }

  try {
    let targetUserDoc: any = null;
    let userId = clienteIdOrIdentifier;

    // 1. Tenta buscar direto por UID no documento
    try {
      const directSnap = await getDoc(doc(db, "users", clienteIdOrIdentifier));
      if (directSnap.exists()) {
        targetUserDoc = directSnap;
        userId = directSnap.id;
      }
    } catch {
      // Ignora e tenta via queries
    }

    // 2. Se não achou diretamente pelo ID, busca por email, CPF/CNPJ ou nome
    if (!targetUserDoc) {
      const usersRef = collection(db, "users");
      
      // Busca por email
      const qEmail = query(usersRef, where("email", "==", clienteIdOrIdentifier));
      const sEmail = await getDocs(qEmail);
      if (!sEmail.empty) {
        targetUserDoc = sEmail.docs[0];
        userId = targetUserDoc.id;
      } else {
        // Busca por CPF/CNPJ
        const cleanCpfCnpj = clienteIdOrIdentifier.replace(/\D/g, "");
        if (cleanCpfCnpj.length >= 11) {
          const qCpf = query(usersRef, where("cpf", "==", clienteIdOrIdentifier));
          const sCpf = await getDocs(qCpf);
          if (!sCpf.empty) {
            targetUserDoc = sCpf.docs[0];
            userId = targetUserDoc.id;
          } else {
            const qCnpj = query(usersRef, where("cnpj", "==", clienteIdOrIdentifier));
            const sCnpj = await getDocs(qCnpj);
            if (!sCnpj.empty) {
              targetUserDoc = sCnpj.docs[0];
              userId = targetUserDoc.id;
            }
          }
        }
      }
    }

    if (!targetUserDoc || !targetUserDoc.exists()) {
      console.warn(`[NivelCliente] Usuário '${clienteIdOrIdentifier}' não localizado para recálculo de nível.`);
      return {
        sucesso: false,
        alterou: false,
        nivelAnterior: "Bronze",
        novoNivel: "Bronze",
        valorCompra: 0,
      };
    }

    const userData = targetUserDoc.data();
    const userName = userData.displayName || userData.nomeCompleto || userData.email || "Cliente";
    const nivelAnterior = userData.level || "Bronze";

    // 3. Determinar o valor da compra
    let valorFinal = Number(valorRecebido || 0);

    // Se o valor não foi fornecido diretamente, busca a última compra baixada em contas_receber ou pedidos_venda
    if (valorFinal <= 0) {
      try {
        const qContas = query(
          collection(db, "contas_receber"),
          where("clienteId", "==", userId),
          where("status", "==", "Recebido")
        );
        const contasSnap = await getDocs(qContas);
        if (!contasSnap.empty) {
          const contas = contasSnap.docs.map((d) => d.data());
          contas.sort((a, b) => {
            const dtA = new Date(a.recebidoEm || a.updatedAt || a.createdAt || 0).getTime();
            const dtB = new Date(b.recebidoEm || b.updatedAt || b.createdAt || 0).getTime();
            return dtB - dtA;
          });
          valorFinal = Number(contas[0].valorRecebido || contas[0].valor || 0);
        }
      } catch (err) {
        console.warn("[NivelCliente] Falha ao consultar histórico de contas_receber:", err);
      }
    }

    // 4. Obter total de compras baixadas no mês para o cliente (incluindo o valor atual caso já não esteja contabilizado)
    const totalComprasMes = await obterTotalComprasMesCliente(db, userId);
    const valorBaseCalculo = Math.max(valorFinal, totalComprasMes);

    // 5. Obter regras e calcular novo nível usando calculateCashbackTier
    const regras = await obterRegrasNivel(db);
    const novoNivel = calculateCashbackTier(valorBaseCalculo, regras);
    const alterou = novoNivel.toLowerCase() !== nivelAnterior.toLowerCase();

    // 6. Atualizar perfil do usuário no Firestore
    const agoraIso = new Date().toISOString();
    await updateDoc(doc(db, "users", userId), {
      level: novoNivel,
      ultimoValorCompra: valorFinal,
      totalComprasMes: valorBaseCalculo,
      dataUltimaCompraBaixada: agoraIso,
      dataRecalculoNivel: agoraIso,
      nivelCalculadoAutomaticamente: true,
    });

    // 7. Registrar log de auditoria
    if (alterou) {
      await logAction(
        `Nível do cliente recalculado automaticamente: ${userName} alterado de ${nivelAnterior} para ${novoNivel} (Base de cálculo / Total do mês: R$ ${valorBaseCalculo.toFixed(2)})`,
        "Financeiro",
        {
          userId,
          clienteNome: userName,
          nivelAnterior,
          novoNivel,
          valorCompra: valorFinal,
          totalComprasMes: valorBaseCalculo,
          origem: infoOrigem?.descricao || "Baixa de Recebimento no Financeiro",
          pedidoId: infoOrigem?.pedidoId || null,
        }
      );
    }

    return {
      sucesso: true,
      alterou,
      nivelAnterior,
      novoNivel,
      valorCompra: valorBaseCalculo,
      userId,
      userName,
    };
  } catch (error) {
    console.error("[NivelCliente] Erro ao recalcular nível do cliente:", error);
    return {
      sucesso: false,
      alterou: false,
      nivelAnterior: "Bronze",
      novoNivel: "Bronze",
      valorCompra: 0,
    };
  }
}
