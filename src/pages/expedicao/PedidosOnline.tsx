import React, { useState, useEffect } from "react";
import { Plus, Search, CheckCircle, FileText, Truck, ArrowRight, Printer, AlertTriangle, ShoppingCart } from "lucide-react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initFirebase } from "../../lib/firebase";
import { processarPedidoWebsite, EXEMPLO_PEDIDO_WEBSITE, CONFIG } from "../../lib/ecommerceFlow";

export default function PedidosOnline() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("Todas");

  useEffect(() => {
    let unsubscribe: () => void;

    const setupListener = async () => {
      try {
        const { db } = await initFirebase();
        const q = collection(db, "pedidos_venda");
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            let items = snapshot.docs.map(d => ({ firebaseId: d.id, ...d.data() })) as any[];
            // Filtrar apenas pedidos aguardando conferência
            items = items.filter(p => p.status === CONFIG.STATUS.NOVO);
            // Ordenar por data (mais recente primeiro)
            items.sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
            setPedidos(items);
            setLoading(false);
          },
          (error) => {
            console.warn("PedidosOnline snapshot error:", error);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSimularVenda = async () => {
    setProcessing(true);
    try {
      const prioridades = ["Alta", "Média", "Baixa"];
      const randomPriority = prioridades[Math.floor(Math.random() * prioridades.length)];
      const novoPedido = {
        ...EXEMPLO_PEDIDO_WEBSITE,
        prioridade: randomPriority
      };
      await processarPedidoWebsite(novoPedido);
      alert(`Pedido recebido (Prioridade: ${randomPriority}) e pronto para conferência!`);
    } catch (err: any) {
      alert("Erro ao processar pedido: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePriorityChange = async (pedido: any, newPriority: string) => {
    try {
      const { db } = await initFirebase();
      const pedidoRef = doc(db, "pedidos_venda", pedido.firebaseId);
      await updateDoc(pedidoRef, {
        prioridade: newPriority
      });
    } catch (err: any) {
      alert("Erro ao atualizar prioridade: " + err.message);
    }
  };

  const getPriorityStyle = (prioridade: string) => {
    switch (prioridade) {
      case "Alta":
        return "bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-200 hover:bg-rose-100";
      case "Média":
        return "bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-200 hover:bg-amber-100";
      case "Baixa":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200 focus:ring-blue-200 hover:bg-blue-100";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "bg-slate-100 text-slate-700 border-slate-200";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "bg-amber-100 text-amber-700 border-amber-200";
      case CONFIG.STATUS.CONFERIDO:
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case CONFIG.STATUS.FATURADO:
        return "bg-blue-100 text-blue-700 border-blue-200";
      case CONFIG.STATUS.DESPACHADO:
        return "bg-green-800 text-white border-green-800";
      case "AGUARDANDO EMISSÃO N.F.":
      case "AGUARDANDO EMISSÃO DE NOTA FISCAL":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleImprimir = async (pedido: any) => {
    let impressoPor = pedido.impressoPor;
    let dataImpressao = pedido.dataImpressao;

    if (!impressoPor) {
      const auth = getAuth();
      impressoPor = auth.currentUser?.displayName || auth.currentUser?.email || "Usuário";
      dataImpressao = new Date().toISOString();

      try {
        const { db } = await initFirebase();
        const pedidoRef = doc(db, "pedidos_venda", pedido.firebaseId);
        await updateDoc(pedidoRef, {
          impressoPor,
          dataImpressao
        });
      } catch (err) {
        console.error("Erro ao salvar dados de impressão:", err);
      }
    }

    const dataObj = new Date(dataImpressao);
    const dataFormatada = dataObj.toLocaleDateString('pt-BR');
    const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Abrir os detalhes do pedido em uma nova janela para impressão
    const printContent = `
      <html>
        <head>
          <title>Impressão de Pedido - ${pedido.id_externo || pedido.id}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>Pedido: ${pedido.id_externo || pedido.id}</h2>
          <p><strong>Cliente:</strong> ${pedido.cliente?.nome}</p>
          <p><strong>Data:</strong> ${new Date(pedido.dataHora).toLocaleString('pt-BR')}</p>
          
          <h3>Itens</h3>
          <table>
            <thead>
              <tr>
                <th>Código do Produto</th>
                <th>Descrição</th>
                <th>Local Estoque</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${(pedido.itens || []).map((item: any) => `
                <tr>
                  <td>${item.codigo || item.sku || '-'}</td>
                  <td>${item.descricao || item.nome || '-'}</td>
                  <td>${item.localEstoque || '-'}</td>
                  <td>${item.quantidade}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 12px; color: #555;">
            Impresso em: ${dataFormatada}, na hora de: ${horaFormatada} por ${impressoPor}
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  const handleSolicitarCompra = (pedido: any) => {
    alert("Solicitação de compra enviada para os itens em falta do pedido " + (pedido.id_externo || pedido.id));
  };

  const handleSeparadoEConferido = async (pedido: any) => {
    try {
      const { db } = await initFirebase();
      const pedidoRef = doc(db, "pedidos_venda", pedido.firebaseId);
      await updateDoc(pedidoRef, {
        status: "AGUARDANDO EMISSÃO N.F."
      });
      alert("Pedido marcado como Separado e Conferido. Status atualizado para AGUARDANDO EMISSÃO N.F.");
    } catch (err: any) {
      alert("Erro ao atualizar o status do pedido: " + err.message);
    }
  };

  const filteredPedidos = pedidos.filter((pedido) => {
    const id = pedido.id_externo || pedido.id || "";
    const name = pedido.cliente?.nome || "";
    const cpfCnpj = pedido.cliente?.cpfCnpj || "";
    const matchesSearch =
      !searchTerm ||
      id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cpfCnpj.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority =
      selectedPriority === "Todas" ||
      (pedido.prioridade || "Média") === selectedPriority;

    return matchesSearch && matchesPriority;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos Online (Expedição)</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de Separação e Conferência de Pedidos</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar pedidos..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px]"
            />
          </div>
          <button
            onClick={async () => {
              if (window.confirm("Deseja limpar todos os pedidos simulados (Maria Aparecida)?")) {
                try {
                  const { db } = await initFirebase();
                  // We'll iterate and delete
                  pedidos.forEach(async (p) => {
                    if (p.cliente?.nome === "Maria Aparecida da Silva") {
                      const { deleteDoc } = await import("firebase/firestore");
                      await deleteDoc(doc(db, "pedidos_venda", p.firebaseId));
                    }
                  });
                  alert("Pedidos simulados removidos.");
                } catch(e: any) {
                  alert("Erro ao limpar: " + e.message);
                }
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
          >
            <AlertTriangle size={16} />
            Limpar Simulados
          </button>
          <button
            onClick={handleSimularVenda}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {processing ? (
              "Processando..."
            ) : (
              <>
                <Plus size={16} />
                Simular Nova Venda E-commerce
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Filtros de Prioridade */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Filtrar por Urgência:</span>
          <div className="flex flex-wrap gap-1.5">
            {["Todas", "Alta", "Média", "Baixa"].map((priority) => {
              const isActive = selectedPriority === priority;
              const colorClasses = 
                priority === "Alta" ? (isActive ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50") :
                priority === "Média" ? (isActive ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50") :
                priority === "Baixa" ? (isActive ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50") :
                (isActive ? "bg-slate-700 text-white border-slate-700 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50");

              return (
                <button
                  key={priority}
                  onClick={() => setSelectedPriority(priority)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-all ${colorClasses}`}
                >
                  {priority === "Alta" && "🔴 "}
                  {priority === "Média" && "🟡 "}
                  {priority === "Baixa" && "🔵 "}
                  {priority}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Exibindo <span className="font-semibold text-slate-900">{filteredPedidos.length}</span> {filteredPedidos.length === 1 ? "pedido" : "pedidos"}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4">ID Pedido</th>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status do Pedido</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-100 rounded w-20 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredPedidos.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="mx-auto mb-3 text-slate-400 animate-bounce" size={32} />
            <p className="font-semibold text-slate-700">Nenhum pedido encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Não há pedidos pendentes que correspondam aos termos de busca ou prioridade selecionada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4">ID Pedido</th>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status do Pedido</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPedidos.map((pedido) => (
                  <tr key={pedido.firebaseId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{pedido.id_externo || pedido.id}</td>
                    <td className="px-6 py-4">{new Date(pedido.dataHora).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <div>{pedido.cliente?.nome}</div>
                      <div className="text-xs text-slate-400">{pedido.cliente?.cpfCnpj}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(pedido.totais?.totalPedido || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={pedido.prioridade || "Média"}
                        onChange={(e) => handlePriorityChange(pedido, e.target.value)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border cursor-pointer outline-none transition-all ${getPriorityStyle(pedido.prioridade || "Média")}`}
                      >
                        <option value="Alta">🔴 Alta</option>
                        <option value="Média">🟡 Média</option>
                        <option value="Baixa">🔵 Baixa</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusStyle(pedido.status)}`}>
                        {pedido.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => handleImprimir(pedido)}
                          title="Imprimir Pedido"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Printer size={18} />
                        </button>
                        <button 
                          onClick={() => handleSolicitarCompra(pedido)}
                          title="Solicitar Compra"
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        >
                          <ShoppingCart size={18} />
                        </button>
                        <button 
                          onClick={() => handleSeparadoEConferido(pedido)}
                          title="Separado e Conferido"
                          disabled={pedido.status === "AGUARDANDO EMISSÃO N.F." || pedido.status === "AGUARDANDO EMISSÃO DE NOTA FISCAL" || pedido.status === CONFIG.STATUS.FATURADO || pedido.status === CONFIG.STATUS.DESPACHADO}
                          className={`p-1.5 rounded-lg transition-colors ${
                            pedido.status === "AGUARDANDO EMISSÃO N.F." || pedido.status === "AGUARDANDO EMISSÃO DE NOTA FISCAL" || pedido.status === CONFIG.STATUS.FATURADO || pedido.status === CONFIG.STATUS.DESPACHADO
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          <CheckCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
