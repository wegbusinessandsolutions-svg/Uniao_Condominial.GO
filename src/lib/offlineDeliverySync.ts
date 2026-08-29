import { useEffect, useState, useCallback } from "react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initFirebase } from "./firebase";
import { logAction } from "./audit";
import { registrarMudancaStatusPedido } from "./orderLogger";

export interface OfflineSyncAction {
  id: string;
  type: "CONFIRM_ARRIVAL" | "START_ROUTE" | "COMPLETE_DELIVERY" | "OCCURRENCE_DELIVERY";
  entregaId: string;
  pedidoId?: string;
  payload: any;
  createdAt: string;
}

const CACHE_STORAGE_KEY = "ENTREGAS_OFFLINE_CACHE_V1";
const SYNC_QUEUE_STORAGE_KEY = "ENTREGAS_PENDING_SYNC_QUEUE_V1";
const LAST_SYNC_KEY = "ENTREGAS_LAST_SYNC_TIMESTAMP";

/**
 * Saves full delivery list into local cache for offline retrieval
 */
export function cacheDeliveries(deliveries: any[]): void {
  try {
    if (!deliveries || !Array.isArray(deliveries)) return;
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(deliveries));
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (err) {
    console.warn("Falha ao salvar cache de entregas:", err);
  }
}

/**
 * Retrieves cached deliveries from localStorage
 */
export function getCachedDeliveries(): { items: any[]; lastSync: string | null } {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    const lastSync = localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return { items: [], lastSync };
    const items = JSON.parse(raw);
    return { items: Array.isArray(items) ? items : [], lastSync };
  } catch (err) {
    console.warn("Falha ao ler cache de entregas:", err);
    return { items: [], lastSync: null };
  }
}

/**
 * Optimistically updates a delivery item in the local offline cache
 */
export function applyOptimisticDeliveryUpdate(entregaId: string, updates: Partial<any>): any[] {
  try {
    const { items } = getCachedDeliveries();
    const updated = items.map((item) => {
      if (item.id === entregaId) {
        return {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString(),
          _isOfflineModified: true,
        };
      }
      return item;
    });
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Falha ao aplicar update otimista no cache:", err);
    return [];
  }
}

/**
 * Retrieves list of pending sync actions
 */
export function getPendingSyncActions(): OfflineSyncAction[] {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const queue = JSON.parse(raw);
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    console.warn("Falha ao ler fila de sincronização:", err);
    return [];
  }
}

/**
 * Adds an action to the persistent offline synchronization queue
 */
export function queueOfflineAction(action: Omit<OfflineSyncAction, "id" | "createdAt">): OfflineSyncAction {
  const newAction: OfflineSyncAction = {
    ...action,
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const current = getPendingSyncActions();
    const filtered = current.filter(
      (a) => !(a.entregaId === newAction.entregaId && a.type === newAction.type)
    );
    filtered.push(newAction);
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Falha ao enfileirar ação offline:", err);
  }

  return newAction;
}

/**
 * Removes a specific sync action by ID
 */
