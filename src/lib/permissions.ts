/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LucideIcon } from "lucide-react";

export interface NavSubItem {
  name: string;
  path?: string;
  icon?: LucideIcon;
  children?: NavSubItem[];
}

export interface NavGroup {
  title: string;
  items: NavSubItem[];
}

export interface ModulePermission {
  visible: boolean;
  submodules: Record<string, boolean>;
}

export type PermissionsMap = Record<string, ModulePermission>;

/**
 * Normalizes role string for consistent matching
 */
export function normalizeRole(role?: string): string {
  return (role || "").toLowerCase().trim();
}

/**
 * Checks if the role represents a staff/collaborator (non-client)
 */
export function isStaffRole(role?: string): boolean {
  const r = normalizeRole(role);
  if (!r || r === "cliente" || r === "customer") return false;
  return [
    "administrador",
    "admin",
    "master",
    "financeiro",
    "comercial",
    "comercial externo",
    "vendedor externo",
    "expedição",
    "expedicao",
    "estoquista",
    "entregador",
  ].includes(r);
}

/**
 * Checks if the role is Administrator
 */
export function isAdminRole(role?: string): boolean {
  const r = normalizeRole(role);
  return ["administrador", "admin", "master"].includes(r);
}

/**
 * Returns the specific dedicated Dashboard route for each user profile.
 */
export function getDefaultDashboardForRole(role?: string): string {
  const r = normalizeRole(role);
  
  if (["administrador", "admin", "master"].includes(r)) {
    return "/admin";
  }
  if (r === "financeiro") {
    return "/admin/financeiro";
  }
  if (r === "comercial") {
    return "/admin/comercial";
  }
  if (r === "comercial externo" || r === "vendedor externo") {
    return "/admin/comercial-externo";
  }
  if (r === "entregador") {
    return "/admin/entrega-mercadorias";
  }
  if (r === "expedição" || r === "expedicao" || r === "estoquista") {
    return "/admin/expedicao";
  }
  
  return "/cliente";
}

/**
 * Returns a human-friendly label for the user's Dashboard
 */
export function getRoleDashboardTitle(role?: string): string {
  const r = normalizeRole(role);
  if (["administrador", "admin", "master"].includes(r)) {
    return "Dashboard - Geral Administrativo";
  }
  if (r === "financeiro") {
    return "Dashboard - Financeiro";
  }
  if (r === "comercial") {
    return "Dashboard - Comercial";
  }
  if (r === "comercial externo" || r === "vendedor externo") {
    return "Dashboard - Comercial Externo";
  }
  if (r === "entregador") {
    return "Dashboard - Entrega de Mercadorias";
  }
  if (r === "expedição" || r === "expedicao" || r === "estoquista") {
    return "Dashboard - Expedição";
  }
  return "Portal do Cliente";
}

/**
 * Default permission matrix mapped strictly by role
 */
