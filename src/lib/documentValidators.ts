/**
 * Helper algorithms for Brazilian documents: CPF and CNPJ validation and progressive masking.
 */

export function validarCPF(cpf: string): boolean {
  if (!cpf) return false;
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false; // Reject repeated digits like 111.111.111-11

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10), 10)) return false;

  return true;
}

export function validarCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;
  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false; // Reject repeated digits like 000.000.000/0000-00

  let length = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, length);
  const digits = cleanCnpj.substring(length);
  let sum = 0;
  let pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0), 10)) return false;

  length = length + 1;
  numbers = cleanCnpj.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1), 10)) return false;

  return true;
}

/**
 * Formats a raw string into a CPF mask progressively: 000.000.000-00
 */
export function formatarCPF(value: string): string {
  if (!value) return "";
  const clean = value.replace(/\D/g, "").slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return clean.replace(/(\d{3})(\d+)/, "$1.$2");
  if (clean.length <= 9) return clean.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
}

/**
 * Formats a raw string into a CNPJ mask progressively: 00.000.000/0000-00
 */
export function formatarCNPJ(value: string): string {
  if (!value) return "";
  const clean = value.replace(/\D/g, "").slice(0, 14);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return clean.replace(/(\d{2})(\d+)/, "$1.$2");
  if (clean.length <= 8) return clean.replace(/(\d{2})(\d{3})(\d+)/, "$1.$2.$3");
  if (clean.length <= 12) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, "$1.$2.$3/$4");
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, "$1.$2.$3/$4-$5");
}

/**
 * Formats dynamically: if <= 11 digits formats as CPF, if > 11 digits switches seamlessly to CNPJ.
 */
export function formatarCpfCnpj(value: string): string {
  if (!value) return "";
  const clean = value.replace(/\D/g, "").slice(0, 14);
  if (clean.length <= 11) {
    return formatarCPF(clean);
  }
  return formatarCNPJ(clean);
}

export type DocumentValidationStatus = "empty" | "typing" | "valid" | "invalid";

export interface DocumentValidationResult {
  status: DocumentValidationStatus;
  isValid: boolean;
  type: "CPF" | "CNPJ" | "INDEFINIDO";
  clean: string;
  formatted: string;
  message: string;
}

/**
 * Validates document in real-time and returns detailed status with message for UI rendering.
 */
