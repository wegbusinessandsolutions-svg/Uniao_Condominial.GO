import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  Plus,
  Search,
  Printer,
  FileText,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, formatarCPF } from "../../lib/documentValidators";
import { DataTableToolbar } from "../../components/common/DataTableToolbar";
import { StatMetricCard } from "../../components/common/StatMetricCard";
import { EmptyState } from "../../components/common/EmptyState";
import { Users, UserCheck, UserX, Briefcase } from "lucide-react";
import { formatDateBR, formatDateTimeBR } from "../../lib/dateUtils";

interface Empregado {
  id?: string;
  // Pessoal
  nome: string;
  fotoUrl: string;
  cpf: string;
  rg: string;
  pis: string;
  nascimento: string;
  email: string;
  telefone: string;
  ativo: boolean;
  // Contrato
  cargo: string;
  departamento: string;
  tipoContrato: string;
  salario: string;
  admissao: string;
  demissao: string;
  inicioJornada: string;
  fimJornada: string;
  intervalo: string;
  // Endereço
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  // Banco
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
  // Comercial
  codigoIndicacao?: string;
  percentualComissao?: number;
}

const emptyEmpregado: Empregado = {
  nome: "",
  fotoUrl: "",
  cpf: "",
  rg: "",
  pis: "",
  nascimento: "",
  email: "",
  telefone: "",
  ativo: true,
  cargo: "",
  departamento: "",
  tipoContrato: "CLT",
  salario: "",
  admissao: "",
  demissao: "",
  inicioJornada: "",
  fimJornada: "",
  intervalo: "",
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  banco: "",
  agencia: "",
  conta: "",
  chavePix: "",
  codigoIndicacao: "",
  percentualComissao: 0,
};

