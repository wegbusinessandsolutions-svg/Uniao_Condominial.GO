/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDateBR, formatDateTimeBR } from "./dateUtils";

export type StandardOSStatus =
  | "Confirmação de Data"
  | "Data confirmada"
  | "Dia de Execução Serviço"
  | "Técnico a caminho"
  | "Em execução"
  | "Serviço Concluído"
  | "Cancelada pelo Cliente"
  | "Cancelado";

export type RoutineServiceOrderStatus = StandardOSStatus;

export function isOSPendingInitialConfirmation(status?: string): boolean {
  if (!status) return true;
  const s = status.trim().toLowerCase();
  return (
    s === "confirmação de data" ||
    s.includes("confirmação de data") ||
    s.includes("aguardando confirmação - data") ||
    s.includes("aguardando confirmação") ||
    s.includes("solicitado") ||
    s.includes("pendente") ||
    s === "novo"
  );
}

export interface ServiceStatusEvent {
  status: StandardOSStatus | string;
  dataHora: string; // ISO format
  dataHoraFormatada?: string; // Formatted date string
  descricao: string;
  autor?: string;
  etapaExecucao?: string;
  detalhesAdicionais?: Record<string, any>;
}

/**
 * Standard steps definition in chronological order
 */
export const STANDARD_OS_STEPS = [
  {
    key: "Confirmação de Data",
    label: "Confirmação de Data",
    shortLabel: "Confirmação",
    stepNumber: 1,
    defaultDesc: "Solicitação registrada no sistema. Aguardando confirmação da data de agendamento.",
  },
  {
    key: "Data confirmada",
    label: "Data confirmada",
    shortLabel: "Confirmada",
    stepNumber: 2,
    defaultDesc: "Data da visita técnica confirmada e agendada na escala operacional.",
  },
  {
    key: "Dia de Execução Serviço",
    label: "Dia de Execução Serviço",
    shortLabel: "Dia do Serviço",
    stepNumber: 3,
    defaultDesc: "Chegou o dia agendado para o atendimento. Aguardando início do deslocamento da equipe técnica.",
  },
  {
    key: "Técnico a caminho",
    label: "Técnico a caminho",
    shortLabel: "A Caminho",
    stepNumber: 4,
    defaultDesc: "Técnico prestador aceitou a ordem de serviço e está em deslocamento até o condomínio.",
  },
  {
    key: "Em execução",
    label: "Em execução",
    shortLabel: "Em Execução",
    stepNumber: 5,
    defaultDesc: "Técnico presente no local realizando os procedimentos e serviços contratados.",
  },
  {
    key: "Serviço Concluído",
    label: "Serviço Concluído",
    shortLabel: "Concluído",
    stepNumber: 6,
    defaultDesc: "Serviço concluído com êxito, evidências fotográficas registradas e assinatura coletada.",
  },
] as const;

/**
 * Normalizes raw or legacy status into the standard status
 */
