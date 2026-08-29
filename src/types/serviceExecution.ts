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
