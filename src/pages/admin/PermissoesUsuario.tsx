import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  Wallet,
  ShoppingCart,
  Truck,
  Sliders,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Settings,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  Boxes,
  UserCheck,
  MapPin,
  Compass
} from "lucide-react";
import { collection, getDocs, query } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";

export default function PermissoesUsuario() {
  const navigate = useNavigate();
  const [userCounts, setUserCounts] = useState<{ [role: string]: number }>({
    Admin: 0,
    Financeiro: 0,
    Comercial: 0,
    "Comercial Externo": 0,
    Expedição: 0,
    Entregador: 0,
    Cliente: 0,
  });
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const { db } = await initFirebase();
        const snap = await getDocs(query(collection(db, "users")));
        const counts: { [role: string]: number } = {
          Admin: 0,
          Financeiro: 0,
          Comercial: 0,
          "Comercial Externo": 0,
          Expedição: 0,
    Entregador: 0,
          Cliente: 0,
        };
        let total = 0;
        snap.forEach((doc) => {
          total++;
          const data = doc.data();
          const r = data.role || "Cliente";
          if (["admin", "Administrador", "Admin"].includes(r)) {
            counts["Admin"]++;
          } else if (r === "Financeiro") {
            counts["Financeiro"]++;
          } else if (r === "Comercial Externo" || r === "Vendedor Externo") {
            counts["Comercial Externo"]++;
          } else if (r === "Comercial") {
            counts["Comercial"]++;
          } else if (r === "Entregador") {
            counts["Entregador"]++;
          } else if (["Expedição", "Estoquista"].includes(r)) {
            counts["Expedição"]++;
          } else {
            counts["Cliente"]++;
          }
        });
        setUserCounts(counts);
        setTotalUsers(total);
      } catch (err) {
        console.error("Erro ao carregar estatísticas de usuários:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const dashboards = [
    {
      id: "financeiro",
      title: "Dashboard - Financeiro",
      path: "/admin/financeiro",
      configPath: "/admin/config-dashboard-financeiro",
      icon: Wallet,
      color: "from-emerald-500 to-teal-600",
      lightBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      badge: "Módulo Financeiro",
      description:
        "Visão consolidada de fluxo de caixa, contas a pagar, faturamento, extrato de cashback e conciliação bancária.",
      allowedRoles: ["Admin", "Financeiro"],
      metrics: "Saldo, Contas, Cashback e Faturamento",
    },
    {
      id: "comercial",
      title: "Dashboard - Comercial",
      path: "/admin/comercial",
      configPath: "/admin/config-dashboard-comercial",
      icon: ShoppingCart,
      color: "from-blue-600 to-indigo-600",
      lightBg: "bg-blue-50 text-blue-700 border-blue-200",
      badge: "Módulo Comercial",
      description:
        "Acompanhamento de vendas de produtos, visitas condominiais, comissões de consultores e ordens de serviço.",
      allowedRoles: ["Admin", "Comercial"],
      metrics: "Vendas, Visitas, Comissões e Clientes",
    },
    {
      id: "comercial-externo",
      title: "Dashboard - Comercial Externo",
      path: "/admin/comercial-externo",
      configPath: "/admin/config-dashboard-comercial-externo",
      icon: MapPin,
      color: "from-cyan-600 to-sky-700",
      lightBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
      badge: "Módulo Comercial Externo",
      description:
        "Painel exclusivo para consultores de campo e promotores de vendas externas, focado exclusivamente no módulo Visitas ao Cliente.",
      allowedRoles: ["Admin", "Comercial", "Comercial Externo"],
      metrics: "Visitas ao Cliente e Prospecção Condominial",
    },
    {
      id: "expedicao",
      title: "Dashboard - Expedição",
      path: "/admin/expedicao",
      configPath: "/admin/config-dashboard-expedicao",
      icon: Truck,
      color: "from-teal-600 to-slate-700",
      lightBg: "bg-teal-50 text-teal-800 border-teal-200",
      badge: "Módulo Logística",
      description:
        "Painel operacional de expedição, rotas de entrega na Grande Goiânia, status de frete e controle de estoque.",
      allowedRoles: ["Admin", "Expedição", "Estoquista", "Entregador"],
      metrics: "Entregas, Pedidos Online e Estoque",
    },
    {
      id: "entrega-mercadorias",
      title: "Dashboard - Entrega de Mercadorias",
      path: "/admin/entrega-mercadorias",
      configPath: "/admin/config-dashboard-entrega-mercadorias",
      icon: Truck,
      color: "from-orange-500 to-amber-600",
      lightBg: "bg-orange-50 text-orange-700 border-orange-200",
      badge: "Módulo Entregador",
      description:
        "Painel exclusivo para entregadores, focado nas rotas, confirmação de entregas em campo e atualizações de status em tempo real.",
      allowedRoles: ["Admin", "Entregador", "Expedição"],
      metrics: "Entregas do Dia, Rotas e Comprovantes",
    },
    {
      id: "cliente",
      title: "Dashboard - Cliente",
      path: "/cliente",
      configPath: "/admin/config-dashboard-cliente",
      icon: Sliders,
      color: "from-indigo-600 to-slate-800",
      lightBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
      badge: "Módulo Portal Cliente",
      description:
        "Personalização e controle de visibilidade dos itens de menu e funcionalidades exibidas aos condomínios.",
      allowedRoles: ["Admin"],
      metrics: "Menus, Atalhos e Visibilidade",
    },
  ];

  const rolesMatrix = [
    {
      role: "Administrador (Admin)",
      desc: "Acesso irrestrito a todos os módulos, relatórios, configurações e dashboards.",
      count: userCounts.Admin,
      color: "bg-indigo-100 text-indigo-800 border-indigo-300",
      access: ["Dashboard - Financeiro", "Dashboard - Comercial", "Dashboard - Comercial Externo", "Dashboard - Expedição", "Dashboard - Entrega de Mercadorias", "Dashboard - Cliente"],
    },
    {
      role: "Financeiro",
      desc: "Acesso focado em contas a pagar/receber, cashback, bancos e faturamento.",
      count: userCounts.Financeiro,
      color: "bg-emerald-100 text-emerald-800 border-emerald-300",
      access: ["Dashboard - Financeiro"],
    },
    {
      role: "Comercial",
      desc: "Acesso a clientes, orçamentos, vendas, comissões, visitas e ordens de serviço.",
      count: userCounts.Comercial,
      color: "bg-blue-100 text-blue-800 border-blue-300",
      access: ["Dashboard - Comercial", "Dashboard - Comercial Externo"],
    },
    {
      role: "Comercial Externo",
      desc: "Acesso direto e operacional focado exclusivamente no módulo de Visitas ao Cliente.",
      count: userCounts["Comercial Externo"],
      color: "bg-cyan-100 text-cyan-800 border-cyan-300",
      access: ["Dashboard - Comercial Externo"],
    },
    {
      role: "Entregador",
      desc: "Acesso focado nas entregas em rota, confirmações de recebimento de mercadorias e status de entrega.",
      count: userCounts.Entregador || 0,
      color: "bg-orange-100 text-orange-800 border-orange-300",
      access: ["Dashboard - Entrega de Mercadorias"],
    },
    {
      role: "Expedição / Logística",
      desc: "Acesso a inventário de estoque, separação, entregas e pedidos online.",
      count: userCounts.Expedição,
      color: "bg-teal-100 text-teal-800 border-teal-300",
      access: ["Dashboard - Expedição"],
    },
    {
      role: "Cliente (Síndico / Condomínio)",
      desc: "Acesso ao catálogo de compras, ordens de serviços, clube de benefícios e cashback.",
      count: userCounts.Cliente,
      color: "bg-slate-100 text-slate-800 border-slate-300",
      access: ["Portal do Cliente"],
    },
  ];

  return (
    <div className="w-full max-w-full space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#0B1A3A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#0071e3]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-400 text-xs font-bold tracking-wide uppercase backdrop-blur-xs">
              <ShieldCheck size={14} />
              <span>Controle de Acesso & Gestão de Dashboards</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Permissões de Usuário
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Centralize a gestão de acessos e acesse diretamente os painéis de controle setoriais: 
              <strong> Financeiro, Comercial, Comercial Externo, Expedição e Portal do Cliente</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/usuarios"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-900 font-bold text-sm shadow-md hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
            >
              <Users size={18} className="text-[#0071e3]" />
              <span>Gerenciar Usuários</span>
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-slate-400 font-medium">Total Usuários</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {loading ? "..." : totalUsers}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-indigo-300 font-medium">Admin</p>
            <p className="text-xl sm:text-2xl font-black text-indigo-400 mt-0.5">
              {loading ? "..." : userCounts.Admin}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-emerald-300 font-medium">Financeiro</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
              {loading ? "..." : userCounts.Financeiro}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-blue-300 font-medium">Comercial</p>
            <p className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">
              {loading ? "..." : userCounts.Comercial}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-cyan-300 font-medium">Com. Externo</p>
            <p className="text-xl sm:text-2xl font-black text-cyan-400 mt-0.5">
              {loading ? "..." : userCounts["Comercial Externo"]}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 backdrop-blur-xs border border-white/5">
            <p className="text-xs text-teal-300 font-medium">Expedição</p>
            <p className="text-xl sm:text-2xl font-black text-teal-400 mt-0.5">
              {loading ? "..." : userCounts.Expedição}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Sectoral Dashboards Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-[#0071e3]" size={22} />
              <span>Painéis de Controle Setoriais</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Selecione o dashboard que deseja acessar ou monitorar:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dashboards.map((dash) => {
            const Icon = dash.icon;
            return (
              <div
                key={dash.id}
                onClick={() => navigate(dash.path)}
                className="group relative bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-slate-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dash.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                      <Icon size={28} />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${dash.lightBg}`}>
                      {dash.badge}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-[#0071e3] transition-colors mb-2">
                    {dash.title}
                  </h3>

                  <p className="text-slate-600 text-sm leading-relaxed mb-4 text-justify">
                    {dash.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 mt-auto">
                  <div className="text-xs text-slate-500 font-medium">
                    <span className="text-slate-400">Métricas: </span>
                    <span className="font-semibold text-slate-700">{dash.metrics}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {dash.configPath && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(dash.configPath);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                        title="Ativar/desativar módulos e indicadores"
                      >
                        <Sliders size={13} className="text-slate-600" />
                        <span>Configurar Opções</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(dash.path)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-[#0071e3] text-white text-xs font-bold transition-all shadow-2xs group-hover:translate-x-0.5 cursor-pointer"
                    >
                      <span>Acessar</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Roles & Permissions Matrix Summary */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Lock className="text-emerald-600" size={22} />
              <span>Matriz de Papéis e Permissões do Sistema</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Relação de perfis e os dashboards correspondentes a cada nível de acesso.
            </p>
          </div>
          <Link
            to="/admin/usuarios"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0071e3] hover:underline"
          >
            <span>Configurar Permissões Individuais</span>
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500 bg-slate-50/50">
                <th className="py-3 px-4 rounded-l-xl">Papel / Nível</th>
                <th className="py-3 px-4">Descrição de Atuação</th>
                <th className="py-3 px-4 text-center">Usuários</th>
                <th className="py-3 px-4 rounded-r-xl">Dashboards com Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rolesMatrix.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${item.color}`}>
                      {item.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-600 text-xs sm:text-sm max-w-xs">
                    {item.desc}
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-slate-800">
                    {loading ? "..." : item.count}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {item.access.map((acc, aIdx) => (
                        <span
                          key={aIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-[#0071e3] text-xs font-medium border border-blue-100"
                        >
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          {acc}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
