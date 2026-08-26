/**
 * Utilitários centralizados de Controle de Acesso e Isolamento de Dados Franqueadora ↔ Franqueadas
 * 
 * Regra de Negócio:
 * - Usuário Franqueadora (Master/Matriz): Visualiza todos os dados consolidados (sem filtro quando "ALL")
 *   ou pode selecionar uma unidade específica.
 * - Usuário Franqueada (Filial): Possui filtro rígido automático (RBP - Role-Based Partitioning).
 *   Acessa estritamente apenas seus próprios dados cadastrais e financeiros em todas as operações (CRUD).
 */

export interface FranqueadaMatchable {
  franqueadaId?: string;
  codigoUnidade?: string;
  unidadeId?: string;
  empresaId?: string;
  numeroFranqueada?: string;
  franqueada?: {
    id?: string;
    codigoUnidade?: string;
  };
  [key: string]: any;
}

/**
 * Determina se o usuário logado pertence à Franqueadora (Matriz/Master com acesso global)
 */
export function isFranqueadoraUser(profile: any, userEmail?: string | null): boolean {
  if (!profile && !userEmail) return true; // Default fallback permissivo para inicialização

  const email = (profile?.email || userEmail || "").toLowerCase();
  
  // Super Admin da plataforma sempre é Franqueadora Master
  if (email === "wegbusinessandsolutions@gmail.com") return true;

  // Verificação explícita de flag
  if (profile?.isFranqueadora === true) return true;
  if (profile?.tipoAcesso === "Franqueadora") return true;

  // Se tem código de unidade ou ID de franqueada específico e não é "ALL" nem "MATRIZ", é Franqueada
  const codigo = (profile?.codigoUnidade || profile?.franqueadaId || "").trim().toUpperCase();
  if (codigo && codigo !== "ALL" && codigo !== "TODAS" && codigo !== "MATRIZ" && codigo !== "MASTER") {
    return false;
  }

  // Se o cargo for Administrador sem unidade restrita
  if (profile?.role === "Administrador" || profile?.role === "admin") {
    return true;
  }

  // Usuários com unidade definida são Franqueadas
  if (profile?.codigoUnidade || profile?.franqueadaId) {
    return false;
  }

  return true;
}

/**
 * Retorna o identificador/código da unidade vinculado ao perfil do usuário
 */
export function getUserFranqueadaCode(profile: any): string {
  if (!profile) return "";
  return (profile.codigoUnidade || profile.franqueadaId || "").trim();
}

/**
 * Verifica se um registro pertence à unidade alvo
 */
export function matchesFranqueadaScope(
  item: FranqueadaMatchable | null | undefined,
  targetUnidade: string | null | undefined,
  franqueadasList: any[] = []
): boolean {
  if (!targetUnidade || targetUnidade === "ALL" || targetUnidade === "TODAS") {
    return true; // Sem filtro para visualização global da Franqueadora
  }

  if (!item) return false;

  const targetClean = targetUnidade.trim().toUpperCase();

  // Encontrar códigos/IDs equivalentes na lista de franqueadas conhecidas
  const matchingFrq = franqueadasList.find(
    (f) =>
      f.id === targetUnidade ||
      f.codigoUnidade?.toUpperCase() === targetClean ||
      f.cnpj === targetUnidade
  );

  const validTargets = new Set<string>([targetClean, targetUnidade]);
  if (matchingFrq) {
    if (matchingFrq.id) validTargets.add(matchingFrq.id);
    if (matchingFrq.codigoUnidade) validTargets.add(matchingFrq.codigoUnidade.toUpperCase());
    if (matchingFrq.cnpj) validTargets.add(matchingFrq.cnpj);
  }

  // Verificar campos do item
  const itemFrqId = item.franqueadaId?.trim();
  const itemCodigo = item.codigoUnidade?.trim().toUpperCase();
  const itemUnidadeId = item.unidadeId?.trim();
  const itemEmpresaId = item.empresaId?.trim();
  const itemNumero = item.numeroFranqueada?.trim().toUpperCase();
  const itemNestedCode = item.franqueada?.codigoUnidade?.trim().toUpperCase();
  const itemNestedId = item.franqueada?.id?.trim();

  if (itemFrqId && validTargets.has(itemFrqId)) return true;
  if (itemCodigo && validTargets.has(itemCodigo)) return true;
  if (itemUnidadeId && validTargets.has(itemUnidadeId)) return true;
  if (itemEmpresaId && validTargets.has(itemEmpresaId)) return true;
  if (itemNumero && validTargets.has(itemNumero)) return true;
  if (itemNestedCode && validTargets.has(itemNestedCode)) return true;
  if (itemNestedId && validTargets.has(itemNestedId)) return true;

  return false;
}

