import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, orderBy, limit, getDoc, updateDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { Search, Plus, Pencil, Trash2, Check, X, Printer, Download, RefreshCw, FileSpreadsheet, HardDriveDownload } from "lucide-react";
import { navGroups } from "../../components/layouts/AdminLayout";
import { getDefaultPermissionsMapForRole } from "../../lib/permissions";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import toast from "react-hot-toast";
import { convertToCSV, triggerDownloadCSV } from "../../components/admin/BackupCsvModal";
import { useAuth } from "../../context/AuthContext";
import { useFranqueada } from "../../context/FranqueadaContext";
import { processarCancelamentoAfiliacaoFinanceiro } from "../../services/afiliacaoFinanceiroService";
import { formatarCPF, formatarCNPJ } from "../../lib/documentValidators";

export default function Usuarios() {
  const { profile } = useAuth();
  const { franqueadas, filterByFranqueada, injectFranqueada, canModify, isFranqueada, userUnidade } = useFranqueada();
  const [users, setUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"login" | "cadastral">("login");
  
  const [formData, setFormData] = useState({
    password: "",
    emailConfirmadoAdmin: false,
    email: "",
    displayName: "",
    role: "Cliente" as any,
    level: "Bronze",
    status: "Ativo",
    codigoUnidade: "",
    cashbackBalance: 0,
    telefone: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    tipoCadastro: "",
    cpf: "",
    cnpj: "",
    nomeResponsavel: "",
    funcao: "",
    cpfResponsavel: "",
    codigoIndicacao: "",
    permissions: {} as any
  });

  const [mainTab, setMainTab] = useState<"usuarios" | "logs">("usuarios");
  const [logs, setLogs] = useState<any[]>([]);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsCategory, setLogsCategory] = useState("Todas");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [emailError, setEmailError] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = query(collection(db, "users"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { db } = await initFirebase();
      const q = query(
        collection(db, "logs_sistema"),
        orderBy("date", "desc"),
        limit(200)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date || 0).getTime();
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
      setLogs(data);
    } catch (e) {
      console.error("Error fetching logs", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (mainTab === "logs") {
      fetchLogs();
    }
  }, [mainTab]);

  const filteredUsers = filterByFranqueada(users).filter((u) => {
    const matchesSearch = (u.displayName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLogs = logs.filter((log) => {
    const actionMatch = (log.action || "").toLowerCase().includes(logsSearch.toLowerCase());
    const emailMatch = (log.userEmail || "").toLowerCase().includes(logsSearch.toLowerCase());
    const ipMatch = (log.ip || "").toLowerCase().includes(logsSearch.toLowerCase());
    const nameMatch = (log.userName || "").toLowerCase().includes(logsSearch.toLowerCase());
    
    const matchesSearch = actionMatch || emailMatch || ipMatch || nameMatch;
    const matchesCategory = logsCategory === "Todas" || log.category === logsCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleOpenModal = (user: any = null) => {
    setActiveTab("login");
    setEmailError("");
    if (user) {
      if (!canModify(user)) {
        toast.error("Acesso Restrito: Você só pode gerenciar usuários vinculados à sua franquia.");
        return;
      }
      const initialPermissions = (user.permissions && Object.keys(user.permissions).length > 0)
        ? user.permissions
        : getDefaultPermissionsMapForRole(user.role);
      setEditingUser(user);
      setFormData({
        email: user.email || "",
        displayName: user.displayName || "",
        role: user.role || "customer",
        level: user.level || "Bronze",
        status: user.status || "Ativo",
        codigoUnidade: user.codigoUnidade || "",
        cashbackBalance: user.cashbackBalance || 0,
        telefone: user.telefone || "",
        endereco: user.endereco || "",
        numero: user.numero || "",
        complemento: user.complemento || "",
        bairro: user.bairro || "",
        cidade: user.cidade || "",
        estado: user.estado || "",
        cep: user.cep || "",
        tipoCadastro: user.tipoCadastro || "",
        cpf: user.cpf || "",
        cnpj: user.cnpj || "",
        nomeResponsavel: user.nomeResponsavel || "",
        funcao: user.funcao || "",
        cpfResponsavel: user.cpfResponsavel || "",
        codigoIndicacao: user.codigoIndicacao || "",
        tipoCondominio: user.tipoCondominio || "",
        quantidadeUnidades: user.quantidadeUnidades || user.quantidadeUnidadesCondominio || "",
        permissions: initialPermissions,
        emailConfirmadoAdmin: user.emailConfirmadoAdmin || false,
        password: ""
      });
    } else {
      setEditingUser(null);
      setFormData(injectFranqueada({
        email: "",
        displayName: "",
        role: "Cliente",
        level: "Bronze",
        status: "Ativo",
        codigoUnidade: userUnidade || "",
        cashbackBalance: 0,
        telefone: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        cep: "",
        tipoCadastro: "",
        cpf: "",
        cnpj: "",
        nomeResponsavel: "",
        funcao: "",
        cpfResponsavel: "",
        codigoIndicacao: "",
        tipoCondominio: "",
        quantidadeUnidades: "",
        permissions: {}
      }));
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEmailError("");
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { db } = await initFirebase();
      const userRef = doc(db, "users", userId);
      
      const userToUpdate = users.find(u => u.id === userId);
      const beforePayload = userToUpdate ? { ...userToUpdate } : null;
      const afterPayload = userToUpdate ? { ...userToUpdate, role: newRole } : null;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));

      await setDoc(userRef, { role: newRole }, { merge: true });
      
      if (userToUpdate) {
        await logAction(
          `Alteração de nível de acesso de ${userToUpdate.email} para ${newRole}`,
          "Administrativo",
          { targetUid: userId, targetEmail: userToUpdate.email, fieldsChanged: ["role"] },
          beforePayload,
          afterPayload
        );
      }
    } catch (error) {
      console.error("Erro ao atualizar papel do usuário:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setEmailError("Por favor, digite um formato de e-mail válido (exemplo: usuario@provedor.com).");
      return;
    }
    setEmailError("");
    try {
      const { db } = await initFirebase();
            let dbId = editingUser?.id || formData.email.replace(/[@.]/g, "_");
      
      // If creating a new user, create the Auth user via REST API
      if (!editingUser) {
        if (!formData.password) {
          setEmailError("Para criar um novo usuário, informe uma senha.");
          return;
        }
        try {
          const fbConfig = (await import("../../../firebase-applet-config.json")).default;
          const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fbConfig.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              returnSecureToken: false
            })
          });
          const authData = await res.json();
          if (!res.ok) {
             throw new Error(authData.error.message || "Erro ao criar usuário na Autenticação");
          }
          dbId = authData.localId; // Use real Auth UID
        } catch (authErr: any) {
          setEmailError(authErr.message);
          return;
        }
      }
      
      const isCancelled = formData.status === "Cancelado";
      const nowIso = new Date().toISOString();

      const rawPayload: any = {
        uid: dbId, // Use mock UID if creating
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        level: formData.level,
        status: formData.status,
        cashbackBalance: Number(formData.cashbackBalance),
        telefone: formData.telefone,
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        cep: formData.cep,
        tipoCadastro: formData.tipoCadastro,
        codigoUnidade: formData.codigoUnidade || "",
        cpf: formData.cpf,
        cnpj: formData.cnpj,
        nomeResponsavel: formData.nomeResponsavel,
        funcao: formData.funcao,
        cpfResponsavel: formData.cpfResponsavel,
        codigoIndicacao: formData.codigoIndicacao,
        tipoCondominio: formData.tipoCondominio || "",
        quantidadeUnidades: formData.quantidadeUnidades ? Number(formData.quantidadeUnidades) || formData.quantidadeUnidades : "",
        permissions: ["admin", "Administrador", "Admin", "Comercial", "Financeiro", "Estoquista", "Entregador", "Expedição"].includes(formData.role) ? formData.permissions : {},
        emailConfirmadoAdmin: formData.emailConfirmadoAdmin,
        updatedAt: nowIso
      };

      const savePayload = injectFranqueada(rawPayload);

      if (editingUser) {
        if (!canModify(editingUser)) {
          alert("Acesso Restrito: Permissão negada para alterar usuário de outra franquia.");
          return;
        }
      }

      if (isCancelled) {
        savePayload.dataCancelamento = editingUser?.dataCancelamento || nowIso;
        savePayload.canceladoPor = profile?.displayName || profile?.email || "Painel de Usuários";
      }

      await setDoc(doc(db, "users", dbId), savePayload, { merge: true });

      // Sincronizar dados e status com afiliação na coleção afiliados_uc
      try {
        const cancelDateToSave = editingUser?.dataCancelamento || nowIso;
        const affiliateSyncData: any = {
          nomeCondominio: formData.displayName,
          nomeSindico: formData.nomeResponsavel || formData.displayName,
          funcaoSindico: formData.funcao || "",
          cnpj: formData.cnpj || formData.cpf || "",
          telefone: formData.telefone || "",
          email: formData.email,
          tipoCondominio: formData.tipoCondominio || "",
          unidadesHabitacionais: formData.quantidadeUnidades ? Number(formData.quantidadeUnidades) || formData.quantidadeUnidades : 0,
          endereco: formData.endereco || "",
          numero: formData.numero || "",
          complemento: formData.complemento || "",
          bairro: formData.bairro || "",
          cidade: formData.cidade || "",
          estado: formData.estado || "",
          cep: formData.cep || "",
          updatedAt: nowIso
        };
        
        // 1. Registro direto por ID
        const afDirectRef = doc(db, "afiliados_uc", dbId);
        const afDirectSnap = await getDoc(afDirectRef);
        if (afDirectSnap.exists()) {
          const payloadDirect = { ...affiliateSyncData };
          if (isCancelled) {
            payloadDirect.status = "Cancelado";
            payloadDirect.dataCancelamento = cancelDateToSave;
            payloadDirect.canceladoPor = profile?.displayName || profile?.email || "Painel de Usuários";
            payloadDirect.motivoCancelamento = "Status cancelado no Painel de Usuários";
          } else if (formData.status === "Ativo" && afDirectSnap.data().status === "Cancelado") {
            payloadDirect.status = "Ativo";
            payloadDirect.dataAtivacao = nowIso;
          }
          await updateDoc(afDirectRef, payloadDirect);
        }

        // 2. Query por userId
        if (dbId) {
          const qUserAf = query(collection(db, "afiliados_uc"), where("userId", "==", dbId));
          const snapUserAf = await getDocs(qUserAf);
          for (const d of snapUserAf.docs) {
            const payloadUser = { ...affiliateSyncData };
            if (isCancelled) {
              payloadUser.status = "Cancelado";
              payloadUser.dataCancelamento = cancelDateToSave;
              payloadUser.canceladoPor = profile?.displayName || profile?.email || "Painel de Usuários";
              payloadUser.motivoCancelamento = "Status cancelado no Painel de Usuários";
            } else if (formData.status === "Ativo" && d.data().status === "Cancelado") {
              payloadUser.status = "Ativo";
              payloadUser.dataAtivacao = nowIso;
            }
            await updateDoc(doc(db, "afiliados_uc", d.id), payloadUser);
          }
        }

        // 3. Query por email
        if (formData.email) {
          const qEmailAf = query(collection(db, "afiliados_uc"), where("email", "==", formData.email.trim()));
          const snapEmailAf = await getDocs(qEmailAf);
          for (const d of snapEmailAf.docs) {
            const payloadEmail = { ...affiliateSyncData };
            if (isCancelled) {
              payloadEmail.status = "Cancelado";
              payloadEmail.dataCancelamento = cancelDateToSave;
              payloadEmail.canceladoPor = profile?.displayName || profile?.email || "Painel de Usuários";
              payloadEmail.motivoCancelamento = "Status cancelado no Painel de Usuários";
            } else if (formData.status === "Ativo" && d.data().status === "Cancelado") {
              payloadEmail.status = "Ativo";
              payloadEmail.dataAtivacao = nowIso;
            }
            await updateDoc(doc(db, "afiliados_uc", d.id), payloadEmail);
          }
        }
      } catch (afiliadoSyncErr) {
        console.warn("Aviso ao sincronizar afiliados_uc:", afiliadoSyncErr);
      }

      // Se o status for Cancelado: processa cancelamento das contas a receber presentes da afiliação
      if (isCancelled) {
        try {
          await processarCancelamentoAfiliacaoFinanceiro(dbId, {
            dataCancelamento: savePayload.dataCancelamento || nowIso,
            actorName: profile?.displayName || profile?.email || "Painel de Usuários",
            nomeCondominio: formData.displayName,
            email: formData.email,
            motivo: "Status alterado para Cancelado no Painel de Usuários"
          });
        } catch (finCancelErr) {
          console.warn("Aviso ao processar cancelamento financeiro das parcelas:", finCancelErr);
        }
      }

      // Audit log payloads
      const beforePayload = editingUser ? { ...editingUser } : null;
      const afterPayload = { ...savePayload };

      // LOG ACTION FOR CREATION / UPDATE / PASSWORD CHANGE
      if (editingUser) {
        if (formData.password) {
          await logAction(
            `Alteração de senha e atualização de cadastro do usuário: ${formData.email}`,
            "Administrativo",
            { targetUid: dbId, targetEmail: formData.email, fieldsChanged: ["password", "profile"] },
            beforePayload,
            afterPayload
          );
        } else {
          await logAction(
            `Atualização de cadastro do usuário: ${formData.email}`,
            "Administrativo",
            { targetUid: dbId, targetEmail: formData.email, fieldsChanged: ["profile"] },
            beforePayload,
            afterPayload
          );
        }
      } else {
        await logAction(
          `Criação do usuário: ${formData.email}`,
          "Administrativo",
          { targetUid: dbId, targetEmail: formData.email, role: formData.role },
          null,
          afterPayload
        );
      }

      fetchUsers();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar usuário.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const userToDelete = users.find(u => u.id === id);
      if (userToDelete && !canModify(userToDelete)) {
        alert("Acesso Restrito: Você só pode excluir usuários vinculados à sua franquia.");
        return;
      }
      const userEmail = userToDelete?.email || id;

      // 1. Delete associated `pedidos_venda`
      const pedidosQuery = query(collection(db, "pedidos_venda"), where("clienteId", "==", id));
      const pedidosSnap = await getDocs(pedidosQuery);
      
      const pedidosQuery2 = query(collection(db, "pedidos_venda"), where("cliente.uid", "==", id));
      const pedidosSnap2 = await getDocs(pedidosQuery2);

      const pedidosQuery3 = userEmail ? query(collection(db, "pedidos_venda"), where("cliente.email", "==", userEmail)) : null;
      const pedidosSnap3 = pedidosQuery3 ? await getDocs(pedidosQuery3) : { docs: [] };
      
      const allPedidos = [...pedidosSnap.docs, ...pedidosSnap2.docs, ...pedidosSnap3.docs];
      const deletedPedidos = new Set();
      
      for (const p of allPedidos) {
        if (!deletedPedidos.has(p.id)) {
           await deleteDoc(doc(db, "pedidos_venda", p.id));
           deletedPedidos.add(p.id);
        }
      }

      // 2. Delete associated `contas_receber`
      const contasQuery = query(collection(db, "contas_receber"), where("clienteId", "==", id));
      const contasSnap = await getDocs(contasQuery);
      for (const c of contasSnap.docs) {
        await deleteDoc(doc(db, "contas_receber", c.id));
      }

      // 3. Delete subcollections of users
      const subcollections = ["cart", "wishlist", "cashback_transactions"];
      for (const sub of subcollections) {
        const subSnap = await getDocs(collection(db, "users", id, sub));
        for (const s of subSnap.docs) {
          await deleteDoc(doc(db, "users", id, sub, s.id));
        }
      }

      // 4. Excluir possível cliente no CRM também
      try {
         await deleteDoc(doc(db, "clientes_crm", id));
      } catch (e) {
         // ignora se não existir
      }

      await deleteDoc(doc(db, "users", id));
      
      const beforePayload = userToDelete ? { ...userToDelete, password: userToDelete.password ? "[REDACTED]" : "" } : null;

      // LOG ACTION FOR EXCLUSION
      await logAction(
        `Exclusão do usuário: ${userEmail}`,
        "Administrativo",
        { targetUid: id, targetEmail: userEmail },
        beforePayload,
        null
      );

      fetchUsers();
      alert("Usuário excluído com sucesso do banco de dados e todo o seu histórico foi removido!\n\nNota: Para que este usuário possa se cadastrar novamente com o mesmo e-mail, você também precisará excluí-lo manualmente na aba 'Authentication' do seu Firebase Console.");
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      alert("Erro ao excluir usuário. Verifique o console para mais detalhes.");
    }
  };

  const toggleModule = (moduleTitle: string) => {
    setFormData(prev => {
      const perms = { ...prev.permissions };
      if (!perms[moduleTitle]) {
        perms[moduleTitle] = { visible: true, submodules: {} };
      } else {
        perms[moduleTitle].visible = !perms[moduleTitle].visible;
      }
      return { ...prev, permissions: perms };
    });
  };

  const toggleSubmodule = (moduleTitle: string, subName: string) => {
    setFormData(prev => {
      const perms = { ...prev.permissions };
      if (!perms[moduleTitle]) {
        perms[moduleTitle] = { visible: true, submodules: { [subName]: true } };
      } else {
        const currentSubs = perms[moduleTitle].submodules || {};
        perms[moduleTitle] = {
          ...perms[moduleTitle],
          visible: true,
          submodules: { ...currentSubs, [subName]: !currentSubs[subName] }
        };
      }
      return { ...prev, permissions: perms };
    });
  };

  const handleExportUsersCSV = async () => {
    try {
      if (users.length === 0) {
        toast.error("Nenhum usuário para exportar.");
        return;
      }
      toast.loading("Exportando lista de usuários...", { id: "export-users" });
      const nowStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const csvData = users.map(u => ({
        id: u.id || "",
        nome: u.displayName || "",
        email: u.email || "",
        papel_acesso: u.role || "Cliente",
        status: u.status || "Ativo",
        nivel: u.level || "Bronze",
        saldo_cashback: Number(u.cashbackBalance || 0).toFixed(2),
        telefone: u.telefone || "",
        tipo_condominio: u.tipoCondominio || "",
        quantidade_unidades: u.quantidadeUnidades || u.quantidadeUnidadesCondominio || "",
        cpf_cnpj: u.cpf || u.cnpj || "",
        endereco: u.endereco || "",
        numero: u.numero || "",
        bairro: u.bairro || "",
        cidade: u.cidade || "",
        estado: u.estado || "",
        cep: u.cep || "",
        codigo_indicacao: u.codigoIndicacao || "",
        tipo_cadastro: u.tipoCadastro || "",
        data_cadastro: u.createdAt || "",
      }));

      const csvContent = convertToCSV(csvData, ";");
      triggerDownloadCSV(csvContent, `usuarios_firestore_${nowStr}.csv`);

      await logAction(
        `Exportou lista cadastral de ${users.length} usuários em formato CSV`,
        "Administrativo",
        { totalRecords: users.length }
      );

      toast.success(`Exportados ${users.length} usuários em CSV!`, { id: "export-users" });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao exportar usuários: ${err.message || err}`, { id: "export-users" });
    }
  };

  const handleExportLogsCSV = async () => {
    try {
      if (logs.length === 0) {
        toast.error("Nenhum log de auditoria para exportar.");
        return;
      }
      toast.loading("Exportando logs de auditoria...", { id: "export-logs" });
      const nowStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const csvData = logs.map(l => ({
        id: l.id || "",
        acao: l.action || "",
        categoria: l.category || "Sistema",
        usuario_responsavel: l.userName || l.userEmail || "",
        email_usuario: l.userEmail || "",
        ip: l.ip || "",
        data_hora: l.date?.toDate ? l.date.toDate().toLocaleString("pt-BR") : String(l.date || ""),
        detalhes: typeof l.details === "object" ? JSON.stringify(l.details) : String(l.details || ""),
      }));

      const csvContent = convertToCSV(csvData, ";");
      triggerDownloadCSV(csvContent, `auditoria_logs_firestore_${nowStr}.csv`);

      await logAction(
        `Exportou ${logs.length} logs de auditoria do sistema em formato CSV`,
        "Administrativo",
        { totalRecords: logs.length }
      );

      toast.success(`Exportados ${logs.length} logs de auditoria em CSV!`, { id: "export-logs" });
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao exportar logs: ${err.message || err}`, { id: "export-logs" });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {mainTab === "usuarios" ? "Cargos e Permissões" : "Auditoria de Logs"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mainTab === "usuarios" 
              ? "Gerencie os acessos de usuários e administradores." 
              : "Rastreabilidade completa de ações e alterações críticas no sistema."}
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          {mainTab === "usuarios" ? (
            <>
              <button
                type="button"
                onClick={handleExportUsersCSV}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Exportar base de usuários do Firestore em arquivo CSV (Excel)"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>Exportar Usuários (CSV)</span>
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-[#0071e3] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
              >
                <Plus size={18} /> Novo Usuário
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleExportLogsCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Exportar trilha de auditoria em arquivo CSV (Excel)"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              <span>Exportar Logs (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-6 border-b border-slate-100 flex gap-6 bg-slate-50/20 shrink-0">
        <button
          onClick={() => setMainTab("usuarios")}
          className={`py-3 text-sm font-semibold border-b-2 transition-all ${
            mainTab === "usuarios"
              ? "border-[#0071e3] text-[#0071e3]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Lista de Usuários
        </button>
        <button
          onClick={() => setMainTab("logs")}
          className={`py-3 text-sm font-semibold border-b-2 transition-all ${
            mainTab === "logs"
              ? "border-[#0071e3] text-[#0071e3]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Logs de Auditoria do Sistema
        </button>
      </div>

      {mainTab === "usuarios" ? (
        <>
          <div className="p-6 bg-slate-50/50 shrink-0 flex items-center justify-between gap-4">
            <div className="relative max-w-md flex-1">
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#0071e3] focus:border-[#0B1A3A] outline-none text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#0B1A3A] focus:border-[#0B1A3A] outline-none text-sm font-medium text-slate-700 transition-all cursor-pointer min-w-[150px]"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Pendente">Pendente</option>
              <option value="Bloqueado">Bloqueado</option>
              <option value="Cancelado">Cancelado</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[900px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Papel</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Nível</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200/70 relative overflow-hidden shrink-0 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent" />
                            <div className="h-3.5 bg-slate-200/70 rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent w-32" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-3.5 bg-slate-200/70 rounded relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent w-44" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-7 bg-slate-100 rounded-lg relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent w-28" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 bg-slate-100 rounded-full relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent w-20" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="h-6 bg-slate-100 rounded-full relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent w-20" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-7 w-7 bg-slate-100 rounded-md relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent" />
                            <div className="h-7 w-7 bg-slate-100 rounded-md relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-linear-to-r before:from-transparent before:via-white/50 before:to-transparent" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                        <p className="font-semibold text-slate-700">Nenhum usuário encontrado.</p>
                        <p className="text-xs text-slate-400 mt-1">Tente ajustar a busca ou o filtro de status.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-slate-900 font-medium">{item.displayName || "-"}</td>
                        <td className="px-6 py-4 text-slate-600">{item.email}</td>
                        <td className="px-6 py-4">
                          <select
                            value={["admin", "Administrador", "Admin"].includes(item.role) ? "Admin" : item.role === "customer" ? "Cliente" : (item.role || "Cliente")}
                            onChange={(e) => handleRoleChange(item.id, e.target.value)}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none cursor-pointer transition-all ${
                              ["admin", "Administrador", "Admin"].includes(item.role) ? "bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100" :
                              item.role === "Cliente" || item.role === "customer" ? "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100" :
                              item.role === "Financeiro" ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100" :
                              item.role === "Comercial" ? "bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100" :
                              item.role === "Expedição" ? "bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100" :
                              "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                            }`}
                          >
                            <option value="Cliente" className="bg-white text-slate-900 font-normal">Cliente</option>
                            <option value="Financeiro" className="bg-white text-slate-900 font-normal">Financeiro</option>
                            <option value="Comercial" className="bg-white text-slate-900 font-normal">Comercial</option>
                            <option value="Expedição" className="bg-white text-slate-900 font-normal">Expedição</option>
                            <option value="Admin" className="bg-white text-slate-900 font-normal">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                              item.status === "Pendente" ? "bg-sky-100 text-sky-800 border border-sky-200" :
                              item.status === "Bloqueado" ? "bg-slate-200 text-slate-800" :
                              item.status === "Cancelado" ? "bg-rose-100 text-rose-800 border border-rose-200 font-bold" :
                              item.status === "Inativo" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                              "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}>
                              {item.status || 'Ativo'}
                            </span>
                            {item.status === "Cancelado" && item.dataCancelamento && (
                              <div className="text-[11px] text-rose-600 font-medium mt-1">
                                {new Date(item.dataCancelamento).toLocaleDateString("pt-BR")} às {new Date(item.dataCancelamento).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{item.level}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
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
                              onClick={() => handleOpenModal(item)}
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="p-6 bg-slate-50/50 shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 animate-in fade-in duration-150">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar por email, IP ou ação executada..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none text-sm transition-all"
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
              />
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoria:</label>
              <select
                value={logsCategory}
                onChange={(e) => setLogsCategory(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none text-sm font-medium text-slate-700 transition-all cursor-pointer min-w-[150px]"
              >
                <option value="Todas">Todas</option>
                <option value="Administrativo">Administrativo</option>
                <option value="Comercial">Comercial</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Estoque">Estoque</option>
                <option value="Sistema">Sistema</option>
              </select>
              <button
                onClick={() => fetchLogs()}
                className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                title="Atualizar Logs"
              >
                <RefreshCw size={18} className={loadingLogs ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[950px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 font-semibold tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Data e Hora</th>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">IP</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Ação</th>
                    <th className="px-6 py-4 text-right">Metadados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLogs ? (
                    Array.from({ length: 5 }).map((_, rIdx) => (
                      <tr key={rIdx} className="animate-pulse">
                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-28" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-44" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-64" /></td>
                        <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 bg-slate-50">
                        Nenhum registro de auditoria encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const formattedDate = log.date?.toDate
                        ? log.date.toDate().toLocaleString("pt-BR")
                        : log.date
                        ? new Date(log.date).toLocaleString("pt-BR")
                        : "-";
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4 text-slate-600 font-mono text-xs">{formattedDate}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{log.userName || "N/A"}</div>
                            <div className="text-xs text-slate-500">{log.userEmail || "anonimo"}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{log.ip || "N/A"}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              log.category === "Financeiro" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                              log.category === "Comercial" ? "bg-blue-50 text-blue-700 border border-blue-100" :
                              log.category === "Administrativo" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                              log.category === "Estoque" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" :
                              "bg-slate-50 text-slate-700 border border-slate-100"
                            }`}>
                              {log.category || "Sistema"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-800 font-medium">{log.action}</td>
                          <td className="px-6 py-4 text-right">
                            {log.details && Object.keys(log.details).length > 0 ? (
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="text-xs text-[#0071e3] hover:underline font-semibold"
                              >
                                Ver detalhes
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-normal">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Selected Log Drawer/Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className={`bg-white rounded-2xl w-full p-6 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-150 overflow-hidden flex flex-col ${
            (selectedLog.before || selectedLog.after) ? "max-w-3xl" : "max-w-lg"
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metadados do Registro</span>
                <h3 className="text-lg font-bold text-slate-800 mt-1">Detalhes da Ação</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 font-sans text-sm text-slate-700 overflow-y-auto max-h-[70vh] pr-1">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 font-semibold uppercase">Ação</div>
                <div className="font-semibold text-slate-800 mt-0.5">{selectedLog.action}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Usuário</div>
                  <div className="font-medium text-slate-800 mt-0.5">{selectedLog.userName || "N/A"}</div>
                  <div className="text-xs text-slate-500">{selectedLog.userEmail}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase">IP do Cliente</div>
                  <div className="font-mono text-slate-800 mt-0.5">{selectedLog.ip || "N/A"}</div>
                </div>
              </div>

              {/* BEFORE & AFTER STATE VIEWS */}
              {selectedLog.before && selectedLog.after ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                  <div className="text-xs text-slate-400 font-semibold uppercase">Rastreabilidade Detalhada (Antes vs Depois)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-red-900">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-red-600 mb-1">Estado Anterior (Antes)</div>
                      <pre className="font-mono overflow-auto max-h-60 whitespace-pre-wrap leading-relaxed bg-white/70 p-2 rounded border border-red-200">
                        {JSON.stringify(selectedLog.before, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 text-green-900">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-green-600 mb-1">Novo Estado (Depois)</div>
                      <pre className="font-mono overflow-auto max-h-60 whitespace-pre-wrap leading-relaxed bg-white/70 p-2 rounded border border-green-200">
                        {JSON.stringify(selectedLog.after, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : selectedLog.before ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Registro Original (Antes de Excluir)</div>
                  <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedLog.before, null, 2)}
                  </pre>
                </div>
              ) : selectedLog.after ? (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Dados de Criação (Depois)</div>
                  <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-3 rounded overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedLog.after, null, 2)}
                  </pre>
                </div>
              ) : null}

              {selectedLog.details && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold uppercase mb-1">Dados Técnicos / Metadados</div>
                  <pre className="text-xs font-mono bg-slate-950 text-slate-200 p-3 rounded overflow-auto max-h-32 whitespace-pre-wrap leading-relaxed">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingUser ? "Editar Usuário e Permissões" : "Novo Usuário"}
              </h3>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50">
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "login"
                    ? "border-[#0B1A3A] text-[#0B1A3A]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setActiveTab("login")}
              >
                Dados de Login
              </button>
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "cadastral"
                    ? "border-[#0B1A3A] text-[#0B1A3A]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => setActiveTab("cadastral")}
              >
                Dados Cadastrais
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === "login" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Nome</label>
                    <input
                      type="text"
                      required
                      value={formData.displayName}
                      onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Papel</label>
                    <select
                      value={["admin", "Administrador", "Admin"].includes(formData.role) ? "Admin" : formData.role === "customer" ? "Cliente" : formData.role}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          role: val,
                          permissions: getDefaultPermissionsMapForRole(val)
                        });
                      }}
                      disabled={!editingUser}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm bg-slate-50 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="Cliente">Cliente</option>
                      {editingUser && (
                        <>
                          <option value="Admin">Admin</option>
                          <option value="Comercial">Comercial</option>
                          <option value="Comercial Externo">Comercial Externo</option>
                          <option value="Financeiro">Financeiro</option>
                          <option value="Expedição">Expedição</option>
                          <option value="Estoquista">Estoquista</option>
                          <option value="Entregador">Entregador</option>
                        </>
                      )}
                    </select>
                    {!editingUser && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Novos cadastros iniciam como Cliente. Salve e edite o cadastro para alterar o papel e permissões.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Bloqueado">Bloqueado</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">
                      Unidade Franqueada Vinculada
                    </label>
                    <select
                      value={formData.codigoUnidade || ""}
                      onChange={(e) => setFormData({ ...formData, codigoUnidade: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm bg-white"
                    >
                      <option value="">Rede Franqueadora Geral / Matriz (Acesso Global)</option>
                      {franqueadas.map((frq) => (
                        <option key={frq.id} value={frq.codigoUnidade || frq.id}>
                          {frq.codigoUnidade ? `${frq.codigoUnidade} • ${frq.nomeFantasia || frq.razaoSocial}` : frq.razaoSocial}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Vincula a visualização e operações deste usuário à unidade específica.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Usuário</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({...formData, email: e.target.value});
                        if (emailError) setEmailError("");
                      }}
                      className={`w-full px-4 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm ${
                        emailError ? "border-red-500 focus:ring-red-100" : "border-slate-200"
                      }`}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 font-semibold mt-1">
                        {emailError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Senha</label>
                    <input
                      type="text"
                      value={formData.password || ""}
                      placeholder="Deixe em branco para não alterar"
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Nível de Cashback</label>
                    <select
                      value={formData.level}
                      onChange={(e) => setFormData({...formData, level: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm"
                    >
                      <option value="Bronze">Bronze</option>
                      <option value="Prata">Prata</option>
                      <option value="Ouro">Ouro</option>
                      <option value="Diamante">Diamante</option>
                    </select>
                  </div>
                                    <div className="col-span-2 md:col-span-3">
                    <label className="flex items-center gap-3 cursor-pointer p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-[#0B1A3A] transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.emailConfirmadoAdmin}
                        onChange={(e) => setFormData({...formData, emailConfirmadoAdmin: e.target.checked})}
                        className="w-5 h-5 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                      />
                      <div>
                        <span className="block font-bold text-slate-900">E-mail confirmado pelo administrador</span>
                        <span className="block text-sm text-slate-500">Isenta a necessidade de confirmação por e-mail para acessar o aplicativo</span>
                      </div>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Telefone / Celular</label>
                    <input
                      type="text"
                      value={formData.telefone || ""}
                      onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              )}

              {activeTab === "cadastral" && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="col-span-2 md:col-span-2">
                    <label className="block text-sm font-bold text-slate-900 mb-1">
                      {formData.tipoCadastro === "Fisica" ? "Nome Completo" : "Nome / Razão Social / Condomínio"} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.displayName || ""}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder={formData.tipoCadastro === "Fisica" ? "Nome Completo" : "Ex: Condomínio Residencial Parque"}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Tipo de Cadastro</label>
                    <select
                      value={formData.tipoCadastro || "Juridica"}
                      onChange={(e) => setFormData({ ...formData, tipoCadastro: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                    >
                      <option value="Juridica">Pessoa Jurídica (Condomínio / Empresa)</option>
                      <option value="Fisica">Pessoa Física</option>
                    </select>
                  </div>

                  {formData.tipoCadastro === "Juridica" ? (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">C.N.P.J.</label>
                        <input
                          type="text"
                          value={formData.cnpj || ""}
                          onChange={(e) => setFormData({ ...formData, cnpj: formatarCNPJ(e.target.value) })}
                          placeholder="00.000.000/0000-00"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Tipo de Condomínio</label>
                        <select
                          value={formData.tipoCondominio || ""}
                          onChange={(e) => setFormData({ ...formData, tipoCondominio: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        >
                          <option value="">Não informado</option>
                          <option value="Residencial">Residencial</option>
                          <option value="Comercial">Comercial</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Quantidade de Unidades</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.quantidadeUnidades || ""}
                          onChange={(e) => setFormData({ ...formData, quantidadeUnidades: e.target.value.replace(/\D/g, "") })}
                          placeholder="Ex: 12"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Nome do Responsável / Síndico</label>
                        <input
                          type="text"
                          value={formData.nomeResponsavel || ""}
                          onChange={(e) => setFormData({ ...formData, nomeResponsavel: e.target.value })}
                          placeholder="Ex: João da Silva"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">CPF do Responsável</label>
                        <input
                          type="text"
                          value={formData.cpfResponsavel || ""}
                          onChange={(e) => setFormData({ ...formData, cpfResponsavel: formatarCPF(e.target.value) })}
                          placeholder="000.000.000-00"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Função / Cargo</label>
                        <input
                          type="text"
                          value={formData.funcao || ""}
                          onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                          placeholder="Ex: Síndico(a), Subsíndico(a), Administrador(a)"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Nº C.P.F.</label>
                        <input
                          type="text"
                          value={formData.cpf || ""}
                          onChange={(e) => setFormData({ ...formData, cpf: formatarCPF(e.target.value) })}
                          placeholder="000.000.000-00"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Tipo de Condomínio</label>
                        <select
                          value={formData.tipoCondominio || ""}
                          onChange={(e) => setFormData({ ...formData, tipoCondominio: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        >
                          <option value="">Não informado</option>
                          <option value="Residencial">Residencial</option>
                          <option value="Comercial">Comercial</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Quantidade de Unidades</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.quantidadeUnidades || ""}
                          onChange={(e) => setFormData({ ...formData, quantidadeUnidades: e.target.value.replace(/\D/g, "") })}
                          placeholder="Ex: 12"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 md:col-span-3 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 mb-4">Endereço</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="col-span-2 md:col-span-3">
                        <label className="block text-sm font-bold text-slate-900 mb-1">Logradouro / Rua</label>
                        <input
                          type="text"
                          value={formData.endereco || ""}
                          onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                          placeholder="Ex: Av. Paulista"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Número</label>
                        <input
                          type="text"
                          value={formData.numero || ""}
                          onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                          placeholder="Ex: 100"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Complemento / Bloco</label>
                        <input
                          type="text"
                          value={formData.complemento || ""}
                          onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                          placeholder="Ex: Bloco A, Apto 101"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Bairro / Setor</label>
                        <input
                          type="text"
                          value={formData.bairro || ""}
                          onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                          placeholder="Ex: Centro"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Cidade</label>
                        <input
                          type="text"
                          value={formData.cidade || ""}
                          onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                          placeholder="Ex: São Paulo"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">Estado (UF)</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={formData.estado || ""}
                          onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                          placeholder="SP"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1">CEP</label>
                        <input
                          type="text"
                          value={formData.cep || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 8);
                            const formatted = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
                            setFormData({ ...formData, cep: formatted });
                          }}
                          placeholder="00000-000"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-3 pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold text-slate-900 mb-1">Código de Indicação</label>
                        <input 
                          type="text" 
                          value={formData.codigoIndicacao || ""} 
                          onChange={(e) => setFormData({ ...formData, codigoIndicacao: e.target.value.toUpperCase() })} 
                          placeholder="Ex: CONSULTOR123"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-brand-light outline-none transition-shadow" 
                        />
                        <p className="text-xs text-slate-500 mt-1">Este código indica a qual consultor este usuário está vinculado.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {["admin", "Administrador", "Admin", "Comercial", "Financeiro", "Estoquista", "Entregador", "Expedição"].includes(formData.role) && activeTab === "login" && (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Módulos Administrativos</h4>
                  <p className="text-xs text-slate-500 mb-6">Defina os módulos e sub-módulos que este usuário terá acesso no CRM.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {navGroups.map(group => {
                      const isGroupVisible = formData.permissions[group.title]?.visible;
                      
                      return (
                        <div key={group.title} className="border rounded-xl p-4 bg-slate-50 hover:border-slate-300 transition-colors">
                          <label className="flex items-center gap-3 cursor-pointer mb-3 drop-shadow-sm pb-3 border-b border-slate-200">
                            <input 
                              type="checkbox" 
                              checked={!!isGroupVisible}
                              onChange={() => toggleModule(group.title)}
                              className="w-4 h-4 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                            />
                            <span className="font-bold text-slate-900 text-[15px]">{group.title}</span>
                          </label>

                          <div className="space-y-2.5 pl-7">
                            {group.items.map((item: any) => {
                              const isSubVisible = formData.permissions[group.title]?.submodules?.[item.name];
                              return (
                                <div key={item.name} className="space-y-1.5">
                                  <label className="flex items-center gap-3 cursor-pointer text-sm">
                                    <input 
                                      type="checkbox" 
                                      checked={!!isSubVisible}
                                      onChange={() => toggleSubmodule(group.title, item.name)}
                                      className="w-3.5 h-3.5 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                                    />
                                    <span className="text-slate-700 font-medium hover:text-slate-900">{item.name}</span>
                                  </label>
                                  {item.children && (
                                    <div className="pl-6 space-y-2 border-l border-slate-200 ml-1.5 my-1.5">
                                      {item.children.map((child: any) => {
                                        const isChildSubVisible = formData.permissions[group.title]?.submodules?.[child.name];
                                        return (
                                          <div key={child.name} className="space-y-1">
                                            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
                                              <input
                                                type="checkbox"
                                                checked={!!isChildSubVisible}
                                                onChange={() => toggleSubmodule(group.title, child.name)}
                                                className="w-3 h-3 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                                              />
                                              <span className={`text-slate-700 hover:text-slate-900 ${child.children ? "font-bold text-slate-800" : ""}`}>{child.name}</span>
                                            </label>

                                            {child.children && (
                                              <div className="pl-5 space-y-1 border-l border-slate-200 ml-1 my-1">
                                                {child.children.map((grandChild: any) => {
                                                  const isGrandChildVisible = formData.permissions[group.title]?.submodules?.[grandChild.name];
                                                  return (
                                                    <label key={grandChild.name} className="flex items-center gap-2 cursor-pointer text-[11px]">
                                                      <input
                                                        type="checkbox"
                                                        checked={!!isGrandChildVisible}
                                                        onChange={() => toggleSubmodule(group.title, grandChild.name)}
                                                        className="w-2.5 h-2.5 text-[#0B1A3A] rounded focus:ring-[#0B1A3A]"
                                                      />
                                                      <span className="text-slate-600 hover:text-slate-900">{grandChild.name}</span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </form>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#0B1A3A] hover:bg-opacity-90 rounded-lg transition-colors shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
