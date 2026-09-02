import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { 
  Plus, Edit2, Trash2, Send, X, Phone, User, Building2, 
  CheckCircle2, FileText, AlertCircle, Contact, BookUser, Clock
} from "lucide-react";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function MeusContatos() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [contatos, setContatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cnpjCpf: "",
    nomeEmpresa: "",
    nomeContato: "",
    telefone: "",
    atendimentoUrgencia: "Não se Aplica",
    especialidades: [] as string[],
    observacoes: ""
  });

  const [saving, setSaving] = useState(false);

  const especialidadesOpcoes = [
    "Cerca Elétrica",
    "Circuito de Câmeras",
    "Colaboradores",
    "Eletricista",
    "Elevador",
    "Encanador",
    "Jardineiro",
    "Outros",
    "Pinturas",
    "Portão Eletrônico",
    "Reformas e Pequenos Reparos",
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "cliente_contatos"),
      where("clienteId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => (a.nomeEmpresa || "").localeCompare(b.nomeEmpresa || ""));
      setContatos(list);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar contatos:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const handleMaskCnpjCpf = (value: string) => {
    let v = value.replace(/\D/g, "");
    if (v.length <= 11) {
      // CPF
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v;
  };

  const handleMaskTelefone = (value: string) => {
    let v = value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    return v;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "cnpjCpf") {
      setFormData(prev => ({ ...prev, cnpjCpf: handleMaskCnpjCpf(value) }));
    } else if (name === "telefone") {
      setFormData(prev => ({ ...prev, telefone: handleMaskTelefone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEspecialidadeToggle = (esp: string) => {
    setFormData(prev => {
      const current = [...prev.especialidades];
      const index = current.indexOf(esp);
      if (index === -1) {
        current.push(esp);
      } else {
        current.splice(index, 1);
      }
      return { ...prev, especialidades: current };
    });
  };

  const openModalNew = () => {
    setFormData({
      cnpjCpf: "",
      nomeEmpresa: "",
      nomeContato: "",
      telefone: "",
      atendimentoUrgencia: "Não se Aplica",
      especialidades: [],
      observacoes: ""
    });
    setEditingId(null);
    setShowModal(true);
  };

  const openModalEdit = (contato: any) => {
    setFormData({
      cnpjCpf: contato.cnpjCpf || "",
      nomeEmpresa: contato.nomeEmpresa || "",
      nomeContato: contato.nomeContato || "",
      telefone: contato.telefone || "",
      atendimentoUrgencia: contato.atendimentoUrgencia || "Não se Aplica",
      especialidades: contato.especialidades || [],
      observacoes: contato.observacoes || ""
    });
    setEditingId(contato.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir este contato?")) {
      try {
        await deleteDoc(doc(db, "cliente_contatos", id));
        addToast({
          title: "Contato excluído",
          message: "O contato foi removido com sucesso.",
          type: "info"
        });
      } catch (e: any) {
        console.error("Erro ao excluir contato", e);
        addToast({
          title: "Erro ao excluir",
          message: "Não foi possível excluir o contato: " + (e?.message || "Tente novamente"),
          type: "error"
        });
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      addToast({
        title: "Sessão expirada",
        message: "Faça login para salvar seus contatos.",
        type: "error"
      });
      return;
    }
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        clienteId: user.uid,
        clienteEmail: user.email || "",
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "cliente_contatos", editingId), payload);
        addToast({
          title: "Contato atualizado",
          message: "Contato atualizado com sucesso!",
          type: "success"
        });
      } else {
        await addDoc(collection(db, "cliente_contatos"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        addToast({
          title: "Contato salvo",
          message: "Novo contato cadastrado com sucesso!",
          type: "success"
        });
      }
      setShowModal(false);
    } catch (e: any) {
      console.error("Erro ao salvar:", e);
      addToast({
        title: "Erro ao salvar contato",
        message: e?.message || "Ocorreu um erro ao salvar o contato. Verifique sua conexão.",
        type: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = (contato: any) => {
    const rawTel = (contato.telefone || "").replace(/\D/g, "");

    // Formatação das Especialidades de forma sóbria e limpa
    const especialidadesTexto = (contato.especialidades && contato.especialidades.length > 0)
      ? contato.especialidades.map((e: string) => `  - ${e}`).join("\n")
      : "  - Serviços sob consulta";

    // Formatação de Urgência em texto sóbrio
    let urgenciaTexto = "Não se aplica";
    if (contato.atendimentoUrgencia === "Sim") {
      urgenciaTexto = "Sim (atendimento fora de expediente / plantão)";
    } else if (contato.atendimentoUrgencia === "Não") {
      urgenciaTexto = "Não (apenas horário comercial)";
    }

    // Apresentação sóbria, bem estruturada e sem formatação em negrito
    const lines: string[] = [
      "INDICAÇÃO DE CONTATO / PRESTADOR",
      "----------------------------------------",
      "Olá! Conforme solicitado, seguem os dados do contato cadastrado para atendimento no condomínio:",
      "",
      `▪ Empresa / Profissional: ${contato.nomeEmpresa || "Não informada"}`,
      `▪ Contato: ${contato.nomeContato || "Não informado"}`,
    ];

    if (contato.cnpjCpf) {
      lines.push(`▪ CNPJ/CPF: ${contato.cnpjCpf}`);
    }

    if (contato.telefone) {
      lines.push(`▪ Telefone: ${contato.telefone}`);
      if (rawTel) {
        lines.push(`▪ WhatsApp direto: https://wa.me/55${rawTel}`);
      }
    }

    lines.push(`▪ Atendimento de urgência: ${urgenciaTexto}`);
    lines.push("");
    lines.push("▪ Especialidades atendidas:");
    lines.push(especialidadesTexto);

    if (contato.observacoes && contato.observacoes.trim()) {
      lines.push("");
      lines.push("▪ Observações:");
      lines.push(contato.observacoes.trim());
    }

    lines.push("");
    lines.push("----------------------------------------");
    lines.push("Encaminhado pela Administração do Condomínio");

    const text = lines.join("\n");

    // Copia para a área de transferência
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    addToast("Abrindo WhatsApp para enviar os dados do contato...", "success");

    // Abre o compartilhamento do WhatsApp
    const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-1 sm:px-4 lg:px-6 space-y-6 overflow-x-hidden min-w-0">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3 break-words">
            <BookUser className="text-blue-600 shrink-0" size={28} />
            <span className="truncate">Meus Contatos</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1 font-normal break-words">
            Cadastre os contatos e prestadores de serviço do seu condomínio.
          </p>
        </div>
        <button
          onClick={openModalNew}
          className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm shrink-0"
        >
          <Plus size={20} />
          <span>Novo Contato</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : contatos.length === 0 ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center min-w-0">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <Contact size={32} />
          </div>
          <h3 className="text-lg sm:text-xl font-medium text-slate-900 mb-2">Nenhum contato cadastrado</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md font-normal">
            Mantenha a organização do seu condomínio centralizando todos os prestadores de serviço que você utiliza aqui.
          </p>
          <button
            onClick={openModalNew}
            className="w-full sm:w-auto justify-center bg-blue-50 text-blue-700 hover:bg-blue-100 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Adicionar Primeiro Contato
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
          {contatos.map(contato => (
            <div key={contato.id} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col min-w-0 overflow-hidden break-words">
              <div className="flex justify-between items-start mb-4 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 truncate text-base sm:text-lg" title={contato.nomeEmpresa}>
                      {contato.nomeEmpresa || "Empresa não informada"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 mt-0.5 min-w-0">
                      <User size={14} className="shrink-0" />
                      <span className="truncate" title={contato.nomeContato}>{contato.nomeContato || "Sem nome de contato"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 mb-6 flex-grow min-w-0">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 min-w-0">
                  <Phone size={15} className="text-slate-400 shrink-0" />
                  <span className="truncate break-all">{contato.telefone || "Sem telefone"}</span>
                </div>

                {contato.cnpjCpf && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate font-mono">{contato.cnpjCpf}</span>
                  </div>
                )}

                {contato.atendimentoUrgencia === "Sim" && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 shadow-xs">
                    <Clock size={12} className="text-slate-500 shrink-0" />
                    <span>Atende Urgência / Plantão</span>
                  </div>
                )}
                
                {contato.especialidades && contato.especialidades.length > 0 && (
                  <div className="pt-2 min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Especialidades</p>
                    <div className="flex flex-wrap gap-1.5 min-w-0">
                      {contato.especialidades.slice(0, 3).map((esp: string) => (
                        <span key={esp} className="bg-blue-50 text-blue-700 px-2 sm:px-2.5 py-0.5 rounded-lg text-xs font-medium border border-blue-100 truncate max-w-full">
                          {esp}
                        </span>
                      ))}
                      {contato.especialidades.length > 3 && (
                        <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg text-xs font-medium border border-slate-200 shrink-0">
                          +{contato.especialidades.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-auto min-w-0">
                <button
                  onClick={() => handleWhatsApp(contato)}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 active:scale-[0.98] text-emerald-700 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5 sm:gap-2 border border-emerald-200/70 shadow-xs cursor-pointer truncate min-w-0"
                  title="Compartilhar dados deste contato via WhatsApp"
                >
                  <Send size={15} className="shrink-0 text-emerald-600" />
                  <span className="truncate">Enviar contato WhatsApp</span>
                </button>
                <button
                  onClick={() => openModalEdit(contato)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100 shrink-0 cursor-pointer"
                  title="Editar Contato"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(contato.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100 shrink-0 cursor-pointer"
                  title="Excluir Contato"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Include/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto overflow-x-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto sm:my-8 relative flex flex-col max-h-[92vh] min-w-0">
            <div className="p-4 sm:p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0 min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3 truncate">
                {editingId ? "Editar Contato" : "Novo Contato"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden min-w-0">
              <div className="p-4 sm:p-6 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden flex-1 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Nome da Empresa / M.E.I.
                    </label>
                    <input
                      type="text"
                      name="nomeEmpresa"
                      value={formData.nomeEmpresa}
                      onChange={handleChange}
                      required
                      placeholder="Ex: EletroGomes Serviços"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      C.N.P.J. ou C.P.F.
                    </label>
                    <input
                      type="text"
                      name="cnpjCpf"
                      value={formData.cnpjCpf}
                      onChange={handleChange}
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Nome do Contato
                    </label>
                    <input
                      type="text"
                      name="nomeContato"
                      value={formData.nomeContato}
                      onChange={handleChange}
                      required
                      placeholder="Ex: João Silva"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                      Telefone (WhatsApp)
                    </label>
                    <input
                      type="text"
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleChange}
                      required
                      placeholder="(00) 00000-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2">
                    Atendimento de urgência ou fora de expediente?
                  </label>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {["Sim", "Não", "Não se Aplica"].map(opt => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="atendimentoUrgencia"
                            value={opt}
                            checked={formData.atendimentoUrgencia === opt}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 transition-colors ${
                            formData.atendimentoUrgencia === opt
                              ? 'border-blue-600 bg-blue-600' 
                              : 'border-slate-300 group-hover:border-blue-400 bg-white'
                          }`}>
                            {formData.atendimentoUrgencia === opt && (
                              <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                            )}
                          </div>
                        </div>
                        <span className={`text-xs sm:text-sm ${formData.atendimentoUrgencia === opt ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2.5">
                    Especialidades Atendidas
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                    {especialidadesOpcoes.map(esp => {
                      const isChecked = formData.especialidades.includes(esp);
                      return (
                        <label 
                          key={esp}
                          className={`flex items-start gap-2.5 p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked 
                              ? 'border-blue-600 bg-blue-50/50' 
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="mt-0.5 relative flex items-center justify-center shrink-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleEspecialidadeToggle(esp)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-2 border-slate-300'
                            }`}>
                              {isChecked && <CheckCircle2 size={14} className="text-white" />}
                            </div>
                          </div>
                          <span className={`text-xs sm:text-sm select-none break-words ${isChecked ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                            {esp}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Informações adicionais sobre o prestador..."
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-6 sm:p-8 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 shrink-0 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 text-slate-600 hover:bg-slate-200 font-medium rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm text-sm"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Salvar Contato</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
