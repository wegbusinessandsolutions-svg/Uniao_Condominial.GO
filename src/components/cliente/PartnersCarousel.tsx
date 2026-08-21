import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import OptimizedImage from "../ui/OptimizedImage";

interface Marca {
  id: string;
  nome?: string;
  logomarca?: string;
}

export default function PartnersCarousel() {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarcas() {
      try {
        const q = query(collection(db, "marcas_parceiras"), where("status", "==", "Ativo"));
        const snapshot = await getDocs(q);
        const marcasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marca));
        
        // Ordenação alfabética crescente de A a Z
        const sortedMarcas = marcasData.sort((a, b) => {
          const nomeA = (a.nome || "").trim();
          const nomeB = (b.nome || "").trim();
          return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base", numeric: true });
        });

        setMarcas(sortedMarcas);
      } catch (err) {
        console.error("Erro ao buscar marcas:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMarcas();
  }, []);

  if (loading || marcas.length === 0) return null;

  // Duplicate the array to create a seamless infinite marquee effect
  const repeatedMarcas = [...marcas, ...marcas, ...marcas, ...marcas];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 overflow-hidden relative">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Marcas Parceiras</h2>
        <a href="/cliente/marcas" className="text-sm font-medium text-[#0071e3] hover:underline">Ver todos</a>
      </div>

      <div className="relative w-full flex items-center overflow-hidden h-28 mask-image-fade">
        {/* CSS for custom mask if not using tailwind mask plugin directly */}
        <style>{`
          .mask-image-fade {
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          }
          .animate-marquee {
            animation: marquee 35s linear infinite;
          }
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee:hover {
            animation-play-state: paused;
          }
        `}</style>

        <div className="flex items-center gap-10 whitespace-nowrap animate-marquee">
          {repeatedMarcas.map((marca, idx) => (
            <div
              key={`${marca.id}-${idx}`}
              className="flex-shrink-0 w-36 h-18 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center p-2.5 hover:border-[#0071e3]/30 shadow-2xs hover:shadow-md hover:scale-105 transition-all duration-300"
            >
              <OptimizedImage
                src={marca.logomarca || ""}
                alt={marca.nome || "Parceiro"}
                objectFit="contain"
                className="w-full h-full object-contain"
                fallbackType="logo"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
