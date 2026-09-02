/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { initFirebase } from "./firebase";
import { logAction } from "./audit";
import { ServicePhoto, RoutineServiceOrder } from "../types/serviceExecution";

export interface CachedServicePhoto {
  id: string;
  orderId: string;
  fase: "antes" | "depois";
  slotIndex: number; // 0, 1, 2 to guarantee exact sequence
  url: string; // Base64 data URL
  legenda?: string;
  tiradaEm: string; // ISO
  status: "pending_upload" | "uploading" | "synced" | "failed";
  error?: string;
  createdAt: string;
}

const DB_NAME = "WEG_OS_PHOTOS_OFFLINE_DB";
const DB_VERSION = 1;
const STORE_NAME = "pending_photos";
const ORDER_CACHE_STORE = "cached_orders";

let cachedDbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initializes and opens the IndexedDB database with safety timeout and connection reuse
 */
function openIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB não suportado neste navegador."));
  }

  if (cachedDbPromise) {
    return cachedDbPromise;
  }

  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let resolved = false;

    // Safety timeout to prevent hanging the entire app if IDB is blocked
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cachedDbPromise = null;
        reject(new Error("Timeout ao inicializar o banco IndexedDB local."));
      }
    }, 4000);

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Pending photos store with indexes for orderId, fase and slotIndex
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("orderId", "orderId", { unique: false });
          store.createIndex("orderId_fase", ["orderId", "fase"], { unique: false });
          store.createIndex("status", "status", { unique: false });
        }

        // Cached orders store
        if (!db.objectStoreNames.contains(ORDER_CACHE_STORE)) {
          db.createObjectStore(ORDER_CACHE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            cachedDbPromise = null;
          };
          db.onclose = () => {
            cachedDbPromise = null;
          };
          resolve(db);
        }
      };

      request.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cachedDbPromise = null;
          reject(request.error || new Error("Erro desconhecido ao abrir IndexedDB."));
        }
      };

      request.onblocked = () => {
        console.warn("Abertura do IndexedDB bloqueada por outra aba ou transação pendente.");
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          cachedDbPromise = null;
          reject(new Error("IndexedDB bloqueado."));
        }
      };
    } catch (error) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cachedDbPromise = null;
        reject(error);
      }
    }
  });

  return cachedDbPromise;
}

/**
 * Saves or updates a photo in the IndexedDB offline cache.
 * Designed to never hang the caller: incorporates safety timeouts and graceful fallbacks.
 */
export async function savePhotoToIndexedDB(photo: CachedServicePhoto): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn("Timeout de 3s ao salvar no cache IndexedDB, liberando fluxo.");
          resolve();
        }
      }, 3000);

      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(photo);

        tx.oncomplete = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };

        tx.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.warn("Erro na transação de foto IndexedDB:", tx.error);
            resolve();
          }
        };

        tx.onabort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.warn("Transação de foto IndexedDB abortada.");
            resolve();
          }
        };

        request.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.warn("Erro no request store.put:", request.error);
            resolve();
          }
        };
      } catch (txErr) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn("Falha ao iniciar transação no IndexedDB:", txErr);
          resolve();
        }
      }
    });
  } catch (err) {
    console.warn("savePhotoToIndexedDB aviso (cache offline não disponível):", err);
  }
}

/**
 * Retrieves all photos for a specific OS and phase from IndexedDB, sorted by slotIndex
 */
export async function getPhotosFromIndexedDB(
  orderId: string,
  fase?: "antes" | "depois"
): Promise<CachedServicePhoto[]> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve([]);
        }
      }, 3000);

      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            let results: CachedServicePhoto[] = request.result || [];
            if (orderId) {
              results = results.filter((p) => p.orderId === orderId);
            }
            if (fase) {
              results = results.filter((p) => p.fase === fase);
            }
            // Sort strictly by slotIndex (0, 1, 2...) to preserve chronological sequence
            results.sort((a, b) => a.slotIndex - b.slotIndex);
            resolve(results);
          }
        };

        request.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve([]);
          }
        };
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve([]);
        }
      }
    });
  } catch {
    return [];
  }
}

