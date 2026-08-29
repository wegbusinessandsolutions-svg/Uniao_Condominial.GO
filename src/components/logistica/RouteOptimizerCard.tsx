import React, { useState } from "react";
import { 
  Navigation, 
  Route, 
  Sparkles, 
  Phone, 
  MessageSquare, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  UserCheck, 
  GripVertical, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  Save, 
  RotateCcw, 
  Check, 
  Layers,
  Sparkle
} from "lucide-react";
import { DeliveryLocation } from "./DeliveryRouteMap";
import ManualRouteReorderModal from "./ManualRouteReorderModal";

interface RouteOptimizerCardProps {
  deliveries: DeliveryLocation[];
  selectedDriver: string;
  onSelectDriver: (driver: string) => void;
  availableDrivers: string[];
  onOptimizeRoute: () => void;
  onSelectDelivery: (id: string) => void;
  selectedDeliveryId: string | null;
  onOpenDispatch: (item: any) => void;
  onOpenConfirm: (item: any) => void;
  onOpenOccurrence: (item: any) => void;
  onOpenGeoStatus?: (item: any) => void;
  onUpdateSequence?: (reordered: DeliveryLocation[]) => Promise<void>;
  onRefreshDeliveries?: () => void;
}

export default function RouteOptimizerCard({
  deliveries,
  selectedDriver,
  onSelectDriver,
  availableDrivers,
  onOptimizeRoute,
  onSelectDelivery,
  selectedDeliveryId,
  onOpenDispatch,
  onOpenConfirm,
  onOpenOccurrence,
  onOpenGeoStatus,
  onUpdateSequence,
  onRefreshDeliveries,
}: RouteOptimizerCardProps) {
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [saveInlineSuccess, setSaveInlineSuccess] = useState(false);

  // Filter by driver if selected
  const driverDeliveries = deliveries.filter((d) => {
    if (selectedDriver === "todos") return true;
    return d.entregador === selectedDriver;
  });

  const inTransitDeliveries = driverDeliveries
    .filter((d) => d.status === "Em trânsito")
    .sort((a, b) => (a.sequencia || 999) - (b.sequencia || 999));

  const pendingDispatchDeliveries = driverDeliveries.filter((d) =>
    ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status)
  );

  // Generate Google Maps multi-stop URL for the driver's route
  const generateMultiStopMapUrl = () => {
    if (inTransitDeliveries.length === 0) return null;
    const origin = "-16.6869,-49.2648"; // Central Goiânia Depot
    const destination = `${inTransitDeliveries[inTransitDeliveries.length - 1].lat},${inTransitDeliveries[inTransitDeliveries.length - 1].lng}`;
    const waypoints = inTransitDeliveries
      .slice(0, -1)
      .map((d) => `${d.lat},${d.lng}`)
      .join("|");

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }
    return url;
  };

  const handleShareWhatsAppRoute = () => {
    if (inTransitDeliveries.length === 0) {
      alert("Nenhum pedido em trânsito para gerar o roteiro.");
      return;
    }

    let msg = `🚚 *Roteiro de Entregas - ${selectedDriver === 'todos' ? 'Geral' : selectedDriver}*\n\n`;
    inTransitDeliveries.forEach((d, idx) => {
      msg += `📍 *${idx + 1}ª Parada:* Pedido #${d.pedidoId || "S/N"}\n`;
      msg += `Cliente: ${d.cliente}\n`;
      msg += `Endereço: ${d.endereco || ""}${d.bairro ? ` - ${d.bairro}` : ""}\n`;
      if (d.telefone) msg += `Contato: ${d.telefone}\n`;
      msg += `GPS: https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}\n\n`;
    });

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  // Drag and drop handlers for inline reordering
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...inTransitDeliveries];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    setDraggedIndex(null);
    setDragOverIndex(null);

    // Apply and persist reordered sequence
    if (onUpdateSequence) {
      setIsSavingInline(true);
      try {
        await onUpdateSequence(reordered);
        setSaveInlineSuccess(true);
        setTimeout(() => setSaveInlineSuccess(false), 2000);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSavingInline(false);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Micro-step move up/down
  const handleMoveStep = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= inTransitDeliveries.length) return;

    const reordered = [...inTransitDeliveries];
    const [movedItem] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, movedItem);

    if (onUpdateSequence) {
      setIsSavingInline(true);
      try {
        await onUpdateSequence(reordered);
        setSaveInlineSuccess(true);
        setTimeout(() => setSaveInlineSuccess(false), 2000);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSavingInline(false);
      }
    }
  };

  const multiStopUrl = generateMultiStopMapUrl();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[520px] lg:h-[620px]">
      {/* Header with Driver Filter, Optimize Button and Manual Reorder Button */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Route size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Sequência e Gestão de Rota</h3>
              {saveInlineSuccess && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-in fade-in">
                  <Check size={11} /> Ordem salva
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {inTransitDeliveries.length} paradas ativas • {pendingDispatchDeliveries.length} para despachar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedDriver}
            onChange={(e) => onSelectDriver(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="todos">Todos os Entregadores</option>
            {availableDrivers.map((d, i) => (
              <option key={i} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Manual Reorder Modal Trigger */}
          <button
            onClick={() => setIsReorderModalOpen(true)}
            title="Reorganizar ordem de paradas com tela cheia e predefinições"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
          >
            <ArrowUpDown size={13} className="text-blue-600" />
            <span className="hidden sm:inline">Reotimização</span> Manual
          </button>

          <button
            onClick={onOptimizeRoute}
            title="Calcular melhor sequência de rota por proximidade e prioridade"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <Sparkles size={13} />
            Auto Otimizar
          </button>
        </div>
      </div>

      {/* Action Bar for Driver Multi-stop and WhatsApp */}
      <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between gap-2 text-xs">
        {multiStopUrl ? (
          <a
            href={multiStopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold hover:underline"
          >
            <ExternalLink size={14} />
            Abrir Rota Completa no Google Maps
          </a>
        ) : (
          <span className="text-slate-400 font-medium">Nenhuma rota ativa para GPS</span>
        )}

        <button
          onClick={handleShareWhatsAppRoute}
          disabled={inTransitDeliveries.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors disabled:opacity-40"
        >
          <MessageSquare size={13} />
          Enviar no WhatsApp
        </button>
      </div>

      {/* Reorder drag hint badge */}
      {inTransitDeliveries.length > 1 && (
        <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1.5">
            <GripVertical size={13} className="text-blue-500" />
            <span>Arraste os cards para alterar a ordem de despacho</span>
          </span>
          {isSavingInline && (
            <span className="flex items-center gap-1 text-blue-600 font-bold animate-pulse">
              <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Sincronizando...
            </span>
          )}
        </div>
      )}

      {/* Stops List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
        {/* Section 1: Active In-Transit Deliveries (With Drag & Drop) */}
        {inTransitDeliveries.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Navigation size={14} className="text-blue-600" />
                Em Rota ({inTransitDeliveries.length} Paradas)
              </span>
              <button
                onClick={() => setIsReorderModalOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 lowercase"
              >
                <ArrowUpDown size={12} />
                reordenar tudo
              </button>
            </div>

            {inTransitDeliveries.map((item, idx) => {
              const isSelected = selectedDeliveryId === item.id;
              const isDragging = draggedIndex === idx;
              const isDragOver = dragOverIndex === idx;
              const isFirst = idx === 0;
              const isLast = idx === inTransitDeliveries.length - 1;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => onSelectDelivery(item.id)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                    isDragging
                      ? "opacity-40 bg-blue-50 border-blue-400 scale-[0.98]"
                      : isDragOver
                      ? "border-blue-500 bg-blue-50/80 shadow-md ring-2 ring-blue-400/40"
                      : isSelected
                      ? "bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/30 shadow-sm"
                      : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80"
                  }`}
                >
                  {/* Drop indicator bar at top if dragging over */}
                  {isDragOver && draggedIndex !== idx && (
                    <div className="absolute -top-1 left-2 right-2 h-1 bg-blue-600 rounded-full shadow-xs animate-pulse" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Drag Gripper */}
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0"
                        title="Clique e arraste para reordenar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={16} />
                      </div>

                      {/* Sequence Badge */}
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                        {item.sequencia || idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{item.cliente}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            #{item.pedidoId || "S/N"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          📍 {item.endereco || "Endereço não informado"}
                          {item.bairro ? `, ${item.bairro}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right shrink-0">
                        {item.valorTotal && (
                          <div className="text-xs font-bold text-slate-900">
                            R$ {Number(item.valorTotal).toFixed(2)}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {item.entregador ? item.entregador.split(" ")[0] : "Sem motorista"}
                        </div>
                      </div>

                      {/* Micro Stepper Buttons for Quick Move */}
                      <div
                        className="flex flex-col gap-0.5 pl-1 border-l border-slate-100 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleMoveStep(idx, "up")}
                          disabled={isFirst}
                          title="Subir posição na rota"
                          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => handleMoveStep(idx, "down")}
                          disabled={isLast}
                          title="Descer posição na rota"
                          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions row for this stop */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-[11px]"
                      >
                        <Navigation size={12} />
                        GPS Maps
                      </a>

                      {onOpenGeoStatus && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGeoStatus(item);
                          }}
                          className="flex items-center gap-1 text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-md font-bold text-[11px] border border-sky-200 transition-colors"
                          title="Visualizar posição geográfica em tempo real do entregador"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                          Rastrear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenOccurrence(item);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] transition-colors border border-rose-200"
                      >
                        Ocorrência
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenConfirm(item);
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                      >
                        ✓ Entregar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section 2: Ready for Dispatch */}
        {pendingDispatchDeliveries.length > 0 && (
          <div className="space-y-2.5 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600" />
                Aguardando Despacho ({pendingDispatchDeliveries.length})
              </span>
            </div>

            {pendingDispatchDeliveries.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectDelivery(item.id)}
                className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{item.cliente}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      #{item.pedidoId || "S/N"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    📍 {item.endereco || "Endereço cadastrado"}{item.bairro ? `, ${item.bairro}` : ""}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDispatch(item);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-sm transition-colors"
                >
                  Despachar
                </button>
              </div>
            ))}
          </div>
        )}

        {inTransitDeliveries.length === 0 && pendingDispatchDeliveries.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold">Todas as rotas foram concluídas!</p>
            <p className="text-xs text-slate-400 mt-1">Nenhum pedido pendente ou em trânsito no momento.</p>
          </div>
        )}
      </div>

      {/* Manual Route Reorder Modal */}
      {isReorderModalOpen && (
        <ManualRouteReorderModal
          isOpen={isReorderModalOpen}
          onClose={() => setIsReorderModalOpen(false)}
          onSuccess={() => {
            if (onRefreshDeliveries) onRefreshDeliveries();
          }}
          deliveries={deliveries}
          selectedDriver={selectedDriver}
          availableDrivers={availableDrivers}
        />
      )}
    </div>
  );
}