export function normalizeOSStatus(rawStatus?: string): StandardOSStatus {
  if (!rawStatus) return "Confirmação de Data";
  const s = rawStatus.trim();
  const sLower = s.toLowerCase();

  // Cancelled states
  if (sLower.includes("cancelad") || sLower.includes("rejeitad")) {
    return s.includes("Cliente") ? "Cancelada pelo Cliente" : "Cancelado";
  }

  // Concluded states
  if (
    s === "Serviço Concluído" ||
    s === "Serviço concluído" ||
    sLower.includes("concluído") ||
    sLower.includes("concluido") ||
    sLower.includes("finalizado") ||
    sLower.includes("termo assinado")
  ) {
    return "Serviço Concluído";
  }

  // Active execution / onsite states
  if (
    s === "Em execução" ||
    s === "Em Execução" ||
    sLower.includes("execução") ||
    sLower.includes("execucao") ||
    sLower.includes("andamento") ||
    sLower.includes("vistoria") ||
    sLower.includes("no condomínio") ||
    sLower.includes("no condominio") ||
    sLower.includes("fotos antes") ||
    sLower.includes("fotos depois") ||
    sLower.includes("fotos_antes") ||
    sLower.includes("fotos_depois") ||
    sLower.includes("chegada") ||
    sLower.includes("assinatura")
  ) {
    return "Em execução";
  }

  // In transit / displacement states
  if (
    s === "Técnico a caminho" ||
    s === "Em Deslocamento" ||
    sLower.includes("técnico a caminho") ||
    sLower.includes("tecnico a caminho") ||
    sLower.includes("deslocamento") ||
    sLower.includes("a caminho") ||
    sLower.includes("em rota") ||
    sLower.includes("trânsito") ||
    sLower.includes("transito")
  ) {
    return "Técnico a caminho";
  }

  // Execution day states
  if (
    s === "Dia de Execução Serviço" ||
    sLower.includes("dia de execução") ||
    sLower.includes("dia da execução") ||
    sLower.includes("dia de execucao") ||
    sLower.includes("dia do serviço")
  ) {
    return "Dia de Execução Serviço";
  }

  // Confirmed date / scheduled visit
  if (
    s === "Data confirmada" ||
    sLower.includes("data confirmada") ||
    sLower.includes("confirmada a visita") ||
    sLower.includes("visita agendada") ||
    sLower.includes("agendado") ||
    sLower.includes("confirmado")
  ) {
    return "Data confirmada";
  }

  if (
    s === "Confirmação de Data" ||
    sLower.includes("confirmação de data") ||
    sLower.includes("aguardando confirmação - data") ||
    sLower.includes("aguardando confirmação") ||
    sLower.includes("solicitado") ||
    sLower.includes("pendente") ||
    sLower === "novo"
  ) {
    return "Confirmação de Data";
  }

  return "Confirmação de Data";
}

/**
 * Checks if a given date (YYYY-MM-DD or ISO) is today or in the past
 */
export function isTodayOrPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  try {
    let target = dateStr;
    if (target.includes("T")) {
      target = target.substring(0, 10);
    }
    const today = new Date().toISOString().substring(0, 10);
    return target <= today;
  } catch {
    return false;
  }
}

/**
 * Resolves the effective status taking into account whether today is the execution day
 */
export function getEffectiveOSStatus(order: any): StandardOSStatus {
  if (!order) return "Confirmação de Data";

  // 1. Cancellation check
  if (
    order.canceladoEm ||
    order.status === "Cancelada pelo Cliente" ||
    order.status === "Cancelado" ||
    order.etapaExecucao === "cancelado"
  ) {
    return order.status === "Cancelada pelo Cliente" ? "Cancelada pelo Cliente" : "Cancelado";
  }

  // 2. Concluded check
  if (
    order.concluidoEm ||
    order.assinaturaEm ||
    order.termoAssinado ||
    order.etapaExecucao === "concluido" ||
    order.status === "Serviço Concluído" ||
    order.status === "Serviço concluído" ||
    normalizeOSStatus(order.status) === "Serviço Concluído"
  ) {
    return "Serviço Concluído";
  }

  // 3. In execution check (physical arrival, initial/final inspection photos, work in progress, waiting signature)
  const etapa = order.etapaExecucao || "";
  const inExecEtapas = ["fotos_antes", "em_execucao", "fotos_depois", "aguardando_assinatura"];
  if (
    inExecEtapas.includes(etapa) ||
    order.inicioTrabalhoEm ||
    order.fotosAntesEm ||
    (Array.isArray(order.fotosAntes) && order.fotosAntes.length > 0) ||
    order.chegadaEm
  ) {
    return "Em execução";
  }

  // 4. Technician on the way / displacement check
  if (
    etapa === "deslocamento" ||
    order.deslocamentoInicioEm ||
    order.status === "Em Deslocamento" ||
    order.status === "Técnico a caminho"
  ) {
    return "Técnico a caminho";
  }

  // 5. Check latest entry in historicoStatus if available
  if (Array.isArray(order.historicoStatus) && order.historicoStatus.length > 0) {
    const lastEvent = order.historicoStatus[order.historicoStatus.length - 1];
    if (lastEvent?.status) {
      const normalizedLast = normalizeOSStatus(lastEvent.status);
      if (
        normalizedLast === "Em execução" ||
        normalizedLast === "Técnico a caminho" ||
        normalizedLast === "Serviço Concluído"
      ) {
        return normalizedLast;
      }
    }
  }

  // 6. Check order.status normalized
  const normalized = normalizeOSStatus(order?.status);
  if (
    normalized === "Em execução" ||
    normalized === "Técnico a caminho" ||
    normalized === "Serviço Concluído"
  ) {
    return normalized;
  }

  // 7. Check if date confirmed or execution day has arrived
  if (normalized === "Data confirmada" || order.dataConfirmada || order.dataAgendada) {
    const targetDate = order.dataConfirmada || order.dataAgendada;
    if (targetDate && isTodayOrPast(targetDate)) {
      return "Dia de Execução Serviço";
    }
    return "Data confirmada";
  }

  return normalized;
}