/**
 * Removes a photo from IndexedDB by its ID
 */
export async function removePhotoFromIndexedDB(photoId: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve();
        }
      }, 3000);

      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(photoId);

        tx.oncomplete = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };

        tx.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };

        request.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve();
          }
        };
      } catch {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      }
    });
  } catch {
    // Ignora erro
  }
}

/**
 * Retrieves all pending photos waiting for network synchronization across all orders
 */
export async function getAllPendingPhotosFromIndexedDB(): Promise<CachedServicePhoto[]> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results: CachedServicePhoto[] = request.result || [];
      const pending = results.filter((p) => p.status === "pending_upload" || p.status === "failed");
      // Sort by orderId, fase and slotIndex
      pending.sort((a, b) => {
        if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId);
        if (a.fase !== b.fase) return a.fase === "antes" ? -1 : 1;
        return a.slotIndex - b.slotIndex;
      });
      resolve(pending);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves the count of pending offline photos waiting for sync
 */
export async function getPendingSyncPhotosCount(): Promise<number> {
  try {
    const pending = await getAllPendingPhotosFromIndexedDB();
    return pending.length;
  } catch {
    return 0;
  }
}

/**
 * Cache complete OS data in IndexedDB for offline view/execution
 */
export async function cacheOrderInIndexedDB(order: RoutineServiceOrder): Promise<void> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDER_CACHE_STORE, "readwrite");
    const store = tx.objectStore(ORDER_CACHE_STORE);
    const request = store.put(order);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all cached OS from IndexedDB
 */