export default function Empregados() {
  const [data, setData] = useState<Empregado[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [printingItem, setPrintingItem] = useState<Empregado | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Empregado>(emptyEmpregado);
  const [activeTab, setActiveTab] = useState<
    "Pessoal" | "Contrato" | "Endereco" | "Banco"
  >("Pessoal");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const handleAfterPrint = () => setPrintingItem(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    
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

        const base64String = canvas.toDataURL("image/webp", 0.7);
        setFormData((prev) => ({ ...prev, fotoUrl: base64String }));
        setUploadingImage(false);
      };
      img.onerror = () => {
        alert("Erro ao processar a imagem.");
        setUploadingImage(false);
      }
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.");
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePrint = (item: Empregado) => {
    flushSync(() => { setPrintingItem(item); });
    window.print();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const querySnapshot = await getDocs(collection(db, "empregados"));
      const items: Empregado[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...(doc.data() as Omit<Empregado, "id">) });
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

  const handleOpenModal = (item?: Empregado) => {
    setEmailError("");
    if (item) {
      setEditingId(item.id || null);
      setFormData(item);
    } else {
      setEditingId(null);
      setFormData(emptyEmpregado);
    }
    setActiveTab("Pessoal");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(emptyEmpregado);
    setEmailError("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    let { name, value, type } = e.target as HTMLInputElement;
    if (name === "email" && emailError) {
      setEmailError("");
    }
    if (name === "cpf") {
      value = formatarCPF(value);
    } else if (name === "cep") {
      value = value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
    } else if (name === "telefone") {
      value = value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
    }
    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleToggleAtivo = () => {
    setFormData((prev) => ({ ...prev, ativo: !prev.ativo }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    
    if (uploadingImage) {
      alert("Aguarde o upload da foto concluir.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      setEmailError("Formato de e-mail inválido (exemplo: funcionario@email.com).");
      setActiveTab("Pessoal");
      return;
    } else {
      setEmailError("");
    }

    if (formData.cpf) {
      const cleanCpf = formData.cpf.replace(/\D/g, "");
      if (cleanCpf.length > 0 && !validarCPF(cleanCpf)) {
        alert("O CPF informado é inválido. Por favor, verifique os dígitos.");
        setActiveTab("Pessoal");
        return;
      }
    }

    if (!formData.nome || formData.nome.trim() === "") {
      alert("O campo Nome é obrigatório.");
      setActiveTab("Pessoal");
      return;
    }

    try {
      setIsSaving(true);
      const { db } = await initFirebase();
      const dataToSave = { ...formData };
      delete dataToSave.id;

      // Cleanup undefined values to avoid firestore errors
      Object.keys(dataToSave).forEach((key) => {
        if ((dataToSave as any)[key] === undefined) {
          delete (dataToSave as any)[key];
        }
      });

      if (editingId) {
        await updateDoc(doc(db, "empregados", editingId), dataToSave);
      } else {
        await addDoc(collection(db, "empregados"), {
          ...dataToSave,
          createdAt: new Date().toISOString(),
        });
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Error preparing document:", error);
      alert("Erro ao formatar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const employeeToDelete = data.find(emp => emp.id === id);
      const employeeName = employeeToDelete?.nome || id;

      await deleteDoc(doc(db, "empregados", id));

      // LOG ACTION
      await logAction(
        `Exclusão de colaborador: ${employeeName}`,
        "Administrativo",
        { employeeId: id, employeeName }
      );

      fetchData();
    } catch (error) {
      console.error("Error executing delete:", error);
    }
  };

  const [statusFilter, setStatusFilter] = useState("all");

  const kpis = {
    total: data.length,
    ativos: data.filter((item) => item.ativo).length,
    inativos: data.filter((item) => !item.ativo).length,
    departamentos: new Set(data.map((item) => item.departamento).filter(Boolean)).size,
  };

  const filteredData = data.filter((item) => {
    if (statusFilter === "ativos" && !item.ativo) return false;
    if (statusFilter === "inativos" && item.ativo) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (item.nome || "").toLowerCase().includes(term) ||
      (item.cpf || "").toLowerCase().includes(term) ||
      (item.cargo || "").toLowerCase().includes(term) ||
      (item.departamento || "").toLowerCase().includes(term) ||
      (item.email || "").toLowerCase().includes(term)
    );
  });

  const handleExportCsv = () => {
    if (filteredData.length === 0) {
      alert("Nenhum empregado para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "CPF",
      "Cargo",
      "Departamento",
      "Tipo_Contrato",
      "Salario",
      "Admissao",
      "Telefone",
      "Email",
      "Status",
    ];

    const rows = filteredData.map((emp) => [
      `"${emp.nome || ""}"`,
      `"${emp.cpf || ""}"`,
      `"${emp.cargo || ""}"`,
      `"${emp.departamento || ""}"`,
      `"${emp.tipoContrato || ""}"`,
      `"${emp.salario || ""}"`,
      `"${formatDateBR(emp.admissao)}"`,
      `"${emp.telefone || ""}"`,
      `"${emp.email || ""}"`,
      `"${emp.ativo ? "Ativo" : "Inativo"}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `empregados_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Empregados
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Cadastro de colaboradores, jornada, salário e dados bancários.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatMetricCard
            title="Total de Colaboradores"
            value={kpis.total}
            icon={Users}
            iconBgColor="bg-blue-50 dark:bg-blue-950/60"
            iconColor="text-[#0071e3]"
            subtitle="Registrados na base"
            onClick={() => setStatusFilter("all")}
          />
          <StatMetricCard
            title="Colaboradores Ativos"
            value={kpis.ativos}
            icon={UserCheck}
            iconBgColor="bg-emerald-50 dark:bg-emerald-950/60"
            iconColor="text-emerald-600"
            subtitle="Em atividade regular"
            onClick={() => setStatusFilter("ativos")}
          />
          <StatMetricCard
            title="Colaboradores Inativos"
            value={kpis.inativos}
            icon={UserX}
            iconBgColor="bg-slate-100 dark:bg-slate-800"
            iconColor="text-slate-500"
            subtitle="Desligados ou suspensos"
            onClick={() => setStatusFilter("inativos")}
          />
          <StatMetricCard
            title="Departamentos"
            value={kpis.departamentos}
            icon={Briefcase}
            iconBgColor="bg-purple-50 dark:bg-purple-950/60"
            iconColor="text-purple-600"
            subtitle="Setores mapeados"
          />
        </div>

        {/* Toolbar */}
        <DataTableToolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, CPF, cargo, departamento..."
          filterOptions={[
            { label: "Todos", value: "all", count: kpis.total },
            { label: "Ativos", value: "ativos", count: kpis.ativos },
            { label: "Inativos", value: "inativos", count: kpis.inativos },
          ]}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
          onRefresh={fetchData}
          onExportCsv={handleExportCsv}
          primaryActionLabel="Novo Empregado"
          primaryActionIcon={Plus}
          onPrimaryAction={() => handleOpenModal()}
          totalRecords={data.length}
          filteredRecords={filteredData.length}
        />

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-medium">Empregado(s)</th>
                  <th className="px-6 py-4 font-medium">Cargo</th>
                  <th className="px-6 py-4 font-medium">Departamento</th>
                  <th className="px-6 py-4 font-medium">Contrato</th>
                  <th className="px-6 py-4 font-medium">Admissão</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-32" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-28" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-16" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded w-20" />
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
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center"
                    >
                      <EmptyState
                        title={searchTerm || statusFilter !== "all" ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}
                        description={
                          searchTerm || statusFilter !== "all"
                            ? "Tente ajustar os termos de busca ou mudar o filtro de status."
                            : "Cadastre novos colaboradores para gerenciar contratos, jornadas e comissões."
                        }
                        icon={Users}
                        actionLabel={searchTerm || statusFilter !== "all" ? "Limpar Filtros" : "Novo Empregado"}
                        onAction={
                          searchTerm || statusFilter !== "all"
                            ? () => {
                                setSearchTerm("");
                                setStatusFilter("all");
                              }
                            : () => handleOpenModal()
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, i) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {item.nome}
                          </span>
                          {item.email && (
                            <span className="text-xs text-slate-500">
                              {item.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {item.cargo || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {item.departamento || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {item.tipoContrato || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {formatDateBR(item.admissao)}
                      </td>
                      <td className="px-6 py-4">
                        {item.ativo ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3">
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
                            <Pencil size={18} />
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-50 w-full max-w-4xl overflow-hidden flex flex-col rounded-2xl shadow-2xl max-h-[90vh]">
              <div className="px-8 py-5 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingId ? "Editar Empregado(a)" : "Novo Empregado(a)"}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="px-8 pb-4 bg-slate-50">
                <div className="flex gap-2">
                  {(["Pessoal", "Contrato", "Endereco", "Banco"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                          activeTab === tab
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                        }`}
                      >
                        {tab === "Endereco" ? "Endereço" : tab}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-white">
                <div id="empregado-form" className="space-y-6">
                  {activeTab === "Pessoal" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Nome *
                        </label>
                        <input
                          type="text"
                          name="nome"
                          value={formData.nome || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div className="row-span-2 space-y-2">
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Foto
                        </label>
                        {formData.fotoUrl && (
                          <img src={formData.fotoUrl} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                        )}
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          {uploadingImage && (
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <span className="text-xs text-blue-700 font-medium animate-pulse">Enviando...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          CPF
                        </label>
                        <input
                          type="text"
                          name="cpf"
                          placeholder="000.000.000-00"
                          value={formData.cpf || ""}
                          onChange={handleChange}
                          className={`w-full px-4 py-2 rounded-xl border outline-none focus:ring-2 text-sm ${
                            !formData.cpf
                              ? "border-slate-200 focus:ring-brand-light"
                              : validarCPF(formData.cpf)
                              ? "border-green-500 focus:ring-green-500/30"
                              : "border-red-500 focus:ring-red-500/30"
                          }`}
                        />
                        {formData.cpf && (
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            {validarCPF(formData.cpf) ? (
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
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          RG
                        </label>
                        <input
                          type="text"
                          name="rg"
                          value={formData.rg || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          PIS
                        </label>
                        <input
                          type="text"
                          name="pis"
                          value={formData.pis || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Nascimento
                        </label>
                        <input
                          type="date"
                          name="nascimento"
                          value={formData.nascimento || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleChange}
                          className={`w-full px-4 py-2 rounded-xl border outline-none focus:ring-2 focus:ring-brand-light text-sm ${
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
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          name="telefone"
                          value={formData.telefone || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>

                      <div className="col-span-full pt-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <div className="relative">
                            <input
                              type="checkbox"
                              name="ativo"
                              checked={formData.ativo}
                              onChange={handleToggleAtivo}
                              className="sr-only"
                            />
                            <div
                              className={`block w-10 h-6 rounded-full transition-colors ${formData.ativo ? "bg-blue-600" : "bg-slate-300"}`}
                            ></div>
                            <div
                              className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.ativo ? "transform translate-x-4" : ""}`}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            Ativo
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTab === "Contrato" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Cargo
                        </label>
                        <input
                          type="text"
                          name="cargo"
                          value={formData.cargo || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Departamento
                        </label>
                        <select
                          name="departamento"
                          value={formData.departamento || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm bg-white"
                        >
                          <option value="">Selecione...</option>
                          <option value="Comercial">Comercial</option>
                          <option value="Administrativo">Administrativo</option>
                          <option value="Financeiro">Financeiro</option>
                          <option value="Expedição">Expedição</option>
                          <option value="Estoque">Estoque</option>
                        </select>
                      </div>
                      
                      {formData.departamento === 'Comercial' && formData.cargo === 'Consultor(a) de vendas' && (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-slate-900 mb-1">
                              Código de Indicação (Cupom)
                            </label>
                            <input
                              type="text"
                              name="codigoIndicacao"
                              value={formData.codigoIndicacao || ""}
                              onChange={handleChange}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-900 mb-1">
                              Comissão de Vendas (%)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              name="percentualComissao"
                              value={formData.percentualComissao || 0}
                              onChange={handleChange}
                              className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Tipo de contrato
                        </label>
                        <select
                          name="tipoContrato"
                          value={formData.tipoContrato || "CLT"}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm bg-white"
                        >
                          <option value="CLT">CLT</option>
                          <option value="PJ">PJ</option>
                          <option value="Estágio">Estágio</option>
                          <option value="Temporário">Temporário</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Salário
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="salario"
                          value={formData.salario || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Admissão
                        </label>
                        <input
                          type="date"
                          name="admissao"
                          value={formData.admissao || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Demissão
                        </label>
                        <input
                          type="date"
                          name="demissao"
                          value={formData.demissao || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Início jornada
                        </label>
                        <input
                          type="time"
                          name="inicioJornada"
                          value={formData.inicioJornada || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Fim jornada
                        </label>
                        <input
                          type="time"
                          name="fimJornada"
                          value={formData.fimJornada || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Intervalo (min)
                        </label>
                        <input
                          type="number"
                          name="intervalo"
                          value={formData.intervalo || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "Endereco" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          CEP
                        </label>
                        <input
                          type="text"
                          name="cep"
                          value={formData.cep || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Rua
                        </label>
                        <input
                          type="text"
                          name="rua"
                          value={formData.rua || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Número
                        </label>
                        <input
                          type="text"
                          name="numero"
                          value={formData.numero || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Complemento
                        </label>
                        <input
                          type="text"
                          name="complemento"
                          value={formData.complemento || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Bairro
                        </label>
                        <input
                          type="text"
                          name="bairro"
                          value={formData.bairro || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1">
                            Cidade
                          </label>
                          <input
                            type="text"
                            name="cidade"
                            value={formData.cidade || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1">
                            UF
                          </label>
                          <input
                            type="text"
                            name="uf"
                            value={formData.uf || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "Banco" && (
                    <div className="grid grid-cols-1 gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1">
                            Banco
                          </label>
                          <input
                            type="text"
                            name="banco"
                            value={formData.banco || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1">
                            Agência
                          </label>
                          <input
                            type="text"
                            name="agencia"
                            value={formData.agencia || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-900 mb-1">
                            Conta
                          </label>
                          <input
                            type="text"
                            name="conta"
                            value={formData.conta || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                          />
                        </div>
                      </div>
                      <div className="w-full md:w-1/3">
                        <label className="block text-xs font-semibold text-slate-900 mb-1">
                          Chave Pix
                        </label>
                        <input
                          type="text"
                          name="chavePix"
                          value={formData.chavePix || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-8 py-5 flex justify-end gap-3 bg-white">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={isSaving}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-full shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {printingItem && (
        <div className="hidden print:block w-full bg-white text-black font-sans text-[12px] p-8 absolute top-0 left-0">
          <div className="flex justify-between items-baseline border-b-2 border-slate-900 pb-2 mb-6">
            <div>
              <h1 className="text-xl font-bold">
                Ficha do Empregado — {printingItem.nome}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {printingItem.cpf || "—"}
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
                  Identificação
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Nome
                </td>
                <td className="px-3 py-2">{printingItem.nome || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">CPF</td>
                <td className="px-3 py-2">{printingItem.cpf || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">RG</td>
                <td className="px-3 py-2">{printingItem.rg || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">PIS</td>
                <td className="px-3 py-2">{printingItem.pis || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Data nascimento
                </td>
                <td className="px-3 py-2">
                  {formatDateBR(printingItem.nascimento, "—")}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-slate-200 mb-6">
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Contato
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  E-mail
                </td>
                <td className="px-3 py-2">{printingItem.email || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Telefone
                </td>
                <td className="px-3 py-2">{printingItem.telefone || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-slate-200 mb-6">
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
                  Logradouro
                </td>
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
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">UF</td>
                <td className="px-3 py-2">{printingItem.uf || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">CEP</td>
                <td className="px-3 py-2">{printingItem.cep || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-slate-200 mb-6">
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Vínculo
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Cargo
                </td>
                <td className="px-3 py-2">{printingItem.cargo || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Departamento
                </td>
                <td className="px-3 py-2">
                  {printingItem.departamento || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Tipo contrato
                </td>
                <td className="px-3 py-2 uppercase">
                  {printingItem.tipoContrato || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Admissão
                </td>
                <td className="px-3 py-2">
                  {formatDateBR(printingItem.admissao, "—")}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Demissão
                </td>
                <td className="px-3 py-2">
                  {formatDateBR(printingItem.demissao, "—")}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Salário
                </td>
                <td className="px-3 py-2">
                  {printingItem.salario
                    ? `R$ ${Number(printingItem.salario).toFixed(2).replace(".", ",")}`
                    : "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Início expediente
                </td>
                <td className="px-3 py-2">
                  {printingItem.inicioJornada || "—"}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Fim expediente
                </td>
                <td className="px-3 py-2">{printingItem.fimJornada || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Intervalo (min)
                </td>
                <td className="px-3 py-2">{printingItem.intervalo || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Dias trabalhados
                </td>
                <td className="px-3 py-2">—</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">Ativo</td>
                <td className="px-3 py-2">
                  {printingItem.ativo ? "Sim" : "Não"}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-slate-200 mb-6">
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Bancário
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Banco
                </td>
                <td className="px-3 py-2">{printingItem.banco || "—"}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Agência
                </td>
                <td className="px-3 py-2">{printingItem.agencia || "—"}</td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">Conta</td>
                <td className="px-3 py-2">{printingItem.conta || "—"}</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full border border-slate-200 mb-10">
            <tbody>
              <tr>
                <th
                  colSpan={2}
                  className="bg-slate-900 text-white text-left px-3 py-1.5 font-bold uppercase text-[11px]"
                >
                  Auditoria
                </th>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="bg-slate-100 font-semibold px-3 py-2 w-1/4">
                  Criado em
                </td>
                <td className="px-3 py-2">
                  {(printingItem as any).createdAt
                    ? formatDateTimeBR((printingItem as any).createdAt)
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className="bg-slate-100 font-semibold px-3 py-2">
                  Atualizado em
                </td>
                <td className="px-3 py-2">
                  {(printingItem as any).updatedAt
                    ? formatDateTimeBR((printingItem as any).updatedAt)
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="text-center text-slate-500 text-[10px]">
            Página 1 de 1 — Relatório analítico
          </div>
        </div>
      )}
    </>
  );
}
