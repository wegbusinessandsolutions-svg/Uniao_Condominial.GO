import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { Plus, Trash2, Calendar, Pencil, X, AlertCircle } from "lucide-react";

interface Despesa {
  id: string;
  titulo: string;
  diaVencimento: number;
  valor?: number;
  userId: string;
}

export default function DespesasMensais() {
  const { user } = useAuth();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);

  // Form states
  const [titulo, setTitulo] = useState("");
  const [diaVencimento, setDiaVencimento] = useState<number | "">("");
  const [valor, setValor] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "despesas_condominio"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Despesa[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Despesa);
      });
      // Sort by diaVencimento
      data.sort((a, b) => a.diaVencimento - b.diaVencimento);
      setDespesas(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleOpenModal = (despesa?: Despesa) => {
    if (despesa) {
      setEditingDespesa(despesa);
      setTitulo(despesa.titulo);
      setDiaVencimento(despesa.diaVencimento);
      setValor(despesa.valor ? String(despesa.valor) : "");
    } else {
      setEditingDespesa(null);
      setTitulo("");
      setDiaVencimento("");
      setValor("");
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDespesa(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !titulo || !diaVencimento) return;

    try {
      const despesaData = {
        titulo,
        diaVencimento: Number(diaVencimento),
        valor: valor ? Number(valor) : null,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      };

      if (editingDespesa) {
        await updateDoc(doc(db, "despesas_condominio", editingDespesa.id), despesaData);
      } else {
        await addDoc(collection(db, "despesas_condominio"), {
          ...despesaData,
          createdAt: new Date().toISOString(),
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      alert("Erro ao salvar a despesa.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta despesa?")) {
      try {
        await deleteDoc(doc(db, "despesas_condominio", id));
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir despesa.");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-600" /> Despesas Mensais
          </h1>
          <p className="text-slate-500 mt-1">
            Cadastre as despesas fixas (ordinárias) do condomínio.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-colors flex items-center gap-2"
        >
          <Plus size={18} /> Nova Despesa
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando despesas...</div>
        ) : despesas.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center">
            <AlertCircle className="text-slate-300 w-12 h-12 mb-3" />
            <p className="text-slate-500">Nenhuma despesa cadastrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {despesas.map((despesa) => (
              <div key={despesa.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex flex-col items-center justify-center font-bold">
                    <span className="text-xs font-normal">Dia</span>
                    <span className="leading-none">{despesa.diaVencimento}</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900">{despesa.titulo}</h3>
                    {despesa.valor && (
                      <p className="text-slate-500 text-sm">
                        Valor estimado: R$ {despesa.valor.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleOpenModal(despesa)}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(despesa.id)}
                    className="flex-1 sm:flex-none px-4 py-2 text-sm text-slate-600 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-medium text-slate-900 mb-6">
              {editingDespesa ? "Editar Despesa" : "Nova Despesa"}
            </h2>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título da Despesa *
                </label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Conta de Luz"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dia do Vencimento *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(Number(e.target.value))}
                    placeholder="Ex: 10"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor (Opcional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="R$ 0,00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-md"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
