/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  X,
  Plus,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  HardDrive,
  CloudUpload,
  Layers
} from "lucide-react";
import { ServicePhoto } from "../../types/serviceExecution";
import {
  savePhotoToIndexedDB,
  getPhotosFromIndexedDB,
  removePhotoFromIndexedDB,
  syncPendingServicePhotos,
  uploadServicePhotoToStorage,
  CachedServicePhoto
} from "../../lib/servicePhotoOfflineStorage";
import { applyDateTimeWatermark } from "../../lib/imageWatermark";

interface PhotoUploadStepProps {
  fase: "antes" | "depois";
  photos: ServicePhoto[];
  onChangePhotos: (photos: ServicePhoto[]) => void;
  onAutoSave?: (photos: ServicePhoto[]) => Promise<void> | void;
  orderId?: string;
  nomeCondominio?: string;
  enderecoCompleto?: string;
  title?: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Ensures any image data URL is strictly resized and compressed to max 920px and 0.65 JPEG quality
 * to guarantee that 8 photos (4 antes + 4 depois) comfortably stay well below the 1MB Firestore limit (~320KB total).
 */
function compressImageCanvas(dataUrl: string, maxDim = 920, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function PhotoUploadStep({
  fase,
  photos,
  onChangePhotos,
  onAutoSave,
  orderId,
  nomeCondominio,
  enderecoCompleto,
  title,
  description,
  disabled = false,
}: PhotoUploadStepProps) {
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<ServicePhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentSlotIndex, setCurrentSlotIndex] = useState<number | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Offline & IndexedDB status state
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgressMessage, setSyncProgressMessage] = useState<string | null>(null);
  const [cachedPhotoIds, setCachedPhotoIds] = useState<Set<string>>(new Set());

  const minPhotosRequired = 4;
  const isComplete = photos.length >= minPhotosRequired;

  const defaultTitle =
    fase === "antes"
      ? "Registro Obrigatório de 4 Fotos ANTES da Execução"
      : "Registro Obrigatório de 4 Fotos APÓS a Conclusão";

  const defaultDescription =
    fase === "antes"
      ? "Tire e anexe as 4 fotos nítidas do local antes de iniciar o trabalho. Todas as 4 fotos recebem o carimbo Timemark Foto 100% Real com condomínio, data e horário."
      : "Tire e anexe as 4 fotos comprobatórias do serviço finalizado antes da assinatura. Todas as 4 fotos recebem o carimbo Timemark Foto 100% Real.";

  // Refresh IndexedDB cache states for this specific OS & phase
  const refreshCacheStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      const cached = await getPhotosFromIndexedDB(orderId, fase);
      const ids = new Set(cached.map((c) => c.id));
      setCachedPhotoIds(ids);

