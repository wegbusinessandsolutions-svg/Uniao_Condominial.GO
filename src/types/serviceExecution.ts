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
  designadoEm?: string; // ISO
  designadoPor?: string;

  // Fluxo de Execução e Status
  status: string;
  etapaExecucao: ServiceExecutionStep;

  // Timestamps de Monitoria Interna
  createdAt?: any;
  aceitoEm?: string; // ISO
  deslocamentoInicioEm?: string; // ISO
  chegadaEm?: string; // ISO
  chegadaLocalizacao?: {
    latitude: number;
    longitude: number;
    precisaoMetros?: number;
  };
  fotosAntesEm?: string; // ISO
  inicioTrabalhoEm?: string; // ISO
  pausaLogs?: Array<{
    pausadoEm: string;
    retomadoEm?: string;
    motivo: string;
  }>;
  fotosDepoisEm?: string; // ISO
  assinaturaEm?: string; // ISO
  concluidoEm?: string; // ISO

  // Evidências Fotográficas (Mínimo de 3 Obrigatório)
  fotosAntes: ServicePhoto[];
  fotosDepois: ServicePhoto[];

  // Anotações e Materiais
  observacoesTecnicas?: string;
  materiaisUtilizados?: string;
  recomendacoesFuturas?: string;

  // Assinatura do Responsável do Condomínio
  assinaturaResponsavel?: ServiceSignature;

  // Auditoria Interna de Tempos (Calculados)
  metricasInternas?: {
    tempoReacaoMinutos: number;       // designado -> aceito
    tempoDeslocamentoMinutos: number; // aceito -> chegada
    tempoVistoriaAntesMinutos: number;// chegada -> fotosAntes completas
    tempoExecucaoMinutos: number;     // inicioTrabalho -> fotosDepois completas
    tempoAssinaturaMinutos: number;   // fotosDepois -> assinatura/conclusão
    tempoTotalCicloMinutos: number;   // aceito -> concluído
    slaStatus: "no_prazo" | "atencao" | "atrasado";
    desvioHorasPrevistas?: number;
  };

  proximaOSId?: string; // ID da próxima OS sugerida
}
