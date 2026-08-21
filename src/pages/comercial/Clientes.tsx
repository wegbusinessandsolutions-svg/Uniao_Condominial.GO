import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Printer, Download, RefreshCw, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, validarCNPJ, formatarCPF, formatarCNPJ, formatarCpfCnpj } from "../../lib/documentValidators";

export default function Clientes() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("Básico");
  
  const [formData, setFormData] = useState<any>({ 
    tipo: "Pessoa Jurídica",
    tier: "Diamante",
    status: "Ativo",
    ativo: true
  });
  const [originalData, setOriginalData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [respEmailError, setRespEmailError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = query(collection(db, "users"), where("role", "in", ["Cliente", "customer"]));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      setData(items.sort((a: any, b: any) => (a.displayName || a.nome || '').localeCompare(b.displayName || b.nome || '')));
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
    setFormData({ 
      tipo: "Pessoa Jurídica",
      tier: "Diamante",
      status: "Ativo",
      ativo: true
    });
    setEditingId(null);
    setOriginalData(null);
    setActiveTab("Básico");
    setEmailError("");
    setRespEmailError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    const formState = {
      ...item,
      ativo: item.status === "Ativo" || item.ativo === true
    };
    setFormData(formState);
    setEditingId(item.id);
    setOriginalData(JSON.parse(JSON.stringify(formState)));
    setActiveTab("Básico");
    setEmailError("");
    setRespEmailError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
    setOriginalData(null);
    setEmailError("");
    setRespEmailError("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value, type } = e.target;
    
    if (name === "cpfCnpj") {
      value = formData.tipo === "Pessoa Física"
        ? formatarCPF(value)
        : formData.tipo === "Pessoa Jurídica"
        ? formatarCNPJ(value)
        : formatarCpfCnpj(value);
    } else if (name === "respCpf") {
      value = formatarCPF(value);
    } else if (name === "cep") {
      value = value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
    } else if (name === "telefone" || name === "whatsapp" || name === "respTelefone") {
      value = value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
    }

    if (name === "email" && emailError) setEmailError("");
    if (name === "respEmail" && respEmailError) setRespEmailError("");

    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Email validations with Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let hasError = false;

    if (formData.email && !emailRegex.test(formData.email)) {
      setEmailError("Formato de e-mail do cliente inválido (exemplo: cliente@email.com).");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (formData.respEmail && !emailRegex.test(formData.respEmail)) {
      setRespEmailError("Formato de e-mail do responsável inválido (exemplo: responsavel@email.com).");
      hasError = true;
    } else {
      setRespEmailError("");
    }

    if (hasError) {
      return;
    }

    // Validate CPF / CNPJ before saving if provided
    const docValue = formData.cpfCnpj || formData.documento;
    if (docValue) {
      const clean = docValue.replace(/\D/g, "");
      const isCPF = formData.tipo === "Pessoa Física" || (formData.tipo !== "Pessoa Jurídica" && clean.length <= 11);
      const isValid = isCPF ? validarCPF(clean) : validarCNPJ(clean);
      if (!isValid) {
        alert(`O ${isCPF ? "CPF" : "CNPJ"} do cliente informado é inválido. Por favor, verifique os dígitos.`);
        return;
      }
    }

    // Validate Responsável CPF if provided
    if (formData.respCpf) {
      const cleanResp = formData.respCpf.replace(/\D/g, "");
      if (cleanResp.length > 0 && !validarCPF(cleanResp)) {
        alert("O CPF do Responsável informado é inválido. Por favor, verifique os dígitos.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const savePayload = {
        ...formData,
        status: formData.ativo ? "Ativo" : "Inativo",
        updatedAt: new Date().toISOString()
      };

      const name = savePayload.displayName || savePayload.nome || "Sem Nome";

      if (editingId) {
        await updateDoc(doc(db, "clientes_crm", editingId), savePayload);
        await logAction(
          `Edição de cliente CRM: ${name}`,
          "Comercial",
          { clientId: editingId, name },
          originalData,
          savePayload
        );
      } else {
        savePayload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, "clientes_crm"), savePayload);
        await logAction(
          `Criação de cliente CRM: ${name}`,
          "Comercial",
          { clientId: docRef.id, name },
          null,
          savePayload
        );
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const clientToDelete = data.find(item => item.id === id);
      const name = clientToDelete ? (clientToDelete.displayName || clientToDelete.nome || id) : id;

      await deleteDoc(doc(db, "clientes_crm", id));

      // LOG ACTION
      await logAction(
        `Exclusão de cliente CRM: ${name}`,
        "Comercial",
        { clientId: id, name },
        clientToDelete || null,
        null
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('pt-BR').format(date);
    } catch {
      return dateString;
    }
  };

  const filteredData = data.filter(item => {
    const term = searchTerm.toLowerCase();
    const nome = (item.nome || "").toLowerCase();
    const documento = (item.documento || item.cpfCnpj || "").toLowerCase();
    const email = (item.email || "").toLowerCase();
    return nome.includes(term) || documento.includes(term) || email.includes(term);
  });

  const getTierStyle = (tier: string) => {
    const t = (tier || '').toLowerCase();
    switch (t) {
      case 'diamante': return 'bg-cyan-100 text-cyan-700';
      case 'ouro': return 'bg-yellow-100 text-yellow-700';
      case 'prata': return 'bg-slate-200 text-slate-700';
      case 'bronze': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const tabs = formData.tipo === "Pessoa Jurídica" 
    ? ["Básico", "Endereço", "Responsável", "Notas"]
    : ["Básico", "Endereço", "Notas"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gestão de pessoas físicas e jurídicas.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="text-sm font-medium text-slate-600">
            {filteredData.length} cliente(s)
          </div>
          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Nome</th>
                <th className="px-6 py-4 whitespace-nowrap">Tipo</th>
                <th className="px-6 py-4 whitespace-nowrap">CPF/CNPJ</th>
                <th className="px-6 py-4 whitespace-nowrap">Contato</th>
                <th className="px-6 py-4 whitespace-nowrap">Tier</th>
                <th className="px-6 py-4 whitespace-nowrap">Cashback</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Criado</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-8" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-28" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 max-w-[200px] truncate" title={item.displayName || item.nome}>{item.displayName || item.nome}</td>
                    <td className="px-6 py-4 text-xs font-medium">{item.tipoCadastro === 'Juridica' ? 'PJ' : 'PF'}</td>
                    <td className="px-6 py-4 text-xs font-mono">{item.cnpj || item.cpf || item.documento || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="truncate max-w-[150px]" title={item.email}>{item.email || '-'}</span>
                        <span className="text-slate-400">{item.telefone || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${getTierStyle(item.level || item.tier)}`}>
                        {(item.level || item.tier || '').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-900">R$ {Number(item.cashbackBalance || item.cashback || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[11px] font-semibold rounded-full ${
                        item.status === 'Pendente' ? 'bg-orange-100 text-orange-800' :
                        item.status === 'Bloqueado' ? 'bg-red-100 text-red-800' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {item.status || 'Ativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">{item.dataCadastro || formatDate(item.createdAt)}</td>
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
                      </div>
                    </td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Editar cliente" : "Novo cliente"}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">Preencha os dados. Campos com * são obrigatórios.</p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="flex space-x-2 border-b border-slate-100">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === tab
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <form id="cliente-form" onSubmit={handleSubmit} className="space-y-6">
                
                {activeTab === "Básico" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tipo *
                        </label>
                        <select
                          name="tipo"
                          required
                          value={formData.tipo || "Pessoa Jurídica"}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (e.target.value === "Pessoa Física" && activeTab === "Responsável") {
                              setActiveTab("Básico");
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="Pessoa Jurídica">Pessoa Jurídica</option>
                          <option value="Pessoa Física">Pessoa Física</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Tier
                        </label>
                        <select
                          name="tier"
                          value={formData.tier || "Diamante"}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="Diamante">Diamante</option>
                          <option value="Ouro">Ouro</option>
                          <option value="Prata">Prata</option>
                          <option value="Bronze">Bronze</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome / Razão Social *
                      </label>
                      <input
                        type="text"
                        name="nome"
                        required
                        value={formData.nome || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          CPF/CNPJ
                        </label>
                        <input
                          type="text"
                          name="cpfCnpj"
                          placeholder={formData.tipo === "Pessoa Física" ? "000.000.000-00" : "00.000.000/0000-00"}
                          value={formData.cpfCnpj || formData.documento || ""}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            !(formData.cpfCnpj || formData.documento)
                              ? "border-slate-300 focus:ring-blue-500/50"
                              : (() => {
                                  const clean = (formData.cpfCnpj || formData.documento || "").replace(/\D/g, "");
                                  const isCPF = formData.tipo === "Pessoa Física" || (formData.tipo !== "Pessoa Jurídica" && clean.length <= 11);
                                  return isCPF ? validarCPF(clean) : validarCNPJ(clean);
                                })()
                              ? "border-green-500 focus:ring-green-500/30"
                              : "border-red-500 focus:ring-red-500/30"
                          }`}
                        />
                        {(formData.cpfCnpj || formData.documento) && (
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            {(() => {
                              const clean = (formData.cpfCnpj || formData.documento || "").replace(/\D/g, "");
                              const isCPF = formData.tipo === "Pessoa Física" || (formData.tipo !== "Pessoa Jurídica" && clean.length <= 11);
                              const isValid = isCPF ? validarCPF(clean) : validarCNPJ(clean);
                              if (isValid) {
                                return (
                                  <span className="text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 size={13} /> {isCPF ? "CPF válido" : "CNPJ válido"}
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle size={13} /> {isCPF ? "CPF inválido" : "CNPJ inválido ou incompleto"}
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          RG / IE
                        </label>
                        <input
                          type="text"
                          name="rgIe"
                          value={formData.rgIe || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            emailError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:ring-blue-500/50"
                          }`}
                        />
                        {emailError && (
                          <p className="text-xs text-red-500 font-semibold mt-1">
                            {emailError}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Data nascimento
                        </label>
                        <input
                          type="date"
                          name="dataNascimento"
                          value={formData.dataNascimento || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          name="telefone"
                          value={formData.telefone || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          WhatsApp
                        </label>
                        <input
                          type="text"
                          name="whatsapp"
                          value={formData.whatsapp || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Código de Indicação (Consultor)
                      </label>
                      <input
                        type="text"
                        name="codigoIndicacao"
                        value={formData.codigoIndicacao || ""}
                        onChange={handleInputChange}
                        className="w-full md:w-1/2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="ativo"
                          checked={formData.ativo ?? true}
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-slate-700">Ativo</span>
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === "Endereço" && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          CEP
                        </label>
                        <input
                          type="text"
                          name="cep"
                          value={formData.cep || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Logradouro
                        </label>
                        <input
                          type="text"
                          name="logradouro"
                          value={formData.logradouro || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Número
                        </label>
                        <input
                          type="text"
                          name="numero"
                          value={formData.numero || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Complemento
                        </label>
                        <input
                          type="text"
                          name="complemento"
                          value={formData.complemento || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Bairro
                      </label>
                      <input
                        type="text"
                        name="bairro"
                        value={formData.bairro || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          name="cidade"
                          value={formData.cidade || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          UF
                        </label>
                        <input
                          type="text"
                          name="uf"
                          value={formData.uf || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "Responsável" && formData.tipo === "Pessoa Jurídica" && (
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        name="respNome"
                        value={formData.respNome || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          CPF do Responsável
                        </label>
                        <input
                          type="text"
                          name="respCpf"
                          placeholder="000.000.000-00"
                          value={formData.respCpf || ""}
                          onChange={handleInputChange}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            !formData.respCpf
                              ? "border-slate-300 focus:ring-blue-500/50"
                              : validarCPF(formData.respCpf)
                              ? "border-green-500 focus:ring-green-500/30"
                              : "border-red-500 focus:ring-red-500/30"
                          }`}
                        />
                        {formData.respCpf && (
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            {validarCPF(formData.respCpf) ? (
                              <span className="text-green-600 font-medium flex items-center gap-1">
                                <CheckCircle2 size={13} /> CPF válido
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium flex items-center gap-1">
                                <AlertTriangle size={13} /> CPF inválido ou incompleto
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          name="respTelefone"
                          value={formData.respTelefone || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="respEmail"
                        value={formData.respEmail || ""}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          respEmailError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:ring-blue-500/50"
                        }`}
                      />
                      {respEmailError && (
                        <p className="text-xs text-red-500 font-semibold mt-1">
                          {respEmailError}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "Notas" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notas internas
                    </label>
                    <textarea
                      name="notas"
                      rows={6}
                      value={formData.notas || ""}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
                    ></textarea>
                  </div>
                )}

              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl mt-auto">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="cliente-form"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
