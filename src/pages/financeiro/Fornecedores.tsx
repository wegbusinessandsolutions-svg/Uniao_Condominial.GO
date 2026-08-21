import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Pencil, Trash2, X, Printer, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, validarCNPJ, formatarCpfCnpj } from "../../lib/documentValidators";
import { exportTableToPdf } from "../../lib/pdfExport";

// Basic Tab structure
const tabs = ["Básico", "Endereço", "Bancário", "Extra"];

export default function Fornecedores() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ ativo: true });
  const [activeTab, setActiveTab] = useState("Básico");
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailRepresentanteError, setEmailRepresentanteError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = collection(db, "fornecedores");
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setFormData({ ativo: true });
    setEditingId(null);
    setActiveTab("Básico");
    setEmailError("");
    setEmailRepresentanteError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setFormData(item);
    setEditingId(item.id);
    setActiveTab("Básico");
    setEmailError("");
    setEmailRepresentanteError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
    setEmailError("");
    setEmailRepresentanteError("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value, type } = e.target;
    
    // CNPJ / CPF Mask
    if (name === 'cnpj') {
      value = formatarCpfCnpj(value);
    }
    
    // CEP mask
    if (name === 'cep') {
      value = value.replace(/\D/g, "");
      value = value.replace(/^(\d{5})(\d)/, "$1-$2");
      value = value.substring(0, 9);
    }

    // Phone mask
    if (name === 'telefone' || name === 'whatsapp' || name === 'telefoneRepresentante') {
      value = value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
    }
    
    if (name === "email" && emailError) setEmailError("");
    if (name === "emailRepresentante" && emailRepresentanteError) setEmailRepresentanteError("");

    setFormData(prev => ({
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
      setEmailError("Formato de e-mail do fornecedor inválido (exemplo: contato@fornecedor.com.br).");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (formData.emailRepresentante && !emailRegex.test(formData.emailRepresentante)) {
      setEmailRepresentanteError("Formato de e-mail do representante inválido (exemplo: representante@email.com).");
      hasError = true;
    } else {
      setEmailRepresentanteError("");
    }

    if (hasError) {
      return;
    }
    
    // Validate CNPJ / CPF before saving
    if (formData.cnpj) {
      const clean = formData.cnpj.replace(/\D/g, "");
      const isValid = clean.length <= 11 ? validarCPF(clean) : validarCNPJ(clean);
      if (!isValid) {
        alert(`O ${clean.length <= 11 ? "CPF" : "CNPJ"} informado é inválido. Por favor, digite um documento válido.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const savePayload = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, "fornecedores", editingId), savePayload);
      } else {
        savePayload.createdAt = new Date().toISOString();
        await addDoc(collection(db, "fornecedores"), savePayload);
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o fornecedor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const supplierToDelete = data.find(item => item.id === id);
      const supplierName = supplierToDelete ? (supplierToDelete.razaoSocial || supplierToDelete.nome || id) : id;

      await deleteDoc(doc(db, "fornecedores", id));

      // LOG ACTION
      await logAction(
        `Exclusão de fornecedor: ${supplierName}`,
        "Financeiro",
        { supplierId: id, supplierName }
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const handleExportPdf = () => {
    exportTableToPdf(
      filteredData,
      "Fornecedores",
      [
        { key: "razaoSocial", label: "Razão Social/Nome" },
        { key: "cnpj_cpf", label: "CNPJ/CPF" },
        { key: "email", label: "E-mail" },
        { key: "telefone", label: "Telefone" },
        { key: "cidade", label: "Cidade" },
        { key: "estado", label: "UF" }
      ]
    );
  };

  const filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const razao = (item.razaoSocial || item.nome || "").toLowerCase();
    const fantasia = (item.nomeFantasia || "").toLowerCase();
    const doc = (item.cnpj || item.cnpj_cpf || "").toLowerCase();

    return (
      razao.includes(searchLower) ||
      fantasia.includes(searchLower) ||
      doc.includes(searchLower)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
          <p className="text-sm text-slate-500">Gestão de parceiros e fornecedores de serviços.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors text-sm font-medium"
            title="Exportar para PDF"
          >
            <FileText size={16} />
            Exportar PDF
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Novo Fornecedor
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="relative w-full sm:w-96">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por Razão Social, Fantasia ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark focus:border-transparent transition-shadow"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Razão Social</th>
                <th className="px-6 py-4 whitespace-nowrap">C.N.P.J.</th>
                <th className="px-6 py-4 whitespace-nowrap">Cidade</th>
                <th className="px-6 py-4 whitespace-nowrap">UF</th>
                <th className="px-6 py-4 whitespace-nowrap">Telefone</th>
                <th className="px-6 py-4 whitespace-nowrap">Email</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-48" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-28" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-8" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-36" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.razaoSocial || item.nome || '-'}</td>
                    <td className="px-6 py-4">{item.cnpj || item.cnpj_cpf || '-'}</td>
                    <td className="px-6 py-4">{item.cidade || '-'}</td>
                    <td className="px-6 py-4">{item.uf || '-'}</td>
                    <td className="px-6 py-4">{item.telefone || item.contato || '-'}</td>
                    <td className="px-6 py-4">{item.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[11px] font-semibold rounded-full ${item.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
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
                          onClick={() => {
                            exportTableToPdf(
                              [item],
                              `Fornecedor - ${item.razaoSocial || item.nomeFantasia || "Detalhe"}`,
                              [
                                { key: "razaoSocial", label: "Razão Social/Nome" },
                                { key: "cnpj_cpf", label: "CNPJ/CPF" },
                                { key: "email", label: "E-mail" },
                                { key: "telefone", label: "Telefone" },
                                { key: "cidade", label: "Cidade" },
                                { key: "estado", label: "UF" }
                              ]
                            );
                          }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar Fornecedor" : "Novo fornecedor"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between bg-slate-100 p-1 rounded-full">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                      activeTab === tab
                        ? "bg-white text-brand-dark shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="fornecedor-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* GUIA BÁSICO */}
                <div className={activeTab === "Básico" ? "block" : "hidden"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Razão Social <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="razaoSocial"
                        required
                        value={formData.razaoSocial || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nome Fantasia
                      </label>
                      <input
                        type="text"
                        name="nomeFantasia"
                        value={formData.nomeFantasia || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        CNPJ / CPF <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="cnpj"
                        required
                        placeholder="00.000.000/0000-00 ou 000.000.000-00"
                        value={formData.cnpj || ""}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          !formData.cnpj
                            ? "border-slate-300 focus:ring-brand-dark/50"
                            : (formData.cnpj.replace(/\D/g, "").length <= 11 ? validarCPF(formData.cnpj) : validarCNPJ(formData.cnpj))
                            ? "border-green-500 focus:ring-green-500/30"
                            : "border-red-500 focus:ring-red-500/30"
                        }`}
                      />
                      {formData.cnpj && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          {(() => {
                            const clean = formData.cnpj.replace(/\D/g, "");
                            const isCPF = clean.length <= 11;
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
                        IE
                      </label>
                      <input
                        type="text"
                        name="ie"
                        value={formData.ie || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

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
                          emailError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:ring-brand-dark/50"
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
                        Site
                      </label>
                      <input
                        type="text"
                        name="site"
                        value={formData.site || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="text"
                        name="telefone"
                        value={formData.telefone || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
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
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center gap-3 pt-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="ativo"
                          checked={formData.ativo ?? true}
                          onChange={handleInputChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-dark"></div>
                        <span className="ml-3 text-sm font-medium text-slate-700">Ativo</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* GUIA ENDEREÇO */}
                <div className={activeTab === "Endereço" ? "block" : "hidden"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 grid grid-cols-3 gap-6">
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          CEP
                        </label>
                        <input
                          type="text"
                          name="cep"
                          placeholder="00000-000"
                          value={formData.cep || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Logradouro
                        </label>
                        <input
                          type="text"
                          name="logradouro"
                          value={formData.logradouro || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-3 gap-6">
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Número
                        </label>
                        <input
                          type="text"
                          name="numero"
                          value={formData.numero || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Complemento
                        </label>
                        <input
                          type="text"
                          name="complemento"
                          value={formData.complemento || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Bairro
                      </label>
                      <input
                        type="text"
                        name="bairro"
                        value={formData.bairro || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div className="md:col-span-2 grid grid-cols-4 gap-6">
                      <div className="col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Cidade
                        </label>
                        <input
                          type="text"
                          name="cidade"
                          value={formData.cidade || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                        />
                      </div>

                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          UF
                        </label>
                        <input
                          type="text"
                          name="uf"
                          maxLength={2}
                          value={formData.uf || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50 uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* GUIA BANCÁRIO */}
                <div className={activeTab === "Bancário" ? "block" : "hidden"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Banco
                      </label>
                      <input
                        type="text"
                        name="banco"
                        value={formData.banco || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Agência
                      </label>
                      <input
                        type="text"
                        name="agencia"
                        value={formData.agencia || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Conta
                      </label>
                      <input
                        type="text"
                        name="conta"
                        value={formData.conta || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Chave PIX
                      </label>
                      <input
                        type="text"
                        name="chavePix"
                        value={formData.chavePix || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Condições de pagamento
                      </label>
                      <input
                        type="text"
                        name="condicoesPagamento"
                        placeholder="ex: 30/60/90"
                        value={formData.condicoesPagamento || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>
                  </div>
                </div>

                {/* GUIA EXTRA */}
                <div className={activeTab === "Extra" ? "block" : "hidden"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Representante
                      </label>
                      <input
                        type="text"
                        name="representante"
                        value={formData.representante || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Telefone repr.
                      </label>
                      <input
                        type="text"
                        name="telefoneRepresentante"
                        value={formData.telefoneRepresentante || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email repr.
                      </label>
                      <input
                        type="email"
                        name="emailRepresentante"
                        value={formData.emailRepresentante || ""}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          emailRepresentanteError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:ring-brand-dark/50"
                        }`}
                      />
                      {emailRepresentanteError && (
                        <p className="text-xs text-red-500 font-semibold mt-1">
                          {emailRepresentanteError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Prazo médio entrega (dias)
                      </label>
                      <input
                        type="number"
                        name="prazoEntregaDias"
                        value={formData.prazoEntregaDias || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Rating (0-5)
                      </label>
                      <input
                        type="number"
                        name="rating"
                        min="0"
                        max="5"
                        step="0.1"
                        value={formData.rating || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        name="observacoes"
                        rows={4}
                        value={formData.observacoes || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50 resize-none"
                      />
                    </div>
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
                form="fornecedor-form"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-brand-dark rounded-lg shadow-sm hover:bg-brand-dark/90 transition-colors disabled:opacity-50"
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
