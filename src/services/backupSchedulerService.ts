import { db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { logAction } from "../lib/audit";

export interface BackupCollectionInfo {
  id: string;
  name: string;
  count: number;
}

export interface BackupScheduleConfig {
  ativo: boolean;
  frequencia: "a_cada_6h" | "a_cada_12h" | "diario" | "semanal" | "mensal";
  horario: string; // Ex: "03:00"
  diaSemana: number; // 0 (Domingo) a 6 (Sábado)
  diaMes: number; // 1 a 28/31
  colecoesSelecionadas: string[];
  incluirLogsAuditoria: boolean;
  notificarEmail: boolean;
  emailDestinatario?: string;
  retencaoDias: number;
  ultimaExecucao?: any;
  proximaExecucao?: any;
  statusUltimaExecucao?: "sucesso" | "falha" | "em_andamento";
  ultimoErro?: string;
  updatedAt?: any;
  updatedBy?: string;
}

export interface BackupLog {
  id?: string;
  status: "sucesso" | "falha" | "em_andamento";
  tipoDisparo: "agendado" | "manual" | "sistema";
  iniciadoEm: any;
  concluidoEm?: any;
  duracaoMs?: number;
  totalColecoes: number;
  totalRegistros: number;
  tamanhoBytesEstimado: number;
  colecoesDetalhadas: BackupCollectionInfo[];
  mensagem: string;
  erro?: string;
  executadoPor: string;
  snapshotId?: string;
}

export const ALL_BACKUP_COLLECTIONS: { id: string; name: string }[] = [
  { id: "users", name: "Usuários e Clientes" },
  { id: "config_empresa", name: "Cadastro Empresa Franqueada" },
  { id: "empregados", name: "Empregados / Colaboradores" },
  { id: "produtos", name: "Catálogo de Produtos" },
  { id: "categorias_produtos", name: "Categorias de Produtos" },
  { id: "kits_essenciais", name: "Kits Essenciais" },
  { id: "servicos_essenciais", name: "Serviços Essenciais" },
  { id: "ordens_servico", name: "Ordens de Serviço (OS)" },
  { id: "pedidos_venda", name: "Pedidos de Venda" },
  { id: "comissoes", name: "Comissões Comerciais" },
  { id: "codigos_indicacao", name: "Códigos de Indicação & Cupons" },
  { id: "visitas_crm", name: "Visitas Comerciais (CRM)" },
  { id: "fornecedores", name: "Fornecedores" },
  { id: "contas_pagar", name: "Contas a Pagar" },
  { id: "contas_receber", name: "Contas a Receber" },
  { id: "bancos", name: "Contas Bancárias & Caixas" },
  { id: "centros_custo", name: "Centros de Custo" },
  { id: "entregas", name: "Entregas & Expedição" },
  { id: "muralNotices", name: "Mural Condominial" },
  { id: "clube_beneficios", name: "Clube de Benefícios" },
  { id: "marcas_parceiras", name: "Marcas Parceiras" },
  { id: "regras_cashback", name: "Regras de Cashback" },
  { id: "afiliados_uc", name: "Afiliados União Condominial" },
  { id: "integracao_pagamentos", name: "Configurações de Pagamentos" },
  { id: "configuracao_frete", name: "Configurações de Frete" },
  { id: "configuracao_notificacoes", name: "Configurações de Notificações" },
  { id: "notificacoes_clientes", name: "Notificações de Clientes" },
  { id: "logs_sistema", name: "Logs de Auditoria" },
];

export const DEFAULT_SCHEDULE_CONFIG: BackupScheduleConfig = {
  ativo: true,
  frequencia: "diario",
  horario: "03:00",
  diaSemana: 0,
  diaMes: 1,
  colecoesSelecionadas: ALL_BACKUP_COLLECTIONS.map((c) => c.id),
  incluirLogsAuditoria: true,
  notificarEmail: true,
  emailDestinatario: "wegbusinessandsolutions@gmail.com",
  retencaoDias: 30,
  statusUltimaExecucao: "sucesso",
};

/**
 * Calcula a data e hora da próxima execução com base na configuração
 */
export function calculateNextRun(config: Partial<BackupScheduleConfig>): Date {
  const now = new Date();
  const [hoursStr, minsStr] = (config.horario || "03:00").split(":");
  const hours = parseInt(hoursStr, 10) || 3;
  const mins = parseInt(minsStr, 10) || 0;

  const next = new Date(now);
  next.setHours(hours, mins, 0, 0);

  if (config.frequencia === "a_cada_6h") {
    next.setTime(now.getTime() + 6 * 60 * 60 * 1000);
    return next;
  }

  if (config.frequencia === "a_cada_12h") {
    next.setTime(now.getTime() + 12 * 60 * 60 * 1000);
    return next;
  }

  if (config.frequencia === "diario") {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (config.frequencia === "semanal") {
    const targetDay = config.diaSemana ?? 0;
    let daysToAdd = (targetDay - now.getDay() + 7) % 7;
    if (daysToAdd === 0 && next <= now) {
      daysToAdd = 7;
    }
    next.setDate(now.getDate() + daysToAdd);
    return next;
  }

  if (config.frequencia === "mensal") {
    const targetDate = config.diaMes ?? 1;
    next.setDate(targetDate);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  // Padrão: amanhã no horário
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Obtém a configuração de agendamento do Firestore
 */
export async function getBackupScheduleConfig(): Promise<BackupScheduleConfig> {
  try {
    const docRef = doc(db, "configuracao_backup", "principal");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as BackupScheduleConfig;
      return {
        ...DEFAULT_SCHEDULE_CONFIG,
        ...data,
      };
    }

    // Se não existir, inicializa com os padrões
    const initialConfig: BackupScheduleConfig = {
      ...DEFAULT_SCHEDULE_CONFIG,
      proximaExecucao: calculateNextRun(DEFAULT_SCHEDULE_CONFIG),
    };
    await setDoc(docRef, {
      ...initialConfig,
      updatedAt: serverTimestamp(),
    });
    return initialConfig;
  } catch (error) {
    console.warn("Erro ao buscar configuração de backup do Firestore:", error);
    return DEFAULT_SCHEDULE_CONFIG;
  }
}

/**
 * Salva a configuração de agendamento no Firestore
 */
export async function saveBackupScheduleConfig(
  config: BackupScheduleConfig,
  userName: string = "Administrador"
): Promise<void> {
  const docRef = doc(db, "configuracao_backup", "principal");
  const proxima = calculateNextRun(config);

  const payload = {
    ...config,
    proximaExecucao: Timestamp.fromDate(proxima),
    updatedAt: serverTimestamp(),
    updatedBy: userName,
  };

  await setDoc(docRef, payload, { merge: true });

  await logAction(
    `Configuração de agendamento de backups atualizada (Frequência: ${config.frequencia}, Ativo: ${config.ativo ? "Sim" : "Não"})`,
    "Sistema",
    {
      updatedBy: userName,
      frequencia: config.frequencia,
      horario: config.horario,
      totalColecoes: config.colecoesSelecionadas.length,
      ativo: config.ativo,
    }
  );
}

/**
 * Executa a rotina completa de backup das coleções do Firestore
 */
export async function executeBackupRoutine(
  tipoDisparo: "agendado" | "manual" | "sistema" = "manual",
  executedBy: string = "Administrador",
  customCollections?: string[]
): Promise<{ success: boolean; log: BackupLog; backupData?: any }> {
  const startTime = Date.now();
  const iniciadoEm = new Date();

  // 1. Cria o log inicial em status 'em_andamento'
  let logDocRef: any = null;
  try {
    logDocRef = await addDoc(collection(db, "logs_backup"), {
      status: "em_andamento",
      tipoDisparo,
      iniciadoEm: Timestamp.fromDate(iniciadoEm),
      totalColecoes: 0,
      totalRegistros: 0,
      tamanhoBytesEstimado: 0,
      colecoesDetalhadas: [],
      mensagem: "Iniciando processamento e extração de coleções do Firestore...",
      executadoPor: executedBy,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("Não foi possível criar log inicial de backup:", e);
  }

  try {
    // 2. Determina coleções a processar
    let collectionsToProcess = customCollections;
    let config: BackupScheduleConfig | null = null;

    if (!collectionsToProcess || collectionsToProcess.length === 0) {
      config = await getBackupScheduleConfig();
      collectionsToProcess = config.colecoesSelecionadas || ALL_BACKUP_COLLECTIONS.map((c) => c.id);
    }

    const backupPayload: Record<string, any> = {
      _metadata: {
        versao: "2.0",
        geradoEm: iniciadoEm.toISOString(),
        tipoDisparo,
        executadoPor: executedBy,
        sistema: "União Condominial.GO",
      },
      collections: {},
    };

    const detailedList: BackupCollectionInfo[] = [];
    let totalRecordsCount = 0;

    // 3. Executa a leitura de cada coleção
    for (const colId of collectionsToProcess) {
      const meta = ALL_BACKUP_COLLECTIONS.find((c) => c.id === colId) || { id: colId, name: colId };
      try {
        const snap = await getDocs(collection(db, colId));
        const docsData = snap.docs.map((d) => ({
          _docId: d.id,
          ...d.data(),
        }));

        backupPayload.collections[colId] = {
          id: colId,
          name: meta.name,
          count: snap.size,
          data: docsData,
        };

        detailedList.push({
          id: colId,
          name: meta.name,
          count: snap.size,
        });

        totalRecordsCount += snap.size;
      } catch (err: any) {
        console.warn(`Aviso ao ler coleção ${colId}:`, err);
        detailedList.push({
          id: colId,
          name: meta.name,
          count: 0,
        });
      }
    }

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const sizeBytes = new Blob([jsonString]).size;
    const duracaoMs = Date.now() - startTime;
    const concluidoEm = new Date();

    // 4. Salva snapshot de backup para histórico/restauração se couber ou referencia
    let snapshotId = undefined;
    try {
      // Salva snapshot resumido e comprimido se possível
      const snapDoc = await addDoc(collection(db, "backups_agendados_snapshots"), {
        tipoDisparo,
        geradoEm: Timestamp.fromDate(concluidoEm),
        totalColecoes: detailedList.length,
        totalRegistros: totalRecordsCount,
        tamanhoBytes: sizeBytes,
        executadoPor: executedBy,
        metadata: backupPayload._metadata,
        colecoesResumo: detailedList,
        createdAt: serverTimestamp(),
      });
      snapshotId = snapDoc.id;
    } catch (errSnap) {
      console.warn("Não foi possível salvar documento em backups_agendados_snapshots:", errSnap);
    }

    const mensagemSucesso = `Backup de ${detailedList.length} coleções com ${totalRecordsCount} documentos concluído com sucesso em ${(duracaoMs / 1000).toFixed(1)}s.`;

    const completedLog: BackupLog = {
      status: "sucesso",
      tipoDisparo,
      iniciadoEm: Timestamp.fromDate(iniciadoEm),
      concluidoEm: Timestamp.fromDate(concluidoEm),
      duracaoMs,
      totalColecoes: detailedList.length,
      totalRegistros: totalRecordsCount,
      tamanhoBytesEstimado: sizeBytes,
      colecoesDetalhadas: detailedList,
      mensagem: mensagemSucesso,
      executadoPor: executedBy,
      snapshotId,
    };

    // 5. Atualiza o documento de log no Firestore
    if (logDocRef) {
      await updateDoc(logDocRef, {
        ...completedLog,
        updatedAt: serverTimestamp(),
      });
    }

    // 6. Atualiza a configuração principal de agendamento
    try {
      const currentConfig = config || (await getBackupScheduleConfig());
      const nextDate = calculateNextRun(currentConfig);
      await updateDoc(doc(db, "configuracao_backup", "principal"), {
        ultimaExecucao: Timestamp.fromDate(concluidoEm),
        proximaExecucao: Timestamp.fromDate(nextDate),
        statusUltimaExecucao: "sucesso",
        ultimoErro: null,
      });
    } catch (errCfg) {
      console.warn("Não foi possível atualizar status na configuracao_backup:", errCfg);
    }

    // 7. Salva na trilha de auditoria
    await logAction(
      mensagemSucesso,
      "Sistema",
      {
        tipoDisparo,
        executadoPor: executedBy,
        totalColecoes: detailedList.length,
        totalRegistros: totalRecordsCount,
        tamanhoBytes: sizeBytes,
        duracaoMs,
      }
    );

    // 8. Opcional: Limpeza de logs antigos conforme dias de retenção
    try {
      const retencaoDias = config?.retencaoDias || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retencaoDias);

      const oldLogsQuery = query(
        collection(db, "logs_backup"),
        where("iniciadoEm", "<", Timestamp.fromDate(cutoffDate)),
        limit(20)
      );
      const oldLogsSnap = await getDocs(oldLogsQuery);
      await Promise.all(oldLogsSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (errPurge) {
      console.warn("Aviso na limpeza de logs de retenção:", errPurge);
    }

    return {
      success: true,
      log: { id: logDocRef?.id, ...completedLog },
      backupData: backupPayload,
    };
  } catch (error: any) {
    console.error("Erro durante a execução do backup:", error);
    const duracaoMs = Date.now() - startTime;
    const errorMsg = error?.message || "Erro desconhecido durante a extração dos dados.";

    const failedLog: BackupLog = {
      status: "falha",
      tipoDisparo,
      iniciadoEm: Timestamp.fromDate(iniciadoEm),
      concluidoEm: Timestamp.fromDate(new Date()),
      duracaoMs,
      totalColecoes: 0,
      totalRegistros: 0,
      tamanhoBytesEstimado: 0,
      colecoesDetalhadas: [],
      mensagem: `Falha ao processar backup: ${errorMsg}`,
      erro: errorMsg,
      executadoPor: executedBy,
    };

    if (logDocRef) {
      await updateDoc(logDocRef, {
        ...failedLog,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await updateDoc(doc(db, "configuracao_backup", "principal"), {
        ultimaExecucao: Timestamp.fromDate(new Date()),
        statusUltimaExecucao: "falha",
        ultimoErro: errorMsg,
      });
    } catch (e) {
      // ignore
    }

    return {
      success: false,
      log: { id: logDocRef?.id, ...failedLog },
    };
  }
}
