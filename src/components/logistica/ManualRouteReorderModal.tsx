import React, { useState, useEffect } from "react";
import {
  X,
  GripVertical,
  Route,
  ArrowUpDown,
  Sparkles,
  Check,
  RotateCcw,
  Navigation,
  MapPin,
  Clock,
  DollarSign,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Sliders,
  Layers,
  HelpCircle,
  Truck
} from "lucide-react";
import { DeliveryLocation } from "./DeliveryRouteMap";
import { initFirebase } from "../../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { logAction } from "../../lib/audit";

interface ManualRouteReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  deliveries: DeliveryLocation[];
  selectedDriver: string;
  availableDrivers: string[];
}

export default function ManualRouteReorderModal({
  isOpen,
  onClose,
  onSuccess,
  deliveries,
  selectedDriver,
  availableDrivers,
}: ManualRouteReorderModalProps) {
  const [currentDriver, setCurrentDriver] = useState<string>(selectedDriver || "todos");
  const [items, setItems] = useState<DeliveryLocation[]>([]);
  const [originalItems, setOriginalItems] = useState<DeliveryLocation[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync initial list when modal opens or driver changes
  useEffect(() => {
    if (!isOpen) return;

    setCurrentDriver(selectedDriver || "todos");

    const filtered = deliveries
      .filter((d) => {
        if (selectedDriver === "todos") return d.status === "Em trânsito";
        return d.status === "Em trânsito" && d.entregador === selectedDriver;
      })
      .sort((a, b) => (a.sequencia || 999) - (b.sequencia || 999));

    setItems(filtered);
    setOriginalItems(filtered);
    setHasChanges(false);
    setSaveSuccess(false);
  }, [isOpen, deliveries, selectedDriver]);

  // When driver filter changes inside modal
  const handleDriverChange = (driver: string) => {
    setCurrentDriver(driver);
    const filtered = deliveries
      .filter((d) => {
        if (driver === "todos") return d.status === "Em trânsito";
        return d.status === "Em trânsito" && d.entregador === driver;
      })
      .sort((a, b) => (a.sequencia || 999) - (b.sequencia || 999));

    setItems(filtered);
    setOriginalItems(filtered);
    setHasChanges(false);
  };

  if (!isOpen) return null;

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // For transparent/clean drag image in some browsers
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Optional
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...items];
    const [movedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);

    // Update sequence numbers
    const updated = reordered.map((item, idx) => ({
      ...item,
      sequencia: idx + 1,
    }));

    setItems(updated);
    setHasChanges(true);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Button-based reordering for accessibility & precision
  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    const reordered = [...items];
    const [movedItem] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedItem);

    const updated = reordered.map((item, idx) => ({
      ...item,
      sequencia: idx + 1,
    }));

    setItems(updated);
    setHasChanges(true);
  };

  // Preset Optimizers
  const handleReverseOrder = () => {
    if (items.length <= 1) return;
    const reversed = [...items].reverse().map((item, idx) => ({
      ...item,
      sequencia: idx + 1,
    }));
    setItems(reversed);
    setHasChanges(true);
  };

  const handleSortByPriority = () => {
    const priorityMap: Record<string, number> = { Alta: 1, Média: 2, Baixa: 3 };
    const sorted = [...items]
      .sort((a, b) => {
        const pA = priorityMap[a.prioridade || "Média"] || 2;
        const pB = priorityMap[b.prioridade || "Média"] || 2;
        return pA - pB;
      })
      .map((item, idx) => ({
        ...item,
        sequencia: idx + 1,
      }));
    setItems(sorted);
    setHasChanges(true);
  };

  const handleSortByValue = () => {
    const sorted = [...items]
      .sort((a, b) => Number(b.valorTotal || 0) - Number(a.valorTotal || 0))
      .map((item, idx) => ({
        ...item,
        sequencia: idx + 1,
      }));
    setItems(sorted);
    setHasChanges(true);
  };

  const handleResetToOriginal = () => {
    setItems(originalItems);
    setHasChanges(false);
  };

  // Save new dispatch order to Firebase Firestore
  const handleSaveReorder = async () => {
    if (items.length === 0) return;
    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const newSeq = i + 1;
        await updateDoc(doc(db, "entregas", item.id), {
          sequencia: newSeq,
          updatedAt: new Date().toISOString(),
        });
      }

      await logAction("Reotimização manual de rotas aplicada (Drag-and-Drop)", "Logística", {
        motorista: currentDriver,
        totalParadas: items.length,
        ordemIds: items.map((it) => it.id),
      });

      setSaveSuccess(true);
      setHasChanges(false);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Erro ao salvar ordem de rota:", err);
      alert("Falha ao salvar nova ordem: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsSaving(false);
    }
  };

  const totalValor = items.reduce((acc, curr) => acc + Number(curr.valorTotal || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <ArrowUpDown size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Reotimização Manual de Rota</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-extrabold border border-blue-400/30 uppercase tracking-wide">
                  Drag & Drop
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Arraste e solte os pedidos para definir a ordem exata de entrega e sequência de paradas do entregador.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Control Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-600">Filtrar por Entregador:</span>
            <select
              value={currentDriver}
              onChange={(e) => handleDriverChange(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="todos">Todos os Entregadores ({deliveries.filter((d) => d.status === "Em trânsito").length} paradas)</option>
              {availableDrivers.map((d, i) => (
                <option key={i} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Predefinições:</span>
            <button
              onClick={handleSortByPriority}
              disabled={items.length <= 1}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Organiza prioridade Alta primeiro"
            >
              <Sparkles size={12} className="text-amber-500" />
              Prioridade Alta
            </button>
            <button
              onClick={handleSortByValue}
              disabled={items.length <= 1}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Organiza pelo maior valor total"
            >
              <DollarSign size={12} className="text-emerald-500" />
              Maior Valor
            </button>
            <button
              onClick={handleReverseOrder}
              disabled={items.length <= 1}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Inverte o sentido da rota atual"
            >
              <ArrowUpDown size={12} className="text-blue-500" />
              Inverter Rota
            </button>
            {hasChanges && (
              <button
                onClick={handleResetToOriginal}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Desfazer alterações manuais"
              >
                <RotateCcw size={12} />
                Restaurar
              </button>
            )}
          </div>
        </div>

        {/* Guidance Notice */}
        <div className="px-6 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-blue-600 shrink-0" />
            <span>
              <strong>Dica de uso:</strong> Clique e segure no ícone lateral de arrastar (<strong>⋮⋮</strong>) ou no card para movimentar a parada para a posição desejada.
            </span>
          </div>
          <div className="font-extrabold text-blue-900">
            {items.length} Paradas • R$ {totalValor.toFixed(2)}
          </div>
        </div>

        {/* Draggable Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5 bg-slate-100/50">
          {items.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <Truck size={28} />
              </div>
              <h3 className="font-bold text-slate-700">Nenhum pedido em rota encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Não existem pedidos com status "Em trânsito" para o filtro selecionado. Despache novos pedidos primeiro para reotimizar a rota.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              const isFirst = index === 0;
              const isLast = index === items.length - 1;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative flex items-center gap-3 p-3.5 rounded-xl border transition-all select-none ${
                    isDragging
                      ? "opacity-40 bg-blue-50 border-blue-400 scale-[0.98] shadow-inner"
                      : isDragOver
                      ? "border-blue-500 bg-blue-50/80 shadow-md ring-2 ring-blue-400/50"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  {/* Drop indicator bar at top if dragging over */}
                  {isDragOver && draggedIndex !== index && (
                    <div className="absolute -top-1.5 left-4 right-4 h-1 bg-blue-600 rounded-full shadow-xs animate-pulse" />
                  )}

                  {/* Drag Gripper Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                    title="Arrastar e soltar para reordenar"
                  >
                    <GripVertical size={20} />
                  </div>

                  {/* Sequence Position Number */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-sm">
                      {index + 1}º
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase">
                      Parada
                    </span>
                  </div>

                  {/* Order & Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm truncate">
                        {item.cliente}
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        #{item.pedidoId || "S/N"}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
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

                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-400 shrink-0" />
                        {item.endereco || "Endereço não informado"}
                        {item.bairro ? `, ${item.bairro}` : ""}
                      </span>
                      {item.cidade && (
                        <span className="text-slate-400">• {item.cidade}</span>
                      )}
                    </div>
                  </div>

                  {/* Value & Driver */}
                  <div className="text-right shrink-0 px-2">
                    <div className="text-xs font-black text-slate-900">
                      R$ {Number(item.valorTotal || 0).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {item.entregador ? item.entregador.split(" ")[0] : "Sem motorista"}
                    </div>
                  </div>

                  {/* Micro-Action Steppers (Move Up, Move Down, Top, Bottom) */}
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-2 shrink-0">
                    <button
                      onClick={() => moveItem(index, index - 1)}
                      disabled={isFirst}
                      title="Mover para cima"
                      className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveItem(index, index + 1)}
                      disabled={isLast}
                      title="Mover para baixo"
                      className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      onClick={() => moveItem(index, 0)}
                      disabled={isFirst}
                      title="Enviar para 1ª parada"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                    >
                      <ArrowUpToLine size={14} />
                    </button>
                    <button
                      onClick={() => moveItem(index, items.length - 1)}
                      disabled={isLast}
                      title="Enviar para última parada"
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 transition-colors"
                    >
                      <ArrowDownToLine size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            {hasChanges ? (
              <span className="flex items-center gap-1.5 font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <AlertCircle size={14} />
                Sequência alterada. Clique em "Salvar Nova Ordem".
              </span>
            ) : saveSuccess ? (
              <span className="flex items-center gap-1.5 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Check size={14} />
                Nova ordem de despacho salva com sucesso!
              </span>
            ) : (
              <span className="text-slate-500">
                A rota atual está sincronizada com a base de dados.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveReorder}
              disabled={isSaving || items.length === 0 || (!hasChanges && !saveSuccess)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando Sequência...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Salvar Nova Ordem de Despacho
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