      // If parent has no photos yet but IndexedDB has cached photos, restore them
      if (photos.length === 0 && cached.length > 0) {
        const restored: ServicePhoto[] = cached.map((c) => ({
          id: c.id,
          url: c.url,
          legenda: c.legenda,
          tiradaEm: c.tiradaEm,
          fase: c.fase,
        }));
        onChangePhotos(restored);
      }
    } catch (err) {
      console.warn("Erro ao consultar IndexedDB:", err);
    }
  }, [orderId, fase, photos.length, onChangePhotos]);

  // Handle network online / offline changes & auto-sync
  const triggerSequentialSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncProgressMessage("Iniciando envio sequencial das fotos para a base...");
    try {
      const result = await syncPendingServicePhotos((current, total, msg) => {
        setSyncProgressMessage(`[${current}/${total}] ${msg}`);
      });

      if (result.total > 0) {
        setSyncProgressMessage(
          result.failed === 0
            ? `Envio sequencial concluído! ${result.success} foto(s) sincronizada(s).`
            : `${result.success} enviada(s), ${result.failed} falha(s).`
        );
      } else {
        setSyncProgressMessage(null);
      }
      await refreshCacheStatus();
    } catch (syncErr) {
      console.error("Erro no envio sequencial:", syncErr);
      setSyncProgressMessage("Erro ao sincronizar. Tentaremos novamente quando houver sinal estável.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setSyncProgressMessage(null);
      }, 4000);
    }
  }, [isSyncing, refreshCacheStatus]);

  useEffect(() => {
    refreshCacheStatus();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSequentialSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshCacheStatus, triggerSequentialSync]);

  // Process image with permanent Timemark / Foto 100% Real watermark with fallback
  const processImageFile = async (file: File, captureDate: Date = new Date()): Promise<string> => {
    try {
      const watermarkPromise = applyDateTimeWatermark(file, {
        captureDate,
        maxDimension: 920,
        quality: 0.65,
        includeSeconds: false,
        nomeCondominio,
        enderecoCompleto,
        style: "timemark_real",
      });

      // 8s maximum processing budget
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao estampar marca d'água")), 8000)
      );

      const result = await Promise.race([watermarkPromise, timeoutPromise]);
      return await compressImageCanvas(result.dataUrl, 920, 0.65);
    } catch (wmErr) {
      console.warn("Processamento de marca d'água demorou ou falhou, comprimindo via canvas:", wmErr);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const compressed = await compressImageCanvas(reader.result as string, 920, 0.65);
            resolve(compressed);
          } catch {
            resolve(reader.result as string);
          }
        };
        reader.onerror = () => reject(new Error("Falha ao ler arquivo de fotografia."));
        reader.readAsDataURL(file);
      });
    }
  };

  const handleTriggerUpload = (slotIndex: number) => {
    if (disabled) return;
    setCurrentSlotIndex(slotIndex);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      const captureTime = new Date();
      const nowIso = captureTime.toISOString();
      const targetSlot = currentSlotIndex !== null ? currentSlotIndex : photos.length;
      const photoId = `photo_${Date.now()}_slot${targetSlot}_${Math.random().toString(36).substring(2, 7)}`;

      // Fast image processing & guaranteed compression
      const finalUrl = await processImageFile(file, captureTime);

      const newPhoto: ServicePhoto = {
        id: photoId,
        url: finalUrl,
        tiradaEm: nowIso,
        fase,
        legenda: `Foto ${targetSlot + 1} de 4 - ${fase === "antes" ? "Estado Inicial" : "Comprovação Final"}`,
      };

      // 1. Update React State maintaining exact slot positioning
      const updated = [...photos];
      if (targetSlot < updated.length) {
        updated[targetSlot] = newPhoto;
      } else {
        updated[targetSlot] = newPhoto;
      }
      const filtered = updated.filter(Boolean);

      onChangePhotos(filtered);
      onAutoSave?.(filtered);

      // Stop image processing spinner immediately so technician sees the photo
      setIsProcessingImage(false);

      // 2. Guaranteed background storage into IndexedDB Cache (non-blocking)
      if (orderId) {
        const cachedItem: CachedServicePhoto = {
          id: photoId,
          orderId,
          fase,
          slotIndex: targetSlot,
          url: finalUrl,
          legenda: newPhoto.legenda,
          tiradaEm: nowIso,
          status: "pending_upload",
          createdAt: nowIso,
        };

        savePhotoToIndexedDB(cachedItem)
          .then(() => {
            setCachedPhotoIds((prev) => new Set([...prev, photoId]));
          })
          .catch((idbErr) => {
            console.warn("Aviso ao salvar no IndexedDB:", idbErr);
          });
      }

      // 3. Trigger background sequential sync asynchronously without blocking UI
      if (isOnline && orderId) {
        setTimeout(() => {
          triggerSequentialSync();
        }, 100);
      }
    } catch (err) {
      console.error("Erro ao processar imagem da câmera/upload:", err);
      alert("Não foi possível carregar a imagem. Por favor, tente novamente.");
    } finally {
      setIsProcessingImage(false);
      setCurrentSlotIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async (indexToRemove: number) => {
    if (disabled) return;
    const removedPhoto = photos[indexToRemove];
    if (removedPhoto && orderId) {
      try {
        await removePhotoFromIndexedDB(removedPhoto.id);
        setCachedPhotoIds((prev) => {
          const next = new Set(prev);
          next.delete(removedPhoto.id);
          return next;
        });
      } catch (err) {
        console.warn("Erro ao remover foto do IndexedDB:", err);
      }
    }

    const updated = photos.filter((_, idx) => idx !== indexToRemove);
    onChangePhotos(updated);
    onAutoSave?.(updated);
  };

  const handleUpdateLegenda = async (index: number, newLegenda: string) => {
    const updated = [...photos];
    if (updated[index]) {
      updated[index] = { ...updated[index], legenda: newLegenda };
      onChangePhotos(updated);
      onAutoSave?.(updated);

      if (orderId) {
        try {
          const item = updated[index];
          await savePhotoToIndexedDB({
            id: item.id,
            orderId,
            fase,
            slotIndex: index,
            url: item.url,
            legenda: newLegenda,
            tiradaEm: item.tiradaEm,
            status: "pending_upload",
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn("Erro ao atualizar legenda no IndexedDB:", err);
        }
      }
    }
  };

  // Build slots array - strictly 4 required slots (1, 2, 3, 4)
  const slots = Array.from({ length: 4 }, (_, i) => ({
    index: i,
    photo: photos[i] || null,
    isRequired: true,
  }));

  return (
    <div className="space-y-4">
      {/* Hidden file input with camera access */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                fase === "antes" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"
              }`}
            >
              <Camera size={18} />
            </div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              {title || defaultTitle}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {description || defaultDescription}
          </p>
        </div>

        {/* Badge Progress & Network Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {/* Offline/Online Network Indicator */}
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${
              !isOnline
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-300"
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff size={13} className="text-amber-700" />
                <span>Offline (Cache IndexedDB)</span>
              </>
            ) : (
              <>
                <Wifi size={13} className="text-emerald-700" />
                <span>Online</span>
              </>
            )}
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
              isComplete
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-amber-50 text-amber-700 border-amber-300"
            }`}
          >
            {isComplete ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>{photos.length}/4 Fotos (Completo)</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="text-amber-600 animate-pulse" />
                <span>
                  {photos.length}/4 Fotos Obrigatórias ({4 - photos.length} restantes)
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Offline Alert & Sequential Sync Notification */}
      {(!isOnline || syncProgressMessage || isSyncing) && (
        <div
          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
            !isOnline
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : isSyncing
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg ${
                !isOnline
                  ? "bg-amber-200 text-amber-900"
                  : isSyncing
                  ? "bg-blue-200 text-blue-900"
                  : "bg-emerald-200 text-emerald-900"
              }`}
            >
              {!isOnline ? (
                <HardDrive size={16} />
              ) : isSyncing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <CloudUpload size={16} />
              )}
            </div>
            <div>
              <p className="font-bold">
                {!isOnline
                  ? "Armazenamento Local Seguro (IndexedDB) Ativo"
                  : isSyncing
                  ? "Sincronização Sequencial em Andamento"
                  : "Status de Sincronização"}
              </p>
              <p className="opacity-90 text-[11px]">
                {syncProgressMessage ||
                  (!isOnline
                    ? "Suas 4 fotos são salvas instantaneamente no cache local do dispositivo. Assim que a internet retornar, o envio sequencial será feito na ordem exata."
                    : "Conexão estabelecida. Fotos pendentes prontas para envio ordenado.")}
              </p>
            </div>
          </div>

          {isOnline && !isSyncing && (
            <button
              type="button"
              onClick={triggerSequentialSync}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
            >
              <RefreshCw size={12} /> Sincronizar Agora
            </button>
          )}
        </div>
      )}

      {isProcessingImage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Comprimindo e salvando fotografia no cache local IndexedDB...
        </div>
      )}

      {/* Grid of 4 Photo Slots - Strict Sequence 1, 2, 3, 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {slots.map((slot) => {
          const photo = slot.photo;
          const isCachedLocally = photo && cachedPhotoIds.has(photo.id);

          return (
            <div
              key={slot.index}
              className={`relative rounded-2xl border-2 transition-all overflow-hidden flex flex-col bg-white ${
                photo
                  ? "border-slate-200 shadow-sm"
                  : slot.isRequired
                  ? "border-dashed border-amber-300 bg-amber-50/30 hover:border-amber-400"
                  : "border-dashed border-slate-200 bg-slate-50/50 hover:border-slate-300"
              }`}
            >
              {photo ? (
                // Slot with uploaded Photo
                <div className="flex flex-col h-full">
                  <div className="relative group aspect-4/3 bg-slate-900 overflow-hidden">
                    <img
                      src={photo.url}
                      alt={photo.legenda || `Foto ${slot.index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Tag de identificação sequencial */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <div className="bg-slate-900/85 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Layers size={11} className="text-blue-400" />
                        <span>Foto {slot.index + 1} de 4 (Obrigatória)</span>
                      </div>
                    </div>

                    {/* Tag de Cache IndexedDB */}
                    {isCachedLocally && (
                      <div className="absolute top-2 right-2 bg-emerald-950/85 backdrop-blur-sm text-emerald-300 text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-emerald-600/30">
                        <HardDrive size={10} />
                        <span>IndexedDB</span>
                      </div>
                    )}

                    {/* Overlay Action Buttons */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoForZoom(photo)}
                        className="p-2 bg-white/90 text-slate-800 rounded-xl hover:bg-white transition-colors shadow"
                        title="Visualizar em tamanho grande"
                      >
                        <ZoomIn size={16} />
                      </button>
                      {!disabled && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleTriggerUpload(slot.index)}
                            className="p-2 bg-blue-600/90 text-white rounded-xl hover:bg-blue-600 transition-colors shadow"
                            title="Substituir foto"
                          >
                            <Camera size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(slot.index)}
                            className="p-2 bg-rose-600/90 text-white rounded-xl hover:bg-rose-600 transition-colors shadow"
                            title="Excluir foto"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Legenda da Foto */}
                  <div className="p-3 bg-white flex-1 flex flex-col justify-between border-t border-slate-100">
                    <input
                      type="text"
                      value={photo.legenda || ""}
                      onChange={(e) => handleUpdateLegenda(slot.index, e.target.value)}
                      disabled={disabled}
                      placeholder={`Legenda da Foto ${slot.index + 1} (ex: bomba d'água)`}
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2">
                      <span>
                        Registrada às{" "}
                        {new Date(photo.tiradaEm).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> Salva #{slot.index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                // Empty Slot
                <button
                  type="button"
                  onClick={() => handleTriggerUpload(slot.index)}
                  disabled={disabled}
                  className="w-full aspect-4/3 flex flex-col items-center justify-center p-6 text-center cursor-pointer group hover:bg-white/80 transition-colors"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
                      slot.isRequired
                        ? "bg-amber-100 text-amber-700 group-hover:bg-amber-200"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    }`}
                  >
                    <Camera size={24} />
                  </div>
                  <span className="font-bold text-xs text-slate-800">
                    Tirar Foto {slot.index + 1} de 4 (Obrigatória)
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Toque para abrir câmera ou galeria
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal Zoom Foto */}
      {selectedPhotoForZoom && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-950/80 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold">{selectedPhotoForZoom.legenda || "Visualização de Foto"}</h4>
                <p className="text-xs text-slate-400">
                  Fase: {selectedPhotoForZoom.fase === "antes" ? "Antes da Execução" : "Após Conclusão"} •{" "}
                  {new Date(selectedPhotoForZoom.tiradaEm).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => setSelectedPhotoForZoom(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black">
              <img
                src={selectedPhotoForZoom.url}
                alt="Foto Ampliada"
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
