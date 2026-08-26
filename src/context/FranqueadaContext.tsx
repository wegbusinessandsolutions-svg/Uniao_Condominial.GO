import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { initFirebase } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import {
  isFranqueadoraUser,
  getUserFranqueadaCode,
  matchesFranqueadaScope,
  applyFranqueadaDataFilter,
  injectFranqueadaScope,
  canUserMutateRecord,
  FranqueadaMatchable,
} from "../lib/franqueadaAccess";

export interface FranqueadaUnit {
  id: string;
  codigoUnidade: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  statusFranquia?: "Ativa" | "Em Implantação" | "Suspensa" | "Inativa" | string;
  responsavelUnidade?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  royalties?: string | number;
  fundoPropaganda?: string | number;
  taxaFranquia?: string | number;
  dataInicio?: string;
  logoUrl?: string;
  [key: string]: any;
}

interface FranqueadaContextType {
  franqueadas: FranqueadaUnit[];
  selectedUnidade: string; // "ALL" para Franqueador Master (Todas), ou o codigoUnidade (ex: "FRQ-001")
  setSelectedUnidade: (codigo: string) => void;
  selectedFranqueada: FranqueadaUnit | null;
  isMasterView: boolean;
  isFranqueadora: boolean; // Usuário tem acesso irrestrito à Matriz/Rede
  isFranqueada: boolean; // Usuário restrito a uma filial específica
  userUnidade: string; // Código/ID da franquia do usuário logado
  effectiveUnidade: string; // "ALL" ou unidade ativa efetiva para filtragem
  loading: boolean;
  refreshFranqueadas: () => Promise<void>;
  filterByFranqueada: <T extends FranqueadaMatchable>(items: T[]) => T[];
  matchesFranqueada: (item: FranqueadaMatchable | null | undefined) => boolean;
  injectFranqueada: <T extends Record<string, any>>(data: T) => T & { franqueadaId?: string; codigoUnidade?: string };
  canModify: (item: FranqueadaMatchable) => boolean;
}

const FranqueadaContext = createContext<FranqueadaContextType>({
  franqueadas: [],
  selectedUnidade: "ALL",
  setSelectedUnidade: () => {},
  selectedFranqueada: null,
  isMasterView: true,
  isFranqueadora: true,
  isFranqueada: false,
  userUnidade: "",
  effectiveUnidade: "ALL",
  loading: true,
  refreshFranqueadas: async () => {},
  filterByFranqueada: (items) => items,
  matchesFranqueada: () => true,
  injectFranqueada: (data) => data,
  canModify: () => true,
});

export const useFranqueada = () => useContext(FranqueadaContext);