export function removePendingSyncAction(actionId: string): void {
  try {
    const current = getPendingSyncActions();
    const filtered = current.filter((a) => a.id !== actionId);
    localStorage.setItem(SYNC_QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Falha ao remover item da fila:", err);
  }
}

/**
 * Synchronizes all pending offline actions to Firestore
 */
export async function syncPendingActions(
  onProgress?: (current: number, total: number) => void
): Promise<{ success: number; failed: number; total: number }> {
  const queue = getPendingSyncActions();
  if (queue.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  try {
    const { db } = await initFirebase();

    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      if (onProgress) onProgress(i + 1, queue.length);

      try {
        if (action.type === "CONFIRM_ARRIVAL") {
          await updateDoc(doc(db, "entregas", action.entregaId), action.payload);
          await logAction("Sincronização Offline: Chegada no Local confirmada", "Logística", {
            entregaId: action.entregaId,
            ...action.payload,
            sincronizadoEm: new Date().toISOString(),
          });
        } else if (action.type === "START_ROUTE") {
          await updateDoc(doc(db, "entregas", action.entregaId), action.payload);
          await logAction("Sincronização Offline: Início de Rota", "Logística", {
            entregaId: action.entregaId,
            ...action.payload,
            sincronizadoEm: new Date().toISOString(),
          });
        } else if (action.type === "COMPLETE_DELIVERY") {
          await updateDoc(doc(db, "entregas", action.entregaId), action.payload);

          // Update linked pedido_venda if present
          if (action.pedidoId) {
            try {
              const pedidosSnap = await getDocs(
                query(collection(db, "pedidos_venda"), where("id_externo", "==", action.pedidoId))
              );
              if (!pedidosSnap.empty) {
                const pedidoDoc = pedidosSnap.docs[0];
                await registrarMudancaStatusPedido(
                  db,
                  pedidoDoc.id,
                  "Entregue",
                  action.payload?.entregador || "Entregador",
                  `Mercadoria entregue (Sincronizado offline). Recebedor: ${action.payload?.recebedor || "-"} (${
                    action.payload?.funcaoRecebedor || "-"
                  }). Canhoto: ${action.payload?.assinouCanhoto ? "Sim" : "Não"}`
                );
              }
            } catch (pErr) {
              console.warn("Falha ao sincronizar status do pedido de venda:", pErr);
            }
          }

          await logAction(
            `Sincronização Offline: Entrega Concluída #${action.pedidoId || action.entregaId}`,
            "Logística",
            {
              id: action.entregaId,
              pedidoId: action.pedidoId,
              recebedor: action.payload?.recebedor,
              status: "Entregue",
              sincronizadoEm: new Date().toISOString(),
            }
          );
        } else if (action.type === "OCCURRENCE_DELIVERY") {
          await updateDoc(doc(db, "entregas", action.entregaId), action.payload);

          if (action.pedidoId) {
            try {
              const pedidosSnap = await getDocs(
                query(collection(db, "pedidos_venda"), where("id_externo", "==", action.pedidoId))
              );
              if (!pedidosSnap.empty) {
                const pedidoDoc = pedidosSnap.docs[0];
                await registrarMudancaStatusPedido(
                  db,
                  pedidoDoc.id,
                  "Tentativa de Entrega Sem Sucesso",
                  action.payload?.entregador || "Entregador",
                  `Ocorrência registrada offline: ${action.payload?.motivoFalha || "-"}. Conduta: ${
                    action.payload?.acaoRecomendada || "-"
                  }`
                );
              }
            } catch (pErr) {
              console.warn("Falha ao sincronizar status do pedido com ocorrência:", pErr);
            }
          }

          await logAction(
            `Sincronização Offline: Ocorrência Registrada #${action.pedidoId || action.entregaId}`,
            "Logística",
            {
              id: action.entregaId,
              pedidoId: action.pedidoId,
              motivo: action.payload?.motivoFalha,
              status: "Falha",
              sincronizadoEm: new Date().toISOString(),
            }
          );
        }

        // Successfully synced -> Remove from local queue
        removePendingSyncAction(action.id);
        successCount++;
      } catch (itemErr) {
        console.error(`Erro ao sincronizar item ${action.id}:`, itemErr);
        failedCount++;
      }
    }
  } catch (globalErr) {
    console.error("Erro geral na sincronização offline:", globalErr);
  }

  // Update last sync timestamp
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  return {
    success: successCount,
    failed: failedCount,
    total: queue.length,
  };
}

/**
 * Custom React Hook to manage online/offline status, queue counts, and auto-sync
 */
export function useOfflineDeliverySync() {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingSyncActions().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_KEY));

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getPendingSyncActions().length);
    setLastSyncTime(localStorage.getItem(LAST_SYNC_KEY));
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncPendingActions();
      refreshPendingCount();
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically attempt sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check and periodic queue count check
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 4000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    triggerSync,
    refreshPendingCount,
  };
}
