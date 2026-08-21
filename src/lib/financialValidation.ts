import { logAction } from "./audit";

export interface ParcelaValidacaoInput {
  id?: string;
  numeroParcela?: number | string;
  valor: number | string;
  vencimento?: string;
  status?: string;
  titular?: string;
  descricao?: string;
  [key: string]: any;
}

export interface AfiliadoValidacaoInput {
  id?: string;
  userId?: string;
  clienteId?: string;
  nomeCondominio: string;
  cnpj?: string;
  nomeSindico?: string;
  telefone?: string;
  email?: string;
  diaVencimento: number | string;
  valorMensalidade: number | string;
  valorTotalContrato?: number | string;
  unidadesHabitacionais?: number | string;
  status?: string;
  dataAtivacao?: string;
  dataAfiliacao?: string;
  [key: string]: any;
}

export interface ParcelaValidacaoDetalhe {
  numero: number;
  valor: number;
  vencimento: string;
  valido: boolean;
  motivo?: string;
}

export interface FinancialIntegrityValidationResult {
  isValid: boolean;
  valorTotalAfiliacao: number;
  somaParcelas: number;
  diferenca: number;
  quantidadeParcelas: number;
  quantidadeEsperada: number;
  valorMensalidade: number;
  diaVencimento: number;
  nomeCondominio: string;
  erros: string[];
  avisos: string[];
  detalhesParcelas: ParcelaValidacaoDetalhe[];
}

export class FinancialIntegrityError extends Error {
  public validationResult: FinancialIntegrityValidationResult;

  constructor(message: string, validationResult: FinancialIntegrityValidationResult) {
    super(message);
    this.name = "FinancialIntegrityError";
    this.validationResult = validationResult;
  }
}

/**
 * Arredonda valor para 2 casas decimais evitando erros de ponto flutuante do JavaScript.
 */
