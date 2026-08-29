import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  LayoutDashboard,
  FileText,
  Package,
  Users,
  DollarSign,
  Building2,
  Truck,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Wallet,
  Boxes,
  Database,
  Mail,
  Route,
  Coins,
  FileSpreadsheet,
  Sun,
  Moon,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface SearchableItem {
  id: string;
  name: string;
  category: "Navegação" | "Comercial" | "Financeiro" | "Expedição" | "Operações & OS" | "Ações Rápidas" | "Configurações";
  path?: string;
  action?: () => void;
  icon: React.ElementType;
  keywords?: string[];
  badge?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCsvModal?: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenCsvModal }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
          const event = new CustomEvent("open-command-palette");
          window.dispatchEvent(event);
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const allItems: SearchableItem[] = useMemo(() => {
    return [
      // Quick Actions
      {
        id: "action-csv",
        name: "Exportar Dados e Auditoria em CSV",
        category: "Ações Rápidas",
        action: () => onOpenCsvModal && onOpenCsvModal(),
        icon: FileSpreadsheet,
        keywords: ["exportar", "csv", "backup", "planilha", "excel", "download"],
        badge: "Auditoria",
      },
      {
        id: "action-theme",
        name: theme === "light" ? "Alternar para Modo Escuro" : "Alternar para Modo Claro",
        category: "Ações Rápidas",
        action: () => toggleTheme(),
        icon: theme === "light" ? Moon : Sun,
        keywords: ["tema", "escuro", "claro", "dark", "light", "modo", "cor"],
      },
      {
        id: "action-new-os",
        name: "Gerenciar & Emitir Ordens de Serviço",
        category: "Operações & OS",
        path: "/admin/comercial/ordens-servico",
        icon: FileText,
        keywords: ["os", "ordem", "serviço", "rotineiro", "atendimento", "novo"],
        badge: "Atalho",
      },
      {
        id: "action-execucao-os",
        name: "Execução de Serviços em Campo (Técnico)",
        category: "Operações & OS",
        path: "/admin/comercial/execucao-servicos",
        icon: CheckCircle2,
        keywords: ["execucao", "campo", "tecnico", "fotos", "assinatura", "gps"],
      },
      {
        id: "action-monitoria-os",
        name: "Painel de Monitoria & SLA Operacional",
        category: "Operações & OS",
        path: "/admin/comercial/monitoria-servicos",
        icon: Clock,
        keywords: ["monitoria", "sla", "tempos", "auditoria", "atrasos", "deslocamento"],
        badge: "Novo",
      },

      // Dashboards & Navigation
      {
        id: "nav-dashboard",
        name: "Dashboard Executivo Principal",
        category: "Navegação",
        path: "/admin",
        icon: LayoutDashboard,
        keywords: ["painel", "resumo", "metricas", "kpis", "graficos"],
      },
      {
        id: "nav-comercial-dash",
        name: "Dashboard Comercial",
        category: "Comercial",
        path: "/admin/comercial",
        icon: LayoutDashboard,
        keywords: ["comercial", "vendas", "faturamento"],
      },
      {
        id: "nav-produtos",
        name: "Catálogo de Produtos & Estoque",
        category: "Comercial",
        path: "/admin/produtos",
        icon: Package,
        keywords: ["produtos", "catalogo", "itens", "preço", "sku"],
      },
      {
        id: "nav-clientes",
        name: "Cadastro de Clientes & Condomínios",
        category: "Comercial",
        path: "/admin/comercial/clientes",
        icon: Users,
        keywords: ["clientes", "condominio", "morador", "sindico", "cadastro"],
      },
      {
        id: "nav-vendas",
        name: "Acompanhamento de Vendas",
        category: "Comercial",
        path: "/admin/acompanhamento-venda",
        icon: ShieldCheck,
        keywords: ["vendas", "pedidos", "status", "afiliados"],
      },
      {
        id: "nav-comissoes",
        name: "Gestão de Comissões",
        category: "Comercial",
        path: "/admin/comercial/comissoes",
        icon: DollarSign,
        keywords: ["comissao", "vendedor", "afiliado", "pagamento"],
      },
      {
        id: "nav-servicos-rotineiros",
        name: "Serviços Condominiais Rotineiros",
        category: "Comercial",
        path: "/admin/comercial/servicos",
        icon: Package,
        keywords: ["servicos", "manutencao", "limpeza", "portaria", "conservacao"],
      },

      // Financeiro
      {
        id: "nav-financeiro-dash",
        name: "Dashboard Financeiro",
        category: "Financeiro",
        path: "/admin/financeiro",
        icon: Wallet,
        keywords: ["financeiro", "fluxo", "caixa", "dre", "balanco"],
      },
      {
        id: "nav-contas-receber",
        name: "Contas a Receber & Boletos",
        category: "Financeiro",
        path: "/admin/financeiro/receber",
        icon: DollarSign,
        keywords: ["receber", "boletos", "faturas", "inadimplencia"],
      },
      {
        id: "nav-contas-pagar",
        name: "Contas a Pagar & Despesas",
        category: "Financeiro",
        path: "/admin/financeiro/pagar",
        icon: CreditCard,
        keywords: ["pagar", "despesas", "custos", "contas"],
      },
      {
        id: "nav-bancos",
        name: "Bancos & Conciliação",
        category: "Financeiro",
        path: "/admin/financeiro/bancos",
        icon: Building2,
        keywords: ["bancos", "contas", "saldo", "extrato"],
      },
      {
        id: "nav-cashback",
        name: "Controle & Resgates de Cashback",
        category: "Financeiro",
        path: "/admin/financeiro/controle-cashback",
        icon: Coins,
        keywords: ["cashback", "pontos", "saldo", "recompensas"],
      },

      // Expedição & Logística
      {
        id: "nav-logistica",
        name: "Logística & Roteirização Inteligente",
        category: "Expedição",
        path: "/admin/expedicao/logistica-roteirizacao",
        icon: Route,
        keywords: ["logistica", "rotas", "entregador", "mapa", "roteirizacao"],
        badge: "GPS",
      },
      {
        id: "nav-expedicao-dash",
        name: "Dashboard de Expedição",
        category: "Expedição",
        path: "/admin/expedicao",
        icon: Truck,
        keywords: ["expedicao", "envios", "separacao", "estoque"],
      },
      {
        id: "nav-estoque",
        name: "Estoque & Compras",
        category: "Expedição",
        path: "/admin/expedicao/estoque",
        icon: Boxes,
        keywords: ["estoque", "compras", "fornecedor", "reposicao"],
      },

      // Configurações & Franqueadora
      {
        id: "nav-franqueadora",
        name: "Gestão Franqueadora & Royalties",
        category: "Configurações",
        path: "/admin/franqueadora",
        icon: Building2,
        keywords: ["franqueadora", "royalties", "unidades", "franquias"],
      },
      {
        id: "nav-empresa",
        name: "Cadastro da Empresa & Identidade",
        category: "Configurações",
        path: "/admin/empresa",
        icon: Building2,
        keywords: ["empresa", "dados", "cnpj", "logo", "contato"],
      },
      {
        id: "nav-colaboradores",
        name: "Empregados & Equipe Técnica",
        category: "Configurações",
        path: "/admin/empregados",
        icon: Users,
        keywords: ["empregados", "funcionarios", "colaboradores", "tecnicos"],
      },
      {
        id: "nav-notificacoes",
        name: "Configuração de E-mails & WhatsApp",
        category: "Configurações",
        path: "/admin/configuracao-notificacoes",
        icon: Mail,
        keywords: ["email", "whatsapp", "notificacoes", "templates", "sms"],
      },
      {
        id: "nav-relatorios",
        name: "Central de Relatórios & BI",
        category: "Configurações",
        path: "/admin/relatorios",
        icon: BarChart3,
        keywords: ["relatorios", "bi", "exportar", "analise", "desempenho"],
      },
      {
        id: "nav-backup",
        name: "Backup & Manutenção de Dados",
        category: "Configurações",
        path: "/admin/backup-exportacao",
        icon: Database,
        keywords: ["backup", "seguranca", "exportar", "dados"],
      },
    ];
  }, [theme, toggleTheme, onOpenCsvModal]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems.slice(0, 10);
    }
    const clean = query.toLowerCase().trim();
    return allItems.filter((item) => {
      const matchName = item.name.toLowerCase().includes(clean);
      const matchCategory = item.category.toLowerCase().includes(clean);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(clean));
      return matchName || matchCategory || matchKeywords;
    });
  }, [query, allItems]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleSelect = (item: SearchableItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh] transition-all transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <Search size={20} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite para buscar qualquer tela, O.S., ação rápida ou relatório..."
            className="w-full bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm font-medium focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-semibold text-slate-400 bg-slate-200/70 dark:bg-slate-800 rounded-md border border-slate-300/50 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Sparkles size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhum resultado encontrado para "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Tente pesquisar por palavras-chave como "vendas", "os", "relatório" ou "clientes".</p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/40 text-[#0071e3] font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#0071e3] text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate font-medium text-slate-900 dark:text-slate-100">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/60 text-[#0071e3] dark:text-blue-300">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {item.category} {item.path ? `• ${item.path}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {isSelected && (
                      <span className="flex items-center gap-1 text-xs text-[#0071e3] font-bold animate-in fade-in">
                        Acessar <ArrowRight size={14} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Guide */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-bold">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-bold">↓</kbd> Navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-bold">↵</kbd> Abrir
            </span>
          </div>
          <span className="text-slate-400 font-medium">
            Atalho global: <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-bold">Ctrl + K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
