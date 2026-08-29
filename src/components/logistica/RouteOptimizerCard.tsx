import React, { useState, useMemo } from "react";
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
  ArrowUpToLine,
  ArrowDownToLine,
  Save, 
  RotateCcw, 
  Check, 
  Layers,
  Search,
  SlidersHorizontal,
  DollarSign
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
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter by driver if selected
  const driverDeliveries = deliveries.filter((d) => {
    if (selectedDriver === "todos") return true;
    return d.entregador === selectedDriver;
  });

  const inTransitDeliveries = useMemo(() => {
    return driverDeliveries
      .filter((d) => d.status === "Em trânsito")
      .sort((a, b) => (a.sequencia || 999) - (b.sequencia || 999));
  }, [driverDeliveries]);

  const filteredInTransitDeliveries = useMemo(() => {
    if (!searchTerm.trim()) return inTransitDeliveries;
    const term = searchTerm.toLowerCase();
    return inTransitDeliveries.filter(
      (d) =>
        d.cliente.toLowerCase().includes(term) ||
        (d.pedidoId || "").toLowerCase().includes(term) ||
        (d.endereco || "").toLowerCase().includes(term) ||
        (d.bairro || "").toLowerCase().includes(term)
    );
  }, [inTransitDeliveries, searchTerm]);

  const pendingDispatchDeliveries = useMemo(() => {
    return driverDeliveries.filter((d) =>
      ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status)
    );
  }, [driverDeliveries]);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setSaveInlineSuccess(true);
    setTimeout(() => {
      setSaveInlineSuccess(false);
      setFeedbackMessage(null);
    }, 2200);
  };

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
        showFeedback(`✓ Movido para ${targetIndex + 1}ª parada!`);
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

  // Micro-step move up/down / top / bottom
  const handleMoveStep = async (index: number, direction: "up" | "down" | "top" | "bottom") => {
    let targetIndex = index;
    if (direction === "up") targetIndex = index - 1;
    else if (direction === "down") targetIndex = index + 1;
    else if (direction === "top") targetIndex = 0;
    else if (direction === "bottom") targetIndex = inTransitDeliveries.length - 1;

    if (targetIndex < 0 || targetIndex >= inTransitDeliveries.length || targetIndex === index) return;

    const reordered = [...inTransitDeliveries];
    const [movedItem] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, movedItem);

    if (onUpdateSequence) {
      setIsSavingInline(true);
      try {
        await onUpdateSequence(reordered);
        showFeedback(`✓ Reordenado para ${targetIndex + 1}ª parada!`);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSavingInline(false);
      }
    }
  };

  // Quick Preset Sorters
  const handleQuickSort = async (type: "priority" | "value" | "reverse") => {
    if (inTransitDeliveries.length <= 1) return;
    let sorted = [...inTransitDeliveries];

    if (type === "priority") {
      const pMap: any = { Alta: 1, Média: 2, Baixa: 3 };
      sorted.sort((a, b) => (pMap[a.prioridade || "Média"] || 2) - (pMap[b.prioridade || "Média"] || 2));
    } else if (type === "value") {
      sorted.sort((a, b) => Number(b.valorTotal || 0) - Number(a.valorTotal || 0));
    } else if (type === "reverse") {
      sorted.reverse();
    }

    if (onUpdateSequence) {
      setIsSavingInline(true);
      try {
        await onUpdateSequence(sorted);
        showFeedback("✓ Rota reorganizada!");
      } catch (err) {
        console.error(err);
      } finally {
        setIsSavingInline(false);
      }
    }
  };

  const multiStopUrl = generateMultiStopMapUrl();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[540px] lg:h-[640px]">
      {/* Header with Driver Filter, Optimize Button and Manual Reorder Button */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/80 flex flex-col gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Route size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-sm">Sequência e Gestão de Rota</h3>
                {saveInlineSuccess && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full animate-in fade-in">
                    <Check size={11} /> {feedbackMessage || "Salvo"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {inTransitDeliveries.length} paradas ativas • {pendingDispatchDeliveries.length} para despachar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={selectedDriver}
              onChange={(e) => onSelectDriver(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              <span className="hidden sm:inline">Modo</span> Avançado
            </button>

            <button
              onClick={onOptimizeRoute}
              title="Calcular melhor sequência de rota por proximidade e prioridade"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all whitespace-nowrap"
            >
              <Sparkles size={13} />
              Auto Otimizar
            </button>
          </div>
        </div>

        {/* Quick Sorter Buttons & Search bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Ordenar:</span>
            <button
              onClick={() => handleQuickSort("priority")}
              disabled={inTransitDeliveries.length <= 1}
              className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-30"
              title="Prioridade Alta no topo"
            >
              <Sparkles size={11} className="text-amber-500" />
              Prioridade
            </button>
            <button
              onClick={() => handleQuickSort("value")}
              disabled={inTransitDeliveries.length <= 1}
              className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-30"
              title="Maior Valor primeiro"
            >
              <DollarSign size={11} className="text-emerald-500" />
              Valor
            </button>
            <button
              onClick={() => handleQuickSort("reverse")}
              disabled={inTransitDeliveries.length <= 1}
              className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-30"
              title="Inverter ordem das paradas"
            >
              <ArrowUpDown size={11} className="text-blue-500" />
              Inverter
            </button>
          </div>

          <div className="relative min-w-[140px] max-w-[180px]">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar paradas..."
              className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Action Bar for Driver Multi-stop and WhatsApp */}
      <div className="px-3.5 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between gap-2 text-xs">
        {multiStopUrl ? (
          <a
            href={multiStopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-bold hover:underline"
          >
            <ExternalLink size={13} />
            Abrir Rota Completa no Google Maps
          </a>
        ) : (
          <span className="text-slate-400 font-medium">Nenhuma rota ativa para GPS</span>
        )}

        <button
          onClick={handleShareWhatsAppRoute}
          disabled={inTransitDeliveries.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors disabled:opacity-40 shadow-xs"
        >
          <MessageSquare size={13} />
          Enviar no WhatsApp
        </button>
      </div>

      {/* Reorder drag hint bar */}
      {inTransitDeliveries.length > 1 && (
        <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] text-slate-600 font-medium">
          <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
            <GripVertical size={13} className="text-blue-500" />
            <span>Arraste os cards para alterar a ordem da entrega</span>
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
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 divide-y divide-slate-100">
        {/* Section 1: Active In-Transit Deliveries (With Drag & Drop) */}
        {filteredInTransitDeliveries.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Navigation size={14} className="text-blue-600" />
                Em Rota Ativa ({filteredInTransitDeliveries.length} Paradas)
              </span>
              <button
                onClick={() => setIsReorderModalOpen(true)}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 lowercase"
              >
                <ArrowUpDown size={12} />
                tela cheia
              </button>
            </div>

            {filteredInTransitDeliveries.map((item, idx) => {
              const isSelected = selectedDeliveryId === item.id;
              const isDragging = draggedIndex === idx;
              const isDragOver = dragOverIndex === idx;
              const isFirst = idx === 0;
              const isLast = idx === filteredInTransitDeliveries.length - 1;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => onSelectDelivery(item.id)}
                  className={`relative p-3.5 rounded-xl border transition-all cursor-pointer select-none group ${
                    isDragging
                      ? "opacity-40 bg-blue-50 border-blue-400 scale-[0.98] ring-2 ring-blue-400"
                      : isDragOver
                      ? "border-blue-500 bg-blue-50/90 shadow-lg ring-2 ring-blue-500/50 scale-[1.01]"
                      : isSelected
                      ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/40 shadow-sm"
                      : "bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80 shadow-xs"
                  }`}
                >
                  {/* Drop indicator bar at top if dragging over */}
                  {isDragOver && draggedIndex !== idx && (
                    <div className="absolute -top-1.5 left-2 right-2 h-1.5 bg-blue-600 rounded-full shadow-md animate-pulse flex items-center justify-center">
                      <span className="text-[9px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                        Soltar na {idx + 1}ª posição
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {/* Drag Gripper */}
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 rounded-lg bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                        title="Clique e arraste para reordenar"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical size={16} />
                      </div>

                      {/* Sequence Badge */}
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                          {idx + 1}º
                        </span>
                        <span className="text-[8px] font-extrabold text-slate-400 uppercase mt-0.5">
                          Parada
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm truncate">{item.cliente}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            #{item.pedidoId || "S/N"}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                              item.prioridade === "Alta"
                                ? "bg-rose-100 text-rose-800"
                                : item.prioridade === "Baixa"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.prioridade || "Média"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5 truncate">
                          📍 {item.endereco || "Endereço cadastrado"}{item.bairro ? `, ${item.bairro}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {item.valorTotal && (
                          <div className="text-xs font-black text-slate-900">
                            R$ {Number(item.valorTotal).toFixed(2)}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.entregador ? item.entregador.split(" ")[0] : "Sem motorista"}
                        </div>
                      </div>

                      {/* Micro Stepper & Quick Move Buttons */}
                      <div
                        className="flex flex-col gap-0.5 pl-1.5 border-l border-slate-200 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleMoveStep(idx, "top")}
                            disabled={isFirst}
                            title="Mover direto para o Topo (1ª Parada)"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                          >
                            <ArrowUpToLine size={13} />
                          </button>
                          <button
                            onClick={() => handleMoveStep(idx, "up")}
                            disabled={isFirst}
                            title="Subir uma posição"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                          >
                            <ChevronUp size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => handleMoveStep(idx, "bottom")}
                            disabled={isLast}
                            title="Mover para o Final da Rota"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                          >
                            <ArrowDownToLine size={13} />
                          </button>
                          <button
                            onClick={() => handleMoveStep(idx, "down")}
                            disabled={isLast}
                            title="Descer uma posição"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-20 transition-colors"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions row for this stop */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
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

                      {item.telefone && (
                        <a
                          href={`tel:${item.telefone.replace(/\D/g, "")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-slate-600 hover:text-emerald-700 font-bold text-[11px]"
                          title={`Ligar para ${item.telefone}`}
                        >
                          <Phone size={11} />
                          Ligar
                        </a>
                      )}

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
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-xs"
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
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-xs transition-colors"
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

