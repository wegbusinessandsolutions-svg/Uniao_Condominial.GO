import React, { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Megaphone, CheckCircle, XCircle, Trash2, Clock, Search, X, Edit3, HelpCircle } from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface Notice {
  id: string;
  condominio: string;
  bairro: string;
  tipo?: "comunicado" | "duvida";
  titulo: string;
  texto: string;
  status: "em_revisao" | "publicado" | "rejeitado";
  createdAt: any;
  updatedAt?: any;
}

export default function MuralCondominialAdmin() {
  const { addToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  
  // Edit modal state
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editFormData, setEditFormData] = useState({
    tipo: "comunicado" as "comunicado" | "duvida",
    titulo: "",
    texto: ""
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "muralNotices"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotices: Notice[] = [];
      snapshot.forEach((doc) => {
        fetchedNotices.push({ id: doc.id, ...doc.data() } as Notice);
      });
      setNotices(fetchedNotices);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notices:", error);
      setLoading(false);
      addToast("Erro ao carregar comunicados", "error");
    });

    return () => unsubscribe();
  }, []);

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      if (statusFilter !== "todos" && notice.status !== statusFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const tituloMatch = notice.titulo?.toLowerCase().includes(term);
      const textoMatch = notice.texto?.toLowerCase().includes(term);
      const condMatch = notice.condominio?.toLowerCase().includes(term);
      const bairroMatch = notice.bairro?.toLowerCase().includes(term);
      return tituloMatch || textoMatch || condMatch || bairroMatch;
    });
  }, [notices, searchTerm, statusFilter]);

  const handleUpdateStatus = async (id: string, status: "publicado" | "rejeitado") => {
    try {
      await updateDoc(doc(db, "muralNotices", id), { status });
      addToast(`Comunicado ${status === "publicado" ? "aprovado" : "rejeitado"} com sucesso`, "success");
    } catch (error) {
      console.error("Error updating status:", error);
      addToast("Erro ao atualizar status", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este comunicado permanentemente?")) {
      try {
        await deleteDoc(doc(db, "muralNotices", id));
        addToast("Comunicado excluído com sucesso", "success");
      } catch (error) {
        console.error("Error deleting notice:", error);
        addToast("Erro ao excluir comunicado", "error");
      }
    }
  };

  const handleOpenEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setEditFormData({
      tipo: notice.tipo || "comunicado",
      titulo: notice.titulo || "",
      texto: notice.texto || ""
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;

    if (!editFormData.titulo.trim() || !editFormData.texto.trim()) {
      addToast("Preencha todos os campos", "error");
      return;
    }

    setSubmittingEdit(true);
    try {
      await updateDoc(doc(db, "muralNotices", editingNotice.id), {
        tipo: editFormData.tipo,
        titulo: editFormData.titulo.trim(),
        texto: editFormData.texto.trim(),
        updatedAt: serverTimestamp()
      });
      addToast("Comunicado atualizado pelo Administrador!", "success");
      setEditingNotice(null);
    } catch (error) {
      console.error("Error updating notice as admin:", error);
      addToast("Erro ao atualizar comunicado", "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <div className="w-full max-w-full space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Megaphone className="text-brand-dark" />
              Mural Condominial — Revisão e Moderação
            </h2>
            <p className="text-slate-500 text-sm">
              Gerencie, revise, altere ou exclua comunicados e dúvidas enviados pelos condomínios afiliados.
            </p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, texto, condomínio ou bairro..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
          >
            <option value="todos">Todos os status</option>
            <option value="em_revisao">Em Revisão</option>
            <option value="publicado">Publicados</option>
            <option value="rejeitado">Rejeitados</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : filteredNotices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {searchTerm || statusFilter !== "todos"
              ? "Nenhum comunicado encontrado para os filtros aplicados."
              : "Nenhum comunicado encontrado."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-600 text-sm">Data</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Condomínio / Bairro</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm max-w-[300px]">Comunicado / Dúvida</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm text-center">Status</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotices.map((notice) => (
                  <tr key={notice.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                      {notice.createdAt?.toDate ? notice.createdAt.toDate().toLocaleDateString("pt-BR") : "N/A"}
                      {notice.updatedAt && (
                        <div className="text-[10px] text-amber-600 font-semibold">(editado)</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-800 text-sm">{notice.condominio}</div>
                      <div className="text-xs text-slate-500">{notice.bairro}</div>
                    </td>
                    <td className="p-4 max-w-[300px]">
                      <div className="flex items-center gap-1.5 mb-1">
                        {notice.tipo === "duvida" ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">Dúvida</span>
                        ) : (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">Comunicado</span>
                        )}
                        <div className="font-semibold text-slate-800 text-sm truncate" title={notice.titulo}>{notice.titulo}</div>
                      </div>
                      <div className="text-xs text-slate-500 line-clamp-2" title={notice.texto}>{notice.texto}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        notice.status === "publicado" ? "bg-emerald-100 text-emerald-700" :
                        notice.status === "rejeitado" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {notice.status === "publicado" && <CheckCircle size={14} />}
                        {notice.status === "rejeitado" && <XCircle size={14} />}
                        {notice.status === "em_revisao" && <Clock size={14} />}
                        {notice.status === "publicado" ? "Publicado" :
                         notice.status === "rejeitado" ? "Rejeitado" : "Em Revisão"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Admin edit button */}
                        <button
                          onClick={() => handleOpenEdit(notice)}
                          title="Alterar Comunicado"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 size={17} />
                        </button>

                        {notice.status === "em_revisao" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(notice.id, "publicado")}
                              title="Aprovar"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(notice.id, "rejeitado")}
                              title="Rejeitar"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        {notice.status === "rejeitado" && (
                          <button
                            onClick={() => handleUpdateStatus(notice.id, "publicado")}
                            title="Aprovar (reverter rejeição)"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notice.id)}
                          title="Excluir"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Edit Modal */}
      {editingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit3 className="text-amber-600 w-5 h-5" />
                <span>Alterar Comunicado (Administrador)</span>
              </h3>
              <button 
                onClick={() => setEditingNotice(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, tipo: "comunicado" })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    editFormData.tipo === "comunicado"
                      ? "border-brand-dark bg-brand-light/10 text-brand-dark font-bold ring-1 ring-brand-dark"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Megaphone size={16} />
                  <span>Comunicado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditFormData({ ...editFormData, tipo: "duvida" })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                    editFormData.tipo === "duvida"
                      ? "border-amber-500 bg-amber-50 text-amber-800 font-bold ring-1 ring-amber-500"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <HelpCircle size={16} />
                  <span>Dúvida</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Condomínio / Bairro (Autor)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${editingNotice.condominio} — ${editingNotice.bairro}`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editFormData.titulo}
                  onChange={(e) => setEditFormData({ ...editFormData, titulo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto do Comunicado
                </label>
                <textarea
                  required
                  maxLength={800}
                  rows={5}
                  value={editFormData.texto}
                  onChange={(e) => setEditFormData({ ...editFormData, texto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingNotice(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                  disabled={submittingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {submittingEdit ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
