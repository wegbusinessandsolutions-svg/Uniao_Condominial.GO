import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbsProps {
  customItems?: { label: string; path?: string }[];
}

const ROUTE_NAME_MAP: Record<string, string> = {
  admin: "Início",
  comercial: "Comercial",
  financeiro: "Financeiro",
  expedicao: "Expedição",
  "ordens-servico": "Ordens de Serviço",
  "execucao-servicos": "Execução de Serviços em Campo",
  "monitoria-servicos": "Monitoria & SLA",
  produtos: "Produtos",
  clientes: "Clientes",
  "acompanhamento-venda": "Acompanhamento de Venda",
  comissoes: "Comissões",
  servicos: "Serviços Condominiais",
  visitas: "Visitas",
  categorias: "Categorias",
  "codigos-indicacao": "Códigos de Indicação",
  afiliados: "Controle de Afiliados",
  calculadora: "Calculadora de Preços",
  "comercial-externo": "Comercial Externo",
  "logistica-roteirizacao": "Logística & Roteirização",
  entregas: "Entregas",
  estoque: "Estoque & Compras",
  "pedidos-online": "Pedidos Online",
  "entrega-mercadorias": "Entrega de Mercadorias",
  pagar: "Contas a Pagar",
  receber: "Contas a Receber",
  "controle-cashback": "Controle de Cashback",
  faturamento: "Faturamento",
  fornecedores: "Fornecedores",
  bancos: "Bancos",
  "centros-custo": "Centros de Custo",
  franqueadora: "Franqueadora",
  empresa: "Empresa",
  empregados: "Empregados",
  "clube-beneficios": "Clube de Benefícios",
  "configuracao-frete": "Configuração de Frete",
  "integracao-pagamentos": "Integração Pagamentos",
  "marcas-parceiras": "Marcas Parceiras",
  "mural-condominial": "Mural Condominial",
  "permissoes-usuario": "Permissões de Usuário",
  cashback: "Regras de Cashback",
  relatorios: "Relatórios",
  usuarios: "Usuários",
  "backup-exportacao": "Backup & Exportação",
  "configuracao-notificacoes": "Notificações",
  manutencao: "Manutenção",
};

export function Breadcrumbs({ customItems }: BreadcrumbsProps) {
  const location = useLocation();

  if (customItems && customItems.length > 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-4 overflow-x-auto py-1">
        <ol className="flex items-center gap-1.5 whitespace-nowrap">
          <li className="flex items-center">
            <Link to="/admin" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1">
              <Home size={13} />
            </Link>
          </li>
          {customItems.map((item, index) => {
            const isLast = index === customItems.length - 1;
            return (
              <li key={index} className="flex items-center gap-1.5">
                <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
                {item.path && !isLast ? (
                  <Link to={item.path} className="hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className={`font-semibold ${isLast ? "text-slate-900 dark:text-slate-100" : ""}`}>
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Automatic path generator
  const pathSegments = location.pathname.split("/").filter(Boolean);
  if (pathSegments.length <= 1 && pathSegments[0] === "admin") {
    return null; // Root admin dashboard does not need breadcrumbs
  }

  let accumulatedPath = "";
  const items = pathSegments.map((segment) => {
    accumulatedPath += `/${segment}`;
    return {
      label: ROUTE_NAME_MAP[segment] || segment.replace(/-/g, " "),
      path: accumulatedPath,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-xs text-slate-500 dark:text-slate-400 mb-3 overflow-x-auto py-0.5">
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        <li className="flex items-center">
          <Link
            to="/admin"
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
            title="Início"
          >
            <Home size={13} />
            <span className="hidden sm:inline">Início</span>
          </Link>
        </li>
        {items.slice(1).map((item, index, arr) => {
          const isLast = index === arr.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
              {isLast ? (
                <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.path}
                  className="hover:text-slate-900 dark:hover:text-slate-100 font-medium transition-colors capitalize"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
export default Breadcrumbs;
