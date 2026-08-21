import React, { useState, useEffect } from "react";
import { Plus, Search, CheckCircle, FileText, Truck, ArrowRight, Printer, AlertTriangle, Eye, X, XCircle, FileCheck } from "lucide-react";
import { collection, getDocs, doc, getDoc, onSnapshot, updateDoc, query, where, addDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { processPedido, EXEMPLO_PEDIDO_WEBSITE, CONFIG, faturarPedido } from "../../lib/ecommerceFlow";

export default function Faturamento() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any | null>(null);
  
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [pedidoParaCancelar, setPedidoParaCancelar] = useState<any | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [faturando, setFaturando] = useState(false);

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
            // Filtrar apenas pedidos aguardando nota ou já faturados
            items = items.filter(p => 
              p.status === "AGUARDANDO EMISSÃO N.F." || 
              p.status === "AGUARDANDO EMISSÃO DE NOTA FISCAL" || 
              p.status === CONFIG.STATUS.FATURADO || 
              p.status === CONFIG.STATUS.DESPACHADO ||
              p.status === "Faturamento Cancelado" ||
              p.status === "Cancelado o Faturamento"
            );
            // Ordenar por data (mais recente primeiro)
            items.sort((a: any, b: any) => new Date(b.dataHora || 0).getTime() - new Date(a.dataHora || 0).getTime());
            setPedidos(items);
            setLoading(false);
          },
          (error) => {
            console.warn("Faturamento snapshot error:", error);
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
      // Executa todo o fluxo de ponta a ponta
      await processPedido(EXEMPLO_PEDIDO_WEBSITE);
      alert("Pedido recebido e processado com sucesso pelo fluxo automatizado!");
    } catch (err: any) {
      alert("Erro ao processar pedido: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelarFaturamento = (pedido: any) => {
    setPedidoParaCancelar(pedido);
    setMotivoCancelamento("");
    setCancelError("");
    setIsCancelModalOpen(true);
  };

  const handleFaturar = async (pedido: any) => {
    try {
      setFaturando(true);
      const erros: string[] = [];
      
      // Verificação de Integridade Fiscal
      pedido.itens?.forEach((item: any, idx: number) => {
        if (!item.ncm) erros.push(`Item ${idx + 1} (${item.codigo || 'S/N'}): NCM não informado.`);
        if (!item.cst) erros.push(`Item ${idx + 1} (${item.codigo || 'S/N'}): CST/CSOSN não informado.`);
        if (!item.cfop) erros.push(`Item ${idx + 1} (${item.codigo || 'S/N'}): CFOP não informado.`);
      });

      if (erros.length > 0) {
        alert("Falha na verificação de integridade fiscal dos produtos:\n\n" + erros.join("\n"));
        setFaturando(false);
        return;
      }

      // Simulação da conciliação com SEFAZ
      const res = await faturarPedido(pedido, {
        serie: "001",
        ambiente: "2",
      });

      // ---- COMMISSION GENERATION ----
      try {
        const { db } = await initFirebase();
        const clienteEmail = pedido.cliente?.email || pedido.clienteEmail || "";
        if (clienteEmail) {
          const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", clienteEmail)));
          let codigoIndicacao = null;
          if (!userSnap.empty) {
            codigoIndicacao = userSnap.docs[0].data().codigoIndicacao;
          } else {
            const crmSnap = await getDocs(query(collection(db, "clientes_crm"), where("email", "==", clienteEmail)));
            if (!crmSnap.empty) {
               codigoIndicacao = crmSnap.docs[0].data().codigoIndicacao;
            }
          }
          
          if (codigoIndicacao) {
            // Find the promotional code
            const codigosSnap = await getDocs(query(
               collection(db, "codigos_indicacao"),
               where("codigo", "==", codigoIndicacao),
               where("status", "==", "Ativo")
            ));
            
            if (!codigosSnap.empty) {
               const codigoData = codigosSnap.docs[0].data();
               const hoje = new Date().toISOString().split('T')[0];
               
               if ((!codigoData.dataValidadeInicial || hoje >= codigoData.dataValidadeInicial) && 
                   (!codigoData.dataValidadeFinal || hoje <= codigoData.dataValidadeFinal)) {
                   
                   const percentual = codigoData.porcentagem || 0;
                   if (percentual > 0 && codigoData.beneficiarioId) {
                     const valorTotal = pedido.total || pedido.valorTotal || pedido.totais?.totalPedido || 0;
                     const valorComissao = (valorTotal * percentual) / 100;
                     
                     // 1. Add to comissoes collection
                     await addDoc(collection(db, "comissoes"), {
                        pedidoId: pedido.firebaseId || pedido.id || "N/A",
                        numeroPedido: pedido.codigo || pedido.numero || "N/A",
                        clienteNome: pedido.cliente?.nome || pedido.clienteNome || "N/A",
                        consultorId: codigoData.beneficiarioId,
                        consultorNome: codigoData.descricao || "Beneficiário",
                        codigoIndicacao,
                        valorVenda: valorTotal,
                        percentual,
                        valorComissao,
                        status: "Aprovado",
                        dataCriacao: new Date().toISOString()
                     });

                     // 2. Add cashback to the beneficiary user
                     const beneficiarioRef = doc(db, "users", codigoData.beneficiarioId);
                     const beneficiarioSnap = await getDoc(beneficiarioRef);
                     if (beneficiarioSnap.exists()) {
                        const currentBalance = beneficiarioSnap.data().cashbackBalance || 0;
                        await updateDoc(beneficiarioRef, {
                           cashbackBalance: currentBalance + valorComissao
                        });
                        
                        await addDoc(collection(db, "users", codigoData.beneficiarioId, "cashback_transactions"), {
                           amount: valorComissao,
                           type: "earning",
                           date: new Date().toISOString(),
                           description: `Comissão por indicação (Pedido #${pedido.codigo || pedido.numero || 'N/A'})`,
                           status: "Aprovado",
                           codigoIndicacao
                        });
                     }
                   }
               }
            }
          }
        }
      } catch (err: any) {
        console.error("Erro ao gerar comissão:", err);
      }

      // ---- BUYER CASHBACK GENERATION ----
      try {
        const { db } = await initFirebase();
        const clienteEmail = pedido.cliente?.email || pedido.clienteEmail || "";
        if (clienteEmail) {
          const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", clienteEmail)));
          if (!userSnap.empty) {
            const userDoc = userSnap.docs[0];
            const userData = userDoc.data();
            const level = userData.level || "Bronze";
            const userId = userDoc.id;
            
            // Fetch club rules
            const rulesSnap = await getDocs(collection(db, "clube_beneficios"));
            let percentualCashback = 1; // fallback
            
            if (!rulesSnap.empty) {
               const rule = rulesSnap.docs.map(d => d.data()).find(r => r.nivel?.toLowerCase() === level.toLowerCase());
               if (rule) {
                 percentualCashback = Number(rule.percentual) || 0;
               }
            } else {
               if (level.toLowerCase() === "prata") percentualCashback = 2.5;
               else if (level.toLowerCase() === "ouro") percentualCashback = 5;
            }

            if (percentualCashback > 0) {
              const valorTotal = pedido.total || pedido.valorTotal || pedido.totais?.totalPedido || 0;
              const cashbackGanhado = (valorTotal * percentualCashback) / 100;
              
              if (cashbackGanhado > 0) {
                 const currentBalance = userData.cashbackBalance || 0;
                 await updateDoc(doc(db, "users", userId), {
                    cashbackBalance: currentBalance + cashbackGanhado
                 });
                 
                 await addDoc(collection(db, "users", userId, "cashback_transactions"), {
                    amount: cashbackGanhado,
                    type: "earning",
                    date: new Date().toISOString(),
                    description: `Cashback pela compra (Pedido #${pedido.codigo || pedido.numero || 'N/A'}) - Nível ${level}`,
                    status: "Aprovado"
                 });
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Erro ao gerar cashback do comprador:", err);
      }
      // -----------------------------------

      // LOG ACTION FOR BILLING
      await logAction(
        `Faturamento do pedido #${pedido.codigo || pedido.numero || pedido.id || "N/A"} (NF-e Emitida)`,
        "Financeiro",
        { 
          pedidoId: pedido.firebaseId || pedido.id || "N/A", 
          cliente: pedido.clienteNome || pedido.cliente || "N/A",
          valorTotal: pedido.total || pedido.valorTotal || 0,
          nfeNumero: res.nfe?.numero || "N/A"
        }
      );

      alert("Conciliação com SEFAZ realizada e Pedido Faturado com sucesso!\n\nNF-e: " + res.nfe?.numero);
    } catch (err: any) {
      alert("Erro ao sincronizar com SEFAZ / Faturar: " + err.message);
    } finally {
      setFaturando(false);
    }
  };

  const confirmarCancelamento = async () => {
    if (motivoCancelamento.length < 150) {
      setCancelError("O motivo do cancelamento deve ser detalhado e ter no mínimo 150 caracteres.");
      return;
    }

    try {
      const { db } = await initFirebase();
      const pedidoRef = doc(db, "pedidos_venda", pedidoParaCancelar.firebaseId);
      
      const auth = getAuth();
      const usuarioLogado = auth.currentUser?.email || "Administrador";

      const observacaoAntiga = pedidoParaCancelar.observacoes || "";
      const separador = observacaoAntiga ? "\n" : "";
      const novaObservacao = `${observacaoAntiga}${separador}Motivo do Cancelamento: ${motivoCancelamento} (${usuarioLogado})`;
      
      const novoHistorico = [...(pedidoParaCancelar.historico || []), {
        status: "Faturamento Cancelado",
        dataHora: new Date().toISOString(),
        descricao: `Faturamento cancelado. Motivo: ${motivoCancelamento}`,
        usuario: usuarioLogado
      }];

      await updateDoc(pedidoRef, {
        status: "Faturamento Cancelado",
        observacoes: novaObservacao,
        historico: novoHistorico
      });

      // LOG ACTION FOR BILLING CANCELATION
      await logAction(
        `Cancelamento do faturamento do pedido #${pedidoParaCancelar.codigo || pedidoParaCancelar.numero || "N/A"}`,
        "Financeiro",
        {
          pedidoId: pedidoParaCancelar.firebaseId || pedidoParaCancelar.id || "N/A",
          cliente: pedidoParaCancelar.clienteNome || pedidoParaCancelar.cliente || "N/A",
          valorTotal: pedidoParaCancelar.total || pedidoParaCancelar.valorTotal || 0,
          motivo: motivoCancelamento
        }
      );
      
      alert("Faturamento cancelado com sucesso.");
      setIsCancelModalOpen(false);
      setPedidoParaCancelar(null);
    } catch (err: any) {
      setCancelError("Erro ao cancelar faturamento: " + err.message);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case CONFIG.STATUS.NOVO:
        return "text-slate-700 font-medium";
      case CONFIG.STATUS.EM_CONFERENCIA:
        return "text-amber-700 font-medium";
      case CONFIG.STATUS.CONFERIDO:
        return "text-emerald-700 font-medium";
      case CONFIG.STATUS.FATURADO:
        return "text-blue-700 font-medium";
      case CONFIG.STATUS.DESPACHADO:
        return "text-green-800 font-medium";
      case "AGUARDANDO EMISSÃO N.F.":
      case "AGUARDANDO EMISSÃO DE NOTA FISCAL":
        return "text-orange-500 font-medium";
      case "Cancelado o Faturamento":
      case "Faturamento Cancelado":
        return "text-red-700 font-medium";
      default:
        return "text-slate-700 font-medium";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCpfCnpj = (value?: string) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
  };

  const handleVisualizar = (pedido: any) => {
    setPedidoSelecionado(pedido);
  };

  const handleImprimir = (pedido: any) => {
    const printContent = `
      <html>
        <head>
          <title>Impressão - Faturamento ${pedido.id_externo || pedido.id}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>Faturamento - Pedido: ${pedido.id_externo || pedido.id}</h2>
          <p><strong>Cliente:</strong> ${pedido.cliente?.nome}</p>
          <p><strong>CPF/CNPJ:</strong> ${formatCpfCnpj(pedido.cliente?.cpfCnpj) || ''}</p>
          <p><strong>Endereço:</strong> ${pedido.cliente?.endereco?.logradouro || ''}, ${pedido.cliente?.endereco?.numero || ''} ${pedido.cliente?.endereco?.complemento ? ' - ' + pedido.cliente?.endereco?.complemento : ''} - ${pedido.cliente?.endereco?.bairro || ''} - ${pedido.cliente?.endereco?.municipio || ''}/${pedido.cliente?.endereco?.uf || ''} - CEP: ${pedido.cliente?.endereco?.cep || ''}</p>
          <p><strong>Data:</strong> ${new Date(pedido.dataHora).toLocaleString('pt-BR')}</p>
          <p><strong>Total:</strong> ${formatCurrency(pedido.totais?.totalPedido || 0)}</p>
          
          <h3>Itens</h3>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Preço Unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${(pedido.itens || []).map((item: any) => {
                const vlrUnit = item.valorUnitario || item.precoUnitario || 0;
                const totalItem = item.valorTotal || (item.quantidade * vlrUnit) || 0;
                return `
                  <tr>
                    <td>${item.descricao || item.nome || ''}</td>
                    <td>${item.quantidade}</td>
                    <td>${formatCurrency(vlrUnit)}</td>
                    <td>${formatCurrency(totalItem)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          ${pedido.observacoes ? `
          <h3>Observações</h3>
          <p style="white-space: pre-wrap;">${pedido.observacoes}</p>
          ` : ''}
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faturamento</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de Faturamento e Emissão de Notas Fiscais</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar pedidos..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[250px]"
            />
          </div>
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
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">NF-e</th>
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
                      <div className="h-4 bg-slate-100 rounded w-12" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-4 bg-slate-100 rounded w-24 mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum pedido recebido. Simule uma venda para iniciar o fluxo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="px-6 py-4">ID Pedido</th>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">NF-e</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pedidos.map((pedido) => (
                  <tr key={pedido.firebaseId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{pedido.id_externo || pedido.id}</td>
                    <td className="px-6 py-4">{new Date(pedido.dataHora).toLocaleString('pt-BR')}</td>
                    <td className="px-6 py-4">
                      <div>{pedido.cliente?.nome}</div>
                      <div className="text-xs text-slate-400">{formatCpfCnpj(pedido.cliente?.cpfCnpj)}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {formatCurrency(pedido.totais?.totalPedido || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold uppercase ${getStatusStyle(pedido.status)}`}>
                        {pedido.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {pedido.nfe ? (
                        <div className="flex items-center gap-2 text-blue-600 font-medium">
                          <FileText size={16} />
                          {pedido.nfe.numero}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Pendente</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => handleVisualizar(pedido)}
                          title="Visualizar em Tela"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleImprimir(pedido)}
                          title="Imprimir Pedido"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Printer size={18} />
                        </button>
                        {pedido.status === "AGUARDANDO EMISSÃO N.F." && (
                          <button 
                            onClick={() => handleFaturar(pedido)}
                            disabled={faturando}
                            title="Faturar"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <FileCheck size={18} />
                          </button>
                        )}
                        {pedido.status !== "Cancelado o Faturamento" && pedido.status !== "Faturamento Cancelado" && (
                          <button 
                            onClick={() => handleCancelarFaturamento(pedido)}
                            title="Cancelar Faturamento"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6">
        <h3 className="text-blue-900 font-bold mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-blue-600" />
          Como funciona a integração automatizada
        </h3>
        <div className="flex items-center gap-4 text-sm text-blue-800/80">
          <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-blue-50">
            <strong>1. E-commerce</strong>
            <p className="mt-1 text-xs">Cliente finaliza compra no site, gerando pedido no CRM.</p>
          </div>
          <ArrowRight size={20} className="text-blue-300 flex-shrink-0" />
          <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-blue-50">
            <strong>2. Expedição</strong>
            <p className="mt-1 text-xs">Itens são separados e conferidos no estoque central.</p>
          </div>
          <ArrowRight size={20} className="text-blue-300 flex-shrink-0" />
          <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-blue-50">
            <strong>3. Faturamento</strong>
            <p className="mt-1 text-xs">NF-e é emitida, validando impostos como ICMS e CST.</p>
          </div>
          <ArrowRight size={20} className="text-blue-300 flex-shrink-0" />
          <div className="flex-1 bg-white p-4 rounded-lg shadow-sm border border-blue-50">
            <strong>4. Entregas</strong>
            <p className="mt-1 text-xs">Pedido e NF-e enviados ao painel logístico (Em Rota).</p>
          </div>
        </div>
      </div>

      {pedidoSelecionado && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" />
                Espelho da Nota Fiscal - Pedido {pedidoSelecionado.id_externo || pedidoSelecionado.id}
              </h2>
              <button 
                onClick={() => setPedidoSelecionado(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Cliente */}
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Dados do Cliente / Destinatário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Razão Social / Nome</span>
                    <span className="font-medium text-slate-900">{pedidoSelecionado.cliente?.nome || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">CNPJ / CPF</span>
                    <span className="font-medium text-slate-900">{formatCpfCnpj(pedidoSelecionado.cliente?.cpfCnpj) || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">E-mail</span>
                    <span className="font-medium text-slate-900">{pedidoSelecionado.cliente?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Telefone</span>
                    <span className="font-medium text-slate-900">{pedidoSelecionado.cliente?.telefone || 'N/A'}</span>
                  </div>
                  <div className="lg:col-span-2">
                    <span className="block text-slate-500 text-xs mb-1">Endereço de Entrega</span>
                    <span className="font-medium text-slate-900">
                      {pedidoSelecionado.cliente?.endereco?.logradouro}, {pedidoSelecionado.cliente?.endereco?.numero} 
                      {pedidoSelecionado.cliente?.endereco?.complemento && ` - ${pedidoSelecionado.cliente?.endereco?.complemento}`}
                      <br/>
                      {pedidoSelecionado.cliente?.endereco?.bairro} - {pedidoSelecionado.cliente?.endereco?.municipio}/{pedidoSelecionado.cliente?.endereco?.uf} - CEP: {pedidoSelecionado.cliente?.endereco?.cep}
                    </span>
                  </div>
                </div>
              </section>

              {/* Impostos / Totais */}
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Cálculo do Imposto</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm mb-4">
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Base de Cálc. ICMS</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency(pedidoSelecionado.totais?.totalPedido * 0.8 || 0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Valor do ICMS</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency((pedidoSelecionado.totais?.totalPedido * 0.8) * 0.18 || 0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Base de Cálc. ICMS ST</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency(0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Valor do ICMS ST</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency(0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Valor Total dos Produtos</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency(pedidoSelecionado.totais?.subtotal || 0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Valor do Frete</span>
                    <span className="font-medium text-slate-900 text-right block">{formatCurrency(pedidoSelecionado.totais?.frete || 0)}</span>
                  </div>
                  <div className="border border-slate-200 rounded p-2">
                    <span className="block text-slate-500 text-[10px] uppercase mb-1">Valor Total do Pedido</span>
                    <span className="font-medium text-blue-700 text-right block">{formatCurrency(pedidoSelecionado.totais?.totalPedido || 0)}</span>
                  </div>
                </div>
              </section>

              {/* Transportador / Volumes */}
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Transportador / Volumes Transportados</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                  <div className="lg:col-span-2">
                    <span className="block text-slate-500 text-xs mb-1">Razão Social</span>
                    <span className="font-medium text-slate-900">Correios / Transportadora Padrão</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Frete por Conta</span>
                    <span className="font-medium text-slate-900">0 - Emitente</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">CNPJ / CPF</span>
                    <span className="font-medium text-slate-900">00.000.000/0001-00</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Quantidade</span>
                    <span className="font-medium text-slate-900">{pedidoSelecionado.itens?.length || 0}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Espécie</span>
                    <span className="font-medium text-slate-900">Volumes</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Peso Bruto</span>
                    <span className="font-medium text-slate-900">2.500 kg</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 text-xs mb-1">Peso Líquido</span>
                    <span className="font-medium text-slate-900">2.300 kg</span>
                  </div>
                </div>
              </section>

              {/* Produtos */}
              <section>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Dados do Produto/Serviço</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-y border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Código</th>
                        <th className="px-3 py-2 font-medium">Descrição do Produto/Serviço</th>
                        <th className="px-3 py-2 font-medium">NCM/SH</th>
                        <th className="px-3 py-2 font-medium">CST</th>
                        <th className="px-3 py-2 font-medium">CFOP</th>
                        <th className="px-3 py-2 font-medium">UN</th>
                        <th className="px-3 py-2 font-medium text-right">Qtd</th>
                        <th className="px-3 py-2 font-medium text-right">Vlr. Unit</th>
                        <th className="px-3 py-2 font-medium text-right">Vlr. Total</th>
                        <th className="px-3 py-2 font-medium text-right">Base ICMS</th>
                        <th className="px-3 py-2 font-medium text-right">Vlr. ICMS</th>
                        <th className="px-3 py-2 font-medium text-right">Vlr. IPI</th>
                        <th className="px-3 py-2 font-medium text-right">% ICMS</th>
                        <th className="px-3 py-2 font-medium text-right">% IPI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(pedidoSelecionado.itens || []).map((item: any, index: number) => {
                        const vlrUnit = item.valorUnitario || item.precoUnitario || 0;
                        const totalItem = item.valorTotal || (item.quantidade * vlrUnit) || 0;
                        const baseIcms = totalItem;
                        const vlrIcms = item.valorIcms || (baseIcms * 0.18);
                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{item.codigo || item.id || item.produtoId || '00' + (index+1)}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{item.descricao || item.nome || ''}</td>
                            <td className="px-3 py-2">{item.ncm || '8517.12.31'}</td>
                            <td className="px-3 py-2">{item.cst || '000'}</td>
                            <td className="px-3 py-2">{item.cfop || '5102'}</td>
                            <td className="px-3 py-2">{item.unidade || 'UN'}</td>
                            <td className="px-3 py-2 text-right">{item.quantidade}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(vlrUnit)}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(totalItem)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(baseIcms)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(vlrIcms)}</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(0)}</td>
                            <td className="px-3 py-2 text-right">{item.aliquotaIcms || '18.00'}</td>
                            <td className="px-3 py-2 text-right">0.00</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Observações */}
              {pedidoSelecionado.observacoes && (
                <section>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Dados Adicionais</h3>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                    <span className="block font-medium mb-1">Observações:</span>
                    {pedidoSelecionado.observacoes}
                  </div>
                </section>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setPedidoSelecionado(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white font-medium text-sm transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  handleImprimir(pedidoSelecionado);
                  setPedidoSelecionado(null);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Printer size={16} />
                Imprimir Espelho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {isCancelModalOpen && pedidoParaCancelar && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="text-red-600" />
                Cancelar Faturamento
              </h2>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Pedido <strong>#{pedidoParaCancelar.id_externo || pedidoParaCancelar.id}</strong>. 
                Por favor, informe de maneira detalhada o Motivo do Cancelamento.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Motivo (Mínimo 150 caracteres)
                </label>
                <textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[120px]"
                  placeholder="Descreva detalhadamente por que este faturamento está sendo cancelado..."
                />
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-xs ${motivoCancelamento.length < 150 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {motivoCancelamento.length} / 150 caracteres
                  </span>
                </div>
              </div>

              {cancelError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg mb-4">
                  {cancelError}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-white font-medium text-sm transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={confirmarCancelamento}
                disabled={motivoCancelamento.length < 150}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
