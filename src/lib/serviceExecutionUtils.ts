/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoutineServiceOrder, ServiceExecutionStep } from "../types/serviceExecution";
import { formatDateTimeBR } from "./dateUtils";

export { formatDateTimeBR };

/**
 * Formats minutes into human-readable duration (e.g., "1h 35min" or "45min")
 */
export function formatMinutes(minutes?: number | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) {
    return "0 min";
  }
  const totalMin = Math.round(minutes);
  if (totalMin < 60) {
    return `${totalMin} min`;
  }
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

/**
 * Calculates duration in minutes between two ISO date strings or Timestamps
 */
export function calculateMinutesBetween(startIso?: any, endIso?: any): number {
  if (!startIso || !endIso) return 0;
  const getMs = (val: any) => {
    if (typeof val === "object" && typeof val?.seconds === "number") return val.seconds * 1000;
    if (typeof val === "object" && typeof val?.toDate === "function") return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    const t = new Date(val).getTime();
    return isNaN(t) ? 0 : t;
  };
  const start = getMs(startIso);
  const end = getMs(endIso);
  if (!start || !end || end < start) return 0;
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Formats time from ISO string to HH:mm (e.g. "14:32")
 */
export function formatTimeHM(isoString?: any): string {
  if (!isoString) return "--:--";
  try {
    let d: Date;
    if (typeof isoString === "object" && typeof isoString?.seconds === "number") {
      d = new Date(isoString.seconds * 1000);
    } else if (typeof isoString === "object" && typeof isoString?.toDate === "function") {
      d = isoString.toDate();
    } else if (isoString instanceof Date) {
      d = isoString;
    } else {
      d = new Date(isoString);
    }
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

/**
 * Computes all internal monitoring metrics for a routine service order
 * Tracking the 5 core milestones:
 * 1. Recebimento (recebidoEm / designadoEm)
 * 2. Aceite (aceitoEm)
 * 3. Chegada no Local (chegadaEm)
 * 4. Início dos Trabalhos (inicioTrabalhoEm / fotosAntesEm)
 * 5. Conclusão & Assinatura (concluidoEm / assinaturaEm)
 */
export function computeOrderInternalMetrics(order: Partial<RoutineServiceOrder>) {
  const tempoRecebimentoParaAceiteMinutos = calculateMinutesBetween(
    order.recebidoEm || order.designadoEm || (order.createdAt ? (typeof order.createdAt === "string" ? order.createdAt : new Date().toISOString()) : undefined),
    order.aceitoEm
  );
  const tempoReacaoMinutos = tempoRecebimentoParaAceiteMinutos;
  const tempoDeslocamentoMinutos = calculateMinutesBetween(
    order.deslocamentoInicioEm || order.aceitoEm,
    order.chegadaEm
  );
  const tempoVistoriaAntesMinutos = calculateMinutesBetween(
    order.chegadaEm,
    order.fotosAntesEm || order.inicioTrabalhoEm
  );
  const tempoExecucaoMinutos = calculateMinutesBetween(
    order.inicioTrabalhoEm || order.fotosAntesEm,
    order.fotosDepoisEm || order.concluidoEm
  );
  const tempoAssinaturaMinutos = calculateMinutesBetween(
    order.fotosDepoisEm || order.inicioTrabalhoEm,
    order.concluidoEm || order.assinaturaEm
  );
  const tempoTotalCicloMinutos = calculateMinutesBetween(
    order.recebidoEm || order.designadoEm || order.aceitoEm,
    order.concluidoEm
  );

  // Prazo previsto em minutos
  let previstoMinutos = 120; // padrão 2 horas
  if (order.prazoPrevistoHoras) {
    const num = Number(order.prazoPrevistoHoras);
    if (!isNaN(num) && num > 0) {
      previstoMinutos = num * 60;
    }
  }

  let slaStatus: "no_prazo" | "atencao" | "atrasado" = "no_prazo";
  if (tempoExecucaoMinutos > 0) {
    if (tempoExecucaoMinutos <= previstoMinutos) {
      slaStatus = "no_prazo";
    } else if (tempoExecucaoMinutos <= previstoMinutos * 1.25) {
      slaStatus = "atencao";
    } else {
      slaStatus = "atrasado";
    }
  }

  return {
    tempoRecebimentoParaAceiteMinutos,
    tempoReacaoMinutos,
    tempoDeslocamentoMinutos,
    tempoVistoriaAntesMinutos,
    tempoExecucaoMinutos,
    tempoAssinaturaMinutos,
    tempoTotalCicloMinutos,
    slaStatus,
    previstoMinutos,
    desvioHorasPrevistas: tempoExecucaoMinutos > 0 ? (tempoExecucaoMinutos - previstoMinutos) / 60 : 0
  };
}

/**
 * Returns user-facing execution stage details for technician & management
 */
export function getExecutionStepInfo(step?: ServiceExecutionStep | string) {
  switch (step) {
    case "pendente_atribuicao":
      return {
        stepNumber: 0,
        title: "Aguardando Designação",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
        description: "Serviço aprovado, aguardando definição do colaborador/responsável.",
      };
    case "atribuido":
      return {
        stepNumber: 1,
        title: "Novo Serviço Designado",
        badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
        description: "Designado ao colaborador. Aguardando confirmação e início do deslocamento.",
      };
    case "deslocamento":
      return {
        stepNumber: 2,
        title: "Em Deslocamento",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
        description: "Colaborador a caminho do condomínio solicitante.",
      };
    case "chegou_local":
    case "fotos_antes":
      return {
        stepNumber: 3,
        title: "Chegou no Condomínio / 4 Fotos Iniciais",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
        description: "No local realizando vistoria preliminar e registrando as 4 fotos obrigatórias.",
      };
    case "em_execucao":
      return {
        stepNumber: 4,
        title: "Trabalho em Execução",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        description: "Serviço rotineiro em andamento conforme escopo técnico.",
      };
    case "fotos_depois":
      return {
        stepNumber: 5,
        title: "Vistoria Final / 4 Fotos Conclusão",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
        description: "Trabalho concluído. Registrando as 4 fotos comprobatórias obrigatórias.",
      };
    case "aguardando_assinatura":
      return {
        stepNumber: 6,
        title: "Coletando Assinatura",
        badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
        description: "Colhendo a assinatura digital do responsável pelo condomínio.",
      };
    case "concluido":
      return {
        stepNumber: 7,
        title: "Serviço Concluído & Assinado",
        badgeColor: "bg-green-100 text-green-800 border-green-300",
        description: "Ordem de serviço finalizada com evidências e termo assinado.",
      };
    case "cancelado":
      return {
        stepNumber: -1,
        title: "Cancelada",
        badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
        description: "Ordem de serviço cancelada.",
      };
    default:
      return {
        stepNumber: 1,
        title: "Pendente",
        badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
        description: "Status em processamento.",
      };
  }
}

/**
 * Calculates remaining time for the technician to edit a service order within 8 hours of completion
 */
export function getOrderEditTimeRemaining(order: RoutineServiceOrder): {
  canEdit: boolean;
  remainingMs: number;
  remainingHours: number;
  remainingMinutes: number;
  formattedRemaining: string;
  deadlineIso?: string;
  conclusionDate?: string;
} {
  if (order.status !== "Serviço Concluído" && order.etapaExecucao !== "concluido") {
    return {
      canEdit: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      formattedRemaining: "Serviço não finalizado",
    };
  }

  const completionIso =
    order.concluidoEm || order.assinaturaEm || (order as any).dataConclusao || order.updatedAt;

  if (!completionIso) {
    return {
      canEdit: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      formattedRemaining: "Data de conclusão não identificada",
    };
  }

  const completionDate = new Date(completionIso);
  const completionTimestamp = completionDate.getTime();
  if (isNaN(completionTimestamp)) {
    return {
      canEdit: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      formattedRemaining: "Data de conclusão inválida",
    };
  }

  const deadlineTime = completionTimestamp + 8 * 60 * 60 * 1000;
  const remainingMs = deadlineTime - Date.now();
  const canEdit = remainingMs > 0;

  if (!canEdit) {
    return {
      canEdit: false,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      formattedRemaining: "Prazo de 8 horas expirado",
      deadlineIso: new Date(deadlineTime).toISOString(),
      conclusionDate: completionIso,
    };
  }

  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  const formattedRemaining = `${remainingHours}h ${remainingMinutes.toString().padStart(2, "0")}min restantes`;

  return {
    canEdit: true,
    remainingMs,
    remainingHours,
    remainingMinutes,
    formattedRemaining,
    deadlineIso: new Date(deadlineTime).toISOString(),
    conclusionDate: completionIso,
  };
}