export function getDefaultPermissionsMapForRole(role?: string): PermissionsMap {
  const r = normalizeRole(role);

  if (["administrador", "admin", "master"].includes(r)) {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Dashboard": true,
          "Manutenção de Dados": true,
          "Franqueadora": true,
          "Franqueada - Empresa": true,
          "Backup e Exportação": true,
          "Configuração E-mails e Mensagens": true,
          
          // Submodules under Franqueada - Empresa
          "Cadastro Empresa Franqueada": true,
          "Clube de Benefícios": true,
          "Comercial": true,
          "Configuração de Frete": true,
          "Empregados/Colaboradores": true,
          "Expedição": true,
          "Financeiro": true,
          "Integração Pagamentos": true,
          "Marcas Parceiras": true,
          "Mural Condominial": true,
          "Permissões de Usuário": true,
          "Regras de Cashback": true,
          "Relatórios": true,
          "Usuários": true,

          // Financeiro Submodules
          "Bancos": true,
          "Centro de Custo - Lucro": true,
          "Contas a Pagar": true,
          "Contas a Receber": true,
          "Controle de Cashback": true,
          "Dashboard - Financeiro": true,
          "Faturamento": true,
          "Fornecedores": true,
          "Extrato de Cashback": true,
          "Conciliação Bancária": true,

          // Comercial Submodules
          "Acompanhamento de Venda": true,
          "Calculadora de Preços": true,
          "Categorias de Produtos": true,
          "Clientes": true,
          "Códigos de Indicação": true,
          "Comissões": true,
          "Controle de Afiliados U.C.": true,
          "Dashboard - Comercial": true,
          "Dashboard - Comercial Externo": true,
          "Ordens de Serviço": true,
          "Produtos": true,
          "Serviços Condominiais Rotineiros": true,
          "Visitas ao Cliente": true,

          // Expedição Submodules
          "Dashboard - Entrega de Mercadorias": true,
          "Dashboard - Expedição": true,
          "Logística e Roteirização": true,
          "Entregas": true,
          "Estoque – Compras": true,
          "Pedidos Online": true,

          // Permissões de Usuário Submodules
          "Dashboard - Cliente": true,
        },
      },
    };
  }

  if (r === "financeiro") {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Franqueada - Empresa": true,
          "Financeiro": true,
          "Bancos": true,
          "Centro de Custo - Lucro": true,
          "Contas a Pagar": true,
          "Contas a Receber": true,
          "Controle de Cashback": true,
          "Dashboard - Financeiro": true,
          "Faturamento": true,
          "Fornecedores": true,
          "Extrato de Cashback": true,
          "Conciliação Bancária": true,
        },
      },
    };
  }

  if (r === "comercial") {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Franqueada - Empresa": true,
          "Comercial": true,
          "Acompanhamento de Venda": true,
          "Calculadora de Preços": true,
          "Categorias de Produtos": true,
          "Clientes": true,
          "Códigos de Indicação": true,
          "Comissões": true,
          "Controle de Afiliados U.C.": true,
          "Dashboard - Comercial": true,
          "Dashboard - Comercial Externo": true,
          "Ordens de Serviço": true,
          "Produtos": true,
          "Serviços Condominiais Rotineiros": true,
          "Visitas ao Cliente": true,
        },
      },
    };
  }

  if (r === "comercial externo" || r === "vendedor externo") {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Franqueada - Empresa": true,
          "Comercial": true,
          "Dashboard - Comercial Externo": true,
          "Visitas ao Cliente": true,
          "Clientes": true,
          "Ordens de Serviço": true,
        },
      },
    };
  }

  if (r === "entregador") {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Franqueada - Empresa": true,
          "Expedição": true,
          "Dashboard - Entrega de Mercadorias": true,
          "Logística e Roteirização": true,
          "Entregas": true,
        },
      },
    };
  }

  if (r === "expedição" || r === "expedicao" || r === "estoquista") {
    return {
      Admin: {
        visible: true,
        submodules: {
          "Franqueada - Empresa": true,
          "Expedição": true,
          "Dashboard - Expedição": true,
          "Dashboard - Entrega de Mercadorias": true,
          "Logística e Roteirização": true,
          "Entregas": true,
          "Estoque – Compras": true,
          "Pedidos Online": true,
          "Ordens de Serviço": true,
          "Produtos": true,
        },
      },
    };
  }

  return {
    Admin: { visible: false, submodules: {} },
  };
}

