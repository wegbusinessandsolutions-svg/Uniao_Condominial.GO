import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { AlertTriangle, CheckCircle, Clock, X } from "lucide-react";

interface Despesa {
  id: string;
  titulo: string;
  diaVencimento: number;
}

export function DespesasAlertModal() {
  const { user } = useAuth();
  const [despesaDaSemana, setDespesaDaSemana] = useState<Despesa | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const checkDespesas = async () => {
      try {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // 1. Get all despesas for this user
        const q = query(collection(db, "despesas_condominio"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setLoading(false);
          return;
        }

        const despesas: Despesa[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Despesa));

        // 2. Find any despesa that falls in the next 7 days
        let targetDespesa: Despesa | null = null;

        for (const despesa of despesas) {
          const expirationDate = new Date(currentYear, currentMonth, despesa.diaVencimento);
          
          // If expiration already passed this month, maybe check next month?
          // Let's keep it simple: check if expiration date is within the next 7 days from today.
          // Wait, if today is 28th and expiration is 2nd of next month:
          if (expirationDate < today && today.getDate() > despesa.diaVencimento) {
            expirationDate.setMonth(currentMonth + 1);
          }

          const diffTime = expirationDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            // Found a despesa coming up!
            // 3. Check if user already dismissed/paid this month
            const alertKey = `${user.uid}_${despesa.id}_${expirationDate.getFullYear()}_${expirationDate.getMonth()}`;
            const alertRef = doc(db, "alertas_despesas", alertKey);
            const alertSnap = await getDoc(alertRef);

            if (!alertSnap.exists()) {
              targetDespesa = despesa;
              break;
            } else {
              const status = alertSnap.data().status;
              // If status is 'snoozed', check when it was snoozed
              if (status === "snoozed") {
                const snoozedAt = alertSnap.data().updatedAt;
                const snoozeDate = new Date(snoozedAt);
                const snoozeDiff = today.getTime() - snoozeDate.getTime();
                const snoozeDays = Math.floor(snoozeDiff / (1000 * 60 * 60 * 24));
                
                if (snoozeDays >= 1) { // Alert again after 1 day
                  targetDespesa = despesa;
                  break;
                }
              }
            }
          }
        }

        if (targetDespesa) {
          setDespesaDaSemana(targetDespesa);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Erro ao checar despesas:", error);
      } finally {
        setLoading(false);
      }
    };

    checkDespesas();
  }, [user]);

  const handleAction = async (action: "paid" | "aware" | "snooze") => {
    if (!user || !despesaDaSemana) return;

    try {
      const today = new Date();
      let month = today.getMonth();
      let year = today.getFullYear();
      
      if (today.getDate() > despesaDaSemana.diaVencimento) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }

      const alertKey = `${user.uid}_${despesaDaSemana.id}_${year}_${month}`;
      const alertRef = doc(db, "alertas_despesas", alertKey);

      let status = "aware";
      if (action === "paid") status = "paid";
      if (action === "snooze") status = "snoozed";

      await setDoc(alertRef, {
        status,
        despesaId: despesaDaSemana.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao salvar status do alerta:", error);
      setIsOpen(false);
    }
  };

  if (!isOpen || !despesaDaSemana) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle size={32} />
          </div>
          
          <h2 className="text-xl font-medium text-slate-900 mb-2">
            Lembrete de Pagamento
          </h2>
          
          <p className="text-slate-600 text-sm mb-6">
            Você tem um vencimento próximo para a semana: <br/>
            <strong className="text-slate-800 text-base">{despesaDaSemana.titulo}</strong> no dia <strong>{despesaDaSemana.diaVencimento}</strong>.
          </p>

          <div className="flex flex-col w-full gap-3">
            <button
              onClick={() => handleAction("aware")}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              Obrigado, estou ciente e irei pagar
            </button>
            
            <button
              onClick={() => handleAction("paid")}
              className="w-full py-3 px-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Já liquidei o pagamento, obrigado
            </button>
            
            <button
              onClick={() => handleAction("snooze")}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Clock size={18} /> Obrigado, me avise posteriormente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
