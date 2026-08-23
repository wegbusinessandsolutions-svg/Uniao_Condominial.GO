import React, { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Home, FileText, User, ShoppingBag, MapPin, Package, Tag, Heart, CreditCard, LogOut, Book, Menu, Sun, Moon, Coins, MessageSquare, Headphones, Megaphone } from "lucide-react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function CustomerLayout() {
  const { profile, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const mainRef = useRef<HTMLElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuConfig, setMenuConfig] = useState<any>({});

  useEffect(() => {
    // Scroll smoothly to top on route change, ensuring user starts at the beginning of the view
    if (location.hash) {
      setTimeout(() => {
        const id = location.hash.replace("#", "");
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const fetchMenuConfig = async () => {
      try {
        const docRef = doc(db, "config", "client_dashboard");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMenuConfig(docSnap.data());
        }
      } catch (err) {
        console.error("Erro ao buscar configurações do dashboard do cliente", err);
      }
    };
    fetchMenuConfig();
  }, []);

  const handleLogout = () => {
    auth.signOut();
    navigate("/");
    window.location.reload();
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

  if (profile.status === "Pendente") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-4 sm:px-6 lg:px-8">
          <div className="font-bold text-xl text-brand-dark tracking-tight">WegBusiness</div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Cadastro em Análise</h2>
            <p className="text-slate-600 mb-6">
              Seu cadastro foi recebido com sucesso e está pendente de aprovação pela nossa equipe.
              Você receberá um e-mail assim que seu acesso for liberado.
            </p>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </main>
      </div>
    );
  }

  const navItems = [
    { name: "Inicial", path: "/cliente", icon: Home, end: true, key: "menuInicial" },
    { name: "Meus Dados", path: "/cliente/meus-dados", icon: User, key: "menuMeusDados" },
    { name: "Meus Pedidos", path: "/cliente/pedidos", icon: ShoppingBag, key: "menuMeusPedidos" },
    { name: "Minhas Ordens de Serviço", path: "/cliente/ordens-servico", icon: FileText, key: "menuOrdensServico" },
    { name: "Localização do Condomínio", path: "/cliente/endereco", icon: MapPin, key: "menuLocalEntrega" },
  ].filter(item => menuConfig[item.key] !== false);

  const catalogItems = [
    { name: "Produtos de Limpeza e Conservação", path: "/cliente/produtos", icon: Book, key: "menuCatalogoProdutos" },
    { name: "Serviços Condominiais Rotineiros", path: "/cliente/servicos", icon: Package, key: "menuKitsEssenciais" },
  ].filter(item => menuConfig[item.key] !== false);

  const advantageItems = [
    { name: "Cartão Virtual", path: "/cliente/cartao", icon: CreditCard, key: "menuCartaoVirtual" },
    { name: "Clube de Benefícios", path: "/cliente/beneficios", icon: Heart, key: "menuClubeBeneficios" },
    { name: "Meu Cashback", path: "/cliente/cashback", icon: Coins, key: "menuMeuCashback" },
    { name: "Marcas Parceiras", path: "/cliente/marcas", icon: Tag, key: "menuMarcasParceiras" },
  ].filter(item => menuConfig[item.key] !== false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative">
      {/* Header móvel */}
      <header className="md:hidden bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sticky top-0 z-40 w-full shrink-0">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu size={24} />
        </button>
        <div className="text-center flex-1 pt-1 px-2">
          <span className="font-bold text-slate-800 text-[17px] block leading-none notranslate" translate="no">
            União Condominial.<span className="text-emerald-600">GO</span>
          </span>
          <span className="text-[13px] text-[#0071e3] font-semibold mt-1 block leading-none">Área do Cliente</span>
        </div>
        <div className="flex items-center">
        </div>
      </header>

      {/* Backdrop para mobile drawer */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden transition-opacity"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[360px] bg-white border-r border-slate-200 text-slate-800 flex flex-col h-full transform transition-transform duration-300 ease-in-out
          md:relative md:transform-none md:z-0 md:flex md:h-auto md:min-h-screen shrink-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] text-brand-dark font-bold uppercase tracking-wider mb-1 notranslate" translate="no">
              União Condominial.<span className="text-emerald-600">GO</span>
            </h2>
            <h3 className="text-[22px] font-bold text-slate-900 leading-tight">Área do Cliente</h3>
            <p className="text-[18px] font-bold text-[#0071e3] mt-2 whitespace-normal break-words leading-tight" title={profile?.displayName}>
              {profile?.displayName}
            </p>
          </div>
          <div className="hidden md:flex">
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <div>
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.path}
                    end={item.end}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2 rounded-lg text-[15px] transition-colors ${
                        isActive ? "bg-brand-light/10 text-brand-dark font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          {catalogItems.length > 0 && (
            <div>
              <h4 className="px-3 text-[13px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Catálogo</h4>
              <ul className="space-y-0.5">
                {catalogItems.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg text-[15px] transition-colors ${
                          isActive ? "bg-brand-light/10 text-brand-dark font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="whitespace-nowrap">{item.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {advantageItems.length > 0 && (
            <div>
              <h4 className="px-3 text-[13px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Vantagens</h4>
              <ul className="space-y-0.5">
                {advantageItems.map((item) => (
                  <li key={item.name}>
                    <NavLink
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2 rounded-lg text-[15px] transition-colors ${
                          isActive ? "bg-brand-light/10 text-brand-dark font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="whitespace-nowrap">{item.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 mt-auto space-y-1">
          <NavLink
            to="/cliente#mural"
            onClick={() => {
              setIsMobileMenuOpen(false);
              const element = document.getElementById("mural");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-lg text-[15px] transition-colors ${
                location.pathname === "/cliente" && location.hash === "#mural"
                  ? "bg-brand-light/10 text-brand-dark font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Megaphone className="w-4 h-4 text-emerald-600" />
            <span className="whitespace-nowrap">Mural Condominial - Público</span>
          </NavLink>

          <NavLink
            to="/cliente/suporte"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-lg text-[15px] transition-colors ${
                isActive ? "bg-brand-light/10 text-brand-dark font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`
            }
          >
            <Headphones className="w-4 h-4 text-[#0071e3]" />
            <span className="whitespace-nowrap">Fale Conosco - Suporte</span>
          </NavLink>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleLogout();
            }}
            className="flex items-center space-x-3 px-3 py-2 w-full text-slate-600 hover:bg-slate-50 hover:text-red-600 rounded-lg transition-colors text-[15px] font-medium cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main ref={mainRef} className="flex-1 py-4 px-2 sm:px-4 md:px-6 flex flex-col justify-between min-w-0">
        <div className="w-[98%] max-w-[98%] mx-auto flex-1">
          <Outlet />
        </div>

        {/* Voltar ao Menu Superior (visible only on mobile) */}
        {/* Abrir Menu (visible only on mobile) */}
        <div className="md:hidden mt-12 pt-6 border-t border-slate-200 flex justify-center">
          <button
            onClick={() => {
              setIsMobileMenuOpen(true);
            }}
            className="flex items-center gap-2 text-[#0071e3] hover:text-[#0071e3]/80 font-bold text-[15px] transition-all py-2.5 px-6 bg-white rounded-full shadow-sm border border-slate-200 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Menu size={16} />
            Abrir Menu
          </button>
        </div>
      </main>
    </div>
  );
}
