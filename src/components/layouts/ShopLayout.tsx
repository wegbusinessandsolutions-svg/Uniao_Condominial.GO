import React, { useState, useEffect } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { ShoppingCart, Menu, Search, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { LegalModal } from "../common/LegalModal";

export default function ShopLayout() {
  const { profile } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy">("terms");

  const openLegalModal = (tab: "terms" | "privacy") => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/produtos?search=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 text-[15px] sm:text-[16px] w-full overflow-x-hidden">
      {/* Top Banner */}
      <div className="bg-brand-dark text-white text-xs sm:text-sm py-2 px-4 text-center font-semibold tracking-wide shadow-xs w-full">
        Frete grátis nas compras acima de R$ 300,00 para a capital.
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs w-full">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <Link
              to="/"
              className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-1 shrink-0 notranslate" translate="no"
            >
              <span className="font-semibold text-slate-900 italic tracking-tight">União</span>{" "}
              <span className="font-bold text-[#0071e3] italic tracking-tight">Condominial.</span>
              <span className="font-bold text-emerald-600 italic tracking-tight">GO</span>
            </Link>
          </div>

          {/* Search bar on desktop / tablets */}
          <div className="hidden md:flex flex-1 max-w-md lg:max-w-lg mx-2 lg:mx-6 min-w-0">
            <form onSubmit={handleSearch} className="w-full relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar produtos de limpeza..."
                className="w-full bg-slate-100 border border-transparent hover:border-slate-300 focus:border-[#0071e3] rounded-full py-2 pl-10 pr-4 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
              <Search
                className="absolute left-3.5 top-2.5 text-slate-400"
                size={16}
              />
            </form>
          </div>

          {/* User actions / Cart */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {profile ? (
              <Link
                to="/minha-conta"
                className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 hover:text-brand-dark transition-colors py-1.5 px-2 sm:px-2.5 rounded-xl hover:bg-slate-50 shrink-0"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 text-[#0071e3] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                  <User size={16} />
                </div>
                <div className="text-left leading-tight hidden xs:block">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[140px]">
                    Olá, {profile.displayName?.split(" ")[0] || "Cliente"}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-brand-dark font-semibold">
                    Nível {profile.level}
                  </p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Link
                  to="/minha-conta"
                  className="text-xs sm:text-sm font-bold text-slate-700 hover:text-[#0071e3] px-2 sm:px-3 py-1.5 sm:py-2 transition-colors whitespace-nowrap"
                >
                  Entrar
                </Link>
                <Link
                  to="/minha-conta?signup=true"
                  className="bg-[#0071e3] hover:bg-[#005bb5] text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all shadow-xs hover:shadow whitespace-nowrap"
                >
                  Cadastro
                </Link>
              </div>
            )}
            <Link
              to="/carrinho"
              className="relative p-2 text-slate-700 hover:text-[#0071e3] transition-colors rounded-full hover:bg-slate-100 shrink-0"
              title="Ver Carrinho"
            >
              <ShoppingCart size={20} className="sm:w-[22px] sm:h-[22px]" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#0071e3] text-white text-[10px] sm:text-[11px] font-bold h-4.5 w-4.5 sm:h-5 sm:w-5 min-w-[18px] sm:min-w-[20px] flex items-center justify-center rounded-full shadow-xs px-0.5">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-12 mt-auto text-slate-600 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
            {/* Left Column */}
            <div className="space-y-6">
              <Link to="/" className="inline-block text-2xl sm:text-3xl italic tracking-tight notranslate" translate="no">
                <span className="font-black text-slate-900">União</span>{" "}
                <span className="font-bold text-[#0071e3]">Condominial.</span>
                <span className="font-bold text-emerald-600">GO</span>
              </Link>
              
              <div className="space-y-1.5">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">Endereço</h4>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">Rua 4, n. 515, Edif. Parthenon Center Sala 1414 - Setor Central, Goiânia Goiás</p>
              </div>
            </div>

            {/* Middle Column */}
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Sobre Nós</h4>
              <ul className="space-y-3.5 text-sm sm:text-base">
                <li>
                  <Link to="/produtos" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Produtos</Link>
                </li>
                <li>
                  <Link to="/cliente/servicos" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Serviços Condominiais Rotineiros</Link>
                </li>
                <li>
                  <Link to="/sobre" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Sobre a U.C.</Link>
                </li>
              </ul>
            </div>

            {/* Right Column */}
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Atendimento</h4>
              <ul className="space-y-3.5 text-sm sm:text-base">
                <li>
                  <Link to="/cliente/cashback" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Cashback</Link>
                </li>
                <li>
                  <Link to="/minha-conta" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Minha conta</Link>
                </li>
                <li>
                  <Link to="/contato" className="text-slate-600 hover:text-brand-dark transition-colors font-medium">Contato</Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500 font-medium">
            <div className="notranslate" translate="no">
              © 2026 União Condominial.GO. Todos os direitos reservados.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <button 
                onClick={() => openLegalModal("privacy")} 
                className="hover:text-[#0071e3] transition-colors cursor-pointer"
              >
                Política de privacidade
              </button>
              <span className="text-slate-300">•</span>
              <button 
                onClick={() => openLegalModal("terms")} 
                className="hover:text-[#0071e3] transition-colors cursor-pointer"
              >
                Termos de serviço
              </button>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-slate-400 hidden sm:inline">LGPD em Conformidade</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Standardized Terms and Privacy Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        initialTab={legalModalTab}
        onClose={() => setIsLegalModalOpen(false)}
      />
    </div>
  );
}
