import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ImageIcon } from "lucide-react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  sizes?: string;
  quality?: number;
  width?: number;
  fallbackType?: "product" | "logo" | "generic";
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

/**
 * Optimizes external URLs (such as Unsplash) by appending appropriate resizing and format query parameters.
 */
function getOptimizedUrl(url: string, targetWidth: number, targetQuality: number): string {
  if (!url) return "";
  
  // Unsplash CDN Optimization
  if (url.includes("images.unsplash.com")) {
    try {
      const urlObj = new URL(url);
      
      // Keep or add fit=crop and auto=format for modern compression (WebP/AVIF)
      urlObj.searchParams.set("auto", "format");
      urlObj.searchParams.set("fit", "crop");
      
      // Custom quality and width
      urlObj.searchParams.set("w", String(targetWidth));
      urlObj.searchParams.set("q", String(targetQuality));
      
      return urlObj.toString();
    } catch (e) {
      // Fallback to basic string replacement if URL parsing fails
      if (url.includes("?")) {
        return `${url}&auto=format&fit=crop&w=${targetWidth}&q=${targetQuality}`;
      }
      return `${url}?auto=format&fit=crop&w=${targetWidth}&q=${targetQuality}`;
    }
  }

  // Placeholder.com or other known CDNs can be appended here if needed
  return url;
}

export default function OptimizedImage({
  src,
  alt,
  className = "",
  containerClassName = "",
  quality,
  width,
  fallbackType = "product",
  objectFit = "cover",
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewports to serve smaller, more compressed images automatically
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Intersection Observer for robust, client-side Lazy Loading
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "150px", // Trigger loading slightly before the image is in view
        threshold: 0.01,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [src]);

  // Reset states if source image changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // Determine ideal dimensions and quality for the optimized URL
  const defaultWidth = isMobile ? 400 : 700;
  const targetWidth = width || defaultWidth;
  const targetQuality = quality || (isMobile ? 70 : 80); // Compress slightly more on mobile

  const optimizedSrc = isInView ? getOptimizedUrl(src, targetWidth, targetQuality) : "";

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden w-full h-full flex items-center justify-center bg-slate-50 ${containerClassName}`}
    >
      {/* 1. Blur-Up/Shimmer Placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 animate-pulse">
          <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-brand-dark animate-spin opacity-40" />
        </div>
      )}

      {/* 2. Optimized Image itself */}
      {isInView && !hasError ? (
        <motion.img
          src={optimizedSrc}
          alt={alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full transition-all ${
            objectFit === "cover" ? "object-cover" :
            objectFit === "contain" ? "object-contain" :
            objectFit === "fill" ? "object-fill" :
            objectFit === "none" ? "object-none" :
            "object-scale-down"
          } ${className}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}

      {/* 3. Fallback state on error or empty URL */}
      {hasError || !src ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/80 text-slate-400 p-4 select-none">
          <ImageIcon className="w-8 h-8 mb-1 opacity-60" />
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500/80">
            {fallbackType === "product" ? "Sem Imagem" : "Não disponível"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
