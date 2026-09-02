/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WatermarkOptions {
  captureDate?: Date;
  maxDimension?: number;
  quality?: number;
  includeSeconds?: boolean;
  customPrefix?: string;
  nomeCondominio?: string;
  enderecoCompleto?: string;
  codigoVerificacao?: string;
  latitude?: number;
  longitude?: number;
  technicianName?: string;
  style?: "timemark_real" | "compact_badge";
}

export interface WatermarkResult {
  dataUrl: string;
  blob: Blob;
  formattedDateTime: string;
  width: number;
  height: number;
  verificationCode?: string;
}

const MONTHS_BR = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez."
];

const DAYS_OF_WEEK_BR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Formats date into Timemark format: "28 ago. 2026"
 */
export function formatTimemarkDate(date: Date = new Date()): { dateText: string; dayOfWeekText: string; timeText: string } {
  const day = String(date.getDate());
  const month = MONTHS_BR[date.getMonth()];
  const year = String(date.getFullYear());
  const dayOfWeek = DAYS_OF_WEEK_BR[date.getDay()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    dateText: `${day} ${month} ${year}`,
    dayOfWeekText: dayOfWeek,
    timeText: `${hours}:${minutes}`,
  };
}

/**
 * Generates an alphanumeric verification hash like "RNELC9XNTC39YK"
 */
