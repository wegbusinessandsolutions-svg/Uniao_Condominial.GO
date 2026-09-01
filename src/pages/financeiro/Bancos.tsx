import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Printer, Download, RefreshCw } from "lucide-react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { useFranqueada } from "../../context/FranqueadaContext";
import { formatDateBR } from "../../lib/dateUtils";

export default function Bancos() {
  const { filterByFranqueada, injectFranqueada, canModify, isFranqueada } = useFranqueada();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({ 
    tipo: "Corrente",
    ativa: true,
    saldoInicial: 0,
    saldoAtual: 0
  });
  const [isSaving, setIsSaving] = useState(false);

  // Extrato states
  const [isExtratoOpen, setIsExtratoOpen] = useState(false);
  const [extratoBanco, setExtratoBanco] = useState<any>(null);
  const [extratoMovs, setExtratoMovs] = useState<any[]>([]);
  const [loadingExtrato, setLoadingExtrato] = useState(false);

  const openExtrato = async (banco: any) => {
    setExtratoBanco(banco);
    setIsExtratoOpen(true);
    setLoadingExtrato(true);
    try {
      const { db } = await initFirebase();
      const q = collection(db, `bancos/${banco.id}/movimentacoes`);
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter for current month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const filtered = items.filter((mov: any) => {
        if (!mov.data) return false;
        const d = new Date(mov.data + "T12:00:00");
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      
      // Sort by date descending
      filtered.sort((a: any, b: any) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
      
      setExtratoMovs(filtered);
    } catch (err) {
      console.error("Erro ao carregar extrato:", err);
    } finally {
      setLoadingExtrato(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = collection(db, "bancos");
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      setData(items);
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
    setFormData(injectFranqueada({ 
      tipo: "Corrente",
      ativa: true,
      saldoInicial: 0,
      saldoAtual: 0
    }));
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    if (!canModify(item)) {
      alert("Acesso Restrito: Você só pode editar contas bancárias da sua própria franquia.");
      return;
    }
    setFormData(item);
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      if (formData.bancoPadrao) {
        // Find if there is any other default bank and unset it
        const q = collection(db, "bancos");
        const snapshot = await getDocs(q);
        const batchUpdates = [];
        snapshot.docs.forEach((d) => {
          if (d.data().bancoPadrao && d.id !== editingId) {
            batchUpdates.push(updateDoc(doc(db, "bancos", d.id), { bancoPadrao: false }));
          }
        });
        await Promise.all(batchUpdates);
      }

      const rawPayload = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      const savePayload = injectFranqueada(rawPayload);

      if (editingId) {
        const oldDoc = data.find(d => d.id === editingId);
        if (oldDoc && !canModify(oldDoc)) {
          alert("Acesso Restrito: Permissão negada para alterar conta de outra franquia.");
          setIsSaving(false);
          return;
        }
        await updateDoc(doc(db, "bancos", editingId), savePayload);
      } else {
        savePayload.createdAt = new Date().toISOString();
        await addDoc(collection(db, "bancos"), savePayload);
      }
      closeModal();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar a conta.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const bankToDelete = data.find(item => item.id === id);
      if (bankToDelete && !canModify(bankToDelete)) {
        alert("Acesso Restrito: Você só pode excluir contas da sua própria franquia.");
        return;
      }
      const bankName = bankToDelete ? `${bankToDelete.banco || "Banco"} (${bankToDelete.agencia || ""}/${bankToDelete.conta || ""})` : id;

      await deleteDoc(doc(db, "bancos", id));

      // LOG ACTION
      await logAction(
        `Exclusão de conta bancária: ${bankName}`,
        "Financeiro",
        { bankId: id, bankName }
      );

      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const formatCurrency = (value: string | number) => {
    if (value === undefined || value === null || value === "") return "R$ 0,00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const formatAgConta = (agencia?: string, conta?: string) => {
    const a = agencia || "-";
    const c = conta || "-";
    if (a === "-" && c === "-") return "- / -";
    return `${a} / ${c}`;
  };

  const totalSaldoAtual = data.reduce((acc, curr) => acc + (parseFloat(curr.saldoAtual) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contas Bancárias</h1>
          <p className="text-sm text-slate-500 mt-1">
            Saldo total: <span className="text-slate-900 font-medium">{formatCurrency(totalSaldoAtual)}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            Nova conta
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50 rounded-t-xl">
          <div className="text-sm font-medium text-slate-600">
            {filterByFranqueada(data).length} conta(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Banco</th>
                <th className="px-6 py-4 whitespace-nowrap">Tipo</th>
                <th className="px-6 py-4 whitespace-nowrap">Ag/Conta</th>
                <th className="px-6 py-4 whitespace-nowrap">PIX</th>
                <th className="px-6 py-4 whitespace-nowrap">Saldo inicial</th>
                <th className="px-6 py-4 whitespace-nowrap">Saldo atual</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-20" />
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
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded w-12" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filterByFranqueada(data).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              ) : (
                filterByFranqueada(data).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.banco || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {item.tipo ? String(item.tipo).toLowerCase() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{formatAgConta(item.agencia, item.conta)}</td>
                    <td className="px-6 py-4">{item.chavePix || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{formatCurrency(item.saldoInicial)}</td>
                    <td className="px-6 py-4 font-medium">{formatCurrency(item.saldoAtual)}</td>
                    <td className="px-6 py-4 flex gap-1 items-center flex-wrap">
                      <span className={`px-2 py-1 text-[11px] font-semibold rounded-full ${
                        item.ativa ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        {item.ativa ? 'Ativa' : 'Inativa'}
                      </span>
                      {item.bancoPadrao && (
                        <span className="px-2 py-1 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" title="Banco padrão para novos recebimentos automáticos">
                          Padrão
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openExtrato(item)}
                          className="text-slate-400 hover:text-blue-900 transition-colors"
                          title="Imprimir Extrato"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => openExtrato(item)}
                          className="text-slate-400 hover:text-orange-500 transition-colors"
                          title="Ver Extrato"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar conta" : "Nova conta"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form id="banco-form" onSubmit={handleSubmit} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    name="banco"
                    value={formData.banco || ""}
                    onChange={handleInputChange}
                    placeholder="Ex: Caixa Interno"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  />
                  <p className="text-xs text-slate-400 mt-1">Se o banco ainda não existir, será criado automaticamente.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="tipo"
                    required
                    value={formData.tipo || "Corrente"}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  >
                    <option value="Caixa">Caixa</option>
                    <option value="Corrente">Corrente</option>
                    <option value="Poupança">Poupança</option>
                    <option value="Investimento">Investimento</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                </div>

                <div>
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data do Saldo Inicial
                  </label>
                  <input
                    type="date"
                    name="dataSaldoInicial"
                    value={formData.dataSaldoInicial || ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Saldo inicial
                    </label>
                    <input
                      type="number"
                      name="saldoInicial"
                      step="0.01"
                      value={formData.saldoInicial ?? 0}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Saldo atual
                    </label>
                    <input
                      type="number"
                      name="saldoAtual"
                      step="0.01"
                      value={formData.saldoAtual ?? 0}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-dark/50"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="ativa"
                      checked={formData.ativa ?? true}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-slate-700">Conta Ativa</span>
                  </label>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="bancoPadrao"
                      checked={formData.bancoPadrao ?? false}
                      onChange={handleInputChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm font-medium text-slate-700">Banco Padrão (Usado nas cobranças automáticas)</span>
                  </label>
                </div>

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
                form="banco-form"
                disabled={isSaving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExtratoOpen && extratoBanco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col my-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Extrato Financeiro</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button
                  onClick={() => setIsExtratoOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto print:p-0 print:overflow-visible flex-1">
              <div id="extrato-content" className="space-y-6 text-slate-800">
                <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-bold">{extratoBanco.banco}</h3>
                    <p className="text-sm">Agência: {extratoBanco.agencia} | Conta: {extratoBanco.conta}</p>
                    <p className="text-sm">Chave PIX: {extratoBanco.chavePix || "Não informada"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Mês atual</p>
                    <p className="text-sm">Emissão: {formatDateBR(new Date())}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-100">
                  <div>
                    <p className="text-sm text-slate-500">Saldo Atual da Conta</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(extratoBanco.saldoAtual)}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Movimentações do Mês</h4>
                  {loadingExtrato ? (
                    <div className="text-center py-6 text-slate-500 text-sm">Carregando movimentações...</div>
                  ) : extratoMovs.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                      Nenhuma movimentação registrada neste mês.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-3 px-4">Data</th>
                          <th className="py-3 px-4">Descrição</th>
                          <th className="py-3 px-4 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {extratoMovs.map((mov) => (
                          <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4">{formatDateBR(mov.data, "-")}</td>
                            <td className="py-3 px-4 text-slate-700">{mov.descricao}</td>
                            <td className={`py-3 px-4 text-right font-medium ${mov.tipo === "Despesa" ? "text-red-600" : "text-emerald-600"}`}>
                              {mov.tipo === "Despesa" ? "- " : "+ "}
                              {formatCurrency(mov.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
