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
}

export interface WatermarkResult {
  dataUrl: string;
  blob: Blob;
  formattedDateTime: string;
  width: number;
  height: number;
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
    img.crossOrigin = "anonymous";

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
 * in the bottom-right corner (canto inferior direito) with format "DD/MM/AAAA HH:MM".
 * Prepares the processed image for upload to Firebase Storage and offline caching.
 */
export async function applyDateTimeWatermark(
  imageInput: File | Blob | string,
  options: WatermarkOptions = {}
): Promise<WatermarkResult> {
  const {
    captureDate = new Date(),
    maxDimension = 1280,
    quality = 0.85,
    includeSeconds = false,
    customPrefix = "",
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

  // 4. Format Watermark Text (DD/MM/AAAA HH:MM)
  const formattedDateTime = formatWatermarkDateTime(captureDate, includeSeconds);
  const stampText = customPrefix ? `${customPrefix} ${formattedDateTime}` : formattedDateTime;

  // 5. Calculate responsive typography & badge positioning in bottom-right corner
  const fontSize = Math.max(13, Math.round(width * 0.024));
  const margin = Math.round(fontSize * 0.9);
  const paddingX = Math.round(fontSize * 0.75);
  const paddingY = Math.round(fontSize * 0.45);

  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
  const textMetrics = ctx.measureText(stampText);
  const textWidth = textMetrics.width;

  const dotRadius = Math.max(3, Math.round(fontSize * 0.18));
  const dotSpacing = Math.round(fontSize * 0.45);
  const badgeWidth = textWidth + paddingX * 2 + dotRadius * 2 + dotSpacing;
  const badgeHeight = fontSize + paddingY * 2;

  // Position at bottom right
  const badgeX = width - badgeWidth - margin;
  const badgeY = height - badgeHeight - margin;
  const radius = Math.round(badgeHeight * 0.28);

  // 6. Draw protective high-contrast dark badge in bottom-right corner
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)"; // Slate-900 with high opacity for readability on all photos
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.06));

  // Drop shadow for clear separation
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

  // Reset shadow for text and indicator
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // 7. Draw camera status dot (Amber / Gold)
  const dotCenterX = badgeX + paddingX + dotRadius;
  const dotCenterY = badgeY + badgeHeight / 2;
  ctx.fillStyle = "#f59e0b"; // Amber-500
  ctx.beginPath();
  ctx.arc(dotCenterX, dotCenterY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  // 8. Engrave Date and Time text (White, High-Contrast)
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(stampText, dotCenterX + dotRadius + dotSpacing, dotCenterY);

  ctx.restore();

  // 9. Generate permanent stamped output
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = dataURLtoBlob(dataUrl);

  return {
    dataUrl,
    blob,
    formattedDateTime,
    width,
    height,
  };
}
