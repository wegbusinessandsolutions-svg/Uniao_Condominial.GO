/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Camera, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle, ZoomIn, X, Plus, Sparkles } from "lucide-react";
import { ServicePhoto } from "../../types/serviceExecution";

interface PhotoUploadStepProps {
  fase: "antes" | "depois";
  photos: ServicePhoto[];
  onChangePhotos: (photos: ServicePhoto[]) => void;
  title?: string;
  description?: string;
  disabled?: boolean;
}

export default function PhotoUploadStep({
  fase,
  photos,
  onChangePhotos,
  title,
  description,
  disabled = false,
}: PhotoUploadStepProps) {
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<ServicePhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentSlotIndex, setCurrentSlotIndex] = useState<number | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const minPhotosRequired = 3;
  const isComplete = photos.length >= minPhotosRequired;

  const defaultTitle =
    fase === "antes"
      ? "Registro Obrigatório de 3 Fotos ANTES da Execução"
      : "Registro Obrigatório de 3 Fotos APÓS a Conclusão";

  const defaultDescription =
    fase === "antes"
      ? "Tire e anexe no mínimo 3 fotos nítidas do local, equipamento ou área condominial antes de iniciar o trabalho para comprovação de estado inicial."
      : "Tire e anexe no mínimo 3 fotos nítidas comprovando o serviço finalizado, limpeza do local e funcionamento antes da assinatura do síndico/zelador.";

  // Compress image to Base64 (max 1200px width/height, 0.85 quality) to ensure crisp storage
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

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
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          resolve(compressed);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
      const base64 = await processImageFile(file);
      const newPhoto: ServicePhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url: base64,
        tiradaEm: new Date().toISOString(),
        fase,
        legenda:
          currentSlotIndex !== null
            ? `Foto ${currentSlotIndex + 1} - ${fase === "antes" ? "Estado Inicial" : "Serviço Concluído"}`
            : undefined,
      };

      const updated = [...photos];
      if (currentSlotIndex !== null && currentSlotIndex < updated.length) {
        updated[currentSlotIndex] = newPhoto;
      } else {
        updated.push(newPhoto);
      }

      onChangePhotos(updated);
    } catch (err) {
      console.error("Erro ao processar imagem:", err);
      alert("Não foi possível carregar esta foto. Tente novamente com outro arquivo.");
    } finally {
      setIsProcessingImage(false);
      setCurrentSlotIndex(null);
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    if (disabled) return;
    const updated = photos.filter((_, idx) => idx !== indexToRemove);
    onChangePhotos(updated);
  };

  const handleUpdateLegenda = (index: number, newLegenda: string) => {
    const updated = [...photos];
    if (updated[index]) {
      updated[index] = { ...updated[index], legenda: newLegenda };
      onChangePhotos(updated);
    }
  };

  // Build slot slots (at least 3 slots visible)
  const slotCount = Math.max(3, photos.length + (photos.length < 6 ? 1 : 0));
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    index: i,
    photo: photos[i] || null,
    isRequired: i < 3,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
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

        {/* Badge Progress */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
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
                <span>{photos.length}/3 Fotos (Completo)</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="text-amber-600 animate-pulse" />
                <span>
                  {photos.length}/3 Fotos Obrigatórias ({3 - photos.length} restantes)
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {isProcessingImage && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Processando e otimizando fotografia...
        </div>
      )}

      {/* Grid of 3 Photo Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map((slot) => {
          const photo = slot.photo;
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

                    {/* Tag de identificação */}
                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      Foto {slot.index + 1} {slot.isRequired ? "(Obrigatória)" : "(Extra)"}
                    </div>

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
                      <span>Registrada às {new Date(photo.tiradaEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={11} /> Anexada
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
                    {slot.isRequired ? `Tirar Foto ${slot.index + 1} (Obrigatória)` : `Adicionar Foto Extra ${slot.index + 1}`}
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
