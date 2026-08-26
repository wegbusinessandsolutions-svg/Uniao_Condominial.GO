import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

import { Link } from "react-router-dom";

export const AfiliacaoOverdueAlert: React.FC = () => {
  const { profile } = useAuth();
  const [overdueDocs, setOverdueDocs] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const isStaff = profile && ["Administrador", "admin", "Admin", "Financeiro"].includes(profile.role || "");
    if (!isStaff) return;

    const checkOverdue = async () => {
      try {
        const q = query(
          collection(db, "contas_receber"),
          where("status", "in", ["Aberto", "Vencido", "Pendente", "pendente", "aberto", "vencido"])
        );
        const snap = await getDocs(q);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdue: any[] = [];

        snap.forEach((doc) => {
          const data = doc.data();
          if (data.origem === "afiliacao_uc" || (data.descricao && data.descricao.toLowerCase().includes("afiliação"))) {
            if (data.vencimento) {
              const parts = data.vencimento.split("-");
              if (parts.length === 3) {
                // Vencimento original
                const vDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                // Prazo de compensação: vencimento + 2 dias
                vDate.setDate(vDate.getDate() + 2);
                
                if (today > vDate) {
                  overdue.push({ id: doc.id, ...data });
                }
              }
            }
          }
        });

        if (overdue.length > 0) {
          setOverdueDocs(overdue);
        }
      } catch (err) {
        console.warn("Failed to check overdue affiliations", err);
      }
    };

    checkOverdue();
  }, [profile]);

  if (!visible || overdueDocs.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm relative animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-4">
        <div className="bg-red-100 p-2 rounded-full shrink-0">
          <AlertTriangle className="text-red-600" size={24} />
        </div>
        <div className="flex-1 pr-6">
          <h3 className="text-red-800 font-bold text-[15px] mb-1">
            Atenção: Atraso de Pagamento de Afiliação
          </h3>
          <p className="text-red-700 text-sm mb-3">
            Identificamos {overdueDocs.length} {overdueDocs.length === 1 ? 'cliente com boleto de afiliação' : 'clientes com boletos de afiliação'} em atraso (considerando o prazo de compensação bancária de 2 dias).
            <br/>
            <strong>Aviso:</strong> Caso o pagamento já tenha sido realizado hoje ou ontem e o banco ainda não tenha repassado a informação de liquidação, por favor, desconsidere esta mensagem.
          </p>
          <div className="bg-white/60 rounded-lg border border-red-100 p-2 max-h-32 overflow-y-auto space-y-1">
            {overdueDocs.map(doc => (
              <div key={doc.id} className="flex justify-between items-center text-[13px] border-b border-red-100/50 last:border-0 pb-1 last:pb-0">
                <span className="font-semibold text-slate-800 truncate pr-2 max-w-[200px] md:max-w-[400px]">
                  {doc.titular || doc.descricao}
                </span>
                <span className="text-red-600 font-medium whitespace-nowrap">
                  Venc: {doc.vencimento.split('-').reverse().join('/')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link to="/admin/financeiro/contas-receber" className="text-sm font-bold text-red-700 hover:text-red-800 hover:underline">
              Ir para Contas a Receber →
            </Link>
          </div>
        </div>
        <button 
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-red-400 hover:text-red-600 hover:bg-red-100 p-1 rounded-full transition-colors"
          title="Fechar alerta"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
