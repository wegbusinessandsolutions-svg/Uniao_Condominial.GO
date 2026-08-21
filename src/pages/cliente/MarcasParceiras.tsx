import React, { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import OptimizedImage from "../../components/ui/OptimizedImage";

interface Marca {
  id: string;
  nome?: string;
  descricao?: string;
  produtos?: string;
  produtosDisponibilizados?: string;
  logomarca?: string;
}

export default function MarcasParceiras() {
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <Tag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Marcas Parceiras</h1>
            <p className="text-sm text-slate-500">Trabalhamos com as melhores marcas do mercado para garantir qualidade ao seu condomínio.</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
             <div className="text-center py-12 text-slate-500">Carregando marcas...</div>
          ) : marcas.length === 0 ? (
             <div className="text-center py-12 text-slate-500">Nenhuma marca parceira cadastrada.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {marcas.map((marca) => (
                <div key={marca.id} className="bg-white border border-slate-200 rounded-xl flex flex-col p-6 hover:shadow-md transition-shadow">
                  <div className="aspect-[4/3] w-full bg-slate-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-slate-100">
                    <OptimizedImage
                      src={marca.logomarca || ""}
                      alt={marca.nome || ""}
                      objectFit="contain"
                      className="p-2"
                      fallbackType="logo"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{marca.nome || "Marca Sem Nome"}</h3>
                  <p className="text-sm text-slate-500 mb-3">{marca.descricao || "Sem descrição disponível."}</p>
                  {(marca.produtos || marca.produtosDisponibilizados) && (
                    <div className="mt-2 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Produtos Disponibilizados
                      </h4>
                      <p className="text-sm text-slate-600 whitespace-pre-line">
                        {marca.produtos || marca.produtosDisponibilizados}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
