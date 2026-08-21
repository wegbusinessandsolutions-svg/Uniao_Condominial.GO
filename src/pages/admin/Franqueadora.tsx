import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Building,
  MapPin,
  FileText,
  Users,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, validarCNPJ, formatarCPF, formatarCNPJ } from "../../lib/documentValidators";

interface FranqueadoraData {
  id?: string;
  // Básico
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  logoUrl: string;
  telefone: string;
  email: string;
  site: string;

  // Endereço
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;

  // Fiscal
  regimeTributario: string;
  certificadoDigital: string;

  // Extra (Sócios)
  resp1Nome: string;
  resp1Cpf: string;
  resp1Part: string;
  resp1Funcao: string;
  resp1Tel: string;

  resp2Nome: string;
  resp2Cpf: string;
  resp2Part: string;
  resp2Funcao: string;
  resp2Tel: string;

  resp3Nome: string;
  resp3Cpf: string;
  resp3Part: string;
  resp3Funcao: string;
  resp3Tel: string;

  resp4Nome: string;
  resp4Cpf: string;
  resp4Part: string;
  resp4Funcao: string;
  resp4Tel: string;

  // Franquia
  taxaFranquia: string;
  royalties: string;
  fundoPropaganda: string;

  createdAt?: string;
  updatedAt?: string;
}

const emptyFranqueadora: FranqueadoraData = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  logoUrl: "",
  telefone: "",
  email: "",
  site: "",

  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",

  regimeTributario: "",
  certificadoDigital: "",

  resp1Nome: "",
  resp1Cpf: "",
  resp1Part: "",
  resp1Funcao: "",
  resp1Tel: "",

  resp2Nome: "",
  resp2Cpf: "",
  resp2Part: "",
  resp2Funcao: "",
  resp2Tel: "",

  resp3Nome: "",
  resp3Cpf: "",
  resp3Part: "",
  resp3Funcao: "",
  resp3Tel: "",

  resp4Nome: "",
  resp4Cpf: "",
  resp4Part: "",
  resp4Funcao: "",
  resp4Tel: "",

  taxaFranquia: "",
  royalties: "",
  fundoPropaganda: "",
};

