import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { Package, Truck, CheckCircle2, Clock, MapPin, XCircle, MessageCircle } from "lucide-react";
import { logAction } from "../../lib/audit";

export default function EntregadorDashboard() {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pendente" | "transito" | "finalizado">("pendente");

  const fetchEntregas = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const snapshot = await getDocs(collection(db, "entregas"));
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEntregas(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntregas();
  }, []);

  const pendentes = entregas.filter(e => ["Separando", "Pronta para Envio"].includes(e.status));
  const emTransito = entregas.filter(e => e.status === "Em trânsito");
  const finalizados = entregas.filter(e => ["Entregue", "Falha"].includes(e.status));

  const handleStatusChange = async (item: any, newStatus: string) => {
    try {
      const { db } = await initFirebase();
      await updateDoc(doc(db, "entregas", item.id), { status: newStatus, updatedAt: new Date().toISOString() });
      
      setEntregas(prev => prev.map(e => e.id === item.id ? { ...e, status: newStatus } : e));
      
      // Update logs
      await logAction(`Status de entrega alterado para ${newStatus}`, "Estoque", { id: item.id, status: newStatus });
    } catch (err) {
      console.error("Erro ao atualizar status", err);
      alert("Erro ao atualizar status");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard - Entrega de Mercadorias</h1>
        <p className="text-slate-600">Acompanhamento e gestão de rotas de entrega.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Package size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Pendentes</p>
              <h3 className="text-2xl font-bold text-slate-900">{pendentes.length}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Em Trânsito</p>
              <h3 className="text-2xl font-bold text-slate-900">{emTransito.length}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-medium">Finalizadas</p>
              <h3 className="text-2xl font-bold text-slate-900">{finalizados.length}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab("pendente")}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === "pendente" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Pendentes ({pendentes.length})
            </button>
            <button
              onClick={() => setActiveTab("transito")}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === "transito" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Em Trânsito ({emTransito.length})
            </button>
            <button
              onClick={() => setActiveTab("finalizado")}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === "finalizado" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Finalizadas ({finalizados.length})
            </button>
          </nav>
        </div>

        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mb-2"></div>
              Carregando entregas...
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(activeTab === "pendente" ? pendentes : activeTab === "transito" ? emTransito : finalizados).length === 0 ? (
                <div className="p-8 text-center text-slate-500">Nenhuma entrega nesta categoria.</div>
              ) : (
                (activeTab === "pendente" ? pendentes : activeTab === "transito" ? emTransito : finalizados).map(item => (
                  <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">Pedido #{item.pedidoId || item.id.substring(0, 6)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'Entregue' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'Falha' ? 'bg-red-100 text-red-700' :
                          item.status === 'Em trânsito' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium">{typeof item.cliente === 'object' ? item.cliente?.nome : item.cliente}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><MapPin size={14} /> {item.endereco || "Endereço não informado"}</span>
                        {item.dataEntrega && <span className="flex items-center gap-1"><Clock size={14} /> Previsto: {item.dataEntrega}</span>}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {activeTab === "pendente" && (
                        <button 
                          onClick={() => handleStatusChange(item, "Em trânsito")}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Truck size={16} /> Iniciar Rota
                        </button>
                      )}
                      
                      {activeTab === "transito" && (
                        <>
                          <button 
                            onClick={() => handleStatusChange(item, "Entregue")}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Concluir
                          </button>
                          <button 
                            onClick={() => handleStatusChange(item, "Falha")}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
                          >
                            <XCircle size={16} /> Falha
                          </button>
                        </>
                      )}
                      
                      <button className="p-2 text-slate-400 hover:text-[#25D366] hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100" title="Contatar Cliente">
                        <MessageCircle size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
