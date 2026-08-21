import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { initFirebase } from "../../lib/firebase";
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  writeBatch,
  updateDoc 
} from "firebase/firestore";
import { 
  AlertTriangle, 
  Trash2, 
  ShieldAlert, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  Database, 
  AlertOctagon, 
  CheckCircle2, 
  X, 
  Users, 
  Coins, 
  Banknote, 
  Receipt, 
  ShoppingCart, 
  MapPin, 
  DollarSign, 
  FileText, 
  Truck, 
  Boxes, 
  Bell, 
  MessageSquare, 
  Activity,
  Layers
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { isAdminRole, isStaffRole } from "../../lib/permissions";
import { logAction } from "../../lib/audit";

interface TableOption {
  key: string;
  label: string;
  description: string;
  category: "Usuários" | "Financeiro" | "Vendas & CRM" | "Operações & Estoque" | "Comunicação & Logs";
  icon: React.ElementType;
  collections: string[];
}

const TABLE_OPTIONS: TableOption[] = [
  {
    key: "usuariosClientes",
    label: "Usuários (Somente Clientes)",
    description: "Remove cadastros com papel de Cliente e suas subcoleções (carrinho, favoritos, etc.). Mantém a equipe interna.",
    category: "Usuários",
    icon: Users,
    collections: ["users"]
  },
  {
    key: "controleCashback",
    label: "Controle & Extratos de Cashback",
    description: "Exclui todas as transações de cashback e zera os saldos acumulados dos clientes.",
    category: "Financeiro",
    icon: Coins,
    collections: ["cashback_transactions"]
  },
  {
    key: "contasPagar",
    label: "Contas a Pagar",
    description: "Exclui todas as contas e despesas cadastradas no módulo financeiro.",
    category: "Financeiro",
    icon: Banknote,
    collections: ["contas_pagar"]
  },
  {
    key: "contasReceber",
    label: "Contas a Receber",
    description: "Exclui todas as cobranças, títulos e parcelas financeiras a receber.",
    category: "Financeiro",
    icon: Receipt,
    collections: ["contas_receber"]
  },
  {
    key: "faturamento",
    label: "Faturamento & Pedidos Faturados",
    description: "Exclui pedidos de venda marcados com status Faturado, Enviado ou Entregue.",
    category: "Financeiro",
    icon: DollarSign,
    collections: ["pedidos_venda"]
  },
  {
    key: "pedidosOnline",
    label: "Pedidos Online (Geral)",
    description: "Exclui todos os pedidos de venda do e-commerce e seus históricos de status.",
    category: "Vendas & CRM",
    icon: ShoppingCart,
    collections: ["pedidos_venda", "suporte_pedidos"]
  },
  {
    key: "visitasCliente",
    label: "Visitas ao Cliente (CRM)",
    description: "Exclui registros de visitas realizadas aos condomínios e clientes.",
    category: "Vendas & CRM",
    icon: MapPin,
    collections: ["visitas_crm"]
  },
  {
    key: "clientesCrm",
    label: "Clientes Cadastrados no CRM",
    description: "Exclui a base de condomínios e leads prospectados pelo comercial.",
    category: "Vendas & CRM",
    icon: Users,
    collections: ["clientes_crm"]
  },
  {
    key: "afiliacoesContratos",
    label: "Afiliações e Contratos",
    description: "Exclui os termos de afiliação e adesão registrados na União Condominial.",
    category: "Vendas & CRM",
    icon: FileText,
    collections: ["afiliados_uc"]
  },
  {
    key: "comissoes",
    label: "Comissões de Vendas",
    description: "Exclui lançamentos de comissões de consultores e vendedores.",
    category: "Financeiro",
    icon: DollarSign,
    collections: ["comissoes"]
  },
  {
    key: "ordensServico",
    label: "Ordens de Serviço",
    description: "Exclui todas as ordens de serviço e solicitações de manutenção de condomínio.",
    category: "Operações & Estoque",
    icon: FileText,
    collections: ["ordens_servico"]
  },
  {
    key: "entregas",
    label: "Entregas & Rastreamentos",
    description: "Exclui roteiros de expedição e entregas de mercadorias.",
    category: "Operações & Estoque",
    icon: Truck,
    collections: ["entregas"]
  },
  {
    key: "estoqueCompras",
    label: "Movimentações de Estoque",
    description: "Exclui o histórico de entradas e saídas de produtos no almoxarifado.",
    category: "Operações & Estoque",
    icon: Boxes,
    collections: ["estoque_movimentacoes"]
  },
  {
    key: "notificacoes",
    label: "Notificações do Sistema",
    description: "Exclui avisos, alertas e mensagens de notificação enviadas aos usuários.",
    category: "Comunicação & Logs",
    icon: Bell,
    collections: ["notifications", "notificacoes_clientes", "notificacoes"]
  },
  {
    key: "muralCondominial",
    label: "Mural Condominial & Avisos",
    description: "Exclui postagens do mural e suas respectivas respostas e comentários.",
    category: "Comunicação & Logs",
    icon: MessageSquare,
    collections: ["muralNotices"]
  },
  {
    key: "logsAuditoria",
    label: "Logs do Sistema e Auditoria",
    description: "Limpa registros de auditoria (logs_sistema, email_logs e logs_backup).",
    category: "Comunicação & Logs",
    icon: Activity,
    collections: ["logs_sistema", "email_logs", "logs_backup"]
  }
];

export default function ManutencaoDados() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedUserForVisits, setSelectedUserForVisits] = useState("all");

  const [selections, setSelections] = useState<Record<string, boolean>>({
    usuariosClientes: false,
    controleCashback: false,
    contasPagar: false,
    contasReceber: false,
    faturamento: false,
    visitasCliente: false,
    clientesCrm: false,
    afiliacoesContratos: false,
    comissoes: false,
    ordensServico: false,
    entregas: false,
    estoqueCompras: false,
    pedidosOnline: false,
    notificacoes: false,
    muralCondominial: false,
    logsAuditoria: false
  });

  const [recordCounts, setRecordCounts] = useState<Record<string, number>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [progressStatus, setProgressStatus] = useState<string>("");
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>("Todas");

  // Determine admin authorization
  const isSuperAdminEmail = 
    profile?.email?.toLowerCase() === "wegbusinessandsolutions@gmail.com" || 
    user?.email?.toLowerCase() === "wegbusinessandsolutions@gmail.com";
  
  const isUserAdmin = 
    isAdminRole(profile?.role) || 
    isSuperAdminEmail || 
    ["administrador", "admin", "master", "superadmin"].includes((profile?.role || "").toLowerCase().trim());

  // Fetch users (for salesperson filter) and approximate counts
  const fetchCountsAndUsers = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const { db } = await initFirebase();
      
      // Fetch users list
      const userSnap = await getDocs(collection(db, "users"));
      const uList = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(uList);

      const counts: Record<string, number> = {};

      // Client users count
      const clientUsers = uList.filter((u: any) => !isStaffRole(u.role) || ["cliente", "customer"].includes((u.role || "").toLowerCase()));
      counts["usuariosClientes"] = clientUsers.length;

      // Parallel count fetch for performance
      const fetchPromises = [
        getDocs(collection(db, "cashback_transactions")).then(s => { counts["controleCashback"] = s.size; }).catch(() => { counts["controleCashback"] = 0; }),
        getDocs(collection(db, "contas_pagar")).then(s => { counts["contasPagar"] = s.size; }).catch(() => { counts["contasPagar"] = 0; }),
        getDocs(collection(db, "contas_receber")).then(s => { counts["contasReceber"] = s.size; }).catch(() => { counts["contasReceber"] = 0; }),
        getDocs(collection(db, "pedidos_venda")).then(s => { 
          counts["pedidosOnline"] = s.size;
          counts["faturamento"] = s.docs.filter(d => ["faturado", "enviado", "entregue"].includes(String(d.data().status || "").toLowerCase())).length;
        }).catch(() => { counts["pedidosOnline"] = 0; counts["faturamento"] = 0; }),
        getDocs(collection(db, "visitas_crm")).then(s => { counts["visitasCliente"] = s.size; }).catch(() => { counts["visitasCliente"] = 0; }),
        getDocs(collection(db, "clientes_crm")).then(s => { counts["clientesCrm"] = s.size; }).catch(() => { counts["clientesCrm"] = 0; }),
        getDocs(collection(db, "afiliados_uc")).then(s => { counts["afiliacoesContratos"] = s.size; }).catch(() => { counts["afiliacoesContratos"] = 0; }),
        getDocs(collection(db, "comissoes")).then(s => { counts["comissoes"] = s.size; }).catch(() => { counts["comissoes"] = 0; }),
        getDocs(collection(db, "ordens_servico")).then(s => { counts["ordensServico"] = s.size; }).catch(() => { counts["ordensServico"] = 0; }),
        getDocs(collection(db, "entregas")).then(s => { counts["entregas"] = s.size; }).catch(() => { counts["entregas"] = 0; }),
        getDocs(collection(db, "estoque_movimentacoes")).then(s => { counts["estoqueCompras"] = s.size; }).catch(() => { counts["estoqueCompras"] = 0; }),
        getDocs(collection(db, "muralNotices")).then(s => { counts["muralCondominial"] = s.size; }).catch(() => { counts["muralCondominial"] = 0; }),
        Promise.all([
          getDocs(collection(db, "notifications")).catch(() => ({ size: 0 })),
          getDocs(collection(db, "notificacoes_clientes")).catch(() => ({ size: 0 }))
        ]).then(([s1, s2]) => { counts["notificacoes"] = (s1.size || 0) + (s2.size || 0); }),
        Promise.all([
          getDocs(collection(db, "logs_sistema")).catch(() => ({ size: 0 })),
          getDocs(collection(db, "email_logs")).catch(() => ({ size: 0 })),
          getDocs(collection(db, "logs_backup")).catch(() => ({ size: 0 }))
        ]).then(([s1, s2, s3]) => { counts["logsAuditoria"] = (s1.size || 0) + (s2.size || 0) + (s3.size || 0); })
      ];

      await Promise.all(fetchPromises);
      setRecordCounts(counts);
    } catch (err) {
      console.error("Erro ao carregar contagens:", err);
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => {
    fetchCountsAndUsers();
  }, [fetchCountsAndUsers]);

  const handleSelectAll = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    TABLE_OPTIONS.forEach(opt => {
      updated[opt.key] = val;
    });
    setSelections(updated);
  };

  const handleSelectPreset = (preset: "vendas" | "financeiro" | "crm" | "logs") => {
    const updated: Record<string, boolean> = {};
    TABLE_OPTIONS.forEach(opt => { updated[opt.key] = false; });
    
    if (preset === "vendas") {
      updated["pedidosOnline"] = true;
      updated["faturamento"] = true;
      updated["ordensServico"] = true;
      updated["entregas"] = true;
    } else if (preset === "financeiro") {
      updated["contasPagar"] = true;
      updated["contasReceber"] = true;
      updated["controleCashback"] = true;
      updated["comissoes"] = true;
      updated["faturamento"] = true;
    } else if (preset === "crm") {
      updated["visitasCliente"] = true;
      updated["clientesCrm"] = true;
      updated["afiliacoesContratos"] = true;
    } else if (preset === "logs") {
      updated["notificacoes"] = true;
      updated["logsAuditoria"] = true;
    }
    setSelections(updated);
  };

  const totalSelectedCount = Object.keys(selections).filter(k => selections[k]).length;
  const totalEstimatedDocs = Object.keys(selections)
    .filter(k => selections[k])
    .reduce((acc, k) => acc + (recordCounts[k] || 0), 0);

  // Chunked batch deletion helper
  const deleteQueryInBatches = async (db: any, qOrRef: any, label: string) => {
    try {
      const snap = await getDocs(qOrRef);
      if (snap.empty) return 0;

      let deleted = 0;
      const docs = snap.docs;
      const CHUNK_SIZE = 350;

      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        deleted += chunk.length;
        setProgressStatus(`Excluindo ${label}: ${deleted}/${docs.length} registros...`);
      }
      return deleted;
    } catch (err) {
      console.warn(`Erro ao excluir documentos de ${label}:`, err);
      // Fallback: direct delete per document if batch fails
      try {
        const snap = await getDocs(qOrRef);
        let count = 0;
        for (const d of snap.docs) {
          try {
            await deleteDoc(d.ref);
            count++;
          } catch (e) {
            console.warn(`Aviso ao excluir doc ${d.id}:`, e);
          }
        }
        return count;
      } catch (fallbackErr) {
        console.error(`Falha no fallback de exclusão para ${label}:`, fallbackErr);
        return 0;
      }
    }
  };

  const handleExecuteMaintenance = async () => {
    if (!isUserAdmin) {
      toast.error("Acesso não autorizado. Apenas administradores podem executar esta rotina.");
      return;
    }

    if (totalSelectedCount === 0) {
      toast.error("Selecione pelo menos uma tabela para zerar.");
      return;
    }

    if (confirmInput.trim().toUpperCase() !== "CONFIRMAR") {
      toast.error("Por favor, digite CONFIRMAR no campo de texto para prosseguir.");
      return;
    }

    setShowConfirmModal(false);
    setLoading(true);
    setProgressPercentage(5);
    setProgressStatus("Iniciando rotina de manutenção e limpeza...");

    const toastId = toast.loading("Executando exclusão segura no banco de dados...");
    const { db } = await initFirebase();

    let totalDeleted = 0;
    const summaryDeleted: Record<string, number> = {};

    try {
      const activeKeys = Object.keys(selections).filter(k => selections[k]);
      const totalSteps = activeKeys.length;
      let currentStep = 0;

      // 1. Usuários Clientes
      if (selections.usuariosClientes) {
        setProgressStatus("Localizando usuários do tipo Cliente...");
        const usersSnap = await getDocs(collection(db, "users"));
        const clientDocs = usersSnap.docs.filter(d => {
          const r = String(d.data().role || "").toLowerCase().trim();
          return !isStaffRole(r) || ["cliente", "customer"].includes(r);
        });

        let uDeleted = 0;
        for (const uDoc of clientDocs) {
          const uid = uDoc.id;
          // Delete subcollections
          try {
            const subcollections = ["cart", "wishlist", "cashback_transactions"];
            for (const sub of subcollections) {
              const subSnap = await getDocs(collection(db, "users", uid, sub));
              for (const s of subSnap.docs) {
                await deleteDoc(s.ref);
              }
            }
          } catch (subErr) {
            console.warn("Aviso ao limpar subcoleções do usuário:", subErr);
          }

          // Delete client crm doc if exists with same id
          try {
            await deleteDoc(doc(db, "clientes_crm", uid));
          } catch (e) { /* ignore */ }

          // Delete user document
          await deleteDoc(uDoc.ref);
          uDeleted++;
        }
        summaryDeleted["Usuários Clientes"] = uDeleted;
        totalDeleted += uDeleted;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 2. Controle de Cashback
      if (selections.controleCashback) {
        setProgressStatus("Excluindo registros de cashback...");
        const rootCbCount = await deleteQueryInBatches(db, collection(db, "cashback_transactions"), "Cashback Raiz");
        
        // Reset balances on user profiles
        try {
          const uSnap = await getDocs(collection(db, "users"));
          const batch = writeBatch(db);
          let uCount = 0;
          uSnap.docs.forEach(d => {
            if (Number(d.data().cashbackBalance || 0) > 0) {
              batch.update(d.ref, { cashbackBalance: 0 });
              uCount++;
            }
          });
          if (uCount > 0) {
            await batch.commit();
          }
        } catch (cbResetErr) {
          console.warn("Aviso ao zerar saldo de cashback:", cbResetErr);
        }

        summaryDeleted["Cashback"] = rootCbCount;
        totalDeleted += rootCbCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 3. Contas a Pagar
      if (selections.contasPagar) {
        setProgressStatus("Excluindo Contas a Pagar...");
        const c = await deleteQueryInBatches(db, collection(db, "contas_pagar"), "Contas a Pagar");
        summaryDeleted["Contas a Pagar"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 4. Contas a Receber
      if (selections.contasReceber) {
        setProgressStatus("Excluindo Contas a Receber...");
        const c = await deleteQueryInBatches(db, collection(db, "contas_receber"), "Contas a Receber");
        summaryDeleted["Contas a Receber"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 5. Faturamento
      if (selections.faturamento) {
        setProgressStatus("Excluindo registros de Faturamento...");
        const pSnap = await getDocs(collection(db, "pedidos_venda"));
        const faturados = pSnap.docs.filter(d => {
          const st = String(d.data().status || "").toLowerCase().trim();
          return ["faturado", "enviado", "entregue"].includes(st);
        });

        let fCount = 0;
        const CHUNK_SIZE = 350;
        for (let i = 0; i < faturados.length; i += CHUNK_SIZE) {
          const chunk = faturados.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
          fCount += chunk.length;
        }

        summaryDeleted["Faturamento"] = fCount;
        totalDeleted += fCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 6. Pedidos Online (Geral)
      if (selections.pedidosOnline) {
        setProgressStatus("Excluindo todos os Pedidos Online...");
        const pCount = await deleteQueryInBatches(db, collection(db, "pedidos_venda"), "Pedidos Online");
        
        // Also clean support chat for orders
        try {
          await deleteQueryInBatches(db, collection(db, "suporte_pedidos"), "Suporte Pedidos");
          await deleteQueryInBatches(db, collection(db, "suporte_mensagens"), "Mensagens de Suporte");
        } catch (chatErr) {
          console.warn("Aviso ao limpar chat de pedidos:", chatErr);
        }

        summaryDeleted["Pedidos Online"] = pCount;
        totalDeleted += pCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 7. Visitas ao Cliente (CRM)
      if (selections.visitasCliente) {
        setProgressStatus("Excluindo Visitas ao Cliente...");
        let vCount = 0;
        if (selectedUserForVisits === "all") {
          vCount = await deleteQueryInBatches(db, collection(db, "visitas_crm"), "Visitas CRM");
        } else {
          const qVisitas = query(collection(db, "visitas_crm"), where("vendedorId", "==", selectedUserForVisits));
          vCount = await deleteQueryInBatches(db, qVisitas, "Visitas do Vendedor");
        }
        summaryDeleted["Visitas CRM"] = vCount;
        totalDeleted += vCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 8. Clientes CRM
      if (selections.clientesCrm) {
        setProgressStatus("Excluindo Clientes CRM...");
        const c = await deleteQueryInBatches(db, collection(db, "clientes_crm"), "Clientes CRM");
        summaryDeleted["Clientes CRM"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 9. Afiliações e Contratos
      if (selections.afiliacoesContratos) {
        setProgressStatus("Excluindo Afiliações...");
        const c = await deleteQueryInBatches(db, collection(db, "afiliados_uc"), "Afiliações");
        summaryDeleted["Afiliações"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 10. Comissões
      if (selections.comissoes) {
        setProgressStatus("Excluindo Comissões...");
        const c = await deleteQueryInBatches(db, collection(db, "comissoes"), "Comissões");
        summaryDeleted["Comissões"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 11. Ordens de Serviço
      if (selections.ordensServico) {
        setProgressStatus("Excluindo Ordens de Serviço...");
        const c = await deleteQueryInBatches(db, collection(db, "ordens_servico"), "Ordens de Serviço");
        summaryDeleted["Ordens de Serviço"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 12. Entregas
      if (selections.entregas) {
        setProgressStatus("Excluindo Entregas...");
        const c = await deleteQueryInBatches(db, collection(db, "entregas"), "Entregas");
        summaryDeleted["Entregas"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 13. Movimentações de Estoque
      if (selections.estoqueCompras) {
        setProgressStatus("Excluindo Movimentações de Estoque...");
        const c = await deleteQueryInBatches(db, collection(db, "estoque_movimentacoes"), "Estoque Movimentações");
        summaryDeleted["Movimentações de Estoque"] = c;
        totalDeleted += c;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 14. Notificações
      if (selections.notificacoes) {
        setProgressStatus("Excluindo Notificações...");
        let nCount = 0;
        nCount += await deleteQueryInBatches(db, collection(db, "notifications"), "Notifications");
        nCount += await deleteQueryInBatches(db, collection(db, "notificacoes_clientes"), "Notificações Clientes");
        nCount += await deleteQueryInBatches(db, collection(db, "notificacoes"), "Notificações");
        summaryDeleted["Notificações"] = nCount;
        totalDeleted += nCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 15. Mural Condominial
      if (selections.muralCondominial) {
        setProgressStatus("Excluindo Mural Condominial...");
        const muralSnap = await getDocs(collection(db, "muralNotices"));
        let mCount = 0;
        for (const noticeDoc of muralSnap.docs) {
          try {
            const respSnap = await getDocs(collection(db, "muralNotices", noticeDoc.id, "respostas"));
            for (const r of respSnap.docs) {
              await deleteDoc(r.ref);
            }
          } catch (rErr) {
            console.warn("Aviso ao limpar respostas do mural:", rErr);
          }
          await deleteDoc(noticeDoc.ref);
          mCount++;
        }
        summaryDeleted["Mural Condominial"] = mCount;
        totalDeleted += mCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      // 16. Logs de Auditoria
      if (selections.logsAuditoria) {
        setProgressStatus("Excluindo Logs de Auditoria...");
        let lCount = 0;
        lCount += await deleteQueryInBatches(db, collection(db, "logs_sistema"), "Logs Sistema");
        lCount += await deleteQueryInBatches(db, collection(db, "email_logs"), "Logs Email");
        lCount += await deleteQueryInBatches(db, collection(db, "logs_backup"), "Logs Backup");
        summaryDeleted["Logs do Sistema"] = lCount;
        totalDeleted += lCount;
        currentStep++;
        setProgressPercentage(Math.round((currentStep / totalSteps) * 90));
      }

      setProgressPercentage(100);
      setProgressStatus("Limpeza concluída com sucesso!");

      // Log maintenance action in audit trail
      try {
        await logAction(
          `Execução de Manutenção e Limpeza de Banco de Dados: ${totalDeleted} registros excluídos`,
          "Administrativo",
          {
            summaryDeleted,
            totalRecordsDeleted: totalDeleted,
            executedBy: profile?.email || user?.email || "Administrador",
            selectedOptions: activeKeys
          }
        );
      } catch (logErr) {
        console.warn("Aviso ao salvar log de auditoria da manutenção:", logErr);
      }

      toast.success(`Manutenção finalizada! ${totalDeleted} registros foram excluídos com sucesso.`, { 
        id: toastId,
        duration: 6000 
      });

      // Refresh counters
      await fetchCountsAndUsers();

      // Reset checkboxes
      const resetSelections: Record<string, boolean> = {};
      TABLE_OPTIONS.forEach(opt => { resetSelections[opt.key] = false; });
      setSelections(resetSelections);
      setConfirmInput("");
    } catch (err: any) {
      console.error("Erro geral na manutenção:", err);
      toast.error(`Falha ao executar limpeza: ${err.message || "Erro desconhecido"}`, { 
        id: toastId,
        duration: 6000 
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setProgressStatus("");
        setProgressPercentage(0);
      }, 3000);
    }
  };

  const categories = ["Todas", "Usuários", "Financeiro", "Vendas & CRM", "Operações & Estoque", "Comunicação & Logs"];

  const filteredOptions = TABLE_OPTIONS.filter(opt => {
    if (activeCategory === "Todas") return true;
    return opt.category === activeCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
              <ShieldAlert size={14} className="text-amber-200" />
              <span>Área Crítica Administrativa</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Manutenção e Limpeza do Banco de Dados
            </h1>
            <p className="text-white/90 text-sm sm:text-base leading-relaxed">
              Utilitário de gestão de dados para zerar tabelas operacionais, limpar registros de testes ou redefinir módulos específicos com segurança e rastreabilidade total.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={fetchCountsAndUsers}
              disabled={loading || loadingCounts}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl font-bold text-sm backdrop-blur-md border border-white/20 transition-all cursor-pointer disabled:opacity-50"
              title="Atualizar contadores do banco"
            >
              <RefreshCw size={16} className={loadingCounts ? "animate-spin" : ""} />
              <span>{loadingCounts ? "Atualizando..." : "Recarregar Contadores"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress status card (during deletion) */}
      {loading && (
        <div className="bg-white rounded-2xl border-2 border-red-400 p-6 shadow-md animate-pulse">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 text-red-700 font-bold text-base">
              <AlertOctagon className="animate-spin" size={22} />
              <span>{progressStatus || "Executando processo de exclusão..."}</span>
            </div>
            <span className="font-mono text-sm font-extrabold text-red-600">{progressPercentage}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-red-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            Por favor, não feche esta aba durante o processamento da limpeza do banco de dados.
          </p>
        </div>
      )}

      {/* Presets & Quick Actions Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Seleção Rápida:</span>
            <button
              type="button"
              onClick={() => handleSelectAll(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <CheckSquare size={14} className="text-slate-600" />
              <span>Selecionar Todos</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Square size={14} className="text-slate-400" />
              <span>Desmarcar Todos</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("vendas")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Apenas Vendas & Pedidos</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("financeiro")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Apenas Financeiro</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("crm")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Apenas CRM & Visitas</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset("logs")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Apenas Logs & Notificações</span>
            </button>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 block">
              Tabelas Selecionadas: <strong className="text-red-600 text-sm">{totalSelectedCount}</strong> de {TABLE_OPTIONS.length}
            </span>
            {totalEstimatedDocs > 0 && (
              <span className="text-[11px] text-slate-400 font-medium block">
                (~{totalEstimatedDocs} registros a serem excluídos)
              </span>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-3">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tables to Clear */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredOptions.map(option => {
          const isSelected = !!selections[option.key];
          const count = recordCounts[option.key];
          const Icon = option.icon;

          return (
            <div
              key={option.key}
              onClick={() => setSelections(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
              className={`group relative p-5 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                isSelected
                  ? "bg-red-50/50 border-red-500 shadow-xs ring-2 ring-red-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl transition-colors shrink-0 ${
                  isSelected ? "bg-red-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                }`}>
                  <Icon size={22} />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-slate-900 text-base leading-tight">{option.label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
                      {option.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {option.description}
                  </p>
                </div>

                <div className="absolute right-4 top-5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Controlled by card click
                    className="w-5 h-5 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Special Filter Sub-options (e.g. Visitas por vendedor) */}
              {option.key === "visitasCliente" && isSelected && (
                <div 
                  className="mt-4 pt-3 border-t border-red-200/80 bg-white/80 p-3 rounded-xl space-y-2"
                  onClick={e => e.stopPropagation()}
                >
                  <label className="block text-xs font-bold text-slate-700">
                    Filtrar por Vendedor / Representante:
                  </label>
                  <select
                    value={selectedUserForVisits}
                    onChange={e => setSelectedUserForVisits(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white font-medium text-slate-800"
                  >
                    <option value="all">Todos os usuários (Zerar todas as visitas)</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.email || `ID: ${u.id}`} ({u.role || "Sem cargo"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Record Count Badge */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  {option.collections.join(", ")}
                </span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full ${
                  typeof count === "number" && count > 0
                    ? isSelected ? "bg-red-200/80 text-red-900" : "bg-slate-100 text-slate-700"
                    : "bg-slate-50 text-slate-400"
                }`}>
                  {typeof count === "number" ? `${count} ${count === 1 ? 'registro' : 'registros'}` : "Carregando..."}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating / Bottom Confirmation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-30">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 text-red-700 rounded-xl shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {totalSelectedCount > 0 
                ? `${totalSelectedCount} ${totalSelectedCount === 1 ? 'tabela selecionada' : 'tabelas selecionadas'} para limpeza`
                : "Nenhuma tabela selecionada"}
            </h3>
            <p className="text-xs text-slate-500">
              {totalSelectedCount > 0 
                ? "Clique no botão ao lado para revisar e confirmar a exclusão definitiva dos dados."
                : "Selecione uma ou mais caixas acima para habilitar o processo de manutenção."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          disabled={loading || totalSelectedCount === 0}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-8 py-3.5 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Trash2 size={18} />
          <span>Executar Limpeza ({totalSelectedCount})</span>
        </button>
      </div>

      {/* Safety Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Confirmar Exclusão de Dados</h3>
                  <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Ação Irreversível</span>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-800 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                Atenção: Os dados selecionados serão excluídos permanentemente.
              </p>
              <p className="text-red-700 leading-relaxed">
                Esta rotina fará a exclusão direta dos documentos no Firebase Firestore. Certifique-se de ter realizado um backup prévio caso necessite recuperar alguma informação.
              </p>
            </div>

            {/* List of tables to be deleted */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Tabelas selecionadas ({totalSelectedCount}):
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {TABLE_OPTIONS.filter(o => selections[o.key]).map(o => (
                  <div key={o.key} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-xs">
                    <span className="font-semibold text-slate-800">{o.label}</span>
                    <span className="font-bold text-red-600 font-mono">
                      {typeof recordCounts[o.key] === "number" ? `${recordCounts[o.key]} docs` : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation Input */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">
                Digite <span className="text-red-600 font-mono font-extrabold">CONFIRMAR</span> no campo abaixo para autorizar:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder="CONFIRMAR"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm font-mono font-bold uppercase tracking-wider focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-center bg-slate-50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMaintenance}
                disabled={confirmInput.trim().toUpperCase() !== "CONFIRMAR"}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 size={16} />
                <span>Excluir Permanentemente</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
