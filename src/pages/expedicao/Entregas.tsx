import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Pencil, Trash2, X, Printer, RefreshCw, FileText, Check, Truck, Package, PackageCheck, MessageCircle } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { registrarMudancaStatusPedido } from "../../lib/orderLogger";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import DailyDeliverySummary from "../../components/ui/DailyDeliverySummary";

export default function Entregas() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  
  const [isConfirmDeliveryModalOpen, setIsConfirmDeliveryModalOpen] = useState(false);
  const [deliveryConfirmData, setDeliveryConfirmData] = useState({ nome: "", funcao: "", assinou: false });

  const [isDeliveryFailureModalOpen, setIsDeliveryFailureModalOpen] = useState(false);
  const [deliveryFailureReason, setDeliveryFailureReason] = useState("Cliente ausente");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = collection(db, "entregas");
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setFormData({ status: "Separando" });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormData({ ...item, cliente: typeof item.cliente === "object" ? item.cliente?.nome : item.cliente });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const savePayload = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, "entregas", editingId), savePayload);
      } else {
        savePayload.createdAt = new Date().toISOString();
        await addDoc(collection(db, "entregas"), savePayload);
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const itemToDelete = data.find(item => item.id === id);
      const description = itemToDelete ? `Pedido #${itemToDelete.pedidoId || ""} para ${itemToDelete.destinatario || ""}` : id;

      await deleteDoc(doc(db, "entregas", id));

      // LOG ACTION
      await logAction(
        `Exclusão de registro de entrega: ${description}`,
        "Estoque",
        { deliveryId: id, description }
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const filteredData = data.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      (item.pedidoId || "").toLowerCase().includes(term) ||
      (item.nf || "").toLowerCase().includes(term) ||
      ((typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "").toLowerCase().includes(term)
    );
  });

  const groupedData = {
    Separando: filteredData.filter(d => d.status === "Separando"),
    ProntaParaEnvio: filteredData.filter(d => d.status === "Pronta para Envio"),
    EmTransito: filteredData.filter(d => d.status === "Em trânsito"),
    Entregue: filteredData.filter(d => d.status === "Entregue"),
    Falha: filteredData.filter(d => d.status === "Falha")
  };


  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (newStatus === "Entregue") {
      setSelectedDeliveryId(id);
      setDeliveryConfirmData({ nome: "", funcao: "", assinou: false });
      setIsConfirmDeliveryModalOpen(true);
      return;
    }
    
    if (newStatus === "Falha") {
      setSelectedDeliveryId(id);
      setDeliveryFailureReason("Cliente ausente");
      setIsDeliveryFailureModalOpen(true);
      return;
    }

    try {
      const { db } = await initFirebase();
      await updateDoc(doc(db, "entregas", id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setData(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      
      const item = data.find(i => i.id === id);
      if (item) {
        await logAction(`Entrega atualizada para ${newStatus}`, "Estoque", { id, status: newStatus, pedido: item.pedidoId });
      }
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
      alert("Erro ao atualizar o status da entrega.");
    }
  };

  const confirmDeliveryUpdate = async () => {
    if (!selectedDeliveryId) return;
    if (!deliveryConfirmData.nome || !deliveryConfirmData.funcao) {
      alert("Por favor, preencha o nome e a função do recebedor.");
      return;
    }
    if (!deliveryConfirmData.assinou) {
      alert("É necessário confirmar que o recebedor assinou o canhoto da nota fiscal.");
      return;
    }

    try {
      setIsSaving(true);
      const { db } = await initFirebase();

      let locationStr = "";
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
          });
          locationStr = ` | Geolocalização: Lat ${pos.coords.latitude.toFixed(6)}, Lng ${pos.coords.longitude.toFixed(6)}`;
        }
      } catch (geoErr) {
        console.warn("Não foi possível obter geolocalização:", geoErr);
      }
      const updatePayload: any = {
        status: "Entregue",
        recebedor: deliveryConfirmData.nome,
        funcaoRecebedor: deliveryConfirmData.funcao,
        assinouCanhoto: deliveryConfirmData.assinou,
        horaEntrega: new Date().toISOString().split("T")[1].substring(0, 5),
        updatedAt: new Date().toISOString()
      };
      if (locationStr) {
        updatePayload.geolocalizacao = locationStr;
      }
      await updateDoc(doc(db, "entregas", selectedDeliveryId), updatePayload);
      setData(prev => prev.map(item => item.id === selectedDeliveryId ? { 
        ...item, 
        status: "Entregue",
        recebedor: deliveryConfirmData.nome,
        funcaoRecebedor: deliveryConfirmData.funcao,
        assinouCanhoto: deliveryConfirmData.assinou
      } : item));
      
      const item = data.find(i => i.id === selectedDeliveryId);
      if (item) {
        // Also update pedidos_venda
        if (item.pedidoId) {
          const pedidosSnap = await getDocs(query(collection(db, "pedidos_venda"), where("id_externo", "==", item.pedidoId)));
          if (!pedidosSnap.empty) {
            const pedidoDoc = pedidosSnap.docs[0];
            await registrarMudancaStatusPedido(
              db,
              pedidoDoc.id,
              "Entregue",
              "Entregador",
              `Mercadoria entregue. Recebedor: ${deliveryConfirmData.nome} (${deliveryConfirmData.funcao}) - Assinou canhoto: ${deliveryConfirmData.assinou ? 'Sim' : 'Não'}${locationStr}`
            );
          }
        }

        await logAction(`Entrega concluída: Pedido #${item.pedidoId}`, "Estoque", { 
          id: selectedDeliveryId, 
          status: "Entregue",
          recebedor: deliveryConfirmData.nome 
        });
      }
      setIsConfirmDeliveryModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao confirmar entrega.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmFailureUpdate = async () => {
    if (!selectedDeliveryId) return;
    try {
      setIsSaving(true);
      const { db } = await initFirebase();
      await updateDoc(doc(db, "entregas", selectedDeliveryId), {
        status: "Falha",
        motivoFalha: deliveryFailureReason,
        updatedAt: new Date().toISOString()
      });
      setData(prev => prev.map(item => item.id === selectedDeliveryId ? { 
        ...item, 
        status: "Falha",
        motivoFalha: deliveryFailureReason
      } : item));
      
      const item = data.find(i => i.id === selectedDeliveryId);
      if (item) {
        // Also update pedidos_venda
        if (item.pedidoId) {
          const pedidosSnap = await getDocs(query(collection(db, "pedidos_venda"), where("id_externo", "==", item.pedidoId)));
          if (!pedidosSnap.empty) {
            const pedidoDoc = pedidosSnap.docs[0];
            await registrarMudancaStatusPedido(
              db,
              pedidoDoc.id,
              "Falha na Entrega",
              "Entregador",
              `Entrega não realizada. Motivo: ${deliveryFailureReason}`
            );
          }
        }

        await logAction(`Falha na entrega: Pedido #${item.pedidoId}`, "Estoque", { 
          id: selectedDeliveryId, 
          status: "Falha",
          motivo: deliveryFailureReason 
        });
      }
      setIsDeliveryFailureModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao registrar falha.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderStatusTracker = (item: any) => {
    const steps = [
      { id: "Separando", label: "Separando", icon: Package },
      { id: "Pronta para Envio", label: "Pronta p/ Envio", icon: PackageCheck },
      { id: "Em trânsito", label: "Em trânsito", icon: Truck },
      { id: "Entregue", label: "Entregue", icon: Check }
    ];

    const currentIndex = steps.findIndex(s => s.id === item.status);
    // Se o status não for um dos 3 (ex: Falha), o tracker pode não marcar nenhum, o que é OK

    return (
      <div className="flex items-center w-full max-w-[200px]">
        {steps.map((step, idx) => {
          const isCompleted = currentIndex >= idx;
          const isCurrent = currentIndex === idx;
          const isError = item.status === "Falha";
          const Icon = step.icon;
          
          let bgColor = "bg-white";
          let borderColor = "border-slate-300";
          let textColor = "text-slate-400";
          
          if (isCompleted) {
            bgColor = "bg-blue-600";
            borderColor = "border-blue-600";
            textColor = "text-white";
          }
          
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => handleUpdateStatus(item.id, step.id)}
                className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all group ${bgColor} ${borderColor} ${textColor} hover:border-blue-400 hover:text-blue-500 ${isCurrent ? 'ring-2 ring-blue-200 ring-offset-1' : ''}`}
                title={`Marcar como ${step.label}`}
              >
                <Icon size={12} />
              </button>
              {idx < steps.length - 1 && (
                <div className={`h-1 flex-1 -mx-1 transition-colors ${currentIndex > idx ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const handleReportAbsence = async (item: any) => {
    if (!window.confirm("Deseja reportar a ausência do cliente? O status será alterado para Falha e o cliente será notificado via WhatsApp.")) {
      return;
    }

    try {
      const { db } = await initFirebase();
      const reason = "Cliente ausente";
      
      await updateDoc(doc(db, "entregas", item.id), {
        status: "Falha",
        motivoFalha: reason,
        updatedAt: new Date().toISOString()
      });

      setData(prev => prev.map(d => d.id === item.id ? { 
        ...d, 
        status: "Falha",
        motivoFalha: reason
      } : d));
      
      if (item.pedidoId) {
        const pedidosSnap = await getDocs(query(collection(db, "pedidos_venda"), where("id_externo", "==", item.pedidoId)));
        if (!pedidosSnap.empty) {
          const pedidoDoc = pedidosSnap.docs[0];
          await registrarMudancaStatusPedido(
            db,
            pedidoDoc.id,
            "Falha na Entrega",
            "Entregador",
            `Entrega não realizada. Motivo: ${reason}`
          );
        }
      }

      await logAction(`Falha na entrega (Ausência): Pedido #${item.pedidoId}`, "Estoque", { 
        id: item.id, 
        status: "Falha",
        motivo: reason 
      });

      // Send WhatsApp Notification
      let phone = "";
      if (typeof item.cliente === "object" && item.cliente?.telefone) {
        phone = item.cliente.telefone;
      } else if (typeof item.cliente === "string") {
        phone = item.cliente.replace(/[^0-9]/g, "");
      }
      
      if (phone) {
        phone = phone.replace(/\D/g, "");
        const message = encodeURIComponent(`Olá${item.cliente?.nome ? ` ` + item.cliente.nome.split(' ')[0] : (typeof item.cliente === 'string' ? ` ` + item.cliente.split(' ')[0] : '')}! Tentamos realizar a entrega do seu pedido (${item.pedidoId || item.nf || ''}), porém não encontramos ninguém no local. Por favor, entre em contato para reagendarmos a entrega.`);
        const url = `https://wa.me/55${phone}?text=${message}`;
        window.open(url, "_blank");
      } else {
        alert("Cliente ausente registrado. Porém, não foi possível abrir o WhatsApp pois o número não foi encontrado no cadastro.");
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao reportar ausência.");
    }
  };

  const handleContactWhatsApp = (item: any) => {
    // Attempt to extract the phone number from the item's client details if available
    let phone = "";
    if (typeof item.cliente === "object" && item.cliente?.telefone) {
      phone = item.cliente.telefone;
    }
    phone = phone.replace(/\\D/g, "");
    
    // Default URL if no specific phone is found
    const url = phone ? `https://wa.me/55${phone}` : `https://wa.me/`;
    window.open(url, "_blank");
  };

  const renderActionButtons = (item: any) => (
    <div className="flex items-center justify-end gap-3">
      {item.status === "Pronta para Envio" && (
        <button
          onClick={() => {
            if (window.confirm("Deseja aceitar esta entrega e iniciar a rota?")) {
              handleUpdateStatus(item.id, "Em trânsito");
            }
          }}
          className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          title="Aceitar Rota / Iniciar Trânsito"
        >
          <Truck size={14} /> Aceitar Rota
        </button>
      )}
      {(item.status === "Em trânsito") && (
        <button
          onClick={() => handleReportAbsence(item)}
          className="text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          title="Reportar Ausência"
        >
          <X size={14} /> Reportar Ausência
        </button>
      )}
      {(item.status === "Em trânsito" || item.status === "Falha") && (
        <button
          onClick={() => handleContactWhatsApp(item)}
          className="text-slate-400 hover:text-green-600 transition-colors"
          title="Contatar Responsável (WhatsApp)"
        >
          <MessageCircle size={18} />
        </button>
      )}
      <button
        onClick={() => window.print()}
        className="text-slate-400 hover:text-blue-900 transition-colors"
        title="Imprimir"
      >
        <Printer size={18} />
      </button>
      <button
        onClick={() => {}}
        className="text-slate-400 hover:text-orange-500 transition-colors"
        title="Baixar PDF"
      >
        <Download size={18} />
      </button>
      <button
        onClick={() => openEditModal(item)}
        className="text-slate-400 hover:text-amber-800 transition-colors"
        title="Editar"
      >
        <Pencil size={18} />
      </button>
      <button
        onClick={() => setItemToDelete(item.id)}
        className="text-slate-400 hover:text-red-600 transition-colors"
        title="Excluir"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Entregas</h1>
          <p className="text-sm text-slate-500 mt-1">Roteirização e acompanhamento de status logístico.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar pedido, NF, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px]"
            />
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nova Rota
          </button>
        </div>
      </div>

      <DailyDeliverySummary data={data} />

      {/* Grid Separando */}
      <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
        <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-orange-800">Separando ({groupedData.Separando.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3">N. Pedido</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Dt Pedido</th>
                <th className="px-6 py-3">Hora Pedido</th>
                <th className="px-6 py-3">Valor Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedData.Separando.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                groupedData.Separando.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.pedidoId || "-"}</td>
                    <td className="px-6 py-3">{(typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "-"}</td>
                    <td className="px-6 py-3">{item.dataPedido || "-"}</td>
                    <td className="px-6 py-3">{item.horaPedido || "-"}</td>
                    <td className="px-6 py-3">{item.valorTotal || "-"}</td>
                    <td className="px-6 py-3">{renderStatusTracker(item)}</td>
                    <td className="px-6 py-3">{renderActionButtons(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Pronta para Envio */}
      <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
        <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-indigo-800">Pronta para Envio ({groupedData.ProntaParaEnvio.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3">N. Pedido</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Dt Pedido</th>
                <th className="px-6 py-3">Hora Pedido</th>
                <th className="px-6 py-3">Valor Total</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedData.ProntaParaEnvio.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                groupedData.ProntaParaEnvio.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.pedidoId || "-"}</td>
                    <td className="px-6 py-3">{(typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "-"}</td>
                    <td className="px-6 py-3">{item.dataPedido || "-"}</td>
                    <td className="px-6 py-3">{item.horaPedido || "-"}</td>
                    <td className="px-6 py-3">{item.valorTotal || "-"}</td>
                    <td className="px-6 py-3">{renderStatusTracker(item)}</td>
                    <td className="px-6 py-3">{renderActionButtons(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Em trânsito */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-blue-800">Em trânsito ({groupedData.EmTransito.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3">N. NF</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Hora Saída</th>
                <th className="px-6 py-3">Valor Total</th>
                <th className="px-6 py-3">Entregador</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedData.EmTransito.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                groupedData.EmTransito.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.nf || "-"}</td>
                    <td className="px-6 py-3">{(typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "-"}</td>
                    <td className="px-6 py-3">{item.data || "-"}</td>
                    <td className="px-6 py-3">{item.horaSaida || "-"}</td>
                    <td className="px-6 py-3">{item.valorTotal || "-"}</td>
                    <td className="px-6 py-3">{item.entregador || "-"}</td>
                    <td className="px-6 py-3">{renderStatusTracker(item)}</td>
                    <td className="px-6 py-3">{renderActionButtons(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Entregue */}
      <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
        <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-emerald-800">Entregue ({groupedData.Entregue.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3">N. NF</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Hora Saída</th>
                <th className="px-6 py-3">Hora Entrega</th>
                <th className="px-6 py-3">Recebedor(a)</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedData.Entregue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                groupedData.Entregue.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.nf || "-"}</td>
                    <td className="px-6 py-3">{(typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "-"}</td>
                    <td className="px-6 py-3">{item.data || "-"}</td>
                    <td className="px-6 py-3">{item.horaSaida || "-"}</td>
                    <td className="px-6 py-3">{item.horaEntrega || "-"}</td>
                    <td className="px-6 py-3">{item.recebedor || "-"}</td>
                    <td className="px-6 py-3">{renderStatusTracker(item)}</td>
                    <td className="px-6 py-3">{renderActionButtons(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid Falha */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
        <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-red-800">Falha ({groupedData.Falha.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className="px-6 py-3">N. NF</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Hora Saída</th>
                <th className="px-6 py-3">Hora Chegada</th>
                <th className="px-6 py-3">Situação</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedData.Falha.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                groupedData.Falha.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.nf || "-"}</td>
                    <td className="px-6 py-3">{(typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "-"}</td>
                    <td className="px-6 py-3">{item.data || "-"}</td>
                    <td className="px-6 py-3">{item.horaSaida || "-"}</td>
                    <td className="px-6 py-3">{item.horaChegada || "-"}</td>
                    <td className="px-6 py-3">{item.situacao || "-"}</td>
                    <td className="px-6 py-3">{renderStatusTracker(item)}</td>
                    <td className="px-6 py-3">{renderActionButtons(item)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto pt-10">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col my-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Editar Entrega" : "Nova Entrega"}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Preencha os detalhes do envio.</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="entrega-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status || "Separando"}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Separando">Separando</option>
                      <option value="Pronta para Envio">Pronta para Envio</option>
                      <option value="Em trânsito">Em trânsito</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Falha">Falha</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">N. Pedido</label>
                    <input
                      type="text"
                      name="pedidoId"
                      value={formData.pedidoId || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">N. NF</label>
                    <input
                      type="text"
                      name="nf"
                      value={formData.nf || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                    <input
                      type="text"
                      name="cliente"
                      value={formData.cliente || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total</label>
                    <input
                      type="text"
                      name="valorTotal"
                      value={formData.valorTotal || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Data / Dt Pedido</label>
                    <input
                      type="date"
                      name="dataPedido"
                      value={formData.dataPedido || formData.data || ""}
                      onChange={(e) => {
                        handleInputChange(e);
                        // Sincroniza os dois para simplificar
                        setFormData(prev => ({...prev, data: e.target.value}));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Pedido</label>
                    <input
                      type="time"
                      name="horaPedido"
                      value={formData.horaPedido || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Saída</label>
                    <input
                      type="time"
                      name="horaSaida"
                      value={formData.horaSaida || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora Entrega / Chegada</label>
                    <input
                      type="time"
                      name="horaEntrega"
                      value={formData.horaEntrega || formData.horaChegada || ""}
                      onChange={(e) => {
                        handleInputChange(e);
                        setFormData(prev => ({...prev, horaChegada: e.target.value}));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Entregador</label>
                    <input
                      type="text"
                      name="entregador"
                      value={formData.entregador || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Recebedor(a)</label>
                    <input
                      type="text"
                      name="recebedor"
                      value={formData.recebedor || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Situação / Motivo Falha</label>
                    <input
                      type="text"
                      name="situacao"
                      value={formData.situacao || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="entrega-form"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmDeliveryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Confirmar Entrega</h2>
              <button
                onClick={() => setIsConfirmDeliveryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Pessoa que Recebeu</label>
                  <input
                    type="text"
                    value={deliveryConfirmData.nome}
                    onChange={(e) => setDeliveryConfirmData(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
                  <input
                    type="text"
                    value={deliveryConfirmData.funcao}
                    onChange={(e) => setDeliveryConfirmData(prev => ({ ...prev, funcao: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Titular, Porteiro, Vizinho"
                  />
                </div>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deliveryConfirmData.assinou}
                      onChange={(e) => setDeliveryConfirmData(prev => ({ ...prev, assinou: e.target.checked }))}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Assinou o canhoto da NF?</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsConfirmDeliveryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeliveryUpdate}
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Confirmando..." : "Confirmar Entrega"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeliveryFailureModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Entrega Não Realizada</h2>
              <button
                onClick={() => setIsDeliveryFailureModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Motivo da Falha</label>
                  <select
                    value={deliveryFailureReason}
                    onChange={(e) => setDeliveryFailureReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Cliente ausente">Cliente ausente</option>
                    <option value="Endereço não localizado">Endereço não localizado</option>
                    <option value="Recusa do cliente">Recusa do cliente</option>
                    <option value="Mercadoria avariada">Mercadoria avariada</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setIsDeliveryFailureModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmFailureUpdate}
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-red-600 rounded-lg shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Registrando..." : "Registrar Falha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