export function isUserAuthorizedForPath(pathname: string, role?: string, permissions?: any): boolean {
  const r = normalizeRole(role);
  
  // Superadmin / Admin has unrestricted access
  if (isAdminRole(role)) {
    return true;
  }

  // Not logged in or client trying to access admin
  if (!isStaffRole(role)) {
    return false;
  }

  const cleanPath = pathname.replace(/\/$/, "");

  // Root /admin is exclusively the Admin Dashboard
  if (cleanPath === "/admin") {
    return false;
  }

  // Sector-based path authorizations
  if (cleanPath.startsWith("/admin/financeiro")) {
    return r === "financeiro";
  }

  if (cleanPath === "/admin/comercial-externo" || cleanPath === "/admin/comercial/externo") {
    return ["comercial externo", "vendedor externo", "comercial"].includes(r);
  }

  if (cleanPath.startsWith("/admin/comercial")) {
    if (r === "comercial externo" || r === "vendedor externo") {
      // External sales can only access visitas, clientes, ordens-servico
      return (
        cleanPath.includes("/visitas") ||
        cleanPath.includes("/clientes") ||
        cleanPath.includes("/ordens-servico") ||
        cleanPath.includes("/externo")
      );
    }
    return r === "comercial";
  }

  if (cleanPath === "/admin/entrega-mercadorias" || cleanPath === "/admin/logistica-roteirizacao") {
    return ["entregador", "expedição", "expedicao", "estoquista"].includes(r);
  }

  if (cleanPath.startsWith("/admin/expedicao")) {
    if (r === "entregador") {
      return cleanPath.includes("/entregas") || cleanPath.includes("/logistica-roteirizacao");
    }
    return ["expedição", "expedicao", "estoquista"].includes(r);
  }

  if (cleanPath === "/admin/produtos") {
    return ["comercial", "expedição", "expedicao", "estoquista"].includes(r);
  }

  return false;
}

/**
 * Recursively filters items and their nested sub-items according to active permissions
 */
function filterNavSubItems(
  items: NavSubItem[],
  groupPerm: ModulePermission,
  defaultGroupPerm: ModulePermission | undefined,
  isAdmin: boolean
): NavSubItem[] {
  return items
    .map((item) => {
      // If Admin Dashboard at /admin, only admins see it
      if (item.name === "Dashboard" && item.path === "/admin") {
        if (!isAdmin) return null;
      }

      // Check if item is permitted
      const isItemAllowed =
        groupPerm.submodules && typeof groupPerm.submodules[item.name] !== "undefined"
          ? groupPerm.submodules[item.name] === true
          : defaultGroupPerm?.submodules?.[item.name] === true;

      // Filter children recursively if present
      if (item.children && item.children.length > 0) {
        const filteredChildren = filterNavSubItems(
          item.children,
          groupPerm,
          defaultGroupPerm,
          isAdmin
        );

        // If all children were filtered out and this item has no path, hide it
        if (filteredChildren.length === 0 && !item.path) {
          return null;
        }

        // If parent item is explicitly marked false in custom perms, hide it
        if (isItemAllowed === false) {
          return null;
        }

        // If allowed or has valid child submodules
        if (isItemAllowed || filteredChildren.length > 0) {
          return { ...item, children: filteredChildren };
        }

        return null;
      }

      if (!isItemAllowed) {
        return null;
      }

      return item;
    })
    .filter(Boolean) as NavSubItem[];
}

/**
 * Filter the sidebar navigation groups to show ONLY items the user is authorized to see,
 * discarding all unauthorized groups and submodules.
 */
export function getFilteredNavGroups(
  allGroups: NavGroup[],
  userRole?: string,
  userPermissions?: any
): NavGroup[] {
  const isAdmin = isAdminRole(userRole);
  const defaultPerms = getDefaultPermissionsMapForRole(userRole);
  const hasCustomPerms = !!userPermissions && typeof userPermissions === "object" && Object.keys(userPermissions).length > 0;

  return allGroups
    .map((group) => {
      // Get the effective group permission
      let groupPerm = defaultPerms[group.title];
      if (hasCustomPerms && userPermissions[group.title]) {
        groupPerm = userPermissions[group.title];
      }

      // If group is not marked as visible (or not authorized), hide the entire group
      if (!groupPerm || groupPerm.visible !== true) {
        return null;
      }

      // Filter subitems recursively in this group
      const filteredItems = filterNavSubItems(
        group.items,
        groupPerm,
        defaultPerms[group.title],
        isAdmin
      );

      // If all items in this group were filtered out, hide the entire group header
      if (filteredItems.length === 0) {
        return null;
      }

      return {
        ...group,
        items: filteredItems,
      };
    })
    .filter(Boolean) as NavGroup[];
}
