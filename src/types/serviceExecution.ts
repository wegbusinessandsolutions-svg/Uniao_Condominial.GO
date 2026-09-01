/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ServicePhoto {
  id: string;
  url: string;
  legenda?: string;
  tiradaEm: string; // ISO
  fase: "antes" | "depois";
  tamanhoBytes?: number;
}

export interface ServiceSignature {
  nome: string;
  cargoOuFuncao: "Síndico(a)" | "Subsíndico(a)" | "Zelador(a)" | "Gerente Predial" | "Membro do Conselho" | "Morador Autorizado" | "Outro";
  cargoPersonalizado?: string;
  documento: string; // RG ou CPF
  telefone?: string;
  email?: string;
  assinaturaBase64: string; // Data URL PNG/JPEG
  assinadoEm: string; // ISO
  termoCienciaAceito: boolean;
}

export type ServiceExecutionStep = 
  | "pendente_atribuicao"   // Criada mas sem colaborador
  | "atribuido"             // Colaborador designado, aguardando aceite
  | "deslocamento"          // Colaborador aceitou e está a caminho
  | "chegou_local"          // Colaborador chegou no condomínio
  | "fotos_antes"           // Tirando as 3 fotos obrigatórias antes
  | "em_execucao"           // Trabalho técnico em andamento
  | "fotos_depois"          // Tirando as 3 fotos obrigatórias depois
  | "aguardando_assinatura" // Trabalho finalizado, coletando assinatura
  | "concluido"             // Assinado e finalizado com sucesso
  | "cancelado";

export interface RoutineServiceOrder {
  id: string;
  numeroOS?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  nomeCondominio?: string;
  enderecoCondominio?: string;
  numeroCondominio?: string;
  bairroCondominio?: string;
  cidadeCondominio?: string;
  telefoneContato?: string;
  nomeResponsavelLocal?: string;
  
  // Serviço Contratado
  servicoId?: string;
  servicoCodigo?: string;
  servicoNome?: string;
  servicoDescricao?: string;
  servicoValor?: number | string;
  prazoPrevistoHoras?: number | string;
  preRequisitos?: string;

  // Agendamento
  dataAgendada?: string; // YYYY-MM-DD
  dataConfirmada?: string;
  turnoAgendado?: string; // "Manhã (08:00 às 12:00)", "Tarde (13:00 às 17:00)", etc.
  prioridade?: "Normal" | "Urgente" | "Crítica";
  ordemFila?: number; // Ordem de execução do colaborador no dia (1, 2, 3...)

  // Colaborador / Responsável Designado
  colaboradorId?: string;
  colaboradorNome?: string;
  colaboradorEmail?: string;
  colaboradorTelefone?: string;
  colaboradorCargo?: string;
  colaboradorFoto?: string;

  // Fluxo de Execução e Status
  status: string;
  etapaExecucao: ServiceExecutionStep;

  // Timestamps de Monitoria Interna (Recebimento, Aceite, Chegada, Início, Conclusão)
  createdAt?: any;
  updatedAt?: string;
  recebidoEm?: string; // ISO - Momento em que o colaborador recebe/é designado a OS
  designadoEm?: string; // ISO
  designadoPor?: string;
  aceitoEm?: string; // ISO - Momento em que o colaborador aceita a OS e inicia deslocamento
  deslocamentoInicioEm?: string; // ISO
  chegadaEm?: string; // ISO - Momento em que o colaborador chega ao condomínio
  chegadaLocalizacao?: {
    latitude: number;
    longitude: number;
    precisaoMetros?: number;
  };
  fotosAntesEm?: string; // ISO - Momento em que as 3 fotos iniciais são confirmadas
  inicioTrabalhoEm?: string; // ISO - Momento em que os trabalhos técnicos efetivamente começam
  pausaLogs?: Array<{
    pausadoEm: string;
    retomadoEm?: string;
    motivo: string;
  }>;
  fotosDepoisEm?: string; // ISO - Momento em que as 3 fotos finais são confirmadas
  assinaturaEm?: string; // ISO - Momento em que o responsável assina digitalmente
  concluidoEm?: string; // ISO - Momento em que a OS é 100% concluída e finalizada

  // Evidências Fotográficas (Mínimo de 3 Obrigatório)
  fotosAntes: ServicePhoto[];
  fotosDepois: ServicePhoto[];

  // Anotações e Materiais
  observacoesTecnicas?: string;
  materiaisUtilizados?: string;
  recomendacoesFuturas?: string;

  // Assinatura do Responsável do Condomínio
  assinaturaResponsavel?: ServiceSignature;

  // Auditoria Interna de Tempos (Calculados para Gestão)
  metricasInternas?: {
    tempoRecebimentoParaAceiteMinutos: number; // recebido/designado -> aceito
    tempoReacaoMinutos: number;                // designado -> aceito
    tempoDeslocamentoMinutos: number;          // aceito -> chegada
    tempoVistoriaAntesMinutos: number;         // chegada -> início do trabalho / fotos antes
    tempoExecucaoMinutos: number;              // início do trabalho -> conclusão física / fotos depois
    tempoAssinaturaMinutos: number;            // fotos depois -> assinatura & conclusão
    tempoTotalCicloMinutos: number;            // recebido/aceito -> concluído
    slaStatus: "no_prazo" | "atencao" | "atrasado";
    desvioHorasPrevistas?: number;
    previstoMinutos?: number;
  };

