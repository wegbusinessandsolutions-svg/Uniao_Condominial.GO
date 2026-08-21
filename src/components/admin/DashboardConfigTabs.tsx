import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Wallet, 
  ShoppingCart, 
  MapPin, 
  Truck, 
  Sliders, 
  ShieldCheck 
} from "lucide-react";

export default function DashboardConfigTabs() {
  const location = useLocation();

  const tabs = [
    {
      name: "Dashboard - Financeiro",
      path: "/admin/config-dashboard-financeiro",
      icon: Wallet,
      color: "text-emerald-600",
    },
    {
      name: "Dashboard - Comercial",
      path: "/admin/config-dashboard-comercial",
      icon: ShoppingCart,
      color: "text-blue-600",
    },
    {
      name: "Dashboard - Comercial Externo",
      path: "/admin/config-dashboard-comercial-externo",
      icon: MapPin,
      color: "text-cyan-600",
    },
    {
      name: "Dashboard - Expedição",
      path: "/admin/config-dashboard-expedicao",
      icon: Truck,
      color: "text-orange-600",
    },
    {
      name: "Dashboard - Cliente",
      path: "/admin/config-dashboard-cliente",
      icon: Sliders,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs mb-6">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 mb-2">
        <ShieldCheck size={16} className="text-slate-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Personalização de Visibilidade dos Dashboards
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-100"
              }`}
            >
              <Icon size={16} className={isActive ? "text-cyan-300" : tab.color} />
              <span className="truncate">{tab.name.replace("Dashboard - ", "")}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