/**
 * Recursively removes all undefined values from objects and arrays for Firestore safety
 */
export function sanitizeFirestorePayload<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestorePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Creates a new status audit log entry
 */
export function createStatusLogEntry(
  status: StandardOSStatus | string,
  descricao?: string,
  autor?: string,
  etapaExecucao?: string,
  extraDetails?: Record<string, any>
): ServiceStatusEvent {
  const now = new Date();
  const normalized = normalizeOSStatus(status);
  
  let defaultDesc = descricao;
  if (!defaultDesc) {
    const match = STANDARD_OS_STEPS.find((st) => st.key === normalized);
    defaultDesc = match ? match.defaultDesc : `Status alterado para ${status}.`;
  }

  const entry: ServiceStatusEvent = {
    status: normalized,
    dataHora: now.toISOString(),
    dataHoraFormatada: formatDateTimeBR(now),
    descricao: defaultDesc,
    autor: autor || "Sistema",
  };

  if (etapaExecucao) {
    entry.etapaExecucao = etapaExecucao;
  }

  if (extraDetails && typeof extraDetails === "object" && Object.keys(extraDetails).length > 0) {
    const sanitized = sanitizeFirestorePayload(extraDetails);
    if (sanitized && Object.keys(sanitized).length > 0) {
      entry.detalhesAdicionais = sanitized;
    }
  }

  return entry;
}

/**
 * Appends a new status change event into the order's tracking history
 */
export function appendStatusHistory(
  currentOrder: any,
  newStatus: StandardOSStatus | string,
  descricao?: string,
  autor?: string,
  extraPayload: Record<string, any> = {}
): {
  status: StandardOSStatus | string;
  historicoStatus: ServiceStatusEvent[];
  [key: string]: any;
} {
  const normalizedStatus = normalizeOSStatus(newStatus);
  const existingHistory: ServiceStatusEvent[] = Array.isArray(currentOrder?.historicoStatus)
    ? currentOrder.historicoStatus.map((item: any) => sanitizeFirestorePayload(item))
    : buildInitialStatusHistoryFromLegacy(currentOrder);

  // Avoid duplicate successive entries with exact same status within 1 minute
  const lastEntry = existingHistory[existingHistory.length - 1];
  const isDuplicate =
    lastEntry &&
    lastEntry.status === normalizedStatus &&
    Math.abs(new Date().getTime() - new Date(lastEntry.dataHora).getTime()) < 60000;

  const rawEntry = createStatusLogEntry(
    normalizedStatus,
    descricao,
    autor,
    extraPayload.etapaExecucao || currentOrder?.etapaExecucao
  );

  const updatedHistory = isDuplicate
    ? existingHistory
    : [...existingHistory, rawEntry];

  const payload = {
    ...extraPayload,
    status: normalizedStatus,
    historicoStatus: updatedHistory.map((item) => sanitizeFirestorePayload(item)),
    statusAtualizadoEm: new Date().toISOString(),
  };

  return sanitizeFirestorePayload(payload);
}

/**
 * Reconstructs initial history for pre-existing legacy service orders
 */
