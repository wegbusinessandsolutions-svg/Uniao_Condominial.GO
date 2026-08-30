import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AlertTriangle, Clock, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";

export const ClientAfiliacaoAlert: React.FC = () => {
  const { user } = useAuth();
  const [overdueDocs, setOverdueDocs] = useState<any[]>([]);
  const [upcomingDocs, setUpcomingDocs] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!user) return;

    
    const checkDocs = async () => {
      try {
        let afiliacaoId = user.uid;

        // Tentar achar o ID real de afiliado
        const directSnap = await getDocs(query(collection(db, "afiliados_uc"), where("userId", "==", user.uid)));
        if (!directSnap.empty) {
          afiliacaoId = directSnap.docs[0].id;
        } else if (user.email) {
          const emailSnap = await getDocs(query(collection(db, "afiliados_uc"), where("email", "==", user.email)));
          if (!emailSnap.empty) {
            afiliacaoId = emailSnap.docs[0].id;
          }
        }

        const q = query(
          collection(db, "contas_receber"),
          where("afiliacaoId", "==", afiliacaoId),
          where("status", "in", ["Aberto", "Vencido", "Pendente", "pendente", "aberto", "vencido"])
        );

        const snap = await getDocs(q);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdue: any[] = [];
        const upcoming: any[] = [];

        snap.forEach((doc) => {
          const data = doc.data();
          if (data.vencimento) {
            const parts = data.vencimento.split("-");
            if (parts.length === 3) {
              const vDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              vDate.setHours(0, 0, 0, 0);

              // Calcula diferença em dias (pode ser negativo se estiver no passado)
              const diffTime = vDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              // Prazo de compensação: vencimento + 2 dias
              const compDate = new Date(vDate);
              compDate.setDate(compDate.getDate() + 2);

              if (today > compDate) {
                // Em atraso (já passou do prazo de compensação)
                overdue.push({ id: doc.id, ...data, vencDate: vDate });
              } else if (diffDays >= 0 && diffDays <= 3) {
                // Próximo do vencimento (faltam 0 a 3 dias)
                upcoming.push({ id: doc.id, ...data, vencDate: vDate, diffDays });
              }
            }
          }
        });

        setOverdueDocs(overdue);
        setUpcomingDocs(upcoming);
      } catch (err) {
        console.warn("Failed to check affiliations", err);
      }
    };

    checkDocs();
  }, [user]);

  if (!visible || (overdueDocs.length === 0 && upcomingDocs.length === 0)) return null;

  return (
    <div className="mb-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Alerta de Atraso */}
      {overdueDocs.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-5 shadow-md relative">
          <div className="flex items-start gap-4">
            <div className="bg-red-100 p-2.5 rounded-full shrink-0">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div className="flex-1 pr-6">
              <h3 className="text-red-900 text-lg font-normal mb-1">
                Atenção: Você possui boleto de afiliação em atraso
              </h3>
              <p className="text-red-700 text-sm mb-2 leading-relaxed">
                Identificamos que há mensalidade(s) pendente(s) junto à União Condominial.
                <br />
                <span className="font-medium">Aviso:</span> O boleto bancário leva até dois dias úteis para ser compensado. Caso já tenha realizado o pagamento neste período, por favor, desconsidere esta mensagem.
              </p>
              <div className="mt-3">
                <Link to="/cliente/suporte" className="text-base text-red-800 hover:text-red-950 font-normal hover:underline">
                  Falar com o Suporte →
                </Link>
              </div>
            </div>
            <button 
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 text-red-400 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-full transition-colors"
              title="Fechar alerta"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Vencimento Próximo */}
      {upcomingDocs.length > 0 && overdueDocs.length === 0 && (
        <div className="bg-amber-50 rounded-2xl p-5 shadow-md relative">
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-2.5 rounded-full shrink-0">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div className="flex-1 pr-6">
              <h3 className="text-amber-900 text-lg font-normal mb-1">
                Aviso de Vencimento Próximo
              </h3>
              
              {upcomingDocs.map(doc => {
                const dia = String(doc.vencDate.getDate()).padStart(2, '0');
                const mes = String(doc.vencDate.getMonth() + 1).padStart(2, '0');
                return (
                  <p key={doc.id} className="text-amber-800 text-base font-normal">
                    Esteja atento a data de vencimento de sua Anuidade, e informe o seu vence dia: <span className="font-medium text-amber-950">{dia}/{mes}</span>
                  </p>
                );
              })}
            </div>
            <button 
              onClick={() => setVisible(false)}
              className="absolute top-4 right-4 text-amber-400 hover:text-amber-600 hover:bg-amber-100 p-1.5 rounded-full transition-colors"
              title="Fechar alerta"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
