import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export { formatDateBR, formatDateTimeBR, formatDateTimeShortBR, formatDateInput } from "./dateUtils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte qualquer valor (string com vírgula, ponto, R$, etc.) para number válido.
 */
export function parseValor(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str || str.toLowerCase() === "nan" || str === "—") return 0;

  str = str.replace(/R\$\s?/gi, "").replace(/\s/g, "").trim();
  if (!str) return 0;

  if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(".") < str.lastIndexOf(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  }

  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formata um valor numérico estritamente com duas casas decimais após a vírgula
 * no padrão x.xxx,xx (ex: 1.234,56 ou 0,00)
 */
export function formatValor(val: any, withPrefix = false): string {
  const num = parseValor(val);
  const formatted = num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withPrefix ? `R$ ${formatted}` : formatted;
}

/**
 * Formata moeda com R$ no padrão brasileiro R$ x.xxx,xx
 */
export function formatCurrency(val: any): string {
  return formatValor(val, true);
}