  proximaOSId?: string; // ID da próxima OS sugerida
}

/**
 * Returns descriptive presentation info and step index for a given execution step
 */
export function getExecutionStepInfo(etapa: ServiceExecutionStep): {
  label: string;
  stepNumber: number;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  switch (etapa) {
    case "pendente_atribuicao":
      return {
        label: "Pendente de Atribuição",
        stepNumber: 0,
        badgeBg: "bg-amber-500/20 border-amber-500/30",
        badgeText: "text-amber-400",
        description: "Aguardando definição de técnico prestador",
      };
    case "atribuido":
      return {
        label: "OS Atribuída",
        stepNumber: 1,
        badgeBg: "bg-blue-500/20 border-blue-500/30",
        badgeText: "text-blue-400",
        description: "Aguardando aceite e início do deslocamento",
      };
    case "deslocamento":
      return {
        label: "Em Deslocamento",
        stepNumber: 2,
        badgeBg: "bg-cyan-500/20 border-cyan-500/30",
        badgeText: "text-cyan-400",
        description: "Prestador em trânsito para o condomínio",
      };
    case "chegou_local":
    case "fotos_antes":
      return {
        label: "Vistoria Inicial (Fotos)",
        stepNumber: 3,
        badgeBg: "bg-yellow-500/20 border-yellow-500/30",
        badgeText: "text-yellow-400",
        description: "Chegou ao local — registrando 3 fotos iniciais com marca d'água",
      };
    case "em_execucao":
      return {
        label: "Em Execução",
        stepNumber: 4,
        badgeBg: "bg-indigo-500/20 border-indigo-500/30",
        badgeText: "text-indigo-400",
        description: "Serviço físico em andamento no condomínio",
      };
    case "fotos_depois":
      return {
        label: "Vistoria Final (Fotos)",
        stepNumber: 5,
        badgeBg: "bg-purple-500/20 border-purple-500/30",
        badgeText: "text-purple-400",
        description: "Serviço concluído — registrando 3 fotos finais com marca d'água",
      };
    case "aguardando_assinatura":
      return {
        label: "Coleta de Assinatura",
        stepNumber: 6,
        badgeBg: "bg-orange-500/20 border-orange-500/30",
        badgeText: "text-orange-400",
        description: "Aguardando assinatura digital do responsável",
      };
    case "concluido":
      return {
        label: "Concluído",
        stepNumber: 7,
        badgeBg: "bg-emerald-500/20 border-emerald-500/30",
        badgeText: "text-emerald-400",
        description: "Serviço 100% finalizado com fotos, relatório e assinatura",
      };
    case "cancelado":
      return {
        label: "Cancelado",
        stepNumber: -1,
        badgeBg: "bg-rose-500/20 border-rose-500/30",
        badgeText: "text-rose-400",
        description: "Ordem de serviço cancelada",
      };
    default:
      return {
        label: "Em Andamento",
        stepNumber: 1,
        badgeBg: "bg-slate-500/20 border-slate-500/30",
        badgeText: "text-slate-400",
        description: "Processamento de serviço",
      };
  }
}

/**
 * Computes internal operational SLA metrics and duration timestamps for auditing
 */
export function computeOrderInternalMetrics(order: RoutineServiceOrder): RoutineServiceOrder["metricasInternas"] {
  const getDiffMinutes = (startIso?: string, endIso?: string): number => {
    if (!startIso || !endIso) return 0;
    try {
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      if (isNaN(start) || isNaN(end) || end < start) return 0;
      return Math.round((end - start) / (1000 * 60));
    } catch {
      return 0;
    }
  };

  const tempoRecebimentoParaAceiteMinutos = getDiffMinutes(
    order.designadoEm || order.recebidoEm || order.createdAt,
    order.aceitoEm
  );

  const tempoReacaoMinutos = tempoRecebimentoParaAceiteMinutos;

  const tempoDeslocamentoMinutos = getDiffMinutes(
    order.deslocamentoInicioEm || order.aceitoEm,
    order.chegadaEm
  );

  const tempoVistoriaAntesMinutos = getDiffMinutes(
    order.chegadaEm,
    order.fotosAntesEm || order.inicioTrabalhoEm
  );

  const tempoExecucaoMinutos = getDiffMinutes(
    order.inicioTrabalhoEm,
    order.fotosDepoisEm || order.concluidoEm
  );

  const tempoAssinaturaMinutos = getDiffMinutes(
    order.fotosDepoisEm,
    order.assinaturaEm || order.concluidoEm
  );

  const tempoTotalCicloMinutos = getDiffMinutes(
    order.aceitoEm || order.recebidoEm || order.createdAt,
    order.concluidoEm || order.assinaturaEm
  );

  const previstoHoras = Number(order.prazoPrevistoHoras) || 2;
  const previstoMinutos = previstoHoras * 60;
  const desvioHorasPrevistas = tempoExecucaoMinutos > 0
    ? Number(((tempoExecucaoMinutos - previstoMinutos) / 60).toFixed(2))
    : 0;

  let slaStatus: "no_prazo" | "atencao" | "atrasado" = "no_prazo";
  if (tempoExecucaoMinutos > previstoMinutos * 1.2) {
    slaStatus = "atrasado";
  } else if (tempoExecucaoMinutos > previstoMinutos) {
    slaStatus = "atencao";
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
    desvioHorasPrevistas,
    previstoMinutos,
  };
}
