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
  const [despesasFila, setDespesasFila] = useState<Despesa[]>([]);
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

        // 2. Find ALL despesas that fall in the next 7 days
        const pendingDespesas: Despesa[] = [];

        for (const despesa of despesas) {
          const expirationDate = new Date(currentYear, currentMonth, despesa.diaVencimento);
          
          if (expirationDate < today && today.getDate() > despesa.diaVencimento) {
            expirationDate.setMonth(currentMonth + 1);
          }

          const diffTime = expirationDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0 && diffDays <= 7) {
            // Found a despesa coming up!
            const alertKey = `${user.uid}_${despesa.id}_${expirationDate.getFullYear()}_${expirationDate.getMonth()}`;
            const alertRef = doc(db, "alertas_despesas", alertKey);
            const alertSnap = await getDoc(alertRef);

            if (!alertSnap.exists()) {
              pendingDespesas.push(despesa);
            } else {
              const status = alertSnap.data().status;
              if (status === "snoozed") {
                const snoozedAt = alertSnap.data().updatedAt;
                const snoozeDate = new Date(snoozedAt);
                const snoozeDiff = today.getTime() - snoozeDate.getTime();
                const snoozeDays = Math.floor(snoozeDiff / (1000 * 60 * 60 * 24));
                
                if (snoozeDays >= 1) { // Alert again after 1 day
                  pendingDespesas.push(despesa);
                }
              }
            }
          }
        }

        if (pendingDespesas.length > 0) {
          setDespesasFila(pendingDespesas);
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
    if (!user || despesasFila.length === 0) return;

    const currentDespesa = despesasFila[0];

    try {
      const today = new Date();
      let month = today.getMonth();
      let year = today.getFullYear();
      
      if (today.getDate() > currentDespesa.diaVencimento) {
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }

      const alertKey = `${user.uid}_${currentDespesa.id}_${year}_${month}`;
      const alertRef = doc(db, "alertas_despesas", alertKey);

      let status = "aware";
      if (action === "paid") status = "paid";
      if (action === "snooze") status = "snoozed";

      await setDoc(alertRef, {
        status,
        despesaId: currentDespesa.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const novaFila = despesasFila.slice(1);
      setDespesasFila(novaFila);
      if (novaFila.length === 0) {
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Erro ao salvar status do alerta:", error);
      // Proceed to next even on error to not block UI
      const novaFila = despesasFila.slice(1);
      setDespesasFila(novaFila);
      if (novaFila.length === 0) setIsOpen(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen || despesasFila.length === 0) return null;

  const despesaDaSemana = despesasFila[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4 shadow-sm relative">
            <AlertTriangle size={32} />
            {despesasFila.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {despesasFila.length}
              </span>
            )}
          </div>
          
          <h2 className="text-xl font-medium text-slate-900 mb-2">
            Lembrete de Pagamento
          </h2>
          
          <p className="text-slate-600 text-sm mb-6">
            Você tem um vencimento próximo para a semana: <br/>
            <strong className="text-slate-800 text-base">{despesaDaSemana.titulo}</strong> no dia <strong>{despesaDaSemana.diaVencimento}</strong>.
            {despesasFila.length > 1 && (
              <span className="block mt-2 text-amber-600 text-xs">
                (Você possui mais {despesasFila.length - 1} alerta{despesasFila.length - 1 > 1 ? 's' : ''} pendente{despesasFila.length - 1 > 1 ? 's' : ''})
              </span>
            )}
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
