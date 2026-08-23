import React, { useState, useRef, useEffect } from "react";
import { 
  Bell, CheckCircle, Truck, Package, FileText, AlertTriangle, 
  ExternalLink, Check, Trash2, Volume2, Sparkles, X, ChevronRight 
} from "lucide-react";
import { useNotifications, AppNotification } from "../../context/NotificationContext";
import { useToast } from "../../context/ToastContext";
import { Link } from "react-router-dom";

export const CustomerNotificationBell: React.FC<{ isCompact?: boolean }> = ({ isCompact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    permission, 
    requestPermission, 
    markAsRead, 
    markAllAsRead,
    testOrderNotification,
    testPromotionNotification
  } = useNotifications();
  const { addOrderToast, addToast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSimulateStatus = (statusType: "enviado" | "entregue" | "faturado") => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const orderNum = `PED-${randomNum}`;

    if (statusType === "enviado") {
      addOrderToast({
        title: "🚚 Pedido Enviado / Em Rota",
        message: `Seu pedido #${orderNum} foi despachado pela expedição e o entregador já está a caminho do condomínio!`,
        orderNumber: `#${orderNum}`,
        status: "Despachado",
        actionUrl: "/cliente/pedidos",
        actionLabel: "Acompanhar Entrega",
        duration: 8000
      });
    } else if (statusType === "entregue") {
      addOrderToast({
        title: "✅ Pedido Entregue com Sucesso",
        message: `Seu pedido #${orderNum} foi entregue e o comprovante foi assinado na portaria.`,
        orderNumber: `#${orderNum}`,
        status: "Entregue",
        actionUrl: "/cliente/pedidos",
        actionLabel: "Ver Pedido",
        duration: 8000
      });
    } else {
      addOrderToast({
        title: "📄 Nota Fiscal Emitida",
        message: `A Nota Fiscal Eletrônica (NF-e) do pedido #${orderNum} foi gerada com sucesso.`,
        orderNumber: `#${orderNum}`,
        status: "Faturado",
        actionUrl: "/cliente/pedidos",
        actionLabel: "Ver NF-e",
        duration: 8000
      });
    }
  };

  const getNotificationIcon = (notif: AppNotification) => {
    const text = (notif.titulo + " " + notif.mensagem).toLowerCase();
    if (text.includes("entregue") || text.includes("concluíd")) {
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    }
    if (text.includes("despachado") || text.includes("enviado") || text.includes("rota") || text.includes("trânsito")) {
      return <Truck className="w-4 h-4 text-[#0071e3]" />;
    }
    if (text.includes("faturado") || text.includes("nota fiscal") || text.includes("nfe")) {
      return <FileText className="w-4 h-4 text-purple-600" />;
    }
    if (text.includes("promoção") || text.includes("desconto") || text.includes("clube")) {
      return <Sparkles className="w-4 h-4 text-amber-500" />;
    }
    return <Package className="w-4 h-4 text-slate-600" />;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-3xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
        aria-label="Abrir Notificações"
        title="Notificações e Avisos de Pedidos"
      >
        <Bell size={isCompact ? 18 : 20} className={unreadCount > 0 ? "text-[#0071e3]" : "text-slate-600"} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-scale-up">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-sky-50/30">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#0071e3] text-white rounded-xl shadow-3xs">
                <Bell size={16} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">Notificações</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Status de pedidos e alertas em tempo real
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-[11px] font-bold text-[#0071e3] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check size={13} />
                Marcar lidas
              </button>
            )}
          </div>

          {/* Browser Push Permission Alert */}
          {permission !== "granted" && (
            <div className="p-3 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-blue-900 font-medium leading-tight">
                <Volume2 size={16} className="text-[#0071e3] shrink-0" />
                <span>Receba avisos de entrega mesmo com a tela fechada.</span>
              </div>
              <button
                onClick={async () => {
                  const res = await requestPermission();
                  if (res === "granted") {
                    addToast("Notificações Push ativadas com sucesso!", "success");
                  }
                }}
                className="bg-[#0071e3] hover:bg-[#005bb5] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 shadow-3xs cursor-pointer"
              >
                Ativar Push
              </button>
            </div>
          )}

          {/* Quick Simulation / Test Status Alert */}
          <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Testar Alertas:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSimulateStatus("enviado")}
                className="text-[10px] font-bold bg-white hover:bg-sky-50 text-[#0071e3] px-2 py-1 rounded-md border border-blue-200 transition-colors shadow-3xs cursor-pointer flex items-center gap-1"
                title="Testar alerta de Pedido Despachado"
              >
                <Truck size={11} /> Enviado
              </button>
              <button
                onClick={() => handleSimulateStatus("entregue")}
                className="text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200 transition-colors shadow-3xs cursor-pointer flex items-center gap-1"
                title="Testar alerta de Pedido Entregue"
              >
                <CheckCircle size={11} /> Entregue
              </button>
              <button
                onClick={() => handleSimulateStatus("faturado")}
                className="text-[10px] font-bold bg-white hover:bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-200 transition-colors shadow-3xs cursor-pointer flex items-center gap-1"
                title="Testar alerta de NF-e"
              >
                <FileText size={11} /> NF-e
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">Nenhuma notificação no momento</p>
                <p className="text-[11px] text-slate-400">
                  Quando o status do seu pedido mudar (ex: Enviado, Entregue), você será alertado aqui em tempo real.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.lida) markAsRead(notif.id);
                  }}
                  className={`p-3.5 flex items-start gap-3 transition-colors hover:bg-slate-50 cursor-pointer ${
                    !notif.lida ? "bg-sky-50/40" : "bg-white"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0 mt-0.5">
                    {getNotificationIcon(notif)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h5 className="font-bold text-slate-900 text-xs truncate">
                        {notif.titulo}
                      </h5>
                      {!notif.lida && (
                        <span className="w-2 h-2 rounded-full bg-[#0071e3] shrink-0"></span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug">
                      {notif.mensagem}
                    </p>

                    {notif.linkUrl && (
                      <Link
                        to={notif.linkUrl}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0071e3] hover:underline mt-1.5"
                      >
                        <span>Acessar detalhes</span>
                        <ChevronRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
            <Link
              to="/cliente/pedidos"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-slate-700 hover:text-[#0071e3] inline-flex items-center gap-1 transition-colors"
            >
              <span>Ver todos os meus pedidos</span>
              <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