export function buildInitialStatusHistoryFromLegacy(order: any): ServiceStatusEvent[] {
  const events: ServiceStatusEvent[] = [];
  if (!order) return events;

  // 1. Initial creation
  if (order.createdAt) {
    const dStr = typeof order.createdAt === "object" && typeof order.createdAt.seconds === "number"
      ? new Date(order.createdAt.seconds * 1000).toISOString()
      : new Date(order.createdAt).toISOString();
    
    events.push({
      status: "Confirmação de Data",
      dataHora: dStr,
      dataHoraFormatada: formatDateTimeBR(dStr),
      descricao: "Solicitação registrada no sistema. Aguardando confirmação da data.",
      autor: order.clienteNome || "Solicitante",
      etapaExecucao: "pendente_atribuicao",
    });
  }

  // 2. Date confirmation
  if (order.dataConfirmadaEm || order.agendamentoAtualizadoEm || (order.dataConfirmada && order.status !== "Confirmação de Data")) {
    const dStr = order.dataConfirmadaEm || order.agendamentoAtualizadoEm || order.updatedAt || order.createdAt;
    const iso = dStr ? (typeof dStr === "object" && dStr.seconds ? new Date(dStr.seconds * 1000).toISOString() : new Date(dStr).toISOString()) : new Date().toISOString();
    events.push({
      status: "Data confirmada",
      dataHora: iso,
      dataHoraFormatada: formatDateTimeBR(iso),
      descricao: `Data confirmada para ${formatDateBR(order.dataConfirmada || order.dataAgendada)}${order.turnoAgendado ? ` (${order.turnoAgendado})` : ""}.`,
      autor: order.agendamentoConfirmadoPor || "Administrador",
      etapaExecucao: "atribuido",
    });
  }

  // 3. Displacement
  if (order.deslocamentoInicioEm || order.aceitoEm) {
    const dStr = order.deslocamentoInicioEm || order.aceitoEm;
    events.push({
      status: "Técnico a caminho",
      dataHora: dStr,
      dataHoraFormatada: formatDateTimeBR(dStr),
      descricao: `Técnico ${order.colaboradorNome || "prestador"} iniciou deslocamento para o local.`,
      autor: order.colaboradorNome || "Técnico Prestador",
      etapaExecucao: "deslocamento",
    });
  }

  // 4. Execution start
  if (order.inicioTrabalhoEm || order.fotosAntesEm) {
    const dStr = order.inicioTrabalhoEm || order.fotosAntesEm;
    events.push({
      status: "Em execução",
      dataHora: dStr,
      dataHoraFormatada: formatDateTimeBR(dStr),
      descricao: "Técnico no local e trabalhos técnicos em andamento.",
      autor: order.colaboradorNome || "Técnico Prestador",
      etapaExecucao: "em_execucao",
    });
  }

  // 5. Completion
  if (order.concluidoEm || order.assinaturaEm) {
    const dStr = order.concluidoEm || order.assinaturaEm;
    events.push({
      status: "Serviço Concluído",
      dataHora: dStr,
      dataHoraFormatada: formatDateTimeBR(dStr),
      descricao: "Serviço concluído com fotos carimbadas e termo assinado.",
      autor: order.colaboradorNome || "Técnico Prestador",
      etapaExecucao: "concluido",
    });
  }

  // 6. Cancellation
  if (order.canceladoEm) {
    events.push({
      status: order.status === "Cancelada pelo Cliente" ? "Cancelada pelo Cliente" : "Cancelado",
      dataHora: order.canceladoEm,
      dataHoraFormatada: formatDateTimeBR(order.canceladoEm),
      descricao: order.motivoCancelamento ? `Cancelado: ${order.motivoCancelamento}` : "Ordem de serviço cancelada.",
      autor: order.canceladoPor || "Usuário",
      etapaExecucao: "cancelado",
    });
  }

  return events;
}

/**
 * Returns visual layout attributes for any OS status
 */
