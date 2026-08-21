import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { CheckCircle, XCircle, Clock, Search, RefreshCw, Mail, LayoutList } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EmailLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const q = query(
        collection(db, "email_logs"),
        orderBy("dataEnvio", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Erro ao buscar logs de email:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      (log.destinatario && log.destinatario.toLowerCase().includes(term)) ||
      (log.assunto && log.assunto.toLowerCase().includes(term)) ||
      (log.pedidoId && log.pedidoId.toLowerCase().includes(term))
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Logs de Envio de E-mails</h3>
          <p className="text-xs text-slate-500 mt-1">
            Histórico das últimas 100 mensagens disparadas pelo sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar destinatário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent min-w-[200px]"
            />
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-500 font-semibold border-b border-slate-200 bg-slate-50 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Data/Hora</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Destinatário</th>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3">Tipo / Pedido</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  <p>Carregando logs...</p>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <LayoutList className="mx-auto mb-2 text-slate-300" size={32} />
                  <p>Nenhum log encontrado para esta busca.</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-slate-400" />
                      <span className="font-medium text-slate-700">
                        {log.dataEnvio ? format(new Date(log.dataEnvio), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.sucesso ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                        <CheckCircle size={12} />
                        Sucesso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                        <XCircle size={12} />
                        Falha
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-400" />
                      <span className="text-slate-800">{log.destinatario}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate" title={log.assunto}>
                    {log.assunto}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{log.tipo || 'Geral'}</span>
                      {log.pedidoId && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-0.5">#{log.pedidoId}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[200px] truncate text-slate-500" title={log.mensagem}>
                    {log.mensagem}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
