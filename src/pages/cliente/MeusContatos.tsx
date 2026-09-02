import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  Plus, Edit2, Trash2, Send, X, Phone, User, Building2, 
  CheckCircle2, FileText, AlertCircle, Contact, BookUser
} from "lucide-react";
import { 
  collection, query, where, onSnapshot, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp 
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function MeusContatos() {
  const { user } = useAuth();
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
    "Portão Eletrônico",
  ].sort((a, b) => a.localeCompare(b));

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
      } catch (e) {
        console.error("Erro ao excluir contato", e);
        alert("Erro ao excluir contato");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    
    try {
      const payload = {
        ...formData,
        clienteId: user.uid,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "cliente_contatos", editingId), payload);
      } else {
        await addDoc(collection(db, "cliente_contatos"), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar o contato.");
    } finally {
      setSaving(false);
    }
  };

  const handleWhatsApp = (contato: any) => {
    const t = (contato.telefone || "").replace(/\D/g, "");
    if (!t) {
      alert("Telefone inválido.");
      return;
    }

    const text = `Conforme solicitado, segue abaixo os dados do:
${contato.nomeEmpresa ? contato.nomeEmpresa : ""} ${contato.nomeContato ? "- " + contato.nomeContato : ""}

*CNPJ/CPF:* ${contato.cnpjCpf || "Não informado"}
*Contato:* ${contato.nomeContato || "Não informado"}
*Telefone:* ${contato.telefone || "Não informado"}
*Urgência/Fora de Expediente:* ${contato.atendimentoUrgencia || "Não se Aplica"}
*Especialidades:* ${(contato.especialidades || []).join(", ") || "Nenhuma informada"}

*Observações:*
${contato.observacoes || "Nenhuma observação."}`;

    window.open(`https://wa.me/55${t}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BookUser className="text-blue-600" size={32} />
            Meus Contatos
          </h1>
          <p className="text-slate-500 mt-1">
            Cadastre os contatos e prestadores de serviço do seu condomínio.
          </p>
        </div>
        <button
          onClick={openModalNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
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
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <Contact size={32} />
          </div>
          <h3 className="text-xl font-medium text-slate-900 mb-2">Nenhum contato cadastrado</h3>
          <p className="text-slate-500 mb-6 max-w-md">
            Mantenha a organização do seu condomínio centralizando todos os prestadores de serviço que você utiliza aqui.
          </p>
          <button
            onClick={openModalNew}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            Adicionar Primeiro Contato
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contatos.map(contato => (
            <div key={contato.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 line-clamp-1" title={contato.nomeEmpresa}>
                      {contato.nomeEmpresa || "Empresa não informada"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                      <User size={14} />
                      <span className="line-clamp-1" title={contato.nomeContato}>{contato.nomeContato || "Sem nome de contato"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6 flex-grow">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={16} className="text-slate-400 shrink-0" />
                  <span>{contato.telefone || "Sem telefone"}</span>
                </div>
                
                {contato.especialidades && contato.especialidades.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Especialidades</p>
                    <div className="flex flex-wrap gap-1.5">
                      {contato.especialidades.slice(0, 3).map((esp: string) => (
                        <span key={esp} className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg text-xs font-medium border border-blue-100">
                          {esp}
                        </span>
                      ))}
                      {contato.especialidades.length > 3 && (
                        <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-lg text-xs font-medium border border-slate-200">
                          +{contato.especialidades.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-auto">
                <button
                  onClick={() => handleWhatsApp(contato)}
                  className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-green-200/50"
                >
                  <Send size={16} />
                  WhatsApp
                </button>
                <button
                  onClick={() => openModalEdit(contato)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100"
                  title="Editar Contato"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(contato.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 relative flex flex-col max-h-[90vh]">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                {editingId ? "Editar Contato" : "Novo Contato"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Nome da Empresa / M.E.I.
                    </label>
                    <input
                      type="text"
                      name="nomeEmpresa"
                      value={formData.nomeEmpresa}
                      onChange={handleChange}
                      required
                      placeholder="Ex: EletroGomes Serviços"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      C.N.P.J. ou C.P.F.
                    </label>
                    <input
                      type="text"
                      name="cnpjCpf"
                      value={formData.cnpjCpf}
                      onChange={handleChange}
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Nome do Contato
                    </label>
                    <input
                      type="text"
                      name="nomeContato"
                      value={formData.nomeContato}
                      onChange={handleChange}
                      required
                      placeholder="Ex: João Silva"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Telefone (WhatsApp)
                    </label>
                    <input
                      type="text"
                      name="telefone"
                      value={formData.telefone}
                      onChange={handleChange}
                      required
                      placeholder="(00) 00000-0000"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Atendimento de urgência ou fora de expediente?
                  </label>
                  <div className="flex flex-wrap gap-4">
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
                        <span className={`text-sm ${formData.atendimentoUrgencia === opt ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Especialidades Atendidas
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {especialidadesOpcoes.map(esp => {
                      const isChecked = formData.especialidades.includes(esp);
                      return (
                        <label 
                          key={esp}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            isChecked 
                              ? 'border-blue-600 bg-blue-50/50' 
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="mt-0.5 relative flex items-center justify-center">
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
                          <span className={`text-sm select-none ${isChecked ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                            {esp}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Observações
                  </label>
                  <textarea
                    name="observacoes"
                    value={formData.observacoes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Informações adicionais sobre o prestador..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-slate-600 hover:bg-slate-200 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  {saving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={20} />
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
