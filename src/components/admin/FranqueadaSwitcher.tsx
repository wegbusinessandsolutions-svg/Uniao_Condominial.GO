import React, { useState, useRef, useEffect } from "react";
import { useFranqueada } from "../../context/FranqueadaContext";
import { Building2, ChevronDown, Check, Plus, Globe, ExternalLink } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function FranqueadaSwitcher() {
  const { franqueadas, selectedUnidade, setSelectedUnidade, selectedFranqueada, isMasterView, isFranqueada, userUnidade } = useFranqueada();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Se o usuário for de Franqueada, exibe o seletor bloqueado / indicativo de unidade fixa
  if (isFranqueada) {
    const myUnit = franqueadas.find(f => f.codigoUnidade === userUnidade || f.id === userUnidade) || selectedFranqueada;
    return (
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 transition-all shadow-xs cursor-pointer"
          title="Unidade Franqueada Vinculada (Acesso Restrito à sua Franquia)"
        >
          <Building2 size={14} className="text-emerald-700 shrink-0" />
          <span className="truncate max-w-[180px] sm:max-w-[240px]">
            {myUnit?.codigoUnidade || userUnidade || "Franquia"} • {myUnit?.nomeFantasia || myUnit?.razaoSocial || "Sua Unidade"}
          </span>
          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-700 text-white rounded-md uppercase font-bold tracking-wider">
            Sua Franquia
          </span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
              <Building2 size={16} />
              Unidade Franqueada Vinculada
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Você está autenticado na unidade <strong className="text-slate-900">{myUnit?.codigoUnidade || userUnidade}</strong> ({myUnit?.nomeFantasia || myUnit?.razaoSocial || "Franqueada"}).
            </p>
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800">
              <span className="font-semibold block mb-0.5">Filtro de Segurança Rígido Ativo:</span>
              Você acessa exclusivamente os cadastros, produtos, pedidos e dados financeiros da sua própria unidade.
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-xs cursor-pointer ${
          isMasterView
            ? "bg-slate-900 text-white border-slate-800 hover:bg-slate-800"
            : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
        }`}
        title="Alternar contexto entre Franqueador Master (Todas as Unidades) ou Franqueada Específica"
      >
        {isMasterView ? (
          <Globe size={14} className="text-emerald-400 shrink-0" />
        ) : (
          <Building2 size={14} className="text-amber-600 shrink-0" />
        )}
        <span className="truncate max-w-[180px] sm:max-w-[240px]">
          {isMasterView
            ? "Franqueador Master (Rede Global)"
            : `${selectedFranqueada?.codigoUnidade || "Franquia"} • ${selectedFranqueada?.nomeFantasia || selectedFranqueada?.razaoSocial || "Unidade"}`}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3.5 py-2 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Contexto Operacional
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Selecione se deseja visualizar a rede inteira ou filtrar por uma unidade franqueada.
            </p>
          </div>

          <div className="py-1 max-h-60 overflow-y-auto">
            {/* Opção Rede Geral */}
            <button
              type="button"
              onClick={() => {
                setSelectedUnidade("ALL");
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                isMasterView
                  ? "bg-slate-900 text-white font-bold"
                  : "text-slate-700 hover:bg-slate-50 font-medium"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe size={15} className={isMasterView ? "text-emerald-400" : "text-slate-400"} />
                <div className="min-w-0">
                  <p className="truncate">Rede Global (Franqueador Master)</p>
                  <p className={`text-[10px] ${isMasterView ? "text-slate-300" : "text-slate-400"}`}>
                    Consolidado de todas as franqueadas
                  </p>
                </div>
              </div>
              {isMasterView && <Check size={14} className="text-emerald-400 shrink-0 ml-2" />}
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Lista de Franqueadas */}
            {franqueadas.length === 0 ? (
              <div className="px-3.5 py-3 text-center text-xs text-slate-400">
                Nenhuma empresa franqueada cadastrada ainda.
              </div>
            ) : (
              franqueadas.map((frq) => {
                const isSelected = selectedUnidade === frq.codigoUnidade || selectedUnidade === frq.id;
                return (
                  <button
                    key={frq.id}
                    type="button"
                    onClick={() => {
                      setSelectedUnidade(frq.codigoUnidade || frq.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-amber-500 text-white font-bold"
                        : "text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 size={15} className={isSelected ? "text-white" : "text-amber-600"} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            isSelected ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}>
                            {frq.codigoUnidade || "FRQ"}
                          </span>
                          <span className="truncate">{frq.nomeFantasia || frq.razaoSocial}</span>
                        </div>
                        <p className={`text-[10px] truncate ${isSelected ? "text-amber-100" : "text-slate-400"}`}>
                          {frq.cidade ? `${frq.cidade}/${frq.uf} • ` : ""}Royalties: {frq.royalties || 5}%
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-white shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-2 pb-1 px-2 border-t border-slate-100 flex flex-col gap-1">
            <Link
              to="/admin/franqueadora"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-1.5 text-xs text-[#0071e3] hover:bg-blue-50 rounded-lg font-medium transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Globe size={13} />
                Abrir Central do Franqueador
              </span>
              <ExternalLink size={12} />
            </Link>
            <Link
              to="/admin/empresa"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg font-medium transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus size={13} />
                Cadastrar Nova Franqueada
              </span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
