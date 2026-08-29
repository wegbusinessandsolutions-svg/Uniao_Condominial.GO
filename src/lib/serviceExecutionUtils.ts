/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoutineServiceOrder, ServiceExecutionStep } from "../types/serviceExecution";

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
 * Calculates duration in minutes between two ISO date strings
 */
export function calculateMinutesBetween(startIso?: string, endIso?: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Formats time from ISO string to HH:mm (e.g. "14:32")
 */
export function formatTimeHM(isoString?: string): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

/**
 * Formats datetime from ISO string to DD/MM/YYYY HH:mm
 */
export function formatDateTimeBR(isoString?: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/**
 * Computes all internal monitoring metrics for a routine service order
 */
export function computeOrderInternalMetrics(order: Partial<RoutineServiceOrder>) {
  const tempoReacaoMinutos = calculateMinutesBetween(order.designadoEm, order.aceitoEm);
  const tempoDeslocamentoMinutos = calculateMinutesBetween(order.deslocamentoInicioEm || order.aceitoEm, order.chegadaEm);
  const tempoVistoriaAntesMinutos = calculateMinutesBetween(order.chegadaEm, order.fotosAntesEm || order.inicioTrabalhoEm);
  const tempoExecucaoMinutos = calculateMinutesBetween(order.inicioTrabalhoEm, order.fotosDepoisEm || order.concluidoEm);
  const tempoAssinaturaMinutos = calculateMinutesBetween(order.fotosDepoisEm || order.inicioTrabalhoEm, order.concluidoEm);
  const tempoTotalCicloMinutos = calculateMinutesBetween(order.aceitoEm || order.designadoEm, order.concluidoEm);

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
    tempoReacaoMinutos,
    tempoDeslocamentoMinutos,
    tempoVistoriaAntesMinutos,
    tempoExecucaoMinutos,
    tempoAssinaturaMinutos,
    tempoTotalCicloMinutos,
    slaStatus,
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
        title: "Chegou no Condomínio / Fotos Iniciais",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
        description: "No local realizando vistoria preliminar e registrando as 3 fotos obrigatórias.",
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
        title: "Vistoria Final / 3 Fotos Conclusão",
        badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
        description: "Trabalho concluído. Registrando as 3 fotos obrigatórias de comprovação.",
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
