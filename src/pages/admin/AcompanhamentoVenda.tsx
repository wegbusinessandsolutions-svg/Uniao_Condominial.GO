import React, { useState, useEffect } from "react";
import { Eye, Search, Clock, FileText, ArrowRight, X, Printer } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";

export default function AcompanhamentoVenda() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;

    const loadData = async () => {
      try {
        const { db } = await initFirebase();
        const q = collection(db, "pedidos_venda");
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            let items = snapshot.docs.map((d) => ({
              firebaseId: d.id,
              ...d.data(),
            })) as any[];
            
            items.sort(
              (a: any, b: any) =>
                new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime()
            );
            setPedidos(items);
            setLoading(false);
          },
          (error) => {
            console.warn("AcompanhamentoVenda snapshot error:", error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error("Erro ao carregar pedidos:", error);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calcularTempo = (dataInicio: string, dataFim?: string) => {
    const inicio = new Date(dataInicio).getTime();
    const fim = dataFim ? new Date(dataFim).getTime() : new Date().getTime();
    
    if (isNaN(inicio) || isNaN(fim)) return "0 min";
    
    const diffMs = Math.abs(fim - inicio);
    
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const partes = [];
    if (dias > 0) partes.push(`${dias}d`);
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0 || partes.length === 0) partes.push(`${minutos}m`);
    
    return partes.join(" ");
  };

  const calcularTempoEmMinutos = (dataInicio: string, dataFim?: string) => {
    const inicio = new Date(dataInicio).getTime();
    const fim = dataFim ? new Date(dataFim).getTime() : new Date().getTime();
    
    if (isNaN(inicio) || isNaN(fim)) return "0 min";
    
    const diffMs = Math.abs(fim - inicio);
    const minutos = Math.floor(diffMs / (1000 * 60));
    
    return `${minutos} min`;
  };

  const handleImprimir = (pedido: any) => {
    const historicoHtml = (pedido.historico || []).map((evento: any, idx: number, arr: any[]) => {
      const dataProximo = idx > 0 ? arr[idx - 1].dataHora : undefined;
      const tempoDecorrido = calcularTempo(evento.dataHora, dataProximo);
      
      return `
        <div style="margin-bottom: 15px; border-left: 2px solid #ccc; padding-left: 15px;">
          <h4 style="margin: 0;">${evento.status}</h4>
          <p style="margin: 5px 0; color: #555;">${new Date(evento.dataHora).toLocaleString("pt-BR")} 
          - <span style="color: #0284c7; font-weight: bold;">Tempo na fase: ${tempoDecorrido}</span>
          </p>
          <p style="margin: 0; font-size: 14px;">${evento.descricao}</p>
          ${evento.usuario ? `<p style="margin: 0; font-size: 12px; color: #888;">Por: ${evento.usuario}</p>` : ''}
        </div>
      `;
    }).join("");

    const dataSolicitacao = pedido.dataHora || (pedido.historico && pedido.historico.length > 0 ? pedido.historico[pedido.historico.length - 1].dataHora : new Date().toISOString());
    const dataFinal = pedido.historico && pedido.historico.length > 0 ? pedido.historico[0].dataHora : new Date().toISOString();
    const tempoTotal = calcularTempoEmMinutos(dataSolicitacao, dataFinal);

    const printContent = `
      <html>
        <head>
          <title>Acompanhamento de Venda - Pedido #${pedido.id_externo || pedido.id}</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
            h2 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
            .info-item { background: #f8fafc; padding: 10px 15px; border-radius: 5px; }
            .info-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; display: block; }
            .info-value { font-weight: bold; font-size: 15px; }
            .total-time { margin-top: 30px; padding: 15px; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 5px; text-align: center; }
            .total-time strong { color: #0369a1; font-size: 18px; }
          </style>
        </head>
        <body>
          <h2>Andamento do Pedido #${pedido.id_externo || pedido.id}</h2>
          
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Cliente</span>
              <span class="info-value">${pedido.cliente?.nome || 'Não informado'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Data/Hora da Solicitação</span>
              <span class="info-value">${new Date(pedido.dataHora).toLocaleString("pt-BR")}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status Atual</span>
              <span class="info-value">${pedido.status}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Valor Total</span>
              <span class="info-value">${formatCurrency(pedido.totais?.totalPedido || 0)}</span>
            </div>
          </div>
          
          <h3>Histórico de Andamento</h3>
          <div>
            ${historicoHtml || '<p>Nenhum histórico registrado.</p>'}
          </div>
          
          <div class="total-time">
            Tempo Total Decorrido (desde a solicitação): <strong>${tempoTotal}</strong>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const filteredPedidos = pedidos.filter((pedido) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (pedido.id_externo || pedido.id)?.toString().toLowerCase().includes(term) ||
      pedido.cliente?.nome?.toLowerCase().includes(term)
    );
  });

  const handlePrint = (pedido: any) => {
    const printContent = `
      <html>
        <head>
          <title>Acompanhamento de Venda - Pedido #${pedido.id_externo || pedido.id}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h2 { color: #1e293b; margin-bottom: 5px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; }
            .info-grid div { margin-bottom: 5px; }
            .info-grid span.label { color: #64748b; font-size: 12px; display: block; text-transform: uppercase; }
            .info-grid span.value { font-weight: bold; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; font-size: 13px; text-transform: uppercase; color: #475569; }
            td { font-size: 14px; }
            .status-badge { display: inline-block; padding: 3px 8px; background: #e0f2fe; color: #0369a1; border-radius: 12px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Andamento do Pedido #${pedido.id_externo || pedido.id}</h2>
          
          <div class="info-grid">
            <div><span class="label">Cliente</span><span class="value">${pedido.cliente?.nome || 'N/A'}</span></div>
            <div><span class="label">Data/Hora</span><span class="value">${new Date(pedido.dataHora).toLocaleString("pt-BR")}</span></div>
            <div><span class="label">Status Atual</span><span class="value status-badge">${pedido.status}</span></div>
            <div><span class="label">Valor Total</span><span class="value">${formatCurrency(pedido.totais?.totalPedido || 0)}</span></div>
          </div>
          
          <h3>Histórico de Andamento</h3>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Data e Hora</th>
                <th>Descrição</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              ${(pedido.historico || []).map((evento: any) => `
                <tr>
                  <td><strong>${evento.statusAnterior ? `${evento.statusAnterior} → ${evento.novoStatus || evento.status}` : evento.status}</strong></td>
                  <td>${new Date(evento.dataHora).toLocaleString("pt-BR")}</td>
                  <td>${evento.observacao || evento.descricao || '-'}</td>
                  <td>${evento.usuario || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Acompanhamento de Venda
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o andamento dos pedidos no sistema
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Buscar por ID ou Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Número do Pedido</th>
                <th className="px-6 py-4">Nome do Cliente</th>
                <th className="px-6 py-4">Data e Hora</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-48" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-100 rounded w-16 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido, index) => (
                  <tr key={pedido.firebaseId || index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      #{pedido.id_externo || pedido.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {pedido.cliente?.nome || "Não informado"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(pedido.dataHora).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {formatCurrency(pedido.totais?.totalPedido || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setPedidoSelecionado(pedido)}
                          title="Visualizar andamento"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pedidoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" />
                Andamento do Pedido #{pedidoSelecionado.id_externo || pedidoSelecionado.id}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(pedidoSelecionado)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Imprimir"
                >
                  <Printer size={20} />
                </button>
                <button
                  onClick={() => setPedidoSelecionado(null)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                    Informações Gerais
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-slate-500 mb-1">Cliente</span>
                      <span className="font-medium text-slate-900">
                        {pedidoSelecionado.cliente?.nome}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Data/Hora</span>
                      <span className="font-medium text-slate-900">
                        {new Date(pedidoSelecionado.dataHora).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Status Atual</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {pedidoSelecionado.status}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Valor Total</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(pedidoSelecionado.totais?.totalPedido || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                    Histórico de Andamento
                  </h3>
                  <div className="relative pl-6 space-y-6 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-slate-200">
                    {(pedidoSelecionado.historico || []).map((evento: any, idx: number, arr: any[]) => {
                      const dataProximo = idx > 0 ? arr[idx - 1].dataHora : undefined;
                      const tempoDecorrido = calcularTempo(evento.dataHora, dataProximo);
                      return (
                        <div key={idx} className="relative">
                          <div className="absolute -left-6 w-6 h-6 rounded-full bg-blue-100 border-4 border-white flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 text-sm">
                                {evento.statusAnterior ? (
                                  <>
                                    <span className="text-slate-500 font-medium">{evento.statusAnterior}</span>
                                    <span className="mx-2 text-slate-400">→</span>
                                    <span>{evento.novoStatus || evento.status}</span>
                                  </>
                                ) : (
                                  evento.status
                                )}
                              </span>
                              <span className="text-xs text-slate-400">
                                {new Date(evento.dataHora).toLocaleString("pt-BR")}
                              </span>
                              <span className="text-xs font-semibold text-blue-600 ml-2 bg-blue-50 px-2 py-0.5 rounded-full">
                                Tempo: {tempoDecorrido}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">{evento.descricao}</p>
                            {evento.usuario && (
                              <p className="text-xs text-slate-500 mt-1">Por: {evento.usuario}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {(!pedidoSelecionado.historico || pedidoSelecionado.historico.length === 0) && (
                      <div className="text-sm text-slate-500 italic">
                        Nenhum histórico registrado
                      </div>
                    )}
                  </div>

                  {pedidoSelecionado.historico && pedidoSelecionado.historico.length > 0 && (
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100 flex justify-between items-center">
                      <span className="font-medium text-blue-900">Tempo total após solicitação:</span>
                      <span className="text-lg font-bold text-blue-700">
                        {calcularTempoEmMinutos(
                          pedidoSelecionado.dataHora || pedidoSelecionado.historico[pedidoSelecionado.historico.length - 1].dataHora,
                          pedidoSelecionado.historico[0].dataHora
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white font-medium text-sm transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => handleImprimir(pedidoSelecionado)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Printer size={16} />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
