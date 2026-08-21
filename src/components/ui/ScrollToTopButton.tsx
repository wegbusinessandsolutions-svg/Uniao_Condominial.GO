import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Exibe o botão quando o scroll for maior que 280px
      if (window.scrollY > 280) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    // Verificação inicial
    toggleVisibility();

    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.7, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Subir para o topo da página"
          title="Subir para o topo"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-slate-900/90 hover:bg-sky-600 text-white shadow-xl shadow-slate-900/25 border border-white/20 backdrop-blur-md transition-colors duration-200 cursor-pointer group focus:outline-hidden focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
        >
          <ArrowUp
            size={22}
            className="transition-transform duration-200 group-hover:-translate-y-0.5"
            strokeWidth={2.5}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