export default function Franqueadora() {
  const [data, setData] = useState<FranqueadoraData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printingItem, setPrintingItem] = useState<FranqueadoraData | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FranqueadoraData>(emptyFranqueadora);
  const [activeTab, setActiveTab] = useState<
    "Básico" | "Endereço" | "Fiscal" | "Extra" | "Franquia"
  >("Básico");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // max width/height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/webp", 0.8);
        setFormData((prev) => ({ ...prev, logoUrl: base64String }));
        setIsUploadingLogo(false);
      };
      img.onerror = () => {
        alert("Erro ao processar a imagem.");
        setIsUploadingLogo(false);
      }
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.");
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleAfterPrint = () => setPrintingItem(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handlePrint = (item: FranqueadoraData) => {
    flushSync(() => { setPrintingItem(item); });
    window.print();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const querySnapshot = await getDocs(collection(db, "config_franqueadora"));
      const items: FranqueadoraData[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...(doc.data() as Omit<FranqueadoraData, "id">) });
      });
      setData(items);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item?: FranqueadoraData) => {
    setEmailError("");
    if (item) {
      setEditingId(item.id || null);
      setFormData(item);
    } else {
      setEditingId(null);
      setFormData(emptyFranqueadora);
    }
    setActiveTab("Básico");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(emptyFranqueadora);
    setEmailError("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    let { name, value } = e.target;
    if (name === "email" && emailError) {
      setEmailError("");
    }
    if (name === "cnpj") {
      value = formatarCNPJ(value);
    } else if (name.startsWith("resp") && name.endsWith("Cpf")) {
      value = formatarCPF(value);
    } else if (name === "cep") {
      value = value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
    } else if (name === "telefone" || (name.startsWith("resp") && name.endsWith("Tel"))) {
      value = value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      setEmailError("Formato de e-mail inválido (exemplo: contato@franqueadora.com.br).");
      setActiveTab("Básico");
      return;
    } else {
      setEmailError("");
    }

    if (formData.cnpj) {
      const cleanCnpj = formData.cnpj.replace(/\D/g, "");
      if (cleanCnpj.length > 0 && !validarCNPJ(cleanCnpj)) {
        alert("O CNPJ informado é inválido. Por favor, verifique os dígitos.");
        setActiveTab("Básico");
        return;
      }
    }

    // Validate socio CPFs if provided
    for (const num of [1, 2, 3, 4]) {
      const cpfVal = formData[`resp${num}Cpf` as keyof FranqueadoraData] as string;
      if (cpfVal) {
        const cleanCpf = cpfVal.replace(/\D/g, "");
        if (cleanCpf.length > 0 && !validarCPF(cleanCpf)) {
          alert(`O CPF do Sócio ${num} é inválido. Por favor, verifique os dígitos.`);
          setActiveTab("Extra");
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const collectionRef = collection(db, "config_franqueadora");

      const payload = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, "config_franqueadora", editingId), payload);
      } else {
        await addDoc(collectionRef, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }

      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving doc:", error);
      alert("Erro ao salvar os dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      await deleteDoc(doc(db, "config_franqueadora", id));
      await fetchData();
    } catch (error) {
      console.error("Error deleting doc:", error);
      alert("Erro ao excluir registro.");
    }
  };

  const filteredData = data.filter(
    (item) =>
      item.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cnpj?.includes(searchTerm),
  );

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-4 border-b border-slate-200 -mx-6 -mt-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Dados da Franqueadora
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Configurações e informações legais da sua franqueadora.
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-brand-dark hover:bg-brand-dark/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} />
            Nova Franqueadora
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="relative max-w-md">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar por nome ou CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-brand-dark focus:border-brand-dark transition-all outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-semibold">Razão Social</th>
                  <th className="px-6 py-3 font-semibold">Nome Fantasia</th>
                  <th className="px-6 py-3 font-semibold">CNPJ</th>
                  <th className="px-6 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-48" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-32" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-24" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Nenhuma franqueadora encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {item.razaoSocial || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.nomeFantasia || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {item.cnpj || "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            className="text-slate-400 hover:text-blue-900 transition-colors"
                            title="Imprimir"
                            onClick={() => handlePrint(item)}
                          >
                            <Printer size={18} />
                          </button>
                          <button
                            onClick={() => {}}
                            className="text-slate-400 hover:text-sky-600 transition-colors"
                            title="Baixar PDF"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => item.id && setItemToDelete(item.id)}
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingId ? "Editar Franqueadora" : "Nova Franqueadora"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("Básico")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === "Básico"
                      ? "border-brand-dark text-brand-dark"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Building size={16} />
                  Básico
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Endereço")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === "Endereço"
                      ? "border-brand-dark text-brand-dark"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <MapPin size={16} />
                  Endereço
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Fiscal")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === "Fiscal"
                      ? "border-brand-dark text-brand-dark"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <FileText size={16} />
                  Fiscal
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Extra")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === "Extra"
                      ? "border-brand-dark text-brand-dark"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Users size={16} />
                  Extra
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Franquia")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === "Franquia"
                      ? "border-brand-dark text-brand-dark"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Building size={16} />
                  Franquia
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex-1 overflow-y-auto p-6"
              >
                {activeTab === "Básico" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Razão Social *
                      </label>
                      <input
                        type="text"
                        name="razaoSocial"
                        required
                        value={formData.razaoSocial}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nome Fantasia
                      </label>
                      <input
                        type="text"
                        name="nomeFantasia"
                        value={formData.nomeFantasia}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        name="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-md sm:text-sm focus:outline-none focus:ring-2 ${
                          !formData.cnpj
                            ? "border-slate-300 focus:ring-brand-dark focus:border-brand-dark"
                            : validarCNPJ(formData.cnpj)
                            ? "border-green-500 focus:ring-green-500/30"
                            : "border-red-500 focus:ring-red-500/30"
                        }`}
                      />
                      {formData.cnpj && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          {validarCNPJ(formData.cnpj) ? (
                            <span className="text-green-600 font-medium flex items-center gap-1">
                              <CheckCircle2 size={13} /> CNPJ válido
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertTriangle size={13} /> CNPJ inválido ou incompleto
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Inscrição Estadual
                      </label>
                      <input
                        type="text"
                        name="inscricaoEstadual"
                        value={formData.inscricaoEstadual}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Inscrição Municipal
                      </label>
                      <input
                        type="text"
                        name="inscricaoMunicipal"
                        value={formData.inscricaoMunicipal}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Logo da Franqueadora
                      </label>
                      <div className="flex items-center gap-4">
                        {formData.logoUrl && (
                          <div className="h-16 w-16 bg-white border border-slate-200 rounded p-1 flex items-center justify-center">
                            <img src={formData.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="block w-full text-sm text-slate-500
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-md file:border-0
                              file:text-sm file:font-semibold
                              file:bg-brand-light file:text-brand-dark
                              hover:file:bg-brand
                              disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          {isUploadingLogo && (
                            <p className="mt-1 text-sm text-brand-dark">Fazendo upload...</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Telefone
                      </label>
                      <input
                        type="text"
                        name="telefone"
                        value={formData.telefone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        E-mail
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm ${
                          emailError ? "border-red-500 focus:ring-red-100" : "border-slate-300"
                        }`}
                      />
                      {emailError && (
                        <p className="text-xs text-red-500 font-semibold mt-1">
                          {emailError}
                        </p>
                      )}
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Site
                      </label>
                      <input
                        type="text"
                        name="site"
                        value={formData.site}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "Endereço" && (
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-5">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        CEP
                      </label>
                      <input
                        type="text"
                        name="cep"
                        value={formData.cep}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Rua
                      </label>
                      <input
                        type="text"
                        name="rua"
                        value={formData.rua}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Número
                      </label>
                      <input
                        type="text"
                        name="numero"
                        value={formData.numero}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Complemento
                      </label>
                      <input
                        type="text"
                        name="complemento"
                        value={formData.complemento}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Bairro
                      </label>
                      <input
                        type="text"
                        name="bairro"
                        value={formData.bairro}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Cidade
                      </label>
                      <input
                        type="text"
                        name="cidade"
                        value={formData.cidade}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        UF
                      </label>
                      <input
                        type="text"
                        name="uf"
                        value={formData.uf}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "Fiscal" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Regime Tributário
                      </label>
                      <input
                        type="text"
                        name="regimeTributario"
                        value={formData.regimeTributario}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Certificado digital (URL)
                      </label>
                      <input
                        type="text"
                        name="certificadoDigital"
                        value={formData.certificadoDigital}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "Extra" && (
                  <div className="space-y-8">
                    {[1, 2, 3, 4].map((num) => (
                      <div
                        key={num}
                        className="bg-slate-50 p-4 border border-slate-200 rounded-lg shadow-sm"
                      >
                        <h3 className="text-md font-semibold text-slate-800 mb-4">
                          Sócio/Responsável {num}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Nome
                            </label>
                            <input
                              type="text"
                              name={`resp${num}Nome`}
                              value={
                                formData[
                                  `resp${num}Nome` as keyof FranqueadoraData
                                ] as string
                              }
                              onChange={handleChange}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              CPF
                            </label>
                            <input
                              type="text"
                              name={`resp${num}Cpf`}
                              placeholder="000.000.000-00"
                              value={
                                (formData[
                                  `resp${num}Cpf` as keyof FranqueadoraData
                                ] as string) || ""
                              }
                              onChange={handleChange}
                              className={`w-full px-3 py-2 border rounded-md sm:text-sm focus:outline-none focus:ring-2 ${
                                !formData[`resp${num}Cpf` as keyof FranqueadoraData]
                                  ? "border-slate-300 focus:ring-brand-dark focus:border-brand-dark"
                                  : validarCPF(formData[`resp${num}Cpf` as keyof FranqueadoraData] as string)
                                  ? "border-green-500 focus:ring-green-500/30"
                                  : "border-red-500 focus:ring-red-500/30"
                              }`}
                            />
                            {formData[`resp${num}Cpf` as keyof FranqueadoraData] && (
                              <div className="mt-1 flex items-center gap-1 text-[11px]">
                                {validarCPF(formData[`resp${num}Cpf` as keyof FranqueadoraData] as string) ? (
                                  <span className="text-green-600 font-medium flex items-center gap-0.5">
                                    <CheckCircle2 size={11} /> Válido
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-medium flex items-center gap-0.5">
                                    <AlertTriangle size={11} /> Inválido
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Participação (%)
                            </label>
                            <input
                              type="text"
                              name={`resp${num}Part`}
                              value={
                                formData[
                                  `resp${num}Part` as keyof FranqueadoraData
                                ] as string
                              }
                              onChange={handleChange}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Função
                            </label>
                            <input
                              type="text"
                              name={`resp${num}Funcao`}
                              value={
                                formData[
                                  `resp${num}Funcao` as keyof FranqueadoraData
                                ] as string
                              }
                              onChange={handleChange}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Telefone
                            </label>
                            <input
                              type="text"
                              name={`resp${num}Tel`}
                              value={
                                formData[
                                  `resp${num}Tel` as keyof FranqueadoraData
                                ] as string
                              }
                              onChange={handleChange}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "Franquia" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                    <div className="md:col-span-2">
                      <h4 className="text-sm font-semibold text-slate-800 border-b pb-2 mb-4">
                        Configurações da Franquia
                      </h4>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Taxa de Franquia (R$)
                      </label>
                      <input
                        type="text"
                        name="taxaFranquia"
                        value={formData.taxaFranquia || ""}
                        onChange={handleChange}
                        placeholder="Ex: 50000,00"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Royalties (%)
                      </label>
                      <input
                        type="text"
                        name="royalties"
                        value={formData.royalties || ""}
                        onChange={handleChange}
                        placeholder="Ex: 5"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Fundo de Propaganda (%)
                      </label>
                      <input
                        type="text"
                        name="fundoPropaganda"
                        value={formData.fundoPropaganda || ""}
                        onChange={handleChange}
                        placeholder="Ex: 2"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isUploadingLogo}
                    className="bg-brand-dark hover:bg-brand-dark/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Save size={16} />
                        Salvar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {printingItem && (
        <div className="hidden print:block w-full bg-white text-black font-sans text-[12px] p-8 absolute top-0 left-0">
          <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-2 mb-6">
            <div>
              <h1 className="text-xl font-bold">
                Ficha da Franqueadora —{" "}
                {printingItem.razaoSocial || "Configuração da Franqueadora"}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {printingItem.cnpj || "—"}
              </p>
            </div>
            <div className="text-slate-500 text-xs">
              Emitido em {new Date().toLocaleDateString("pt-BR")},{" "}
              {new Date().toLocaleTimeString("pt-BR")}
            </div>
          </div>

          <table className="w-full border border-slate-200 mb-6">
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Básico
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Razão Social
                </td>
                <td className="px-3 py-2">{printingItem.razaoSocial || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Nome Fantasia
                </td>
                <td className="px-3 py-2">
                  {printingItem.nomeFantasia || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">CNPJ</td>
                <td className="px-3 py-2">{printingItem.cnpj || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Inscrição Estadual
                </td>
                <td className="px-3 py-2">
                  {printingItem.inscricaoEstadual || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Inscrição Municipal
                </td>
                <td className="px-3 py-2">
                  {printingItem.inscricaoMunicipal || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Logo (URL)
                </td>
                <td className="px-3 py-2">{printingItem.logoUrl || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Telefone
                </td>
                <td className="px-3 py-2">{printingItem.telefone || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">E-mail</td>
                <td className="px-3 py-2">{printingItem.email || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">Site</td>
                <td className="px-3 py-2">{printingItem.site || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table
            className="w-full border border-slate-200 mb-6"
            style={{ pageBreakInside: "avoid" }}
          >
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Endereço
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  CEP
                </td>
                <td className="px-3 py-2">{printingItem.cep || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">Rua</td>
                <td className="px-3 py-2">{printingItem.rua || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">Número</td>
                <td className="px-3 py-2">{printingItem.numero || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Complemento
                </td>
                <td className="px-3 py-2">{printingItem.complemento || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">Bairro</td>
                <td className="px-3 py-2">{printingItem.bairro || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">Cidade</td>
                <td className="px-3 py-2">{printingItem.cidade || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">UF</td>
                <td className="px-3 py-2">{printingItem.uf || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table
            className="w-full border border-slate-200 mb-6"
            style={{ pageBreakInside: "avoid" }}
          >
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Fiscal
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Regime Tributário
                </td>
                <td className="px-3 py-2">
                  {printingItem.regimeTributario || "—"}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Certificado Digital (URL)
                </td>
                <td className="px-3 py-2">
                  {printingItem.certificadoDigital || "—"}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-md font-bold mb-2">Sócios/Proprietários</h2>
          <table
            className="w-full border border-slate-200 mb-6 text-xs text-left"
            style={{ pageBreakInside: "avoid" }}
          >
            <thead className="bg-slate-100">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 border-r border-slate-200">Resp.</th>
                <th className="px-3 py-2 border-r border-slate-200">Nome</th>
                <th className="px-3 py-2 border-r border-slate-200">CPF</th>
                <th className="px-3 py-2 border-r border-slate-200">
                  Part. (%)
                </th>
                <th className="px-3 py-2 border-r border-slate-200">Função</th>
                <th className="px-3 py-2">Telefone</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((num) => {
                const prefix = `resp${num}` as any;
                const nome = printingItem[`${prefix}Nome` as keyof FranqueadoraData];
                const cpf = printingItem[`${prefix}Cpf` as keyof FranqueadoraData];
                const part = printingItem[`${prefix}Part` as keyof FranqueadoraData];
                const func =
                  printingItem[`${prefix}Funcao` as keyof FranqueadoraData];
                const tel = printingItem[`${prefix}Tel` as keyof FranqueadoraData];
                if (!nome && !cpf && !part && !func && !tel) return null;
                return (
                  <tr
                    key={num}
                    className="border-b border-slate-200 last:border-b-0"
                  >
                    <td className="px-3 py-2 border-r border-slate-200 font-bold">
                      {num}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      {(nome as string) || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      {(cpf as string) || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      {(part as string) || "—"}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      {(func as string) || "—"}
                    </td>
                    <td className="px-3 py-2">{(tel as string) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="text-center text-slate-500 text-[10px]">
            Página 1 de 1 — Relatório da Franqueadora
          </div>
        </div>
      )}
    </>
  );
}