export async function getCachedOrdersFromIndexedDB(): Promise<RoutineServiceOrder[]> {
  const db = await openIndexedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ORDER_CACHE_STORE, "readonly");
    const store = tx.objectStore(ORDER_CACHE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Uploads a base64 watermarked photo to Firebase Storage and returns the download URL.
 * Falls back safely to the original base64 string if offline or if storage is unreachable.
 */
export async function uploadServicePhotoToStorage(
  dataUrl: string,
  orderId: string,
  fase: string,
  slotIndex: number,
  photoId: string
): Promise<string> {
  if (!dataUrl || dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
    return dataUrl;
  }

  try {
    const { storage } = await initFirebase();
    if (!storage) {
      return dataUrl;
    }

    const cleanOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanPhotoId = photoId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `ordens_servico/${cleanOrderId}/${fase}_slot${slotIndex + 1}_${cleanPhotoId}.jpg`;
    const storageRef = ref(storage, path);

    // Upload watermarked image to Firebase Storage
    await uploadString(storageRef, dataUrl, "data_url", {
      contentType: "image/jpeg",
      customMetadata: {
        orderId,
        fase,
        slotIndex: String(slotIndex),
        watermarked: "true",
      },
    });

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.warn("Upload para Firebase Storage falhou, mantendo imagem otimizada em base64:", err);
    return dataUrl;
  }
}

/**
 * Synchronizes pending photos sequentially to Firestore and Firebase Storage when connection is online.
 * Maintains strict slot index order (0, 1, 2) in the destination order's photos array.
 */
export async function syncPendingServicePhotos(
  onProgress?: (current: number, total: number, message: string) => void
): Promise<{ success: number; failed: number; total: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { success: 0, failed: 0, total: 0 };
  }

  const pendingPhotos = await getAllPendingPhotosFromIndexedDB();
  if (pendingPhotos.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  try {
    const { db } = await initFirebase();

    // Group pending photos by OrderId and Phase (antes vs depois)
    const groups: { [groupKey: string]: CachedServicePhoto[] } = {};
    for (const photo of pendingPhotos) {
      const key = `${photo.orderId}_${photo.fase}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(photo);
    }

    let processedCount = 0;
    const totalPhotos = pendingPhotos.length;

    for (const groupKey in groups) {
      const photosInGroup = groups[groupKey];
      // Sort strictly by slotIndex so Photo 1, Photo 2, Photo 3 upload in exact order
      photosInGroup.sort((a, b) => a.slotIndex - b.slotIndex);

      const first = photosInGroup[0];
      const orderId = first.orderId;
      const fase = first.fase;
      const fieldName = fase === "antes" ? "fotosAntes" : "fotosDepois";
      const timestampField = fase === "antes" ? "fotosAntesEm" : "fotosDepoisEm";

      try {
        const orderRef = doc(db, "ordens_servico", orderId);
        const orderSnap = await getDoc(orderRef);

        let currentPhotos: ServicePhoto[] = [];
        if (orderSnap.exists()) {
          const data = orderSnap.data();
          const existing = data[fieldName];
          if (Array.isArray(existing)) {
            currentPhotos = [...existing];
          }
        }

        // Process photos in this group sequentially
        for (const item of photosInGroup) {
          processedCount++;
          if (onProgress) {
            onProgress(
              processedCount,
              totalPhotos,
              `Enviando Foto ${item.slotIndex + 1}/3 com marca d'água (${fase.toUpperCase()}) ao Firebase Storage...`
            );
          }

          // Mark as uploading in IndexedDB
          await savePhotoToIndexedDB({ ...item, status: "uploading" });

          // 1. Upload the watermarked image to Firebase Storage (with Base64 fallback)
          const finalUrl = await uploadServicePhotoToStorage(
            item.url,
            item.orderId,
            item.fase,
            item.slotIndex,
            item.id
          );

          // 2. Convert to ServicePhoto with the permanent URL
          const servicePhoto: ServicePhoto = {
            id: item.id,
            url: finalUrl,
            legenda: item.legenda,
            tiradaEm: item.tiradaEm,
            fase: item.fase,
          };

          // Position at the exact slotIndex to guarantee correct sequence
          if (item.slotIndex < currentPhotos.length) {
            currentPhotos[item.slotIndex] = servicePhoto;
          } else {
            // Fill any intermediate holes if necessary
            while (currentPhotos.length < item.slotIndex) {
              currentPhotos.push(servicePhoto);
            }
            currentPhotos[item.slotIndex] = servicePhoto;
          }

          // Update Firestore sequentially
          const payload: any = {
            [fieldName]: currentPhotos,
            updatedAt: new Date().toISOString(),
          };
          if (!orderSnap.data()?.[timestampField]) {
            payload[timestampField] = item.tiradaEm || new Date().toISOString();
          }

          await updateDoc(orderRef, payload);

          // Mark photo as synced in IndexedDB with the updated storage URL
          await savePhotoToIndexedDB({
            ...item,
            url: finalUrl,
            status: "synced",
          });
          successCount++;
        }

        // Audit log for the successful batch upload
        await logAction(
          `Sincronização Firebase Storage: ${photosInGroup.length} fotos (${fase.toUpperCase()}) gravadas com marca d'água na OS #${orderId.slice(0, 6)}`,
          "Comercial",
          {
            orderId,
            fase,
            quantidade: photosInGroup.length,
            sincronizadoEm: new Date().toISOString(),
          }
        );
      } catch (groupErr: any) {
        console.error(`Erro ao sincronizar fotos do grupo ${groupKey}:`, groupErr);
        for (const item of photosInGroup) {
          await savePhotoToIndexedDB({
            ...item,
            status: "failed",
            error: groupErr?.message || "Falha no upload",
          });
          failedCount++;
        }
      }
    }
  } catch (globalErr) {
    console.error("Erro geral na sincronização de fotos offline:", globalErr);
  }

  return {
    success: successCount,
    failed: failedCount,
    total: pendingPhotos.length,
  };
}
