import { useState, useCallback } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { ReportDefinition } from "./reportCatalog";

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (report: ReportDefinition, filters: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      let rows: any[] = [];
      const dbSnapshots: Record<string, any[]> = {};

      // Pre-fetch all needed collections for the selected report
      for (const col of report.sourceCollections) {
        const snap = await getDocs(collection(db, col));
        dbSnapshots[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const { startDate, endDate } = filters;
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86400000 : Infinity; // Include the end day fully

      // Apply specific report logic
      switch (report.id) {
        // ADMIN
        case "admin_users": {
          rows = dbSnapshots["users"] || [];
          if (filters.role && filters.role !== "Todos") {
            rows = rows.filter(r => r.role === filters.role);
          }
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "admin_employees": {
          rows = (dbSnapshots["empregados"] || []).map(r => ({
            ...r,
            status: r.ativo ? "Ativo" : "Inativo",
            salarioNum: Number(r.salario?.replace(/\D/g, '')) / 100 // assuming format like R$ 1.500,00
          }));
          if (filters.department && filters.department !== "Todos") {
            rows = rows.filter(r => r.departamento === filters.department);
          }
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "admin_logs": {
          rows = (dbSnapshots["logs_sistema"] || []).filter(r => {
            const time = new Date(r.timestamp).getTime();
            return time >= start && time <= end;
          });
          if (filters.modulo && filters.modulo !== "Todos") {
            rows = rows.filter(r => r.modulo === filters.modulo);
          }
          break;
        }

        // COMERCIAL
        case "com_sales": {
          rows = (dbSnapshots["pedidos_venda"] || []).filter(r => {
            const time = new Date(r.dataHora).getTime();
            return time >= start && time <= end;
          }).map(r => ({
            id: r.id_externo || r.id,
            cliente: r.cliente?.nome || r.cliente,
            dataHora: r.dataHora,
            formaPagamento: r.pagamento?.metodo === "17" ? "PIX" : r.pagamento?.metodo === "03" ? "Cartão" : r.pagamento?.metodo === "15" ? "Boleto" : "Outro",
            itensCount: (r.itens || []).length,
            total: r.totais?.totalPedido || r.pagamento?.valor || 0,
            status: r.status
          }));
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          if (filters.formaPagamento && filters.formaPagamento !== "Todos") {
            rows = rows.filter(r => r.pagamento?.metodo === filters.formaPagamento);
          }
          break;
        }
        case "com_clients": {
          rows = (dbSnapshots["users"] || []).filter(u => u.role === "cliente").map(u => ({
            id: u.id,
            nome: u.displayName || u.email,
            tipoCadastro: "Pessoa Física",
            level: u.level || "Bronze",
            comprasCount: 0,
            cashbackSaldo: u.cashbackBalance || 0,
            comprasAcumulado: 0,
            status: u.status || "Ativo"
          }));

          const pedidos = dbSnapshots["pedidos_venda"] || [];
          rows.forEach(r => {
            const clientOrders = pedidos.filter(p => p.cliente?.email === r.email || p.cliente?.uid === r.id);
            r.comprasCount = clientOrders.length;
            r.comprasAcumulado = clientOrders.reduce((acc, o) => acc + (o.totais?.totalPedido || o.pagamento?.valor || 0), 0);
          });

          if (filters.level && filters.level !== "Todos") {
            rows = rows.filter(r => r.level === filters.level);
          }
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "com_inventory": {
          rows = (dbSnapshots["produtos"] || []).map(p => {
            const min = p.estoqueMinimo || 5;
            const cur = p.estoque || 0;
            let status = "Regular";
            if (cur <= 0) status = "Crítico";
            else if (cur <= min) status = "Baixo";
            else if (cur > min * 3) status = "Alto";
            return {
              id: p.id,
              sku: p.sku,
              nome: p.nome,
              categoria: p.categoria || "Geral",
              qtdAtual: cur,
              custoUltimo: p.precoBase || 0,
              precoVenda: p.precoVenda || 0,
              statusEstoque: status
            };
          });
          if (filters.statusEstoque && filters.statusEstoque !== "Todos") {
            rows = rows.filter(r => r.statusEstoque === filters.statusEstoque);
          }
          break;
        }
        case "com_abc": {
          const pedidos = (dbSnapshots["pedidos_venda"] || []).filter(r => {
            const time = new Date(r.dataHora).getTime();
            return time >= start && time <= end;
          });
          const productStats: Record<string, any> = {};
          
          pedidos.forEach(p => {
            if (p.itens && Array.isArray(p.itens)) {
              p.itens.forEach((i: any) => {
                if (!productStats[i.codigo]) {
                  productStats[i.codigo] = { sku: i.codigo, nome: i.nome, qtdVendida: 0, faturamento: 0 };
                }
                productStats[i.codigo].qtdVendida += i.quantidade || 1;
                productStats[i.codigo].faturamento += (i.quantidade || 1) * (i.precoUnitario || 0);
              });
            }
          });

          rows = Object.values(productStats).sort((a, b) => b.faturamento - a.faturamento);
          const totalFaturamento = rows.reduce((acc, r) => acc + r.faturamento, 0);
          
          let acumulado = 0;
          rows.forEach(r => {
            acumulado += r.faturamento;
            r.percAcumulado = totalFaturamento > 0 ? (acumulado / totalFaturamento) * 100 : 0;
            if (r.percAcumulado <= 80) r.curva = "A";
            else if (r.percAcumulado <= 95) r.curva = "B";
            else r.curva = "C";
          });
          break;
        }
        case "com_cashback_extrato": {
          rows = (dbSnapshots["users"] || []).filter(u => u.role === "cliente").map(u => ({
            id: u.id,
            cliente: u.displayName || u.email,
            level: u.level || "Bronze",
            totalCreditado: u.cashbackTotalEarned || 0,
            totalResgatado: u.cashbackTotalSpent || 0,
            saldoAtual: u.cashbackBalance || 0
          }));
          if (filters.level && filters.level !== "Todos") {
            rows = rows.filter(r => r.level === filters.level);
          }
          break;
        }

        // EXPEDIÇÃO
        case "exp_entregas": {
          rows = (dbSnapshots["entregas"] || []).filter(r => {
            const time = r.dataDespacho ? new Date(r.dataDespacho).getTime() : new Date().getTime();
            return time >= start && time <= end;
          });
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "exp_divergencias": {
          const pedidos = (dbSnapshots["pedidos_venda"] || []).filter(r => {
            const time = new Date(r.dataHora).getTime();
            return time >= start && time <= end;
          });
          pedidos.forEach(p => {
            if (p.itens && Array.isArray(p.itens)) {
              p.itens.forEach((i: any) => {
                const pedida = i.quantidade || 0;
                const conferida = i.qtdConferida !== undefined ? i.qtdConferida : pedida;
                if (pedida !== conferida) {
                  rows.push({
                    id: `${p.id}-${i.codigo}`,
                    pedidoId: p.id_externo || p.id,
                    sku: i.codigo,
                    produto: i.nome,
                    qtdPedida: pedida,
                    qtdConferida: conferida,
                    diferenca: conferida - pedida
                  });
                }
              });
            }
          });
          break;
        }

        // FINANCEIRO
        case "fin_cashflow": {
          const rRows = (dbSnapshots["contas_receber"] || []).map(r => ({
            id: r.id,
            tipo: "Entrada",
            descricao: `Recebimento - ${r.cliente}`,
            data: r.vencimento,
            valor: r.valor,
            status: r.status
          }));
          const pRows = (dbSnapshots["contas_pagar"] || []).map(r => ({
            id: r.id,
            tipo: "Saída",
            descricao: `Pagamento - ${r.fornecedor}`,
            data: r.vencimento,
            valor: r.valor,
            status: r.status
          }));
          rows = [...rRows, ...pRows].filter(r => {
            const time = new Date(r.data).getTime();
            return time >= start && time <= end;
          }).sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
          break;
        }
        case "fin_payables": {
          rows = (dbSnapshots["contas_pagar"] || []).filter(r => {
            const time = new Date(r.vencimento).getTime();
            return time >= start && time <= end;
          });
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "fin_receivables": {
          rows = (dbSnapshots["contas_receber"] || []).filter(r => {
            const time = new Date(r.vencimento).getTime();
            return time >= start && time <= end;
          }).map(r => {
            const vDate = new Date(r.vencimento).getTime();
            const now = new Date().getTime();
            const atraso = r.status !== 'Recebido' && now > vDate ? Math.floor((now - vDate) / 86400000) : 0;
            return { ...r, atrasoDias: atraso };
          });
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
        case "fin_dre": {
          // Fake DRE logic for demo
          const recebimentos = (dbSnapshots["contas_receber"] || []).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
          const pagamentos = (dbSnapshots["contas_pagar"] || []).reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
          rows = [
            { codigo: "1", descricao: "Receita Bruta de Vendas", valor: recebimentos, perc: 100 },
            { codigo: "2", descricao: "Deduções de Vendas", valor: recebimentos * 0.1, perc: -10 },
            { codigo: "3", descricao: "Receita Líquida (1-2)", valor: recebimentos * 0.9, perc: 90 },
            { codigo: "4", descricao: "Custo dos Produtos (CMV)", valor: pagamentos * 0.4, perc: -40 },
            { codigo: "5", descricao: "Lucro Bruto (3-4)", valor: recebimentos * 0.9 - pagamentos * 0.4, perc: 50 },
            { codigo: "6", descricao: "Despesas Operacionais", valor: pagamentos * 0.6, perc: -60 },
            { codigo: "7", descricao: "Lucro Operacional (5-6)", valor: (recebimentos * 0.9 - pagamentos * 0.4) - pagamentos * 0.6, perc: -10 }
          ];
          break;
        }
        case "fin_cash_movement": {
          let saldo = 0;
          rows = [
            { id: "1", data: new Date().toISOString(), historico: "Saldo Inicial", tipo: "Entrada", valor: 0, saldo: 0 }
          ];
          break;
        }
        case "fin_bank": {
          rows = (dbSnapshots["bancos"] || []).filter(r => {
            const time = r.data ? new Date(r.data).getTime() : 0;
            return time >= start && time <= end;
          });
          break;
        }
        case "fin_suppliers": {
          rows = (dbSnapshots["fornecedores"] || []).map(f => {
            const compras = (dbSnapshots["contas_pagar"] || []).filter(c => c.fornecedor === f.nome);
            return {
              id: f.id,
              fornecedor: f.nome,
              totalComprado: compras.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
              qtdTitulos: compras.length
            };
          });
          break;
        }
        case "fin_cost_centers": {
          rows = (dbSnapshots["centros_custo"] || []).map(c => {
            const despesas = (dbSnapshots["contas_pagar"] || []).filter(p => p.centroCusto === c.nome);
            return {
              id: c.id,
              centroCusto: c.nome,
              despesas: despesas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0),
              orcamento: c.orcamento || 0
            };
          });
          break;
        }

        // FISCAL
        case "fis_nfe": {
          rows = (dbSnapshots["pedidos_venda"] || []).filter(p => p.nfe).map(p => ({
            id: p.id,
            numero: p.nfe?.numero || "-",
            serie: p.nfe?.serie || "001",
            dataEmissao: p.nfe?.dataEmissao || p.dataHora,
            cliente: p.cliente?.nome || "-",
            valor: p.totais?.totalPedido || 0,
            status: p.nfe?.status || "Autorizada"
          }));
          if (filters.status && filters.status !== "Todos") {
            rows = rows.filter(r => r.status === filters.status);
          }
          break;
        }
      }

      setData(rows);
      return { success: true };
    } catch (err: any) {
      console.error("Error fetching report data:", err);
      const errMsg = err.message || "Erro desconhecido.";
      setError(`Erro ao carregar dados do relatório: ${errMsg}`);
      return { error: errMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, data, error, fetchRows };
}
