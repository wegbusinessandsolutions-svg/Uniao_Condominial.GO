/**
 * Utility functions for safely parsing and formatting service values in CRM and customer components.
 * Prevents "NaN" errors by handling various string/numeric representations safely.
 */

/**
 * Safely parses any service value or raw database input into a valid number.
 * Handles numbers, Brazilian format ("1.500,50"), US format ("1,500.50"), "R$ 150,00", etc.
 * Guarantees never returning NaN.
 */
export function parseServiceValue(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str || str.toLowerCase() === "nan" || str === "—") return 0;

  // Remove currency symbols, non-breaking spaces, and extra whitespace
  str = str.replace(/R\$\s?/gi, "").replace(/\s/g, "").trim();
  if (!str) return 0;

  // Handle strings with both dot and comma e.g. "1.500,50" or "1,500.50"
  if (str.includes(".") && str.includes(",")) {
    if (str.lastIndexOf(".") < str.lastIndexOf(",")) {
      // BR format: "1.500,50" -> strip dots, replace comma with dot
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // US format: "1,500.50" -> strip commas
      str = str.replace(/,/g, "");
    }
  } else if (str.includes(",")) {
    // Single comma present: "150,00" -> replace comma with dot
    str = str.replace(",", ".");
  }

  // Remove any characters other than digits, decimal dot, and minus sign
  str = str.replace(/[^\d.-]/g, "");

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formats a service value cleanly as Brazilian Real currency e.g. "R$ 150,00"
 */
export function formatCurrencyBR(val: any): string {
  const num = parseServiceValue(val);
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Comparator to sort services or products by SKU / Code in ascending order (e.g., SERV-001, SERV-002, SERV-010).
 */
export function compareSkuAscending(a: any, b: any): number {
  const skuA = String(a.codigo || a.sku || a.code || "").trim();
  const skuB = String(b.codigo || b.sku || b.code || "").trim();

  if (!skuA && !skuB) return 0;
  if (!skuA) return 1;
  if (!skuB) return -1;

  return skuA.localeCompare(skuB, undefined, { numeric: true, sensitivity: "base" });
}
