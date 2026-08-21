import React, { useState, useEffect } from "react";
import { DollarSign, Search, CheckCircle, Clock } from "lucide-react";
import { collection, query, getDocs, updateDoc, doc, where } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";

export default function Comissoes() {
  const { profile } = useAuth();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const [comissoes, setComissoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = profile?.role === "Administrador" || profile?.role === "admin" || profile?.role === "Admin";

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      let q = collection(db, "comissoes");
      
      // If not admin, only show their own commissions
      if (!isAdmin) {
        // We need to match by consultorId. For simplicity we check the name or email, or ideally consultorId which we should have in profile. 
        // We will just fetch all and filter by consultorNome matching profile name, since profile.id might not match empregados.id perfectly if not mapped.
        // Actually, we can just fetch all and filter client side for now.
      }
      
      const snapshot = await getDocs(q);
      let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      if (!isAdmin) {
        items = items.filter(i => 
           i.consultorEmail === profile?.email || 
           i.consultorNome === profile?.displayName || 
           i.consultorNome === profile?.nome
        );
      }

      setComissoes(items.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handlePagar = async (id: string) => {
    if (!window.confirm("Confirmar o pagamento desta comissão?")) return;
    try {
      const { db } = await initFirebase();
      await updateDoc(doc(db, "comissoes", id), {
        status: "Pago",
        dataPagamento: new Date().toISOString()
      });
      fetchData();
    } catch (err) {
      alert("Erro ao atualizar status.");
    }
  };

  const filteredItems = comissoes.filter(c => 
    c.numeroPedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clienteNome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.consultorNome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPendente = comissoes.filter(c => c.status === "Pendente").reduce((acc, curr) => acc + curr.valorComissao, 0);
  const totalPago = comissoes.filter(c => c.status === "Pago").reduce((acc, curr) => acc + curr.valorComissao, 0);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-brand-primary" />
            Comissões de Vendas
          </h1>
          <p className="text-slate-500 mt-1">Gerencie as comissões geradas por indicações.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Pendente</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Pago</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</p>
          </div>
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por pedido, cliente ou consultor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-brand-light text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Pedido</th>
                {isAdmin && <th className="px-6 py-4 font-semibold">Consultor</th>}
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Valor Venda</th>
                <th className="px-6 py-4 font-semibold">%</th>
                <th className="px-6 py-4 font-semibold">Comissão</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                {isAdmin && <th className="px-6 py-4 font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-6 py-8 text-center text-slate-500">
                    Carregando comissões...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma comissão encontrada.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      {new Date(item.dataCriacao).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 font-medium text-brand-dark">
                      #{item.numeroPedido}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {item.consultorNome}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {item.clienteNome}
                    </td>
                    <td className="px-6 py-4">
                      {formatCurrency(item.valorVenda)}
                    </td>
                    <td className="px-6 py-4">
                      {item.percentual}%
                    </td>
                    <td className="px-6 py-4 font-bold text-green-600">
                      {formatCurrency(item.valorComissao)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                        item.status === 'Pago' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        {item.status === 'Pendente' && (
                          <button
                            onClick={() => handlePagar(item.id)}
                            className="px-3 py-1 bg-brand-primary text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition"
                          >
                            Marcar Pago
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