export function getDocumentValidation(
  value: string,
  targetType: "CPF" | "CNPJ" | "AUTO" = "AUTO"
): DocumentValidationResult {
  const clean = (value || "").replace(/\D/g, "");

  if (!clean) {
    return {
      status: "empty",
      isValid: false,
      type: targetType === "AUTO" ? "INDEFINIDO" : targetType,
      clean: "",
      formatted: "",
      message: "",
    };
  }

  // If forced CPF
  if (targetType === "CPF") {
    const formatted = formatarCPF(clean);
    if (clean.length < 11) {
      return {
        status: "typing",
        isValid: false,
        type: "CPF",
        clean,
        formatted,
        message: `CPF em preenchimento (${clean.length}/11 dígitos)`,
      };
    }
    const isValid = validarCPF(clean);
    return {
      status: isValid ? "valid" : "invalid",
      isValid,
      type: "CPF",
      clean,
      formatted,
      message: isValid
        ? "CPF válido e verificado"
        : /^(\d)\1{10}$/.test(clean)
        ? "CPF inválido: sequência de números iguais"
        : "CPF inválido: dígitos verificadores não conferem",
    };
  }

  // If forced CNPJ
  if (targetType === "CNPJ") {
    const formatted = formatarCNPJ(clean);
    if (clean.length < 14) {
      return {
        status: "typing",
        isValid: false,
        type: "CNPJ",
        clean,
        formatted,
        message: `CNPJ em preenchimento (${clean.length}/14 dígitos)`,
      };
    }
    const isValid = validarCNPJ(clean);
    return {
      status: isValid ? "valid" : "invalid",
      isValid,
      type: "CNPJ",
      clean,
      formatted,
      message: isValid
        ? "CNPJ válido e verificado"
        : /^(\d)\1{13}$/.test(clean)
        ? "CNPJ inválido: sequência de números iguais"
        : "CNPJ inválido: dígitos verificadores não conferem",
    };
  }

  // AUTO: Check based on length
  if (clean.length <= 11) {
    const formatted = formatarCPF(clean);
    if (clean.length < 11) {
      return {
        status: "typing",
        isValid: false,
        type: "CPF",
        clean,
        formatted,
        message: `Documento em preenchimento (${clean.length} dígitos digitados)`,
      };
    }
    const isCpfValid = validarCPF(clean);
    if (isCpfValid) {
      return {
        status: "valid",
        isValid: true,
        type: "CPF",
        clean,
        formatted,
        message: "CPF válido e verificado",
      };
    }
    // Check if user is might be continuing towards a CNPJ (11 digits might be partial CNPJ)
    return {
      status: "invalid",
      isValid: false,
      type: "CPF",
      clean,
      formatted,
      message: "CPF inválido ou continue digitando se for CNPJ",
    };
  } else {
    const formatted = formatarCNPJ(clean);
    if (clean.length < 14) {
      return {
        status: "typing",
        isValid: false,
        type: "CNPJ",
        clean,
        formatted,
        message: `CNPJ em preenchimento (${clean.length}/14 dígitos)`,
      };
    }
    const isCnpjValid = validarCNPJ(clean);
    return {
      status: isCnpjValid ? "valid" : "invalid",
      isValid: isCnpjValid,
      type: "CNPJ",
      clean,
      formatted,
      message: isCnpjValid
        ? "CNPJ válido e verificado"
        : /^(\d)\1{13}$/.test(clean)
        ? "CNPJ inválido: sequência de números iguais"
        : "CNPJ inválido: dígitos verificadores não conferem",
    };
  }
}

export function calculateCRC16(str: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    const b = str.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      const bit = ((b >> (7 - j)) & 1) === 1;
      const c15 = ((crc >> 15) & 1) === 1;
      crc <<= 1;
      if (c15 !== bit) {
        crc ^= polynomial;
      }
    }
  }

  crc &= 0xFFFF;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaECola(params: {
  chave: string;
  valor?: number;
  nomeRecebedor?: string;
  cidadeRecebedor?: string;
  txid?: string;
}): string {
  const cleanChave = params.chave.trim();
  const rawTxid = params.txid ? params.txid.replace(/[^A-Za-z0-9]/g, "") : "***";
  const txid = rawTxid.slice(0, 25) || "***";

  const nome = (params.nomeRecebedor || "Uniao Condominial")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, 25)
    .trim();

  const cidade = (params.cidadeRecebedor || "Goiania")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .slice(0, 15)
    .trim();

  function formatTag(tag: string, val: string): string {
    const len = String(val.length).padStart(2, '0');
    return `${tag}${len}${val}`;
  }

  const subTag00 = formatTag("00", "br.gov.bcb.pix");
  const subTag01 = formatTag("01", cleanChave);
  const tag26Value = `${subTag00}${subTag01}`;
  const tag26 = formatTag("26", tag26Value);

  const tag52 = "52040000";
  const tag53 = "5303986";

  let tag54 = "";
  if (params.valor && params.valor > 0) {
    const amtStr = Number(params.valor).toFixed(2);
    tag54 = formatTag("54", amtStr);
  }

  const tag58 = "5802BR";
  const tag59 = formatTag("59", nome);
  const tag60 = formatTag("60", cidade);

  const subTag05 = formatTag("05", txid);
  const tag62 = formatTag("62", subTag05);

  const partialPayload = `${formatTag("00", "01")}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const crc = calculateCRC16(partialPayload);
  
  return `${partialPayload}${crc}`;
}


