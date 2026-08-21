import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Coins, 
  X,
  AlertCircle
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc
} from "firebase/firestore";

interface Rule {
  id: string;
  nivel: string;
  percentual: number;
  minimo?: number;
}

export default function CashbackAdmin() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");

  // Data states
  const [rules, setRules] = useState<Rule[]>([]);

  // Rules Modal States
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState({
    nivel: "",
    percentual: 0,
    minimo: 0
  });

  const loadData = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const { db } = await initFirebase();

      // Load Cashback Rules
      const rulesRef = collection(db, "regras_cashback");
      const rulesSnap = await getDocs(rulesRef);
      const loadedRules = rulesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const standardOrder = ["bronze", "prata", "ouro", "diamante"];
      loadedRules.sort((a: any, b: any) => {
        const idxA = standardOrder.indexOf((a.nivel || "").toLowerCase());
        const idxB = standardOrder.indexOf((b.nivel || "").toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (Number(a.percentual) || 0) - (Number(b.percentual) || 0);
      });
      
      setRules(loadedRules);

    } catch (err: any) {
      console.error("Erro ao carregar dados do admin de cashback:", err);
      setErrorMessage("Não foi possível carregar as informações do servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Rules Management Handlers
  const handleOpenRuleModal = (rule?: Rule) => {
    if (rule) {
      setEditingRuleId(rule.id);
      setRuleForm({
        nivel: rule.nivel,
        percentual: rule.percentual,
        minimo: rule.minimo || 0
      });
    } else {
      setEditingRuleId(null);
      setRuleForm({
        nivel: "",
        percentual: 0,
        minimo: 0
      });
    }
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const { db } = await initFirebase();
      const payload = {
        nivel: ruleForm.nivel,
        percentual: Number(ruleForm.percentual),
        minimo: Number(ruleForm.minimo)
      };

      if (editingRuleId) {
        await updateDoc(doc(db, "regras_cashback", editingRuleId), payload);
        await logAction(
          `Edição de regra de cashback: ${payload.nivel}`,
          "Administrativo",
          { ruleId: editingRuleId, ...payload }
        );
        setSuccessMessage(`Regra "${payload.nivel}" atualizada com sucesso!`);
      } else {
        const docRef = await addDoc(collection(db, "regras_cashback"), payload);
        await logAction(
          `Criação de regra de cashback: ${payload.nivel}`,
          "Administrativo",
          { ruleId: docRef.id, ...payload }
        );
        setSuccessMessage(`Regra "${payload.nivel}" adicionada com sucesso!`);
      }

      setIsRuleModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error("Erro ao salvar regra:", err);
      setErrorMessage("Erro ao salvar a regra de cashback.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a regra "${name}"?`)) return;
    
    setSuccessMessage("");
    setErrorMessage("");
    try {
      const { db } = await initFirebase();
      await deleteDoc(doc(db, "regras_cashback", id));
      
      await logAction(
        `Exclusão de regra de cashback: ${name}`,
        "Administrativo",
        { ruleId: id }
      );

      setSuccessMessage(`Regra "${name}" removida com sucesso!`);
      await loadData();
    } catch (err: any) {
      console.error("Erro ao excluir regra de cashback:", err);
      setErrorMessage("Erro ao excluir a regra de cashback.");
    }
  };

  const filteredRules = rules.filter(r => {
    return r.nivel.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-full max-w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="text-sky-600" /> Regras de Cashback
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie as regras de retorno de moedas de cashback para seus clientes.
          </p>
        </div>
        
        <button
          onClick={() => handleOpenRuleModal()}
          className="px-4 py-2 bg-brand-dark hover:bg-brand-dark/95 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Nova Regra
        </button>
      </div>

      {/* Feedback alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 text-sm font-medium">
          <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 text-sm font-medium">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nível do cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 font-medium">
          Carregando informações...
        </div>
      ) : (
        /* TAB RULES: Regras de Cashback */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Nível do Cliente</th>
                  <th className="px-6 py-4">Retorno (%)</th>
                  <th className="px-6 py-4">Valor Mínimo de Compra</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                      Nenhuma regra de cashback cadastrada.
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {rule.nivel}
                      </td>
                      <td className="px-6 py-4 font-medium text-sky-700">
                        {rule.percentual}%
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {rule.minimo ? rule.minimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sem valor mínimo"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenRuleModal(rule)}
                          className="p-1.5 text-slate-600 hover:text-sky-600 transition-colors inline-block"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id, rule.nivel)}
                          className="p-1.5 text-slate-600 hover:text-rose-600 transition-colors inline-block"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rules Add/Edit Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">
                {editingRuleId ? "Editar Regra de Cashback" : "Nova Regra de Cashback"}
              </h3>
              <button 
                onClick={() => setIsRuleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveRule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nível do Cliente *
                </label>
                <div className="flex gap-1.5 mb-2">
                  {["Bronze", "Prata", "Ouro", "Diamante"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setRuleForm(prev => ({ ...prev, nivel: lvl }))}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold border transition-all cursor-pointer ${
                        ruleForm.nivel.toLowerCase() === lvl.toLowerCase()
                          ? "bg-brand-dark text-white border-brand-dark"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ex: Bronze, Prata, Ouro, Diamante"
                  value={ruleForm.nivel}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, nivel: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/40 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Percentual de Cashback (%) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Ex: 5"
                  value={ruleForm.percentual}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, percentual: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/40 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Valor Mínimo do Pedido (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 100"
                  value={ruleForm.minimo}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, minimo: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/40 text-sm text-slate-800"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-brand-dark hover:bg-brand-dark/95 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
