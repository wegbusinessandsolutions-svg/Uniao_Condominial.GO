import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  setDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { logAction } from "../lib/audit";
import {
  validarIntegridadeFinanceiraAfiliacao,
  assertIntegridadeFinanceiraAfiliacao,
  FinancialIntegrityValidationResult,
  FinancialIntegrityError,
  roundCurrency
} from "../lib/financialValidation";

// Re-exporta utilitários globais de integridade financeira
export {
  validarIntegridadeFinanceiraAfiliacao,
  assertIntegridadeFinanceiraAfiliacao,
  FinancialIntegrityError,
  roundCurrency
};
export type { FinancialIntegrityValidationResult };

export const CENTRO_CUSTO_AFILIACAO = "Rec. Afiliação Mensal";

/**
 * Garante que o Centro de Custo "Rec. Afiliação Mensal" exista no banco de dados.
 */
export async function garantirCentroCustoAfiliacao(): Promise<string> {
  try {
    const qCC = query(
      collection(db, "centros_custo"),
      where("nome", "==", CENTRO_CUSTO_AFILIACAO)
    );
    const snapCC = await getDocs(qCC);
    if (!snapCC.empty) {
      return snapCC.docs[0].id;
    }

    // Cria o centro de custo oficial de receitas de afiliação
    const novoCC = await addDoc(collection(db, "centros_custo"), {
      nome: CENTRO_CUSTO_AFILIACAO,
      categoria: "fixo",
      centroPai: "Receitas de Afiliação",
      tipo: "receita",
      status: "Ativo",
      descricao: "Centro de custo para controle das mensalidades e afiliações de condomínios à União Condominial",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return novoCC.id;
  } catch (err) {
    console.warn("Aviso ao garantir centro de custo de afiliação:", err);
    return "";
  }
}

export interface AfiliadoData {
  id?: string;
  userId?: string;
  clienteId?: string;
  nomeCondominio: string;
  cnpj?: string;
  nomeSindico?: string;
  telefone?: string;
  email?: string;
  clienteEmail?: string;
  userEmail?: string;
  diaVencimento: number | string;
  valorMensalidade: number | string;
  valorTotalContrato?: number | string;
  unidadesHabitacionais?: number | string;
  status?: string;
  dataAtivacao?: string;
  dataAfiliacao?: string;
  createdAt?: any;
}

export interface ParcelaAfiliacaoItem {
  id?: string;
  numeroParcela: number;
  vencimento: string;
  valor: number;
  status: string;
  titular: string;
  descricao: string;
  acao: "CRIADA" | "ATUALIZADA" | "MANTIDA_PAGA";
}

export interface SyncAfiliacaoResult {
  success: boolean;
  afiliadoId: string;
  nomeCondominio: string;
  totalParcelas: number;
  criadas: number;
  atualizadas: number;
  mantidas: number;
  valorMensalidade: number;
  valorTotalContrato: number;
  somaParcelas: number;
  diaVencimento: number;
  parcelas: ParcelaAfiliacaoItem[];
  validacaoIntegridade?: FinancialIntegrityValidationResult;
  mensagem: string;
}

/**
 * Calcula as datas de vencimento para as 12 parcelas mensais
 * respeitando o dia escolhido pelo cliente e tratando meses com 28/29/30/31 dias.
 */
export function calcularDatasVencimento(
  diaVencimento: number | string,
  dataBase: Date = new Date()
): string[] {
  const diaVenc = Math.min(Math.max(Number(diaVencimento) || 10, 1), 31);
  const baseDay = dataBase.getDate();
  let mesInicial = dataBase.getMonth() + 1; // 1-12
  let anoInicial = dataBase.getFullYear();

  // Se o dia de vencimento escolhido já passou no mês corrente, a 1ª parcela vence no mês seguinte
  if (diaVenc <= baseDay) {
    mesInicial++;
    if (mesInicial > 12) {
      mesInicial = 1;
      anoInicial++;
    }
  }

  const datas: string[] = [];

  for (let i = 0; i < 12; i++) {
    let m = mesInicial + i;
    let y = anoInicial;

    while (m > 12) {
      m -= 12;
      y++;
    }

    // Calcula a quantidade máxima de dias no mês calculado (ex: Fev = 28/29, Abr = 30)
    const maxDiasNoMes = new Date(y, m, 0).getDate();
    const diaEfetivo = Math.min(diaVenc, maxDiasNoMes);

    const dataFormatada = `${y}-${String(m).padStart(2, "0")}-${String(diaEfetivo).padStart(2, "0")}`;
    datas.push(dataFormatada);
  }

  return datas;
}

/**
 * Sincroniza as 12 parcelas de uma afiliação no Contas a Receber.
 * 
 * Regras Obrigatórias:
 * 1. O titular do documento é obrigatoriamente o Nome do Condomínio (`titular: nomeCondominio`).
 * 2. Valida duplicidades existentes por número de parcela (1 a 12) e id de afiliação/cliente.
 * 3. Se já existirem registros:
 *    - Registros com status "Recebido" são preservados intactos para integridade financeira.
 *    - Registros abertos/pendentes/vencidos têm apenas valores e datas de vencimento atualizados.
 * 4. Se não existirem registros, cria as 12 parcelas cada uma em seu devido mês.
 */
export async function syncAfiliacaoContasReceber(
  afiliado: AfiliadoData,
  options?: {
    actorName?: string;
    origemAcao?: string;
    dataReferencia?: Date;
  }
): Promise<SyncAfiliacaoResult> {
  const afiliadoId = afiliado.id || afiliado.userId || "";
  const afiliacaoId = afiliadoId;
  const nomeCondominio = (afiliado.nomeCondominio || "Condomínio").trim();
  const valorMensal = Number(afiliado.valorMensalidade || 0);
  const diaVenc = Math.min(Math.max(Number(afiliado.diaVencimento) || 10, 1), 31);
  const actor = options?.actorName || "Sistema";
  const origem = options?.origemAcao || "Aceite de Termo";

  if (!afiliadoId) {
    throw new Error("Identificador do afiliado ou cliente não fornecido.");
  }
  if (!nomeCondominio) {
    throw new Error("O nome do condomínio é obrigatório para ser titular do contas a receber.");
  }

  // 1. Garante que o Centro de Custo "Rec. Afiliação Mensal" existe no sistema
  await garantirCentroCustoAfiliacao();

  // 2. Busca banco padrão cadastrado
  let defaultBanco: { id: string; banco: string } | null = null;
  try {
    const bancosSnap = await getDocs(collection(db, "bancos"));
    bancosSnap.forEach((bDoc) => {
      const bData = bDoc.data();
      if (bData.bancoPadrao) {
        defaultBanco = { id: bDoc.id, banco: bData.banco || bData.nome || "Banco Principal" };
      }
    });
    // Se não encontrou banco padrão marcado, pega o primeiro se existir
    if (!defaultBanco && !bancosSnap.empty) {
      const firstDoc = bancosSnap.docs[0];
      defaultBanco = { id: firstDoc.id, banco: firstDoc.data().banco || firstDoc.data().nome || "Banco" };
    }
  } catch (err) {
    console.warn("Aviso ao buscar bancos para conta a receber:", err);
  }

  // 2. Busca registros existentes em contas_receber vinculados a este afiliado
  const existingDocsMap = new Map<string, any>();

  try {
    // Busca por afiliacaoId
    const qAfiliacao = query(
      collection(db, "contas_receber"),
      where("afiliacaoId", "==", afiliadoId)
    );
    const snapAfiliacao = await getDocs(qAfiliacao);
    snapAfiliacao.forEach((d) => existingDocsMap.set(d.id, { ...d.data(), id: d.id }));

    // Busca por clienteId (se for diferente ou complementar)
    const targetClienteId = afiliado.userId || afiliado.clienteId || afiliadoId;
    if (targetClienteId) {
      const qCliente = query(
        collection(db, "contas_receber"),
        where("clienteId", "==", targetClienteId)
      );
      const snapCliente = await getDocs(qCliente);
      snapCliente.forEach((d) => {
        const dData = d.data();
        if (
          dData.categoria === "Afiliação" ||
          dData.origem === "afiliacao_uc" ||
          (dData.descricao && dData.descricao.toLowerCase().includes("afiliação"))
        ) {
          existingDocsMap.set(d.id, { ...dData, id: d.id });
        }
      });
    }

    // Busca por nome do condomínio se a lista ainda for pequena
    if (existingDocsMap.size < 12) {
      const qCat = query(
        collection(db, "contas_receber"),
        where("categoria", "==", "Afiliação")
      );
      const snapCat = await getDocs(qCat);
      snapCat.forEach((d) => {
        const dData = d.data();
        const dTitular = (dData.titular || dData.clienteNome || dData.cliente || "").trim().toLowerCase();
        if (dTitular === nomeCondominio.toLowerCase()) {
          existingDocsMap.set(d.id, { ...dData, id: d.id });
        }
      });
    }
  } catch (err) {
    console.error("Erro ao buscar contas a receber existentes:", err);
  }

  const existingDocs = Array.from(existingDocsMap.values());

  // 3. Calcula datas de vencimento das 12 parcelas
  const dataRef = options?.dataReferencia || (afiliado.dataAtivacao ? new Date(afiliado.dataAtivacao) : new Date());
  const datasVencimento = calcularDatasVencimento(diaVenc, dataRef);

  // 4. PRE-FLIGHT DE INTEGRIDADE FINANCEIRA GLOBAL (Soma das Parcelas x Total da Afiliação)
  // Constrói o modelo previsto de parcelas e valida a integridade matemática antes de qualquer escrita no Firestore
  const parcelasParaValidacao = datasVencimento.map((venc, idx) => ({
    numeroParcela: idx + 1,
    valor: valorMensal,
    vencimento: venc,
    titular: nomeCondominio,
    descricao: `Taxa de Afiliação a U.C. (Parcela ${idx + 1}/12)`
  }));

  const integridadeCheck = await assertIntegridadeFinanceiraAfiliacao(
    afiliado,
    parcelasParaValidacao,
    {
      actorName: actor,
      origem: origem,
      quantidadeEsperada: 12
    }
  );

  let criadas = 0;
  let atualizadas = 0;
  let mantidas = 0;
  const parcelasProcessadas: ParcelaAfiliacaoItem[] = [];

  // 5. Processa cada uma das 12 parcelas
  for (let i = 1; i <= 12; i++) {
    const vencimentoEsperado = datasVencimento[i - 1];
    const descricaoParcela = `Taxa de Afiliação a U.C. (Parcela ${i}/12)`;

    // Procura documento existente para a parcela 'i'
    const existingDoc = existingDocs.find((docItem) => {
      if (Number(docItem.numeroParcela) === i) return true;
      if (docItem.descricao && (
        docItem.descricao.includes(`Parcela ${i}/12`) ||
        docItem.descricao.includes(`Parcela ${i} `) ||
        docItem.descricao.includes(`(${i}/12)`)
      )) {
        return true;
      }
      return false;
    });

    if (existingDoc) {
      const isRecebido = existingDoc.status === "Recebido" || existingDoc.status === "Pago";

      if (isRecebido) {
        // Se já foi pago, não alteramos status, nem datas/valores de quitação
        mantidas++;
        parcelasProcessadas.push({
          id: existingDoc.id,
          numeroParcela: i,
          vencimento: existingDoc.vencimento || vencimentoEsperado,
          valor: Number(existingDoc.valor || valorMensal),
          status: existingDoc.status,
          titular: existingDoc.titular || nomeCondominio,
          descricao: existingDoc.descricao || descricaoParcela,
          acao: "MANTIDA_PAGA"
        });

        // Garante que o titular e o vínculo de afiliação estejam corretos
        if (!existingDoc.titular || existingDoc.titular !== nomeCondominio || !existingDoc.afiliacaoId || !existingDoc.centroCusto) {
          try {
            await updateDoc(doc(db, "contas_receber", existingDoc.id), {
              titular: nomeCondominio,
              clienteNome: nomeCondominio,
              afiliacaoId,
              centroCusto: CENTRO_CUSTO_AFILIACAO,
              updatedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn("Aviso ao sincronizar metadados de parcela paga:", e);
          }
        }
      } else {
        // Parcela em aberto/vencida/pendente: atualiza valor e data de vencimento
        const updatePayload: any = {
          titular: nomeCondominio,
          clienteNome: nomeCondominio,
          cliente: nomeCondominio,
          clienteId: afiliado.userId || afiliado.clienteId || afiliadoId,
          descricao: descricaoParcela,
          valor: valorMensal,
          vencimento: vencimentoEsperado,
          parcelas: 12,
          numeroParcela: i,
          status: existingDoc.status || "Aberto",
          categoria: "Afiliação",
          centroCusto: CENTRO_CUSTO_AFILIACAO,
          afiliacaoId,
          origem: "afiliacao_uc",
          cnpj: afiliado.cnpj || existingDoc.cnpj || "",
          observacoes: `Afiliação União Condominial - Vencimento dia ${diaVenc}`,
          updatedAt: new Date().toISOString()
        };

        if (defaultBanco && !existingDoc.banco) {
          updatePayload.banco = defaultBanco.id;
          updatePayload.bancoNome = defaultBanco.banco;
        }

        await updateDoc(doc(db, "contas_receber", existingDoc.id), updatePayload);
        atualizadas++;

        parcelasProcessadas.push({
          id: existingDoc.id,
          numeroParcela: i,
          vencimento: vencimentoEsperado,
          valor: valorMensal,
          status: updatePayload.status,
          titular: nomeCondominio,
          descricao: descricaoParcela,
          acao: "ATUALIZADA"
        });
      }
    } else {
      // Parcela inexistente: inclui novo registro
      const newPayload: any = {
        titular: nomeCondominio,
        clienteNome: nomeCondominio,
        cliente: nomeCondominio,
        clienteId: afiliado.userId || afiliado.clienteId || afiliadoId,
        descricao: descricaoParcela,
        valor: valorMensal,
        vencimento: vencimentoEsperado,
        parcelas: 12,
        numeroParcela: i,
        status: "Aberto",
        categoria: "Afiliação",
        centroCusto: CENTRO_CUSTO_AFILIACAO,
        afiliacaoId,
        origem: "afiliacao_uc",
        cnpj: afiliado.cnpj || "",
        observacoes: `Afiliação União Condominial - Vencimento dia ${diaVenc}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (defaultBanco) {
        newPayload.banco = defaultBanco.id;
        newPayload.bancoNome = defaultBanco.banco;
      }

      const docRef = await addDoc(collection(db, "contas_receber"), newPayload);
      criadas++;

      parcelasProcessadas.push({
        id: docRef.id,
        numeroParcela: i,
        vencimento: vencimentoEsperado,
        valor: valorMensal,
        status: "Aberto",
        titular: nomeCondominio,
        descricao: descricaoParcela,
        acao: "CRIADA"
      });
    }
  }

  // 5. Registra trilha de auditoria detalhada
  const summaryMsg = `Afiliação U.C. (${nomeCondominio}): 12 parcelas sincronizadas no Contas a Receber (${criadas} criadas, ${atualizadas} atualizadas, ${mantidas} mantidas). Titular: ${nomeCondominio} | Vencimento: Dia ${diaVenc} | Valor: R$ ${valorMensal.toFixed(2)}`;

  try {
    await logAction(
      summaryMsg,
      "Financeiro",
      {
        afiliadoId,
        nomeCondominio,
        diaVencimento: diaVenc,
        valorMensalidade: valorMensal,
        totalParcelas: 12,
        criadas,
        atualizadas,
        mantidas,
        origem,
        executadoPor: actor
      }
    );
  } catch (err) {
    console.warn("Aviso ao registrar log de auditoria:", err);
  }

  return {
    success: true,
    afiliadoId,
    nomeCondominio,
    totalParcelas: 12,
    criadas,
    atualizadas,
    mantidas,
    valorMensalidade: valorMensal,
    valorTotalContrato: integridadeCheck.valorTotalAfiliacao,
    somaParcelas: integridadeCheck.somaParcelas,
    diaVencimento: diaVenc,
    parcelas: parcelasProcessadas,
    validacaoIntegridade: integridadeCheck,
    mensagem: summaryMsg
  };
}

/**
 * Validação prévia de integridade antes de persistir dados de afiliação na coleção `afiliados_uc`.
 */
export function validarAfiliacaoAntesDePersistir(
  afiliado: AfiliadoData,
  options?: { totalEsperadoCustom?: number; quantidadeEsperada?: number }
): FinancialIntegrityValidationResult {
  return validarIntegridadeFinanceiraAfiliacao(afiliado, undefined, options);
}

/**
 * Retorna as 12 parcelas cadastradas para determinado afiliado
 */
export async function getContasReceberAfiliado(
  afiliadoId: string,
  nomeCondominio?: string
): Promise<any[]> {
  const map = new Map<string, any>();

  try {
    const qAfil = query(
      collection(db, "contas_receber"),
      where("afiliacaoId", "==", afiliadoId)
    );
    const snapAfil = await getDocs(qAfil);
    snapAfil.forEach((d) => map.set(d.id, { ...d.data(), id: d.id }));

    const qCli = query(
      collection(db, "contas_receber"),
      where("clienteId", "==", afiliadoId)
    );
    const snapCli = await getDocs(qCli);
    snapCli.forEach((d) => {
      const data = d.data();
      if (data.categoria === "Afiliação" || data.origem === "afiliacao_uc") {
        map.set(d.id, { ...data, id: d.id });
      }
    });

    if (nomeCondominio && map.size < 12) {
      const qCat = query(
        collection(db, "contas_receber"),
        where("categoria", "==", "Afiliação")
      );
      const snapCat = await getDocs(qCat);
      snapCat.forEach((d) => {
        const data = d.data();
        const titular = (data.titular || data.clienteNome || data.cliente || "").trim().toLowerCase();
        if (titular === nomeCondominio.trim().toLowerCase()) {
          map.set(d.id, { ...data, id: d.id });
        }
      });
    }
  } catch (err) {
    console.error("Erro ao listar contas do afiliado:", err);
  }

  const items = Array.from(map.values());
  items.sort((a, b) => (Number(a.numeroParcela) || 0) - (Number(b.numeroParcela) || 0));
  return items;
}

export interface CancelamentoAfiliacaoResult {
  success: boolean;
  afiliadoId: string;
  canceladasAutomaticamente: number;
  mantidasComMenosDe15Dias: number;
  parcelasMantidas: any[];
  parcelasCanceladas: any[];
  mensagem: string;
}

/**
 * Processa o cancelamento de afiliação no Contas a Receber.
 * 
 * Regra:
 * - Todos os registros presentes de contas a receber vinculados à afiliação
 *   que ainda estão com status "a receber" (Aberto, Pendente, Atrasado, Vencido)
 *   têm seu status alterado para "Cancelado", não fazendo mais parte do saldo a receber.
 * - Registros já liquidados (Recebido / Pago) são mantidos para histórico contábil.
 */
export async function processarCancelamentoAfiliacaoFinanceiro(
  afiliadoIdOrClienteId: string,
  options?: {
    dataCancelamento?: Date | string;
    actorName?: string;
    nomeCondominio?: string;
    email?: string;
    motivo?: string;
    cancelarTodas?: boolean; // Padrão: true (todas as parcelas a receber são canceladas)
  }
): Promise<CancelamentoAfiliacaoResult> {
  const targetId = (afiliadoIdOrClienteId || "").trim();
  const actor = options?.actorName || "Sistema";
  const nowIso = new Date().toISOString();
  
  let baseCancelDate = new Date();
  if (options?.dataCancelamento) {
    const parsed = new Date(options.dataCancelamento);
    if (!isNaN(parsed.getTime())) {
      baseCancelDate = parsed;
    }
  }
  // Normaliza para início do dia de cancelamento
  baseCancelDate.setHours(0, 0, 0, 0);

  const existingDocsMap = new Map<string, any>();

  try {
    // 1. Busca por afiliacaoId
    if (targetId) {
      const qAfil = query(
        collection(db, "contas_receber"),
        where("afiliacaoId", "==", targetId)
      );
      const snapAfil = await getDocs(qAfil);
      snapAfil.forEach((d) => existingDocsMap.set(d.id, { ...d.data(), id: d.id }));

      // 2. Busca por clienteId
      const qCli = query(
        collection(db, "contas_receber"),
        where("clienteId", "==", targetId)
      );
      const snapCli = await getDocs(qCli);
      snapCli.forEach((d) => {
        const data = d.data();
        if (
          data.categoria === "Afiliação" ||
          data.origem === "afiliacao_uc" ||
          (data.descricao && data.descricao.toLowerCase().includes("afiliação"))
        ) {
          existingDocsMap.set(d.id, { ...data, id: d.id });
        }
      });
    }

    // 3. Busca por email
    if (options?.email) {
      const qEmail = query(
        collection(db, "contas_receber"),
        where("email", "==", options.email.trim())
      );
      const snapEmail = await getDocs(qEmail);
      snapEmail.forEach((d) => {
        const data = d.data();
        if (
          data.categoria === "Afiliação" ||
          data.origem === "afiliacao_uc" ||
          (data.descricao && data.descricao.toLowerCase().includes("afiliação"))
        ) {
          existingDocsMap.set(d.id, { ...data, id: d.id });
        }
      });
    }

    // 4. Busca por nome do condomínio / titular
    if (options?.nomeCondominio) {
      const qCat = query(
        collection(db, "contas_receber"),
        where("categoria", "==", "Afiliação")
      );
      const snapCat = await getDocs(qCat);
      snapCat.forEach((d) => {
        const data = d.data();
        const titular = (data.titular || data.clienteNome || data.cliente || "").trim().toLowerCase();
        if (titular === options.nomeCondominio!.trim().toLowerCase()) {
          existingDocsMap.set(d.id, { ...data, id: d.id });
        }
      });
    }
  } catch (err) {
    console.error("Erro ao buscar contas para processamento de cancelamento:", err);
  }

  const existingDocs = Array.from(existingDocsMap.values());
  const parcelasCanceladas: any[] = [];
  const parcelasMantidas: any[] = [];

  for (const docItem of existingDocs) {
    const isRecebido = docItem.status === "Recebido" || docItem.status === "Pago";
    if (isRecebido) {
      // Já liquidado, não altera
      parcelasMantidas.push(docItem);
      continue;
    }

    if (docItem.status === "Cancelado") {
      // Já está cancelado
      parcelasCanceladas.push(docItem);
      continue;
    }

    // Todos os registros presentes a receber mudam seu status para Cancelado
    const updateData = {
      status: "Cancelado",
      centroCusto: CENTRO_CUSTO_AFILIACAO,
      motivoCancelamento: options?.motivo || "Afiliação Cancelada - Registro desativado do Contas a Receber",
      dataCancelamento: baseCancelDate.toISOString(),
      canceladoEm: nowIso,
      horaCancelamento: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      canceladoPor: actor,
      updatedAt: nowIso
    };

    try {
      await updateDoc(doc(db, "contas_receber", docItem.id), updateData);
      parcelasCanceladas.push({
        ...docItem,
        ...updateData
      });
    } catch (upErr) {
      console.error(`Erro ao cancelar conta_receber ${docItem.id}:`, upErr);
    }
  }

  const cancelMsg = `Cancelamento de Afiliação (${options?.nomeCondominio || targetId}): ${parcelasCanceladas.length} cobrança(s) de afiliação alterada(s) para o status 'Cancelado' e removida(s) de Contas a Receber.`;

  try {
    await logAction(
      cancelMsg,
      "Financeiro",
      {
        afiliadoId: targetId,
        nomeCondominio: options?.nomeCondominio,
        totalCanceladas: parcelasCanceladas.length,
        liquidadasMantidas: parcelasMantidas.length,
        dataCancelamento: baseCancelDate.toISOString(),
        executadoPor: actor
      }
    );
  } catch (err) {
    console.warn("Aviso ao registrar auditoria de cancelamento:", err);
  }

  return {
    success: true,
    afiliadoId: targetId,
    canceladasAutomaticamente: parcelasCanceladas.length,
    mantidasComMenosDe15Dias: parcelasMantidas.length,
    parcelasMantidas,
    parcelasCanceladas,
    mensagem: cancelMsg
  };
}