export const FranqueadaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, user } = useAuth();
  const [franqueadas, setFranqueadas] = useState<FranqueadaUnit[]>([]);
  const [selectedUnidadeState, setSelectedUnidadeState] = useState<string>(() => {
    return localStorage.getItem("admin_selected_unidade") || "ALL";
  });
  const [loading, setLoading] = useState(true);

  // Determinar se o usuário logado é da Franqueadora (Master) ou de uma Franqueada (Filial)
  const isFranqueadora = useMemo(() => {
    return isFranqueadoraUser(profile, user?.email);
  }, [profile, user]);

  const isFranqueada = !isFranqueadora;
  const userUnidade = useMemo(() => {
    return getUserFranqueadaCode(profile);
  }, [profile]);

  // Se o usuário for de Franqueada, a unidade efetiva é OBRIGATORIAMENTE a dele (Filtro Rígido)
  // Se for Franqueadora, usa a unidade selecionada no switcher ("ALL" ou código específico)
  const effectiveUnidade = useMemo(() => {
    if (isFranqueada && userUnidade) {
      return userUnidade;
    }
    return selectedUnidadeState || "ALL";
  }, [isFranqueada, userUnidade, selectedUnidadeState]);

  const fetchFranqueadas = async () => {
    try {
      const { db } = await initFirebase();
      const list: FranqueadaUnit[] = [];
      const seenIds = new Set<string>();

      // 1. Ler da coleção principal de Empresas/Franqueadas
      try {
        const empSnap = await getDocs(collection(db, "config_empresa"));
        empSnap.forEach((d) => {
          const data = d.data();
          const codigo = data.codigoUnidade || `FRQ-${list.length + 1}`.padStart(7, "0");
          list.push({
            id: d.id,
            codigoUnidade: codigo,
            razaoSocial: data.razaoSocial || "Empresa Franqueada",
            nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
            cnpj: data.cnpj || "",
            statusFranquia: data.statusFranquia || "Ativa",
            responsavelUnidade: data.responsavelUnidade || data.resp1Nome || "",
            email: data.email || "",
            telefone: data.telefone || "",
            cidade: data.cidade || "",
            uf: data.uf || "",
            royalties: data.royalties || "5",
            fundoPropaganda: data.fundoPropaganda || "2",
            taxaFranquia: data.taxaFranquia || "",
            dataInicio: data.dataInicio || "",
            logoUrl: data.logoUrl || "",
            ...data,
          });
          seenIds.add(d.id);
        });
      } catch (err) {
        console.warn("[FranqueadaContext] Erro ao carregar config_empresa:", err);
      }

      // 2. Ler de config_franqueadora caso haja registros legados
      try {
        const frqSnap = await getDocs(collection(db, "config_franqueadora"));
        frqSnap.forEach((d) => {
          if (!seenIds.has(d.id)) {
            const data = d.data();
            const codigo = data.numeroFranqueada || data.codigoUnidade || `FRQ-${list.length + 1}`.padStart(7, "0");
            list.push({
              id: d.id,
              codigoUnidade: codigo,
              razaoSocial: data.razaoSocial || "Franqueada",
              nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
              cnpj: data.cnpj || "",
              statusFranquia: "Ativa",
              responsavelUnidade: data.resp1Nome || "",
              email: data.email || "",
              telefone: data.telefone || "",
              cidade: data.cidade || "",
              uf: data.uf || "",
              royalties: data.royalties || "5",
              fundoPropaganda: data.fundoPropaganda || "2",
              taxaFranquia: data.taxaFranquia || "",
              ...data,
            });
            seenIds.add(d.id);
          }
        });
      } catch (err) {
        console.warn("[FranqueadaContext] Erro ao carregar config_franqueadora:", err);
      }

      setFranqueadas(list);
    } catch (error) {
      console.error("[FranqueadaContext] Erro geral ao buscar franqueadas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFranqueadas();
  }, []);

  const setSelectedUnidade = (codigo: string) => {
    if (isFranqueada) {
      // Se for usuário de Franqueada, não permite trocar o contexto para ALL ou outra franqueada
      return;
    }
    setSelectedUnidadeState(codigo);
    localStorage.setItem("admin_selected_unidade", codigo);
  };

  const isMasterView = isFranqueadora && effectiveUnidade === "ALL";
  const selectedFranqueada = useMemo(() => {
    if (isMasterView) return null;
    return (
      franqueadas.find(
        (f) => f.codigoUnidade === effectiveUnidade || f.id === effectiveUnidade
      ) || null
    );
  }, [isMasterView, franqueadas, effectiveUnidade]);

  // Helpers de CRUD e Acesso para os componentes administrativos
  const filterByFranqueada = <T extends FranqueadaMatchable>(items: T[]): T[] => {
    return applyFranqueadaDataFilter(items, profile, effectiveUnidade, franqueadas);
  };

  const matchesFranqueada = (item: FranqueadaMatchable | null | undefined): boolean => {
    if (isMasterView) return true;
    return matchesFranqueadaScope(item, effectiveUnidade, franqueadas);
  };

  const injectFranqueada = <T extends Record<string, any>>(data: T): T & { franqueadaId?: string; codigoUnidade?: string } => {
    return injectFranqueadaScope(data, profile, effectiveUnidade, franqueadas);
  };

  const canModify = (item: FranqueadaMatchable): boolean => {
    return canUserMutateRecord(item, profile, franqueadas);
  };

  return (
    <FranqueadaContext.Provider
      value={{
        franqueadas,
        selectedUnidade: effectiveUnidade,
        setSelectedUnidade,
        selectedFranqueada,
        isMasterView,
        isFranqueadora,
        isFranqueada,
        userUnidade,
        effectiveUnidade,
        loading,
        refreshFranqueadas: fetchFranqueadas,
        filterByFranqueada,
        matchesFranqueada,
        injectFranqueada,
        canModify,
      }}
    >
      {children}
    </FranqueadaContext.Provider>
  );
};

