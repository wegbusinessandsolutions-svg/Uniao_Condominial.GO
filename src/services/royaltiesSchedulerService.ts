import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { initFirebase } from "../lib/firebase";
import { logAction } from "../lib/audit";

export interface RoyaltyScheduleConfig {
  ativo: boolean; // Se o agendador automático está ligado
  diaFechamento: number; // Dia do mês em que o faturamento do mês anterior é apurado (ex: dia 1 a 28)
  diaVencimento: number; // Dia de vencimento da fatura gerada no mês de cobrança (ex: dia 10)
  aliquotaPadraoRoyalty: number; // % padrão caso a franqueada não tenha definida (ex: 5%)
  aliquotaPadraoFundoPropaganda: number; // % padrão de marketing (ex: 2%)
  gerarContaReceberAutomaticamente: boolean; // Se deve lançar no Contas a Receber da Matriz
  notificarEmail: boolean;
  emailNotificacao?: string;
  ultimaExecucao?: any;
  proximaExecucao?: any;
  statusUltimaExecucao?: "sucesso" | "falha" | "em_andamento";
  competenciaUltimaExecucao?: string; // ex: "2025-05"
  ultimoErro?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface RoyaltyBillingOrderSummary {
  id: string;
  numeroPedido?: string | number;
  data: string;
  clienteNome?: string;
  valor: number;
  status: string;
}

export interface FranqueadaMonthlySummary {
  franqueadaId: string;
  codigoUnidade: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  statusFranquia: string;
  responsavel?: string;
  email?: string;
  telefone?: string;
  aliquotaRoyalty: number;
  aliquotaFundoPropaganda: number;
  totalPedidos: number;
  faturamentoBruto: number;
  valorRoyalties: number;
  valorFundoPropaganda: number;
  valorTotalDevido: number;
  pedidosDetalhados: RoyaltyBillingOrderSummary[];
  cobrancaExistenteId?: string;
  statusCobranca?: "Pendente" | "Faturado" | "Pago" | "Cancelado" | "NaoGerada";
  dataVencimento?: string;
  contaReceberId?: string;
}

export interface RoyaltyBillingRecord {
  id?: string;
  competencia: string; // YYYY-MM
  franqueadaId: string;
  codigoUnidade: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  faturamentoBruto: number;
  totalPedidos: number;
  aliquotaRoyalty: number;
  valorRoyalties: number;
  aliquotaFundoPropaganda: number;
  valorFundoPropaganda: number;
  valorTotal: number;
  dataFechamento: string;
  dataVencimento: string;
  dataEmissao: string;
  status: "Pendente" | "Faturado" | "Pago" | "Cancelado";
  contaReceberId?: string;
  tipoDisparo: "automatico" | "manual";
  executadoPor: string;
  observacoes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ProcessMonthlyRoyaltiesResult {
  success: boolean;
  competencia: string;
  totalFranqueadasProcessadas: number;
  totalFaturamentoApurado: number;
  totalRoyaltiesApurados: number;
  totalFundoPropagandaApurado: number;
  totalGeralDevido: number;
  cobrancasGeradas: number;
  cobrancasAtualizadas: number;
  detalhesFranqueadas: FranqueadaMonthlySummary[];
  mensagem: string;
  erro?: string;
}

export const DEFAULT_ROYALTY_SCHEDULE_CONFIG: RoyaltyScheduleConfig = {
  ativo: true,
  diaFechamento: 1, // Dia 1º do mês seguinte
  diaVencimento: 10, // Vence no dia 10
  aliquotaPadraoRoyalty: 5,
  aliquotaPadraoFundoPropaganda: 2,
  gerarContaReceberAutomaticamente: true,
  notificarEmail: true,
  emailNotificacao: "wegbusinessandsolutions@gmail.com",
  statusUltimaExecucao: "sucesso",
};

export const CENTRO_CUSTO_ROYALTIES = "Rec. Royalties & Franquia";

/**
 * Garante que o Centro de Custo para Royalties exista na base de dados
 */
export async function garantirCentroCustoRoyalties(): Promise<string> {
  try {
    const { db } = await initFirebase();
    const qCC = query(
      collection(db, "centros_custo"),
      where("nome", "==", CENTRO_CUSTO_ROYALTIES)
    );
    const snapCC = await getDocs(qCC);
    if (!snapCC.empty) {
      return snapCC.docs[0].id;
    }

    const novoCC = await addDoc(collection(db, "centros_custo"), {
      nome: CENTRO_CUSTO_ROYALTIES,
      categoria: "Receita de Franquia",
      centroPai: "Receitas Franqueadora Master",
      tipo: "receita",
      status: "Ativo",
      descricao: "Recebimento de royalties, taxas de publicidade e faturamento de franquias da rede",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return novoCC.id;
  } catch (err) {
    console.warn("Aviso ao verificar centro de custo de royalties:", err);
    return "";
  }
}

/**
 * Calcula a data e hora da próxima execução com base no dia de fechamento
 */
export function calculateNextRoyaltyRun(diaFechamento: number): Date {
  const now = new Date();
  const day = Math.min(Math.max(diaFechamento || 1, 1), 28);
  const next = new Date(now.getFullYear(), now.getMonth(), day, 2, 0, 0, 0);

  if (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Retorna a competência do mês anterior (ex: se hoje é junho/2025 -> "2025-05")
 */
export function getPreviousMonthCompetencia(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * Retorna a competência do mês atual (ex: "2025-06")
 */
export function getCurrentMonthCompetencia(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * Busca a configuração de agendamento de royalties do Firestore
 */
export async function getRoyaltyScheduleConfig(): Promise<RoyaltyScheduleConfig> {
  try {
    const { db } = await initFirebase();
    const docRef = doc(db, "configuracao_royalties", "principal");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as RoyaltyScheduleConfig;
      return {
        ...DEFAULT_ROYALTY_SCHEDULE_CONFIG,
        ...data,
      };
    }

    const proxima = calculateNextRoyaltyRun(DEFAULT_ROYALTY_SCHEDULE_CONFIG.diaFechamento);
    const initialConfig: RoyaltyScheduleConfig = {
      ...DEFAULT_ROYALTY_SCHEDULE_CONFIG,
      proximaExecucao: Timestamp.fromDate(proxima),
    };

    await setDoc(docRef, {
      ...initialConfig,
      updatedAt: serverTimestamp(),
    });
    return initialConfig;
  } catch (error) {
    console.warn("Erro ao buscar configuracao_royalties:", error);
    return DEFAULT_ROYALTY_SCHEDULE_CONFIG;
  }
}

/**
 * Salva a configuração de agendamento de royalties no Firestore
 */
export async function saveRoyaltyScheduleConfig(
  config: RoyaltyScheduleConfig,
  userName: string = "Administrador"
): Promise<void> {
  const { db } = await initFirebase();
  const docRef = doc(db, "configuracao_royalties", "principal");
  const proxima = calculateNextRoyaltyRun(config.diaFechamento);

  const payload = {
    ...config,
    proximaExecucao: Timestamp.fromDate(proxima),
    updatedAt: serverTimestamp(),
    updatedBy: userName,
  };

  await setDoc(docRef, payload, { merge: true });

  await logAction(
    `Configuração de agendamento de royalties atualizada (Fechamento: Dia ${config.diaFechamento}, Vencimento: Dia ${config.diaVencimento}, Ativo: ${config.ativo ? "Sim" : "Não"})`,
    "Administrativo",
    {
      updatedBy: userName,
      diaFechamento: config.diaFechamento,
      diaVencimento: config.diaVencimento,
      aliquotaPadraoRoyalty: config.aliquotaPadraoRoyalty,
      aliquotaPadraoFundoPropaganda: config.aliquotaPadraoFundoPropaganda,
      ativo: config.ativo,
      gerarContaReceberAutomaticamente: config.gerarContaReceberAutomaticamente,
    }
  );
}

/**
 * Apura o faturamento e calcula os royalties mensais de todas as franqueadas para uma competência (YYYY-MM).
 */
export async function apurarFaturamentoMensalFranqueadas(
  competencia: string
): Promise<FranqueadaMonthlySummary[]> {
  const { db } = await initFirebase();
  const config = await getRoyaltyScheduleConfig();

  // 1. Carrega todas as unidades de config_empresa e config_franqueadora
  const franqueadasMap = new Map<string, FranqueadaMonthlySummary>();

  try {
    const empSnap = await getDocs(collection(db, "config_empresa"));
    empSnap.forEach((d) => {
      const data = d.data();
      const codigo = (data.codigoUnidade || `FRQ-${franqueadasMap.size + 1}`).toUpperCase().trim();
      const roy = parseFloat(String(data.royalties || config.aliquotaPadraoRoyalty).replace(",", ".")) || config.aliquotaPadraoRoyalty;
      const fnd = parseFloat(String(data.fundoPropaganda || config.aliquotaPadraoFundoPropaganda).replace(",", ".")) || config.aliquotaPadraoFundoPropaganda;

      franqueadasMap.set(d.id, {
        franqueadaId: d.id,
        codigoUnidade: codigo,
        razaoSocial: data.razaoSocial || "Empresa Franqueada",
        nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
        cnpj: data.cnpj || "",
        statusFranquia: data.statusFranquia || "Ativa",
        responsavel: data.responsavelUnidade || data.resp1Nome || "",
        email: data.email || "",
        telefone: data.telefone || "",
        aliquotaRoyalty: roy,
        aliquotaFundoPropaganda: fnd,
        totalPedidos: 0,
        faturamentoBruto: 0,
        valorRoyalties: 0,
        valorFundoPropaganda: 0,
        valorTotalDevido: 0,
        pedidosDetalhados: [],
        statusCobranca: "NaoGerada",
      });
    });
  } catch (e) {
    console.warn("Aviso ao carregar config_empresa para royalties:", e);
  }

  try {
    const frqSnap = await getDocs(collection(db, "config_franqueadora"));
    frqSnap.forEach((d) => {
      if (!franqueadasMap.has(d.id)) {
        const data = d.data();
        const codigo = (data.numeroFranqueada || data.codigoUnidade || `FRQ-${franqueadasMap.size + 1}`).toUpperCase().trim();
        const roy = parseFloat(String(data.royalties || config.aliquotaPadraoRoyalty).replace(",", ".")) || config.aliquotaPadraoRoyalty;
        const fnd = parseFloat(String(data.fundoPropaganda || config.aliquotaPadraoFundoPropaganda).replace(",", ".")) || config.aliquotaPadraoFundoPropaganda;

        franqueadasMap.set(d.id, {
          franqueadaId: d.id,
          codigoUnidade: codigo,
          razaoSocial: data.razaoSocial || "Franqueada",
          nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
          cnpj: data.cnpj || "",
          statusFranquia: "Ativa",
          responsavel: data.responsavel || "",
          email: data.email || "",
          telefone: data.telefone || "",
          aliquotaRoyalty: roy,
          aliquotaFundoPropaganda: fnd,
          totalPedidos: 0,
          faturamentoBruto: 0,
          valorRoyalties: 0,
          valorFundoPropaganda: 0,
          valorTotalDevido: 0,
          pedidosDetalhados: [],
          statusCobranca: "NaoGerada",
        });
      }
    });
  } catch (e) {
    console.warn("Aviso ao carregar config_franqueadora para royalties:", e);
  }

  const franqueadasList = Array.from(franqueadasMap.values());

  // 2. Carrega cobranças de royalties já existentes para esta competência
  const cobrancasExistentesMap = new Map<string, RoyaltyBillingRecord>();
  try {
    const qCobrancas = query(
      collection(db, "cobrancas_royalties"),
      where("competencia", "==", competencia)
    );
    const snapCobrancas = await getDocs(qCobrancas);
    snapCobrancas.forEach((d) => {
      const cData = { ...d.data(), id: d.id } as RoyaltyBillingRecord;
      if (cData.franqueadaId) {
        cobrancasExistentesMap.set(cData.franqueadaId, cData);
      }
      if (cData.codigoUnidade) {
        cobrancasExistentesMap.set(cData.codigoUnidade.toUpperCase(), cData);
      }
    });
  } catch (e) {
    console.warn("Aviso ao buscar cobrancas_royalties existentes:", e);
  }

  // 3. Carrega pedidos de venda e filtra pela competência selecionada
  const ordersSnap = await getDocs(collection(db, "pedidos_venda"));

  ordersSnap.forEach((d) => {
    const order = d.data();
    const orderStatus = (order.status || "").toLowerCase();
    if (orderStatus === "cancelado" || orderStatus === "rejeitado") {
      return;
    }

    const orderDateStr = order.createdAt || order.dataPedido || order.data || "";
    if (!orderDateStr) return;

    const orderCompetencia = String(orderDateStr).slice(0, 7); // "YYYY-MM"
    if (orderCompetencia !== competencia) {
      return;
    }

    const cand =
      order.totais?.totalPedido ||
      order.totalPedido ||
      order.valorTotal ||
      order.valor_total ||
      order.totalGeral ||
      order.total ||
      0;

    let val = 0;
    if (typeof cand === "number") val = cand;
    else if (typeof cand === "string")
      val = parseFloat(cand.replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;

    if (isNaN(val) || val <= 0) return;

    // Identificar a franqueada deste pedido
    const orderFrqCode = (order.codigoUnidade || order.franqueadaId || "").toUpperCase().trim();
    let targetFrq: FranqueadaMonthlySummary | undefined;

    if (orderFrqCode) {
      targetFrq = franqueadasList.find(
        (f) =>
          f.codigoUnidade.toUpperCase() === orderFrqCode ||
          f.franqueadaId === orderFrqCode
      );
    }

    // Se o pedido não estiver explicitamente marcado, atribui à primeira unidade ativa
    if (!targetFrq && franqueadasList.length > 0) {
      targetFrq = franqueadasList[0];
    }

    if (targetFrq) {
      targetFrq.faturamentoBruto += val;
      targetFrq.totalPedidos += 1;
      targetFrq.pedidosDetalhados.push({
        id: d.id,
        numeroPedido: order.numeroPedido || order.numero || d.id.slice(0, 6).toUpperCase(),
        data: orderDateStr,
        clienteNome: order.cliente?.nome || order.clienteNome || order.nomeCliente || "Cliente",
        valor: val,
        status: order.status || "Aprovado",
      });
    }
  });

  // 4. Calcula valores finais e vincula cobranças existentes
  franqueadasList.forEach((frq) => {
    frq.valorRoyalties = Number((frq.faturamentoBruto * (frq.aliquotaRoyalty / 100)).toFixed(2));
    frq.valorFundoPropaganda = Number((frq.faturamentoBruto * (frq.aliquotaFundoPropaganda / 100)).toFixed(2));
    frq.valorTotalDevido = Number((frq.valorRoyalties + frq.valorFundoPropaganda).toFixed(2));

    const cobExistente = cobrancasExistentesMap.get(frq.franqueadaId) || cobrancasExistentesMap.get(frq.codigoUnidade.toUpperCase());
    if (cobExistente) {
      frq.cobrancaExistenteId = cobExistente.id;
      frq.statusCobranca = cobExistente.status;
      frq.dataVencimento = cobExistente.dataVencimento;
      frq.contaReceberId = cobExistente.contaReceberId;
    }
  });

  return franqueadasList;
}

/**
 * Processa e gera as cobranças de royalties em lote para todas as franqueadas em uma competência,
 * salvando no histórico de cobranças e sincronizando com o Contas a Receber da Matriz.
 */
export async function processarCobrancasMensaisRoyalties(
  competencia: string,
  options?: {
    actorName?: string;
    tipoDisparo?: "automatico" | "manual";
    forceRecalculate?: boolean;
    dataVencimentoCustom?: string;
  }
): Promise<ProcessMonthlyRoyaltiesResult> {
  const actor = options?.actorName || "Sistema (Agendador Automático)";
  const tipoDisparo = options?.tipoDisparo || "manual";
  const config = await getRoyaltyScheduleConfig();
  const { db } = await initFirebase();

  await garantirCentroCustoRoyalties();

  // 1. Apura o faturamento de todas as unidades
  const franqueadasSummary = await apurarFaturamentoMensalFranqueadas(competencia);

  let totalFaturamento = 0;
  let totalRoyalties = 0;
  let totalFundo = 0;
  let totalDevido = 0;
  let cobrancasGeradas = 0;
  let cobrancasAtualizadas = 0;

  const nowIso = new Date().toISOString();
  const hojeYmd = nowIso.split("T")[0];

  // Determina data de vencimento padrão
  let vencimentoPadrao = options?.dataVencimentoCustom;
  if (!vencimentoPadrao) {
    const [anoStr, mesStr] = competencia.split("-");
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    // Vencimento ocorre no mês seguinte ao mês da competência
    let mesVenc = mes + 1;
    let anoVenc = ano;
    if (mesVenc > 12) {
      mesVenc = 1;
      anoVenc += 1;
    }
    const diaVenc = Math.min(Math.max(config.diaVencimento || 10, 1), 28);
    vencimentoPadrao = `${anoVenc}-${String(mesVenc).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;
  }

  for (const frq of franqueadasSummary) {
    totalFaturamento += frq.faturamentoBruto;
    totalRoyalties += frq.valorRoyalties;
    totalFundo += frq.valorFundoPropaganda;
    totalDevido += frq.valorTotalDevido;

    const valorCobrar = frq.valorTotalDevido;
    const dataVencimento = frq.dataVencimento || vencimentoPadrao;

    // Se já tem cobrança existente
    if (frq.cobrancaExistenteId) {
      // Se não for paga nem cancelada, atualiza os valores
      if (frq.statusCobranca !== "Pago" && frq.statusCobranca !== "Cancelado") {
        const updateCobrancaPayload: any = {
          faturamentoBruto: frq.faturamentoBruto,
          totalPedidos: frq.totalPedidos,
          aliquotaRoyalty: frq.aliquotaRoyalty,
          valorRoyalties: frq.valorRoyalties,
          aliquotaFundoPropaganda: frq.aliquotaFundoPropaganda,
          valorFundoPropaganda: frq.valorFundoPropaganda,
          valorTotal: valorCobrar,
          dataVencimento,
          updatedAt: nowIso,
          executadoPor: actor,
        };

        await updateDoc(doc(db, "cobrancas_royalties", frq.cobrancaExistenteId), updateCobrancaPayload);

        // Se houver conta_receber vinculada, atualiza também
        if (frq.contaReceberId) {
          try {
            await updateDoc(doc(db, "contas_receber", frq.contaReceberId), {
              valor: valorCobrar,
              valorFaturamentoBase: frq.faturamentoBruto,
              valorRoyalties: frq.valorRoyalties,
              valorFundoPropaganda: frq.valorFundoPropaganda,
              vencimento: dataVencimento,
              updatedAt: nowIso,
            });
          } catch (e) {
            console.warn("Aviso ao atualizar contas_receber:", e);
          }
        }
        cobrancasAtualizadas++;
      }
    } else {
      // Cria nova cobrança de royalties
      let contaReceberId = "";

      // Se configurado para gerar no Contas a Receber da Matriz e houver valor
      if (config.gerarContaReceberAutomaticamente && valorCobrar > 0) {
        try {
          const receivablePayload = {
            descricao: `Royalties & Fundo Prop. (${competencia}) - ${frq.codigoUnidade} ${frq.nomeFantasia || frq.razaoSocial}`,
            cliente: frq.razaoSocial,
            clienteNome: frq.nomeFantasia || frq.razaoSocial,
            clienteCnpj: frq.cnpj,
            franqueadaId: frq.franqueadaId,
            codigoUnidade: frq.codigoUnidade,
            tipoDocumento: "Royalties Franquia",
            categoria: "Receita de Franquia",
            centroCusto: CENTRO_CUSTO_ROYALTIES,
            competencia,
            valor: valorCobrar,
            valorFaturamentoBase: frq.faturamentoBruto,
            valorRoyalties: frq.valorRoyalties,
            valorFundoPropaganda: frq.valorFundoPropaganda,
            vencimento: dataVencimento,
            dataEmissao: hojeYmd,
            status: "Pendente",
            formaPagamento: "Boleto Bancário / PIX",
            origem: "agendamento_royalties",
            observacoes: `Faturamento apurado: R$ ${frq.faturamentoBruto.toFixed(2)} (${frq.totalPedidos} pedidos). Royalties (${frq.aliquotaRoyalty}%): R$ ${frq.valorRoyalties.toFixed(2)}. Fundo (${frq.aliquotaFundoPropaganda}%): R$ ${frq.valorFundoPropaganda.toFixed(2)}.`,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          const crDoc = await addDoc(collection(db, "contas_receber"), receivablePayload);
          contaReceberId = crDoc.id;
        } catch (crErr) {
          console.warn("Aviso ao criar conta a receber de royalties:", crErr);
        }
      }

      const newCobrancaPayload: RoyaltyBillingRecord = {
        competencia,
        franqueadaId: frq.franqueadaId,
        codigoUnidade: frq.codigoUnidade,
        razaoSocial: frq.razaoSocial,
        nomeFantasia: frq.nomeFantasia,
        cnpj: frq.cnpj,
        faturamentoBruto: frq.faturamentoBruto,
        totalPedidos: frq.totalPedidos,
        aliquotaRoyalty: frq.aliquotaRoyalty,
        valorRoyalties: frq.valorRoyalties,
        aliquotaFundoPropaganda: frq.aliquotaFundoPropaganda,
        valorFundoPropaganda: frq.valorFundoPropaganda,
        valorTotal: valorCobrar,
        dataFechamento: hojeYmd,
        dataVencimento,
        dataEmissao: hojeYmd,
        status: valorCobrar > 0 ? "Pendente" : "Faturado",
        contaReceberId: contaReceberId || undefined,
        tipoDisparo,
        executadoPor: actor,
        observacoes: `Processamento ${tipoDisparo} de fechamento mensal.`,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const cDoc = await addDoc(collection(db, "cobrancas_royalties"), newCobrancaPayload);
      frq.cobrancaExistenteId = cDoc.id;
      frq.statusCobranca = newCobrancaPayload.status;
      frq.dataVencimento = dataVencimento;
      frq.contaReceberId = contaReceberId;
      cobrancasGeradas++;
    }
  }

  // 2. Atualiza a configuração com a data da última execução
  try {
    const proximaExec = calculateNextRoyaltyRun(config.diaFechamento);
    await updateDoc(doc(db, "configuracao_royalties", "principal"), {
      ultimaExecucao: serverTimestamp(),
      proximaExecucao: Timestamp.fromDate(proximaExec),
      statusUltimaExecucao: "sucesso",
      competenciaUltimaExecucao: competencia,
      ultimoErro: null,
    });
  } catch (e) {
    console.warn("Aviso ao atualizar status na configuracao_royalties:", e);
  }

  // 3. Registra log de auditoria
  const summaryMsg = `Apuração Mensal de Royalties (${competencia}): ${franqueadasSummary.length} franqueadas processadas. Faturamento Total: R$ ${totalFaturamento.toFixed(2)} | Royalties: R$ ${totalRoyalties.toFixed(2)} | Fundo Propaganda: R$ ${totalFundo.toFixed(2)} | Total Devido à Matriz: R$ ${totalDevido.toFixed(2)} (${cobrancasGeradas} novas faturas, ${cobrancasAtualizadas} atualizadas).`;

  await logAction(
    summaryMsg,
    "Administrativo",
    {
      competencia,
      tipoDisparo,
      executadoPor: actor,
      totalFranqueadas: franqueadasSummary.length,
      totalFaturamento,
      totalRoyalties,
      totalFundo,
      totalDevido,
      cobrancasGeradas,
      cobrancasAtualizadas,
    }
  );

  return {
    success: true,
    competencia,
    totalFranqueadasProcessadas: franqueadasSummary.length,
    totalFaturamentoApurado: totalFaturamento,
    totalRoyaltiesApurados: totalRoyalties,
    totalFundoPropagandaApurado: totalFundo,
    totalGeralDevido: totalDevido,
    cobrancasGeradas,
    cobrancasAtualizadas,
    detalhesFranqueadas: franqueadasSummary,
    mensagem: summaryMsg,
  };
}

/**
 * Verifica se a rotina automática deve ser disparada hoje.
 * Se ativo for true e o dia atual for >= diaFechamento e a competência do mês anterior ainda não foi processada, dispara automaticamente.
 */
export async function executarVerificacaoAgendadorRoyalties(
  actorName: string = "Agendador Automático"
): Promise<{ executou: boolean; resultado?: ProcessMonthlyRoyaltiesResult; motivo?: string }> {
  try {
    const config = await getRoyaltyScheduleConfig();
    if (!config.ativo) {
      return { executou: false, motivo: "Agendador automático de royalties está inativo." };
    }

    const now = new Date();
    const diaAtual = now.getDate();
    const competenciaAnterior = getPreviousMonthCompetencia(now);

    // Verifica se já atingiu o dia de fechamento
    if (diaAtual < (config.diaFechamento || 1)) {
      return {
        executou: false,
        motivo: `Hoje é dia ${diaAtual}, o fechamento está agendado para o dia ${config.diaFechamento}.`,
      };
    }

    // Verifica se a competência anterior já foi processada
    if (config.competenciaUltimaExecucao === competenciaAnterior) {
      return {
        executou: false,
        motivo: `A competência ${competenciaAnterior} já foi processada anteriormente.`,
      };
    }

    // Executa a apuração e fechamento
    const res = await processarCobrancasMensaisRoyalties(competenciaAnterior, {
      actorName,
      tipoDisparo: "automatico",
    });

    return { executou: true, resultado: res };
  } catch (error: any) {
    console.error("Erro na verificação do agendador de royalties:", error);
    return { executou: false, motivo: error?.message || "Erro durante a execução do agendador." };
  }
}

/**
 * Busca histórico de todas as cobranças de royalties geradas
 */
export async function buscarHistoricoCobrancasRoyalties(
  competencia?: string
): Promise<RoyaltyBillingRecord[]> {
  try {
    const { db } = await initFirebase();
    let q = query(collection(db, "cobrancas_royalties"));
    if (competencia) {
      q = query(collection(db, "cobrancas_royalties"), where("competencia", "==", competencia));
    }

    const snap = await getDocs(q);
    const list: RoyaltyBillingRecord[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as RoyaltyBillingRecord);
    });

    // Ordena por competência decrescente e código da unidade
    list.sort((a, b) => {
      if (b.competencia !== a.competencia) {
        return b.competencia.localeCompare(a.competencia);
      }
      return a.codigoUnidade.localeCompare(b.codigoUnidade);
    });

    return list;
  } catch (e) {
    console.warn("Erro ao buscar histórico de cobranças:", e);
    return [];
  }
}

/**
 * Atualiza o status de uma cobrança de royalties (ex: marcar como pago) e reflete no Contas a Receber
 */
export async function atualizarStatusCobrancaRoyalty(
  cobrancaId: string,
  novoStatus: "Pendente" | "Faturado" | "Pago" | "Cancelado",
  options?: {
    actorName?: string;
    dataPagamento?: string;
    formaPagamento?: string;
  }
): Promise<void> {
  const { db } = await initFirebase();
  const actor = options?.actorName || "Administrador";
  const nowIso = new Date().toISOString();

  const cobRef = doc(db, "cobrancas_royalties", cobrancaId);
  const cobSnap = await getDoc(cobRef);
  if (!cobSnap.exists()) {
    throw new Error("Cobrança de royalties não encontrada.");
  }

  const cobData = cobSnap.data() as RoyaltyBillingRecord;

  await updateDoc(cobRef, {
    status: novoStatus,
    dataLiquidacao: novoStatus === "Pago" ? (options?.dataPagamento || nowIso.split("T")[0]) : null,
    updatedAt: nowIso,
    updatedBy: actor,
  });

  // Atualiza no contas_receber correspondente se existir
  if (cobData.contaReceberId) {
    try {
      const crStatus = novoStatus === "Pago" ? "Recebido" : novoStatus === "Cancelado" ? "Cancelado" : "Pendente";
      await updateDoc(doc(db, "contas_receber", cobData.contaReceberId), {
        status: crStatus,
        recebidoEm: novoStatus === "Pago" ? (options?.dataPagamento || nowIso.split("T")[0]) : null,
        valorRecebido: novoStatus === "Pago" ? cobData.valorTotal : null,
        formaPagamento: options?.formaPagamento || "PIX / Transferência",
        updatedAt: nowIso,
      });
    } catch (e) {
      console.warn("Aviso ao atualizar conta a receber correspondente:", e);
    }
  }

  await logAction(
    `Status da Cobrança de Royalties (${cobData.codigoUnidade} - ${cobData.competencia}) alterado para '${novoStatus}'`,
    "Administrativo",
    {
      cobrancaId,
      franqueada: cobData.codigoUnidade,
      competencia: cobData.competencia,
      valor: cobData.valorTotal,
      novoStatus,
      executadoPor: actor,
    }
  );
}

/**
 * Exclui uma cobrança de royalties e remove seu registro no contas_receber se não tiver sido liquidado
 */
export async function excluirCobrancaRoyalty(
  cobrancaId: string,
  actorName: string = "Administrador"
): Promise<void> {
  const { db } = await initFirebase();
  const cobRef = doc(db, "cobrancas_royalties", cobrancaId);
  const cobSnap = await getDoc(cobRef);

  if (!cobSnap.exists()) return;
  const cobData = cobSnap.data() as RoyaltyBillingRecord;

  if (cobData.contaReceberId) {
    try {
      const crSnap = await getDoc(doc(db, "contas_receber", cobData.contaReceberId));
      if (crSnap.exists()) {
        const crData = crSnap.data();
        if (crData.status !== "Recebido" && crData.status !== "Pago") {
          await deleteDoc(doc(db, "contas_receber", cobData.contaReceberId));
        }
      }
    } catch (e) {
      console.warn("Aviso ao excluir conta a receber vinculada:", e);
    }
  }

  await deleteDoc(cobRef);

  await logAction(
    `Cobrança de Royalties excluída (${cobData.codigoUnidade} - ${cobData.competencia} - R$ ${cobData.valorTotal.toFixed(2)})`,
    "Administrativo",
    {
      cobrancaId,
      franqueada: cobData.codigoUnidade,
      competencia: cobData.competencia,
      valor: cobData.valorTotal,
      executadoPor: actorName,
    }
  );
}
