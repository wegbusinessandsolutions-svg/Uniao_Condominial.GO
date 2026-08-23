import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, Bell, Truck, Package, FileText, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'order';

export interface ToastOptions {
  id?: string;
  title?: string;
  message: string;
  type?: ToastType;
  orderId?: string;
  orderNumber?: string;
  status?: string;
  actionUrl?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  duration?: number;
  playSound?: boolean;
}

export interface Toast extends ToastOptions {
  id: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (messageOrOptions: string | ToastOptions, type?: ToastType) => void;
  addOrderToast: (options: Omit<ToastOptions, 'type'>) => void;
  removeToast: (id: string) => void;
}

export function playNotificationChime(type: 'order' | 'success' | 'info' | 'error' = 'order') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    if (type === 'order' || type === 'success') {
      // Ascending pleasant notification chord (D5 -> A5)
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.2);

      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);

      gainNode.gain.setValueAtTime(0.09, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    } else if (type === 'error') {
      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    } else {
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(554.37, now + 0.15);
      gainNode.gain.setValueAtTime(0.07, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    }

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Audio autoplay restrictions caught gracefully
  }
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((messageOrOptions: string | ToastOptions, typeParam: ToastType = 'info') => {
    const id = (typeof messageOrOptions === 'object' && messageOrOptions.id) 
      ? messageOrOptions.id 
      : Math.random().toString(36).substring(2, 9);

    let toastObj: Toast;

    if (typeof messageOrOptions === 'string') {
      toastObj = {
        id,
        message: messageOrOptions,
        type: typeParam,
        duration: 5000,
        playSound: typeParam === 'order' || typeParam === 'success'
      };
    } else {
      toastObj = {
        ...messageOrOptions,
        id,
        type: messageOrOptions.type || typeParam,
        duration: messageOrOptions.duration || 6000,
        playSound: messageOrOptions.playSound !== false
      };
    }

    if (toastObj.playSound) {
      playNotificationChime(toastObj.type as any);
    }

    setToasts((prev) => {
      // Remove any existing toast with same ID to avoid duplicates
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, toastObj];
    });

    const duration = toastObj.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const addOrderToast = useCallback((options: Omit<ToastOptions, 'type'>) => {
    addToast({
      ...options,
      type: 'order',
      playSound: true,
      duration: options.duration || 7000
    });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, addOrderToast, removeToast }}>
      {children}
      <div 
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:w-auto pointer-events-none"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } }}
              className={`pointer-events-auto rounded-2xl shadow-xl border p-4 backdrop-blur-md transition-all ${
                toast.type === 'order'
                  ? 'bg-slate-900/95 border-slate-700 text-white shadow-blue-500/10'
                  : toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-500/10'
                  : toast.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900 shadow-rose-500/10'
                  : toast.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-500/10'
                  : 'bg-white border-slate-200 text-slate-900 shadow-slate-500/10'
              }`}
            >
              {toast.type === 'order' ? (
                /* Rich Order Status Notification Toast */
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#0071e3] text-white flex items-center justify-center shrink-0 shadow-xs">
                        {toast.status?.toLowerCase().includes('entregue') ? (
                          <Check size={18} className="text-white" />
                        ) : toast.status?.toLowerCase().includes('rota') || toast.status?.toLowerCase().includes('despachado') || toast.status?.toLowerCase().includes('enviado') || toast.status?.toLowerCase().includes('transito') ? (
                          <Truck size={18} className="text-white animate-pulse" />
                        ) : toast.status?.toLowerCase().includes('faturado') || toast.status?.toLowerCase().includes('nota') ? (
                          <FileText size={18} className="text-white" />
                        ) : (
                          <Package size={18} className="text-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                            Atualização de Pedido
                          </span>
                          {toast.orderNumber && (
                            <span className="bg-slate-800 text-slate-200 font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
                              {toast.orderNumber}
                            </span>
                          )}
                        </div>
                        <h5 className="font-extrabold text-sm text-white leading-snug">
                          {toast.title || "Status do Pedido Atualizado"}
                        </h5>
                      </div>
                    </div>

                    <button
                      onClick={() => removeToast(toast.id)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
                      aria-label="Fechar"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-10.5">
                    {toast.message}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 pl-10.5">
                    {toast.status && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Status: {toast.status}
                      </span>
                    )}

                    {(toast.actionUrl || toast.onActionClick) && (
                      <a
                        href={toast.actionUrl || "#"}
                        onClick={(e) => {
                          if (toast.onActionClick) {
                            e.preventDefault();
                            toast.onActionClick();
                          }
                          removeToast(toast.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer ml-auto"
                      >
                        <span>{toast.actionLabel || "Acompanhar Pedido"}</span>
                        <ArrowRight size={13} />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                /* Standard Toast */
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {toast.type === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                    {toast.type === 'error' && <AlertTriangle size={18} className="text-rose-500" />}
                    {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-500" />}
                    {toast.type === 'info' && <Bell size={18} className="text-[#0071e3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    {toast.title && (
                      <h5 className="font-bold text-xs sm:text-sm text-slate-900 mb-0.5 leading-tight">
                        {toast.title}
                      </h5>
                    )}
                    <p className="text-xs sm:text-sm font-medium leading-snug">
                      {toast.message}
                    </p>
                    {(toast.actionUrl || toast.onActionClick) && (
                      <a
                        href={toast.actionUrl || "#"}
                        onClick={(e) => {
                          if (toast.onActionClick) {
                            e.preventDefault();
                            toast.onActionClick();
                          }
                          removeToast(toast.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#0071e3] hover:underline mt-1.5 cursor-pointer"
                      >
                        <span>{toast.actionLabel || "Ver Detalhes"}</span>
                        <ArrowRight size={12} />
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-0.5 cursor-pointer"
                    aria-label="Fechar"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
