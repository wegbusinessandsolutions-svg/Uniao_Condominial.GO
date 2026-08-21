import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Printer, Download, RefreshCw, Search } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";

export default function CodigosIndicacao() {
  const [codigos, setCodigos] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>({ status: "Ativo" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { db } = await initFirebase();
      
      const codigosSnap = await getDocs(collection(db, "codigos_indicacao"));
      const codigosData = codigosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCodigos(codigosData);

      const usersSnap = await getDocs(collection(db, "users"));
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(usersData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: any) => {
    if (item) {
      setFormData(item);
      setEditingId(item.id);
    } else {
      setFormData({ status: "Ativo" });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({ status: "Ativo" });
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { db } = await initFirebase();
      
      const payload = {
        ...formData,
        codigo: formData.codigo?.toUpperCase() || "",
        porcentagem: Number(formData.porcentagem) || 0,
      };

      let actionDesc = "";
      let targetId = "";

      if (editingId) {
        await updateDoc(doc(db, "codigos_indicacao", editingId), payload);
        actionDesc = `Edição de código de indicação: ${payload.codigo}`;
        targetId = editingId;
      } else {
        const docRef = await addDoc(collection(db, "codigos_indicacao"), payload);
        actionDesc = `Criação de código de indicação: ${payload.codigo}`;
        targetId = docRef.id;
      }

      await logAction(actionDesc, "Comercial", { targetId }, null, payload);
      fetchData();
      handleCloseModal();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const codeToDelete = codigos.find(c => c.id === id);
      await deleteDoc(doc(db, "codigos_indicacao", id));
      
      await logAction(
        `Exclusão de código de indicação: ${codeToDelete?.codigo}`,
        "Comercial",
        { targetId: id },
        codeToDelete,
        null
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const headers = ["Código,Beneficiário,Validade Início,Validade Fim,Porcentagem,Status"];
    const rows = codigos.map(c => 
      `${c.codigo},${c.descricao || ""},${c.dataValidadeInicial || ""},${c.dataValidadeFinal || ""},${c.porcentagem || 0},${c.status || ""}`
    );
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "codigos_indicacao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = codigos.filter(c => 
    (c.codigo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.descricao || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Códigos de Indicação</h1>
          <p className="text-slate-500">Gerencie os códigos promocionais e comissões associadas.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-brand-dark text-white px-4 py-2 rounded-lg hover:bg-brand-primary transition-colors font-medium shadow-sm"
        >
          <Plus size={20} />
          Novo Código
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-light"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={fetchData} className="p-2 text-slate-400 hover:text-brand-dark hover:bg-slate-100 rounded-lg transition-colors" title="Atualizar">
              <RefreshCw size={20} />
            </button>
            <button onClick={handlePrint} className="p-2 text-slate-400 hover:text-brand-dark hover:bg-slate-100 rounded-lg transition-colors" title="Imprimir">
              <Printer size={20} />
            </button>
            <button onClick={handleDownloadCSV} className="p-2 text-slate-400 hover:text-brand-dark hover:bg-slate-100 rounded-lg transition-colors" title="Download CSV">
              <Download size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-semibold">Código</th>
                <th className="p-4 font-semibold">Beneficiário (Descrição)</th>
                <th className="p-4 font-semibold">Validade</th>
                <th className="p-4 font-semibold">Comissão (%)</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Carregando códigos...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhum código encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className="font-semibold text-brand-dark">{item.codigo}</span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {item.descricao || "-"}
                      <div className="text-xs text-slate-400">
                         {users.find(u => u.id === item.beneficiarioId)?.displayName || ""}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {item.dataValidadeInicial} até {item.dataValidadeFinal}
                    </td>
                    <td className="p-4 text-slate-900 font-medium">
                      {item.porcentagem}%
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === "Ativo" ? "bg-green-100 text-green-700" :
                        item.status === "Bloqueado" ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => setItemToDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? "Editar Código de Indicação" : "Novo Código de Indicação"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="codigoForm" onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Código Promocional</label>
                    <input
                      required
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light uppercase"
                      value={formData.codigo || ""}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                      placeholder="Ex: PROMO2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      required
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                      value={formData.status || "Ativo"}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Usuário Beneficiário</label>
                  <select
                    required
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                    value={formData.beneficiarioId || ""}
                    onChange={(e) => setFormData({ ...formData, beneficiarioId: e.target.value })}
                  >
                    <option value="">Selecione um usuário...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.displayName || u.nomeCompleto || u.nomeEmpresa || u.email} - {u.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Nome do Beneficiário)</label>
                  <input
                    required
                    type="text"
                    className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                    value={formData.descricao || ""}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Ex: João Silva Consultor"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Comissão (%)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                      value={formData.porcentagem || ""}
                      onChange={(e) => setFormData({ ...formData, porcentagem: e.target.value })}
                      placeholder="Ex: 5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Validade Inicial</label>
                    <input
                      required
                      type="date"
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                      value={formData.dataValidadeInicial || ""}
                      onChange={(e) => setFormData({ ...formData, dataValidadeInicial: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Validade Final</label>
                    <input
                      required
                      type="date"
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                      value={formData.dataValidadeFinal || ""}
                      onChange={(e) => setFormData({ ...formData, dataValidadeFinal: e.target.value })}
                    />
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="codigoForm"
                className="px-6 py-2.5 text-sm font-bold text-white bg-brand-dark rounded-lg hover:bg-brand-primary transition-colors shadow-sm"
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