export function getOSStatusVisualInfo(rawStatus?: string, orderData?: any) {
  const effectiveStatus = orderData ? getEffectiveOSStatus({ ...orderData, status: rawStatus }) : normalizeOSStatus(rawStatus);

  switch (effectiveStatus) {
    case "Confirmação de Data":
      return {
        key: "Confirmação de Data",
        label: "Confirmação de Data",
        stepNumber: 1,
        totalSteps: 6,
        badgeClass: "bg-amber-50 text-amber-900 border border-amber-200",
        badgeBg: "bg-amber-50",
        badgeText: "text-amber-900",
        badgeBorder: "border-amber-200",
        badgeDot: "bg-amber-500",
        accentColor: "text-amber-700",
        bgLight: "bg-amber-50/70",
        desc: "Sua solicitação de serviço foi registrada. A equipe administrativa está validando a data para confirmação da visita técnica.",
        highlightText: "Aguardando confirmação de data",
      };

    case "Data confirmada":
      return {
        key: "Data confirmada",
        label: "Data confirmada",
        stepNumber: 2,
        totalSteps: 6,
        badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",
        badgeBg: "bg-sky-50",
        badgeText: "text-sky-800",
        badgeBorder: "border-sky-200",
        badgeDot: "bg-sky-500",
        accentColor: "text-sky-700",
        bgLight: "bg-sky-50/70",
        desc: "Data e turno da visita técnica confirmados pela equipe. A ordem de serviço está agendada na escala operacional.",
        highlightText: "Visita técnica confirmada",
      };

    case "Dia de Execução Serviço":
      return {
        key: "Dia de Execução Serviço",
        label: "Dia de Execução Serviço",
        stepNumber: 3,
        totalSteps: 6,
        badgeClass: "bg-indigo-50 text-indigo-900 border border-indigo-200",
        badgeBg: "bg-indigo-50",
        badgeText: "text-indigo-900",
        badgeBorder: "border-indigo-200",
        badgeDot: "bg-indigo-600",
        accentColor: "text-indigo-700",
        bgLight: "bg-indigo-50/70",
        desc: "Chegou o dia agendado para realização do serviço. A equipe técnica iniciará o deslocamento em breve.",
        highlightText: "Dia do serviço programado",
      };

    case "Técnico a caminho":
      return {
        key: "Técnico a caminho",
        label: "Técnico a caminho",
        stepNumber: 4,
        totalSteps: 6,
        badgeClass: "bg-blue-50 text-blue-900 border border-blue-200",
        badgeBg: "bg-blue-50",
        badgeText: "text-blue-900",
        badgeBorder: "border-blue-200",
        badgeDot: "bg-blue-600",
        accentColor: "text-blue-700",
        bgLight: "bg-blue-50/70",
        desc: "O técnico prestador aceitou a ordem de serviço e está em trânsito com destino ao condomínio.",
        highlightText: "Técnico em deslocamento",
      };

    case "Em execução":
      return {
        key: "Em execução",
        label: "Em execução",
        stepNumber: 5,
        totalSteps: 6,
        badgeClass: "bg-amber-50 text-amber-900 border border-amber-300",
        badgeBg: "bg-amber-50",
        badgeText: "text-amber-900",
        badgeBorder: "border-amber-300",
        badgeDot: "bg-amber-600",
        accentColor: "text-amber-800",
        bgLight: "bg-amber-50/70",
        desc: "Técnico presente no condomínio executando os procedimentos e serviços contratados.",
        highlightText: "Serviço em execução no local",
      };

    case "Serviço Concluído":
      return {
        key: "Serviço Concluído",
        label: "Serviço Concluído",
        stepNumber: 6,
        totalSteps: 6,
        badgeClass: "bg-emerald-50 text-emerald-900 border border-emerald-300",
        badgeBg: "bg-emerald-50",
        badgeText: "text-emerald-900",
        badgeBorder: "border-emerald-300",
        badgeDot: "bg-emerald-600",
        accentColor: "text-emerald-700",
        bgLight: "bg-emerald-50/70",
        desc: "Serviço finalizado com sucesso. Evidências fotográficas arquivadas e termo de conclusão assinado.",
        highlightText: "Serviço concluído e assinado",
      };

    case "Cancelada pelo Cliente":
    case "Cancelado":
      return {
        key: "Cancelado",
        label: effectiveStatus === "Cancelada pelo Cliente" ? "Cancelada pelo Cliente" : "Cancelado",
        stepNumber: 0,
        totalSteps: 6,
        badgeClass: "bg-rose-50 text-rose-800 border border-rose-200",
        badgeBg: "bg-rose-50",
        badgeText: "text-rose-800",
        badgeBorder: "border-rose-200",
        badgeDot: "bg-rose-500",
        accentColor: "text-rose-700",
        bgLight: "bg-rose-50/70",
        desc: "Esta ordem de serviço foi cancelada no sistema.",
        highlightText: "Solicitação cancelada",
      };

    default:
      return {
        key: "Confirmação de Data",
        label: rawStatus || "Confirmação de Data",
        stepNumber: 1,
        totalSteps: 6,
        badgeClass: "bg-slate-100 text-slate-800 border border-slate-200",
        badgeBg: "bg-slate-100",
        badgeText: "text-slate-800",
        badgeBorder: "border-slate-200",
        badgeDot: "bg-slate-500",
        accentColor: "text-slate-700",
        bgLight: "bg-slate-50",
        desc: "Status em processamento.",
        highlightText: "Em atendimento",
      };
  }
}
