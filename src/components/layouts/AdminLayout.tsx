import React, { useState, Suspense } from "react";
import { Outlet, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { FileText,
  Package,
  Users,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Receipt,
  BadgeCheck,
  Building2,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Wallet,
  Banknote,
  ShoppingCart,
  FolderTree,
  Boxes,
  Truck,
  Heart,
  Tag,
  Database,
  Menu,
  Sun,
  Moon,
  HelpCircle,
  Sliders,
  Mail,
  Calculator,
  Coins,
  MapPin,
  Route,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { A2HSNavButton } from "../common/A2HSNavButton";
import { getAuth, signOut } from "firebase/auth";
import { AdminContentSkeleton } from "../ui/Skeleton";
import {
  isStaffRole,
  isAdminRole,
  getDefaultDashboardForRole,
  getRoleDashboardTitle,
  isUserAuthorizedForPath,
  getFilteredNavGroups,
  NavGroup
} from "../../lib/permissions";

import FranqueadaSwitcher from "../admin/FranqueadaSwitcher";
import { Breadcrumbs } from "../common/Breadcrumbs";
import { CommandPalette } from "../common/CommandPalette";
import { Search } from "lucide-react";

// Lazy-load secondary layout components to prevent blocking initial render
const GuidedTour = React.lazy(() => import("../common/GuidedTour"));
const AdminNotifications = React.lazy(() =>
  import("../common/AdminNotifications").then((m) => ({ default: m.AdminNotifications }))
);
const AfiliacaoOverdueAlert = React.lazy(() =>
  import("../financeiro/AfiliacaoOverdueAlert").then((m) => ({ default: m.AfiliacaoOverdueAlert }))
);
const BackupCsvModal = React.lazy(() =>
  import("../admin/BackupCsvModal").then((m) => ({ default: m.BackupCsvModal }))
);

export const navGroups: NavGroup[] = [
  {
    title: "Admin",
    items: [
      { name: "Backup e Exportação", path: "/admin/backup-exportacao", icon: Database },
      {
        name: "Configuração E-mails e Mensagens",
        path: "/admin/configuracao-notificacoes",
        icon: Mail,
      },
      { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
      {
        name: "Franqueada - Empresa",
        icon: Building2,
        children: [
          { name: "Cadastro Empresa Franqueada", path: "/admin/empresa", icon: Building2 },
          { name: "Clube de Benefícios", path: "/admin/clube-beneficios", icon: Heart },
          {
            name: "Comercial",
            path: "/admin/comercial",
            icon: ShoppingCart,
            children: [
              { name: "Acompanhamento de Venda", path: "/admin/acompanhamento-venda", icon: ShieldCheck },
              { name: "Calculadora de Preços", path: "/admin/comercial/calculadora", icon: Calculator },
              { name: "Categorias de Produtos", path: "/admin/comercial/categorias", icon: FolderTree },
              { name: "Clientes", path: "/admin/comercial/clientes", icon: Users },
              { name: "Códigos de Indicação", path: "/admin/comercial/codigos-indicacao", icon: FolderTree },
              { name: "Comissões", path: "/admin/comercial/comissoes", icon: DollarSign },
              { name: "Controle de Afiliados U.C.", path: "/admin/comercial/afiliados", icon: Building2 },
              { name: "Dashboard - Comercial", path: "/admin/comercial", icon: LayoutDashboard },
              { name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },
              { name: "Ordens de Serviço", path: "/admin/comercial/ordens-servico", icon: FileText },
              { name: "Produtos", path: "/admin/produtos", icon: Package },
              { name: "Serviços Condominiais Rotineiros", path: "/admin/comercial/servicos", icon: Package },
              { name: "Visitas ao Cliente", path: "/admin/comercial/visitas", icon: MapPin },
            ],
          },
          { name: "Configuração de Frete", path: "/admin/configuracao-frete", icon: Sliders },
          { name: "Empregados/Colaboradores", path: "/admin/empregados", icon: BadgeCheck },
          {
            name: "Expedição",
            path: "/admin/expedicao",
            icon: Truck,
            children: [
              { name: "Dashboard - Entrega de Mercadorias", path: "/admin/entrega-mercadorias", icon: Truck },
              { name: "Dashboard - Expedição", path: "/admin/expedicao", icon: LayoutDashboard },
              { name: "Logística e Roteirização", path: "/admin/expedicao/logistica-roteirizacao", icon: Route },
              { name: "Entregas", path: "/admin/expedicao/entregas", icon: Truck },
              { name: "Estoque – Compras", path: "/admin/expedicao/estoque", icon: Boxes },
              { name: "Pedidos Online", path: "/admin/expedicao/pedidos-online", icon: Boxes },
            ],
          },
          {
            name: "Financeiro",
            path: "/admin/financeiro",
            icon: Wallet,
            children: [
              { name: "Bancos", path: "/admin/financeiro/bancos", icon: Building2 },
              { name: "Centro de Custo - Lucro", path: "/admin/financeiro/centros-custo", icon: Wallet },
              { name: "Contas a Pagar", path: "/admin/financeiro/pagar", icon: Banknote },
              { name: "Contas a Receber", path: "/admin/financeiro/receber", icon: Banknote },
              { name: "Controle de Cashback", path: "/admin/financeiro/controle-cashback", icon: Coins },
              { name: "Dashboard - Financeiro", path: "/admin/financeiro", icon: LayoutDashboard },
              { name: "Faturamento", path: "/admin/financeiro/faturamento", icon: Boxes },
              { name: "Fornecedores", path: "/admin/financeiro/fornecedores", icon: Users },
            ],
          },
          { name: "Integração Pagamentos", path: "/admin/integracao-pagamentos", icon: CreditCard },
          { name: "Marcas Parceiras", path: "/admin/marcas-parceiras", icon: Tag },
          { name: "Mural Condominial", path: "/admin/mural-condominial", icon: FileText },
          {
            name: "Permissões de Usuário",
            path: "/admin/permissoes-usuario",
            icon: ShieldCheck,
            children: [
              { name: "Dashboard - Cliente", path: "/admin/config-dashboard-cliente", icon: Sliders },
              { name: "Dashboard - Comercial", path: "/admin/config-dashboard-comercial", icon: ShoppingCart },
              { name: "Dashboard - Comercial Externo", path: "/admin/config-dashboard-comercial-externo", icon: MapPin },
              { name: "Dashboard - Entrega de Mercadorias", path: "/admin/config-dashboard-entrega-mercadorias", icon: Truck },
              { name: "Dashboard - Expedição", path: "/admin/config-dashboard-expedicao", icon: Truck },
              { name: "Dashboard - Financeiro", path: "/admin/config-dashboard-financeiro", icon: Wallet },
            ],
          },
          {
            name: "Regras de Cashback",
            path: "/admin/cashback",
            icon: DollarSign,
          },
          { name: "Relatórios", path: "/admin/relatorios", icon: BarChart3 },
          { name: "Usuários", path: "/admin/usuarios", icon: Users },
        ],
      },
      {
        name: "Franqueadora",
        path: "/admin/franqueadora",
        icon: Building2,
      },
      { name: "Manutenção de Dados", path: "/admin/manutencao", icon: ShieldAlert },
    ],
  },
];

export default function AdminLayout() {
  const { profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tourTrigger, setTourTrigger] = useState(0);
  const [isGlobalCsvModalOpen, setIsGlobalCsvModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Listen for custom open-command-palette events
  React.useEffect(() => {
    const handleOpen = () => setIsCommandPaletteOpen(true);
    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);
  const [expandedSubmenus, setExpandedSubmenus] = useState<{ [key: string]: boolean }>({
    "Franqueada - Empresa": true,
    "Comercial": true,
    "Financeiro": true,
    "Expedição": true,
    "Permissões de Usuário": false,
  });

  const hasActivePath = (item: any, currentPath: string): boolean => {
    if (item.path && (currentPath === item.path || currentPath === item.path + "/")) {
      return true;
    }
    if (item.children && Array.isArray(item.children)) {
      return item.children.some((child: any) => hasActivePath(child, currentPath));
    }
    return false;
  };

  const isSubmenuOpen = (name: string, item?: any): boolean => {
    if (expandedSubmenus[name] !== undefined) {
      return expandedSubmenus[name];
    }
    if (item) {
      return hasActivePath(item, location.pathname);
    }
    return false;
  };

  const toggleSubmenu = (name: string, item?: any) => {
    setExpandedSubmenus((prev) => {
      const current = prev[name] !== undefined ? prev[name] : (item ? hasActivePath(item, location.pathname) : true);
      return {
        ...prev,
        [name]: !current,
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/minha-conta" replace />;
  }

  if (profile?.status === "Pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Acesso Pendente</h2>
          <p className="text-slate-600 mb-6">
            Sua conta está em análise. Aguarde a aprovação do administrador.
          </p>
          <button
            onClick={() => {
              getAuth().signOut();
              navigate("/");
            }}
            className="flex items-center justify-center w-full gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const userRole = profile?.role || "";
  const isAdmin = isAdminRole(userRole);
  const isStaff = isStaffRole(userRole);

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Acesso Restrito
          </h2>
          <p className="text-slate-600 mb-4">
            Você não tem permissão para acessar esta área administrativa.
          </p>
          <Link to="/" className="text-brand-dark hover:underline font-medium">
            Voltar para a loja
          </Link>
        </div>
      </div>
    );
  }

    // Automatic redirect if non-admin user lands on root "/admin" or "/admin/"
  const currentPath = location.pathname;
  const cleanPath = currentPath.replace(/\/$/, "");

  // Path-level module permission checks
  const filteredNav = getFilteredNavGroups(navGroups, userRole, profile?.permissions);
  
  // Find the first available route to use as fallback/dashboard
  let firstAvailableRoute = "/admin"; // fallback
  if (!isAdmin) {
    firstAvailableRoute = "/"; // ultimate fallback if nothing available
    for (const group of filteredNav) {
      if (group.items.length > 0) {
        if (group.items[0].path) {
          firstAvailableRoute = group.items[0].path;
          break;
        } else if (group.items[0].children && group.items[0].children.length > 0) {
          firstAvailableRoute = group.items[0].children[0].path;
          break;
        }
      }
    }
  }

  if (cleanPath === "/admin" && !isAdmin) {
    return <Navigate to={firstAvailableRoute} replace />;
  }

  let hasModuleAccess = false;
  if (isAdmin) {
    hasModuleAccess = true;
  } else {
    // recursively check if cleanPath matches any item's path
    const checkPath = (items: any[]) => {
      for (const item of items) {
        if (item.path && (cleanPath === item.path || cleanPath.startsWith(item.path + "/"))) return true;
        if (item.children && checkPath(item.children)) return true;
      }
      return false;
    };
    for (const group of filteredNav) {
      if (checkPath(group.items)) {
        hasModuleAccess = true;
        break;
      }
    }
  }

  if (!hasModuleAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Acesso Restrito ao Módulo
          </h2>
          <p className="text-slate-600 mb-6 text-sm">
            Seu perfil (<span className="font-semibold text-slate-800">{userRole || "Colaborador"}</span>) não possui permissão para acessar este módulo.
          </p>
          <Link
            to={firstAvailableRoute}
            className="inline-block px-5 py-2.5 bg-[#0071e3] text-white rounded-xl hover:bg-blue-600 transition-colors font-bold text-sm shadow-sm"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    window.location.href = "/";
  };

  const filteredNavGroups = getFilteredNavGroups(navGroups, userRole, profile?.permissions);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans print:block print:bg-white text-black relative">
      {/* Header móvel */}
      <header className="md:hidden bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40 w-full shrink-0 print:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu size={24} />
        </button>
        <div className="text-center flex-1 pr-6 pt-1">
          <span className="font-bold text-slate-800 text-[17px] block leading-none notranslate" translate="no">
            União Condominial.<span className="text-emerald-600">GO</span>
          </span>
          <span className="text-[13px] text-[#0071e3] font-semibold mt-1 block leading-none">Gestão Central</span>
        </div>
      </header>

      {/* Backdrop para mobile drawer */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[360px] bg-slate-50 border-r border-slate-200 text-slate-900 flex flex-col h-full transform transition-transform duration-300 ease-in-out print:hidden
          md:relative md:transform-none md:z-0 md:flex md:h-auto md:min-h-screen shrink-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-4 mb-2">
          <span className="text-xl font-bold block notranslate" translate="no">
            <span className="text-brand-dark">União</span>{" "}
            <span className="text-[#0071e3]">Condominial.</span>
            <span className="text-emerald-600">GO</span>
          </span>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            Gestão Central
          </p>
          {profile?.displayName && (
            <p className="text-[16px] font-bold text-[#0071e3] mt-2 whitespace-normal break-words leading-tight tour-step-profile" title={profile?.displayName}>
              {profile?.displayName}
            </p>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          {filteredNavGroups.map((group) => (
            <div key={group!.title}>
              <h3 className="text-[12.5px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 pl-2">
                {group!.title}
              </h3>
              <div className="space-y-1">
                {group!.items.map((item: any) => {
                  const isActive =
                    location.pathname === item.path ||
                    location.pathname === item.path + "/";
                  const Icon = item.icon;
                  
                  let tourClass = "";
                  if (item.name === "Dashboard" && item.path === "/admin") {
                    tourClass = "tour-step-dashboard";
                  } else if (item.name === "Integração Pagamentos" || item.name === "Integração de Pagamentos") {
                    tourClass = "tour-step-payments";
                  } else if (item.name === "Relatórios") {
                    tourClass = "tour-step-reports";
                  }

                  if (item.children && item.children.length > 0) {
                    const isAnyChildActive = hasActivePath(item, location.pathname);
                    const isMenuOpen = isSubmenuOpen(item.name, item);

                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between rounded-lg">
                          {item.path ? (
                            <>
                              <Link
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] md:text-sm font-medium transition-colors ${
                                  isActive
                                    ? "bg-brand-dark text-white font-bold"
                                    : isAnyChildActive
                                    ? "bg-slate-200/80 text-[#0071e3] font-bold"
                                    : "text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <Icon size={18} className="w-[18px] h-[18px] shrink-0" />
                                <span className="truncate">{item.name}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleSubmenu(item.name, item);
                                }}
                                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
                                title={isMenuOpen ? "Recolher subitens" : "Expandir subitens"}
                              >
                                {isMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleSubmenu(item.name, item);
                              }}
                              className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-[15px] md:text-sm font-medium transition-colors cursor-pointer text-left ${
                                isAnyChildActive
                                  ? "bg-slate-200/80 text-[#0071e3] font-bold"
                                  : "text-slate-700 hover:bg-slate-100"
                              }`}
                              title={isMenuOpen ? "Recolher subitens" : "Expandir subitens"}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Icon size={18} className="w-[18px] h-[18px] shrink-0 text-slate-500" />
                                <span className="truncate font-semibold">{item.name}</span>
                              </div>
                              <span className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors">
                                {isMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </span>
                            </button>
                          )}
                        </div>

                        {isMenuOpen && (
                          <div className="pl-2.5 pr-1 py-1 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
                            {item.children.map((child: any) => {
                              const ChildIcon = child.icon;

                              // If child has nested children (e.g. Comercial, Expedição, Financeiro, Permissões de Usuário)
                              if (child.children && child.children.length > 0) {
                                const isChildFolderActive = hasActivePath(child, location.pathname);
                                const isChildFolderOpen = isSubmenuOpen(child.name, child);

                                return (
                                  <div key={child.name} className="space-y-1 my-1">
                                    <div className="flex items-center justify-between rounded-lg">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          toggleSubmenu(child.name, child);
                                        }}
                                        className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] md:text-xs font-bold transition-all text-left cursor-pointer ${
                                          isChildFolderActive
                                            ? "bg-blue-50 text-[#0071e3] border border-blue-200/60"
                                            : "text-slate-700 hover:bg-slate-200/60 hover:text-slate-900"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ChildIcon size={15} className={isChildFolderActive ? "text-[#0071e3]" : "text-slate-500"} />
                                          <span className="truncate uppercase tracking-wider text-[11px] font-bold">{child.name}</span>
                                        </div>
                                        <span className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors ml-1">
                                          {isChildFolderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </span>
                                      </button>
                                    </div>

                                    {isChildFolderOpen && (
                                      <div className="pl-2.5 pr-1 py-0.5 space-y-0.5 border-l-2 border-slate-300 ml-3.5 my-1">
                                        {child.children.map((grandChild: any) => {
                                          const isGrandChildActive =
                                            location.pathname === grandChild.path ||
                                            location.pathname === grandChild.path + "/";
                                          const GrandChildIcon = grandChild.icon;
                                          return (
                                            <Link
                                              key={grandChild.name}
                                              to={grandChild.path}
                                              onClick={() => setIsMobileMenuOpen(false)}
                                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] md:text-[11.5px] font-medium transition-colors ${
                                                isGrandChildActive
                                                  ? "bg-[#0071e3] text-white font-bold shadow-2xs"
                                                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                                              }`}
                                            >
                                              <GrandChildIcon size={13} className={isGrandChildActive ? "text-white" : "text-slate-400 shrink-0"} />
                                              <span className="truncate">{grandChild.name}</span>
                                            </Link>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Leaf child item
                              const isChildActive =
                                location.pathname === child.path ||
                                location.pathname === child.path + "/";
                              return (
                                <Link
                                  key={child.name}
                                  to={child.path}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13.5px] md:text-xs font-medium transition-colors ${
                                    isChildActive
                                      ? "bg-[#0071e3] text-white font-bold shadow-2xs"
                                      : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                                  }`}
                                >
                                  <ChildIcon size={14} className={isChildActive ? "text-white" : "text-slate-400 shrink-0"} />
                                  <span className="truncate">{child.name}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[16px] md:text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-dark text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      } ${tourClass}`}
                    >
                      <Icon size={18} className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 mt-auto space-y-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[16px] md:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 w-full transition-colors dark:text-slate-400 dark:hover:text-slate-200"
          >
            {theme === "light" ? (
              <>
                <Moon size={18} className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" />
                <span>Modo Escuro</span>
              </>
            ) : (
              <>
                <Sun size={18} className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" />
                <span>Modo Claro</span>
              </>
            )}
          </button>

          <div className="pt-1">
            <A2HSNavButton variant="sidebar" />
          </div>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[16px] md:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 w-full transition-colors"
          >
            <LogOut size={18} className="w-[20px] h-[20px] md:w-[18px] md:h-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 print:hidden transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-lg"
              title="Abrir Menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100 capitalize truncate">
              {location.pathname === "/admin" || (location.pathname.startsWith("/admin/") && location.pathname.split("/").length === 3 && ["financeiro", "comercial", "expedicao", "comercial-externo", "entrega-mercadorias"].includes(location.pathname.split("/")[2]))
                ? `Olá, ${profile?.displayName?.split(" ")[0] || "Colaborador"}`
                : location.pathname.split("/").pop()?.replace(/-/g, " ") ||
                  "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Command Palette Quick Search Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium transition-all cursor-pointer shadow-2xs group"
              title="Buscar telas, O.S., relatórios ou ações (Ctrl+K)"
            >
              <Search size={14} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
              <span className="hidden lg:inline">Buscar no sistema...</span>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700 shadow-2xs">
                Ctrl K
              </kbd>
            </button>

            {/* Mobile search icon */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs cursor-pointer"
              title="Buscar no sistema"
            >
              <Search size={18} />
            </button>

            {isAdmin && <FranqueadaSwitcher />}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsGlobalCsvModalOpen(true)}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800 transition-all flex items-center gap-1.5 shadow-2xs font-bold text-xs cursor-pointer active:scale-95"
                title="Exportar dados cadastrais do Firestore em CSV (Backup e Auditoria)"
              >
                <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            )}
            <A2HSNavButton variant="header" />

            <button
              onClick={() => {
                localStorage.removeItem("union_admin_tour_completed");
                setTourTrigger(prev => prev + 1);
              }}
              className="p-2 rounded-xl text-[#0071e3] hover:bg-[#0071e3]/10 transition-all flex items-center gap-2 border border-[#0071e3]/20 bg-white dark:bg-slate-900 shadow-xs cursor-pointer"
              title="Iniciar Tour de Boas-vindas"
            >
              <HelpCircle size={18} />
              <span className="text-xs font-bold hidden sm:inline">Tour Guiado</span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs tour-step-theme cursor-pointer"
              title={theme === "light" ? "Mudar para Modo Escuro" : "Mudar para Modo Claro"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              <span className="text-xs font-semibold hidden sm:inline">
                {theme === "light" ? "Escuro" : "Claro"}
              </span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto print:overflow-visible print:block py-4 px-2 sm:px-4 md:px-6 print:p-0 bg-slate-50 dark:bg-slate-900 print:bg-white text-black">
          <div className="w-[98%] max-w-[98%] mx-auto flex flex-col gap-4">
            <Breadcrumbs />
            <Suspense fallback={null}>
              <AfiliacaoOverdueAlert />
            </Suspense>
            <Suspense fallback={<AdminContentSkeleton />}>
              <Outlet />
            </Suspense>

            <Suspense fallback={null}>
              <GuidedTour key={tourTrigger} forceStart={tourTrigger > 0} />
              <AdminNotifications />
              <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                onOpenCsvModal={() => setIsGlobalCsvModalOpen(true)}
              />
              {isGlobalCsvModalOpen && (
                <BackupCsvModal
                  isOpen={isGlobalCsvModalOpen}
                  onClose={() => setIsGlobalCsvModalOpen(false)}
                />
              )}
            </Suspense>

            {/* Abrir Menu (visible only on mobile) */}
            <div className="md:hidden mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-center">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(true);
                }}
                className="flex items-center gap-2 text-[#0071e3] hover:text-[#0071e3]/80 font-bold text-[15px] transition-all py-2.5 px-6 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Menu size={16} />
                Abrir Menu
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
