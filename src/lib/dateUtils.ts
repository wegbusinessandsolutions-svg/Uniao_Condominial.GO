/**
 * Centralized Brazilian Date & Time formatting utilities
 * Formato padrão estrito: dd/mm/aaaa
 */

/**
 * Converte e formata qualquer tipo de data para o padrão brasileiro estrito: dd/mm/aaaa
 * 
 * Suporta:
 * - String "YYYY-MM-DD"
 * - String ISO "YYYY-MM-DDTHH:mm:ss.sssZ"
 * - String "DD/MM/YYYY"
 * - Objeto Date
 * - Objeto Timestamp do Firestore ({ seconds, nanoseconds } ou .toDate())
 * - Número de milissegundos ou unix timestamp
 */
export function formatDateBR(val: any, fallback = "-"): string {
  if (val === null || val === undefined || val === "") return fallback;

  // Se já for uma string
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-" || trimmed === "—") return fallback;

    // Formato DD/MM/YYYY ou DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }

    // Formato YYYY-MM-DD estrito (evita deslocamento de fuso horário gerado por new Date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-");
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }

    // Formato YYYY-MM-DD com hora / sufixo (ex: "2026-08-31T14:30:00" ou "2026-08-31 14:30")
    if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(trimmed)) {
      const datePart = trimmed.substring(0, 10);
      const [year, month, day] = datePart.split("-");
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  // Firestore Timestamp
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return formatNativeDate(d);
      }
    }
    if (typeof val.seconds === "number") {
      const d = new Date(val.seconds * 1000);
      if (!isNaN(d.getTime())) {
        return formatNativeDate(d);
      }
    }
  }

  // Objeto Date
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      return formatNativeDate(val);
    }
    return fallback;
  }

  // Número / timestamp em milissegundos ou segundos
  if (typeof val === "number") {
    const ms = val < 10000000000 ? val * 1000 : val;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return formatNativeDate(d);
    }
  }

  // Fallback tentando Date parsing genérico
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return formatNativeDate(d);
    }
  } catch {
    // ignore
  }

  return typeof val === "string" ? val : fallback;
}

function formatNativeDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

/**
 * Formata data e hora para dd/mm/aaaa às HH:mm
 */
export function formatDateTimeBR(val: any, fallback = "-"): string {
  if (val === null || val === undefined || val === "") return fallback;
  const dateStr = formatDateBR(val, "");
  if (!dateStr) return fallback;

  let hours = "";
  let minutes = "";

  if (typeof val === "string" && (val.includes("T") || val.includes(" "))) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        hours = String(d.getHours()).padStart(2, "0");
        minutes = String(d.getMinutes()).padStart(2, "0");
      }
    } catch {
      // ignore
    }
  } else if (val instanceof Date && !isNaN(val.getTime())) {
    hours = String(val.getHours()).padStart(2, "0");
    minutes = String(val.getMinutes()).padStart(2, "0");
  } else if (typeof val === "object" && typeof val.seconds === "number") {
    const d = new Date(val.seconds * 1000);
    hours = String(d.getHours()).padStart(2, "0");
    minutes = String(d.getMinutes()).padStart(2, "0");
  } else if (typeof val === "object" && typeof val.toDate === "function") {
    const d = val.toDate();
    hours = String(d.getHours()).padStart(2, "0");
    minutes = String(d.getMinutes()).padStart(2, "0");
  }

  if (hours && minutes) {
    return `${dateStr} às ${hours}:${minutes}`;
  }
  return dateStr;
}

/**
 * Formata data e hora para dd/mm/aaaa HH:mm (sem o "às")
 */
export function formatDateTimeShortBR(val: any, fallback = "-"): string {
  if (val === null || val === undefined || val === "") return fallback;
  const dateStr = formatDateBR(val, "");
  if (!dateStr) return fallback;

  let hours = "";
  let minutes = "";

  if (typeof val === "string" && (val.includes("T") || val.includes(" "))) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        hours = String(d.getHours()).padStart(2, "0");
        minutes = String(d.getMinutes()).padStart(2, "0");
      }
    } catch {
      // ignore
    }
  } else if (val instanceof Date && !isNaN(val.getTime())) {
    hours = String(val.getHours()).padStart(2, "0");
    minutes = String(val.getMinutes()).padStart(2, "0");
  } else if (typeof val === "object" && typeof val.seconds === "number") {
    const d = new Date(val.seconds * 1000);
    hours = String(d.getHours()).padStart(2, "0");
    minutes = String(d.getMinutes()).padStart(2, "0");
  } else if (typeof val === "object" && typeof val.toDate === "function") {
    const d = val.toDate();
    hours = String(d.getHours()).padStart(2, "0");
    minutes = String(d.getMinutes()).padStart(2, "0");
  }

  if (hours && minutes) {
    return `${dateStr} ${hours}:${minutes}`;
  }
  return dateStr;
}

/**
 * Retorna no formato YYYY-MM-DD para preencher <input type="date" />
 */
export function formatDateInput(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(val)) return val.substring(0, 10);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split("/");
      return `${y}-${m}-${d}`;
    }
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}