export function generateVerificationHash(seed?: string): string {
  if (seed && seed.length >= 8) {
    const clean = seed.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (clean.length >= 12) return clean.substring(0, 14);
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = "";
  for (let i = 0; i < 14; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

/**
 * Formats a Date object into standard Brazilian format: "DD/MM/AAAA HH:MM"
 * e.g. "29/08/2026 15:30"
 */
export function formatWatermarkDateTime(
  date: Date = new Date(),
  includeSeconds = false
): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (includeSeconds) {
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Converts a data URL (base64) to a Blob object
 */
export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Converts a data URL to a File object
 */
export function dataURLtoFile(dataUrl: string, filename: string): File {
  const blob = dataURLtoBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

/**
 * Loads an image from File, Blob, or Data/Object URL
 */
function loadImage(input: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Set crossOrigin only for external string URLs to avoid tainting canvas.
    // Setting it for Blob/File object URLs can cause loading to fail silently in some browsers (like Safari/iOS).
    if (typeof input === "string" && (input.startsWith("http://") || input.startsWith("https://"))) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Falha ao carregar imagem: ${err}`));

    if (typeof input === "string") {
      img.src = input;
    } else if (input instanceof Blob) {
      const url = URL.createObjectURL(input);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
    } else {
      reject(new Error("Formato de imagem inválido para processamento."));
    }
  });
}

/**
 * Processes an image and imprints a permanent, high-contrast date and time watermark
 * with authentic Timemark / Foto 100% Real layout (matching verified service photos),
 * including condominium name, address, time, date, day of week, and verification code.
 */
export async function applyDateTimeWatermark(
  imageInput: File | Blob | string,
  options: WatermarkOptions = {}
): Promise<WatermarkResult> {
  const {
    captureDate = new Date(),
    maxDimension = 1440,
    quality = 0.88,
    includeSeconds = false,
    customPrefix = "",
    nomeCondominio = "",
    enderecoCompleto = "",
    codigoVerificacao = generateVerificationHash(),
    style = "timemark_real",
  } = options;

  const img = await loadImage(imageInput);

  // 1. Calculate proportional aspect ratio scaling (up to maxDimension)
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // 2. Setup Canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Contexto 2D do Canvas não disponível.");
  }

  // Enable high quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 3. Draw base photo
  ctx.drawImage(img, 0, 0, width, height);

  const formattedDateTime = formatWatermarkDateTime(captureDate, includeSeconds);
  const { dateText, dayOfWeekText, timeText } = formatTimemarkDate(captureDate);

  if (style === "timemark_real") {
    // ----------------------------------------------------
    // TIMEMARK "FOTO 100% REAL" AUTHENTIC STAMPING LAYOUT
    // ----------------------------------------------------
    const scale = Math.max(1, width / 960);

    // Subtle dark gradient at top and bottom to guarantee extreme legibility on white/bright backgrounds
    const bottomGrad = ctx.createLinearGradient(0, height - height * 0.28, 0, height);
    bottomGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    bottomGrad.addColorStop(0.4, "rgba(0, 0, 0, 0.35)");
    bottomGrad.addColorStop(1, "rgba(0, 0, 0, 0.75)");
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, height - height * 0.28, width, height * 0.28);

    const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.18);
    topGrad.addColorStop(0, "rgba(0, 0, 0, 0.55)");
    topGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, height * 0.18);

    ctx.save();

    // A. TOP RIGHT: "Timemark" & "Foto 100% Real"
    const topMargin = Math.round(28 * scale);
    const rightMargin = Math.round(28 * scale);

    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    // Text drop shadows for ultra crisp contrast
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = Math.round(8 * scale);
    ctx.shadowOffsetX = Math.round(2 * scale);
    ctx.shadowOffsetY = Math.round(2 * scale);

    // "Timemark"
    const timemarkFontSize = Math.round(22 * scale);
    ctx.font = `bold ${timemarkFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#FACC15"; // Timemark Gold Yellow
    ctx.fillText("Timemark", width - rightMargin, topMargin);

    // "Foto 100% Real"
    const realFontSize = Math.round(14 * scale);
    ctx.font = `500 ${realFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Foto 100% Real", width - rightMargin, topMargin + timemarkFontSize + Math.round(4 * scale));

    // B. RIGHT MARGIN: Vertical Security Hash (e.g. "RNELC9XNTC39YK Timemark Verified")
    ctx.save();
    ctx.translate(width - Math.round(14 * scale), height * 0.48);
    ctx.rotate(Math.PI / 2); // 90deg vertical down
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = Math.round(4 * scale);
    ctx.fillText(`⛨ ${codigoVerificacao} Timemark Verified`, 0, 0);
    ctx.restore();

    // C. BOTTOM LEFT: Time (Large), Date, Day, Condomínio & Address
    const leftMargin = Math.round(30 * scale);
    const bottomBase = height - Math.round(30 * scale);

    // 1. Prepare texts
    const condText = nomeCondominio ? nomeCondominio.trim() : "";
    const addrText = enderecoCompleto ? enderecoCompleto.trim() : "";

    const addrFontSize = Math.round(15 * scale);
    ctx.font = `500 ${addrFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const addrLineHeight = Math.round(22 * scale);

    // Calculate vertical positions from bottom up
    let currentY = bottomBase;

    // Draw Address line (if present)
    if (addrText) {
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = `400 ${Math.round(13.5 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = Math.round(6 * scale);
      
      // Auto-wrap address if it exceeds max width
      const maxAddrWidth = width * 0.72;
      if (ctx.measureText(addrText).width > maxAddrWidth) {
        const words = addrText.split(" ");
        let line = "";
        const lines: string[] = [];
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (ctx.measureText(test).width > maxAddrWidth) {
            lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);

        for (let i = lines.length - 1; i >= 0; i--) {
          ctx.fillText(lines[i], leftMargin, currentY);
          currentY -= addrLineHeight;
        }
      } else {
        ctx.fillText(addrText, leftMargin, currentY);
        currentY -= addrLineHeight;
      }
    }

    // Draw Condomínio line (if present)
    if (condText) {
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = `bold ${Math.round(15 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = "#FFFFFF";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = Math.round(6 * scale);
      ctx.fillText(condText, leftMargin, currentY);
      currentY -= Math.round(22 * scale);
    } else if (!addrText) {
      // Default location stamp if neither is provided
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.font = `500 ${Math.round(14 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = Math.round(6 * scale);
      ctx.fillText("Condomínio Residencial • Atendimento Presencial", leftMargin, currentY);
      currentY -= Math.round(22 * scale);
    }

    currentY -= Math.round(6 * scale);

    // 2. Large Time + Vertical Divider + Date/Day
    const timeFontSize = Math.round(44 * scale);
    ctx.font = `bold ${timeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = Math.round(8 * scale);

    // Draw Large Time
    const timeDisplay = customPrefix ? `${customPrefix} ${timeText}` : timeText;
    ctx.fillText(timeDisplay, leftMargin, currentY);
    const timeMetrics = ctx.measureText(timeDisplay);

    // Draw Vertical Divider Line (Gold / Amber)
    const dividerX = leftMargin + timeMetrics.width + Math.round(10 * scale);
    const dividerHeight = Math.round(36 * scale);
    const dividerTop = currentY - dividerHeight;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = Math.round(6 * scale);
    ctx.fillStyle = "#FACC15"; // Amber Yellow Divider
    ctx.fillRect(dividerX, dividerTop, Math.round(3 * scale), dividerHeight);
    ctx.restore();

    // Draw Date and Day of Week next to divider
    const dateLeft = dividerX + Math.round(12 * scale);
    const dateFontSize = Math.round(14.5 * scale);
    const dayFontSize = Math.round(13.5 * scale);

    // Date (Line 1)
    ctx.font = `bold ${dateFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "top";
    ctx.fillText(dateText, dateLeft, dividerTop);

    // Day of Week (Line 2)
    ctx.font = `500 ${dayFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(dayOfWeekText, dateLeft, dividerTop + Math.round(18 * scale));

    ctx.restore();
  } else {
    // ----------------------------------------------------
    // COMPACT BADGE LAYOUT (Legacy / Mini)
    // ----------------------------------------------------
    const stampText = customPrefix ? `${customPrefix} ${formattedDateTime}` : formattedDateTime;
    const fontSize = Math.max(13, Math.round(width * 0.024));
    const margin = Math.round(fontSize * 0.9);
    const paddingX = Math.round(fontSize * 0.75);
    const paddingY = Math.round(fontSize * 0.45);

    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const textMetrics = ctx.measureText(stampText);
    const textWidth = textMetrics.width;

    const dotRadius = Math.max(3, Math.round(fontSize * 0.18));
    const dotSpacing = Math.round(fontSize * 0.45);
    const badgeWidth = textWidth + paddingX * 2 + dotRadius * 2 + dotSpacing;
    const badgeHeight = fontSize + paddingY * 2;

    const badgeX = width - badgeWidth - margin;
    const badgeY = height - badgeHeight - margin;
    const radius = Math.round(badgeHeight * 0.28);

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));

    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = Math.round(fontSize * 0.4);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
    } else {
      ctx.moveTo(badgeX + radius, badgeY);
      ctx.arcTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeHeight, radius);
      ctx.arcTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX, badgeY + badgeHeight, radius);
      ctx.arcTo(badgeX, badgeY + badgeHeight, badgeX, badgeY, radius);
      ctx.arcTo(badgeX, badgeY, badgeX + badgeWidth, badgeY, radius);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    const dotCenterX = badgeX + paddingX + dotRadius;
    const dotCenterY = badgeY + badgeHeight / 2;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(stampText, dotCenterX + dotRadius + dotSpacing, dotCenterY);

    ctx.restore();
  }

  // Generate permanent stamped output
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = dataURLtoBlob(dataUrl);

  return {
    dataUrl,
    blob,
    formattedDateTime,
    width,
    height,
    verificationCode: codigoVerificacao,
  };
}