export function roundCurrency(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Formata valor para moeda brasileira (BRL).
 */
function formatBrl(val: number): string {
  return (Number(val) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

/**
 * Função global que valida a integridade dos dados financeiros
 * (Soma das parcelas x Valor total da afiliação x Regras de negócio)
 * antes de persistir novos registros ou atualizações no Firestore.
 *
 * @param afiliado Dados cadastrais e financeiros do condomínio afiliado.
 * @param parcelas Opcional. Lista de parcelas explícitas para validação. Se omitido, simula as 12 parcelas padrão.
 * @param options Opções adicionais de validação (quantidade esperada, total customizado, permitir isenção zero).
 */
export function validarIntegridadeFinanceiraAfiliacao(
  afiliado: AfiliadoValidacaoInput,
  parcelas?: ParcelaValidacaoInput[],
  options?: {
    quantidadeEsperada?: number;
    totalEsperadoCustom?: number;
    permitirZero?: boolean;
    toleranciaCentavos?: number;
  }
): FinancialIntegrityValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];
  const detalhesParcelas: ParcelaValidacaoDetalhe[] = [];

  const quantidadeEsperada = options?.quantidadeEsperada ?? 12;
  const tolerancia = options?.toleranciaCentavos ?? 0.02; // tolerância padrão de 2 centavos para arredondamentos

  // 1. Validação dos dados cadastrais básicos necessários para o faturamento
  const nomeCondominio = (afiliado?.nomeCondominio || "").trim();
  if (!nomeCondominio) {
    erros.push("Nome do Condomínio (Titular Financeiro) não foi informado.");
  }

  const diaVenc = Number(afiliado?.diaVencimento);
  if (isNaN(diaVenc) || diaVenc < 1 || diaVenc > 31) {
    erros.push(`Dia de vencimento inválido (${afiliado?.diaVencimento}). Deve estar entre 1 e 31.`);
  }

  const valorMensal = roundCurrency(Number(afiliado?.valorMensalidade));
  if (isNaN(valorMensal)) {
    erros.push("Valor da mensalidade não é um número válido.");
  } else if (valorMensal < 0) {
    erros.push(`Valor da mensalidade não pode ser negativo (${formatBrl(valorMensal)}).`);
  } else if (valorMensal === 0 && !options?.permitirZero) {
    erros.push("Valor da mensalidade deve ser maior que zero (R$ 0,00 informado).");
  }

  // 2. Determinação do Valor Total Esperado da Afiliação
  let totalEsperado: number;
  if (options?.totalEsperadoCustom !== undefined) {
    totalEsperado = roundCurrency(options.totalEsperadoCustom);
  } else if (afiliado?.valorTotalContrato !== undefined && Number(afiliado.valorTotalContrato) > 0) {
    totalEsperado = roundCurrency(Number(afiliado.valorTotalContrato));
  } else {
    // Cálculo do contrato anual: valor mensalidade * total de parcelas contratadas (12)
    totalEsperado = roundCurrency(valorMensal * quantidadeEsperada);
  }

  // 3. Obtenção ou Geração das Parcelas para Análise
  let listaParcelas: ParcelaValidacaoInput[] = [];

  if (parcelas && parcelas.length > 0) {
    listaParcelas = parcelas;
  } else {
    // Se a lista de parcelas não foi fornecida, monta as N parcelas simuladas com base na mensalidade
    for (let i = 1; i <= quantidadeEsperada; i++) {
      listaParcelas.push({
        numeroParcela: i,
        valor: valorMensal,
        vencimento: `Parcela ${i}/${quantidadeEsperada}`,
        titular: nomeCondominio,
        descricao: `Taxa de Afiliação a U.C. (Parcela ${i}/${quantidadeEsperada})`
      });
    }
  }

  // 4. Verificação de Quantidade de Parcelas
  if (listaParcelas.length !== quantidadeEsperada) {
    erros.push(
      `Quantidade de parcelas divergente: ${listaParcelas.length} parcelas informadas, mas o contrato exige exatamente ${quantidadeEsperada} parcelas.`
    );
  }

  // 5. Soma e Validação Individual das Parcelas
  let somaCalculada = 0;
  const numerosVistos = new Set<number>();

  listaParcelas.forEach((p, index) => {
    const num = Number(p.numeroParcela) || index + 1;
    const val = roundCurrency(Number(p.valor));
    const venc = (p.vencimento || "").trim();
    let parcelaValida = true;
    let motivoInvalido = "";

    // Verifica número sequencial duplicado
    if (numerosVistos.has(num)) {
      parcelaValida = false;
      motivoInvalido = `Número de parcela duplicado: ${num}`;
      erros.push(`Inconsistência: Parcela duplicada com número ${num}.`);
    } else {
      numerosVistos.add(num);
    }

    // Verifica valor da parcela
    if (isNaN(val)) {
      parcelaValida = false;
      motivoInvalido = "Valor não numérico";
      erros.push(`Parcela ${num} possui valor inválido (NaN).`);
    } else if (val < 0) {
      parcelaValida = false;
      motivoInvalido = "Valor negativo";
      erros.push(`Parcela ${num} possui valor negativo (${formatBrl(val)}).`);
    } else if (val === 0 && !options?.permitirZero) {
      parcelaValida = false;
      motivoInvalido = "Valor zerado";
      erros.push(`Parcela ${num} possui valor zerado (${formatBrl(val)}).`);
    }

    // Verifica data de vencimento se informada
    if (venc && venc.length === 10 && venc.includes("-")) {
      const parsedDate = new Date(venc + "T00:00:00");
      if (isNaN(parsedDate.getTime())) {
        avisos.push(`Parcela ${num} possui data de vencimento em formato suspeito: ${venc}`);
      }
    }

    somaCalculada = roundCurrency(somaCalculada + val);

    detalhesParcelas.push({
      numero: num,
      valor: val,
      vencimento: venc || "Não especificado",
      valido: parcelaValida,
      motivo: motivoInvalido || undefined
    });
  });

  // 6. Validação da Soma das Parcelas x Valor Total da Afiliação
  const diferenca = roundCurrency(Math.abs(somaCalculada - totalEsperado));

  if (diferenca > tolerancia) {
    erros.push(
      `Inconsistência de Integridade Financeira: A soma das ${listaParcelas.length} parcelas (${formatBrl(
        somaCalculada
      )}) diverge do valor total da afiliação (${formatBrl(
        totalEsperado
      )}). Diferença calculada: ${formatBrl(diferenca)}.`
    );
  }

  // 7. Alertas de Negócio adicionais
  if (valorMensal > 10000) {
    avisos.push(`Valor mensal atipicamente alto para condomínio (${formatBrl(valorMensal)}).`);
  }

  const isValid = erros.length === 0;

  return {
    isValid,
    valorTotalAfiliacao: totalEsperado,
    somaParcelas: somaCalculada,
    diferenca,
    quantidadeParcelas: listaParcelas.length,
    quantidadeEsperada,
    valorMensalidade: valorMensal,
    diaVencimento: diaVenc || 10,
    nomeCondominio,
    erros,
    avisos,
    detalhesParcelas
  };
}

/**
 * Valida a integridade financeira e lança uma exceção descritiva caso
 * encontre inconsistências, impedindo qualquer mutação/persistência no Firestore.
 *
 * Registra auditoria automática no banco de dados quando detecta violação de integridade.
 *
 * @param afiliado Dados cadastrais e financeiros do condomínio afiliado.
 * @param parcelas Opcional. Lista de parcelas explícitas para validação.
 * @param options Opções adicionais de validação.
 */
export async function assertIntegridadeFinanceiraAfiliacao(
  afiliado: AfiliadoValidacaoInput,
  parcelas?: ParcelaValidacaoInput[],
  options?: {
    quantidadeEsperada?: number;
    totalEsperadoCustom?: number;
    permitirZero?: boolean;
    origem?: string;
    actorName?: string;
  }
): Promise<FinancialIntegrityValidationResult> {
  const result = validarIntegridadeFinanceiraAfiliacao(afiliado, parcelas, options);

  if (!result.isValid) {
    const errorMsg = `[Integridade Financeira Bloqueada] Inconsistência detectada na afiliação de "${
      result.nomeCondominio || "Condomínio"
    }": ${result.erros.join(" | ")}`;

    console.group(
      "%c[Financial Integrity Check] 🛑 Violação de Integridade Financeira Detectada!",
      "color: #dc2626; font-weight: bold; font-size: 13px;"
    );
    console.error(errorMsg, {
      afiliado,
      totalEsperado: result.valorTotalAfiliacao,
      somaParcelas: result.somaParcelas,
      diferenca: result.diferenca,
      quantidadeParcelas: result.quantidadeParcelas,
      erros: result.erros,
      avisos: result.avisos,
      detalhesParcelas: result.detalhesParcelas
    });
    console.groupEnd();

    // Log de auditoria no Firestore para registrar a tentativa inconsistente
    try {
      await logAction(
        `Bloqueio de Integridade Financeira: ${result.nomeCondominio} (Soma: ${formatBrl(
          result.somaParcelas
        )} x Total: ${formatBrl(result.valorTotalAfiliacao)})`,
        "Financeiro",
        {
          tipo: "BLOQUEIO_INTEGRIDADE_FINANCEIRA",
          afiliadoId: afiliado.id || afiliado.userId,
          nomeCondominio: result.nomeCondominio,
          somaParcelas: result.somaParcelas,
          totalEsperado: result.valorTotalAfiliacao,
          diferenca: result.diferenca,
          erros: result.erros,
          origem: options?.origem || "Validação Global de Afiliação",
          executadoPor: options?.actorName || "Sistema / Validador Global"
        }
      );
    } catch (auditErr) {
      console.warn("Aviso ao registrar log de bloqueio financeiro:", auditErr);
    }

    throw new FinancialIntegrityError(result.erros[0] || errorMsg, result);
  }

  console.log(
    `%c[Financial Integrity Check] ✅ Integridade financeira aprovada para "${result.nomeCondominio}": Soma (${formatBrl(
      result.somaParcelas
    )}) = Total (${formatBrl(result.valorTotalAfiliacao)}) em ${result.quantidadeParcelas} parcelas.`,
    "color: #16a34a; font-weight: bold;"
  );

  return result;
}