/**
 * Filtra uma lista de registros aplicando a política Franqueadora ↔ Franqueada
 */
export function applyFranqueadaDataFilter<T extends FranqueadaMatchable>(
  items: T[],
  profile: any,
  selectedUnidade: string = "ALL",
  franqueadasList: any[] = []
): T[] {
  const isMaster = isFranqueadoraUser(profile);

  if (isMaster) {
    // Se usuário for da Franqueadora e selecionou "ALL", remove totalmente o filtro
    if (!selectedUnidade || selectedUnidade === "ALL" || selectedUnidade === "TODAS") {
      return items;
    }
    // Se for da Franqueadora e escolheu uma unidade no dropdown, filtra pela unidade escolhida
    return items.filter((item) => matchesFranqueadaScope(item, selectedUnidade, franqueadasList));
  }

  // Se o usuário for de uma Franqueada, adiciona o filtro RÍGIDO da sua própria franquia
  const userUnit = getUserFranqueadaCode(profile);
  if (!userUnit) {
    return items;
  }

  return items.filter((item) => {
    // 1. Verifica correspondência direta de unidade
    if (matchesFranqueadaScope(item, userUnit, franqueadasList)) {
      return true;
    }
    // 2. Registros que ainda não possuem franqueadaId definidos podem ser exibidos se forem criados pelo usuário
    if (!item.franqueadaId && !item.codigoUnidade && item.userId === profile?.uid) {
      return true;
    }
    return false;
  });
}

/**
 * Injeta ou padroniza os campos `franqueadaId` e `codigoUnidade` em operações de criação/atualização (CRUD)
 */
export function injectFranqueadaScope<T extends Record<string, any>>(
  data: T,
  profile: any,
  selectedUnidade: string = "ALL",
  franqueadasList: any[] = []
): T & { franqueadaId?: string; codigoUnidade?: string } {
  const isMaster = isFranqueadoraUser(profile);
  const result: any = { ...data };

  if (!isMaster) {
    // Para usuário de Franqueada: Injeção RÍGIDA e OBRIGATÓRIA da sua unidade
    const userUnit = getUserFranqueadaCode(profile);
    const frqInfo = franqueadasList.find(
      (f) => f.codigoUnidade === userUnit || f.id === userUnit
    );

    result.codigoUnidade = frqInfo?.codigoUnidade || userUnit;
    result.franqueadaId = frqInfo?.id || userUnit;
    result.empresaId = frqInfo?.id || result.empresaId || userUnit;
  } else {
    // Para usuário Franqueadora:
    // Se já informou no formulário ou tem unidade selecionada no switcher diferente de ALL
    if (result.codigoUnidade || result.franqueadaId) {
      const frqInfo = franqueadasList.find(
        (f) => f.codigoUnidade === result.codigoUnidade || f.id === result.franqueadaId || f.id === result.codigoUnidade
      );
      if (frqInfo) {
        result.codigoUnidade = frqInfo.codigoUnidade;
        result.franqueadaId = frqInfo.id;
      }
    } else if (selectedUnidade && selectedUnidade !== "ALL" && selectedUnidade !== "TODAS") {
      const frqInfo = franqueadasList.find(
        (f) => f.codigoUnidade === selectedUnidade || f.id === selectedUnidade
      );
      result.codigoUnidade = frqInfo?.codigoUnidade || selectedUnidade;
      result.franqueadaId = frqInfo?.id || selectedUnidade;
    }
  }

  return result;
}

/**
 * Valida se o usuário tem permissão para editar ou excluir um registro específico
 */
export function canUserMutateRecord(
  item: FranqueadaMatchable,
  profile: any,
  franqueadasList: any[] = []
): boolean {
  if (isFranqueadoraUser(profile)) {
    return true; // Franqueador Master tem permissão irrestrita
  }

  const userUnit = getUserFranqueadaCode(profile);
  if (!userUnit) return false;

  return matchesFranqueadaScope(item, userUnit, franqueadasList);
}
