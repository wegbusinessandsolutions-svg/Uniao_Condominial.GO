import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ShoppingCart, Receipt, ArrowRight, BadgeCheck, HeartHandshake, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import PartnersCarousel from "../../components/cliente/PartnersCarousel";
import MuralCondominial from "../../components/cliente/MuralCondominial";
import WeatherWidget from "../../components/cliente/WeatherWidget";

import badgeBronze from "../../assets/images/badge_bronze_1787100127454.jpg";
import badgePrata from "../../assets/images/badge_prata_1787100145745.jpg";
import badgeOuro from "../../assets/images/badge_ouro_1787100156882.jpg";
import badgeDiamante from "../../assets/images/badge_diamante_1787100168869.jpg";

export default function CustomerDashboard() {
  const { profile, user } = useAuth();
  const [isAfiliado, setIsAfiliado] = useState<boolean | null>(null);
  const [afiliadoData, setAfiliadoData] = useState<any | null>(null);
  const [loadingAfiliado, setLoadingAfiliado] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAfiliacao = async () => {
      if (!user?.uid) {
        if (isMounted) setLoadingAfiliado(false);
        return;
      }

      try {
        // 1. Direct doc by user.uid
        const directSnap = await getDoc(doc(db, "afiliados_uc", user.uid));
        if (directSnap.exists()) {
          const data = directSnap.data();
          if (isMounted) {
            setAfiliadoData(data);
            setIsAfiliado(data.status === "Ativo" || data.afiliado === true);
            setLoadingAfiliado(false);
          }
          return;
        }

        // 2. Query by userId
        const qUser = query(collection(db, "afiliados_uc"), where("userId", "==", user.uid));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          const data = snapUser.docs[0].data();
          if (isMounted) {
            setAfiliadoData(data);
            setIsAfiliado(data.status === "Ativo" || data.afiliado === true);
            setLoadingAfiliado(false);
          }
          return;
        }

        // 3. Query by email
        if (user.email) {
          const qEmail = query(collection(db, "afiliados_uc"), where("email", "==", user.email));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const data = snapEmail.docs[0].data();
            if (isMounted) {
              setAfiliadoData(data);
              setIsAfiliado(data.status === "Ativo" || data.afiliado === true);
              setLoadingAfiliado(false);
            }
            return;
          }
        }

        // 4. Check profile flags
        const isProfAfil =
          (profile as any)?.afiliado === true ||
          (profile as any)?.isAfiliado === true ||
          (profile as any)?.statusAfiliacao === "Ativo";

        if (isMounted) {
          setIsAfiliado(isProfAfil);
          if (isProfAfil) {
            setAfiliadoData(profile);
          }
          setLoadingAfiliado(false);
        }
      } catch (err) {
        console.warn("Erro ao buscar afiliação no dashboard:", err);
        if (isMounted) {
          const fallback = (profile as any)?.afiliado === true || (profile as any)?.isAfiliado === true;
          setIsAfiliado(fallback);
          setLoadingAfiliado(false);
        }
      }
    };

    fetchAfiliacao();

    return () => {
      isMounted = false;
    };
  }, [user, profile]);

  const getFormattedDataAfiliacao = () => {
    const rawDate =
      afiliadoData?.dataAtivacao ||
      afiliadoData?.dataAfiliacao ||
      afiliadoData?.dataAceite ||
      afiliadoData?.createdAt ||
      (profile as any)?.dataAtivacao ||
      (profile as any)?.dataAfiliacao ||
      (profile as any)?.createdAt ||
      (profile as any)?.dataCadastro;

    if (!rawDate) {
      return new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    if (typeof rawDate === "object" && typeof rawDate.toDate === "function") {
      return rawDate.toDate().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    if (typeof rawDate === "string") {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        }
      } catch {
        // ignore
      }
    }

    return String(rawDate);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-[#f4f9fc] border border-[#e2eef5] rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative glowing lights in background for modern depth */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#46bad4]/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-[#12235a]/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Top Row: Date & Greeting on left, Classification on right */}
          <div className="flex justify-between items-center w-full gap-4">
            <div className="flex flex-col gap-2">
              {/* Date in first position */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <div className="bg-white border border-slate-200/80 shadow-xs px-4 py-2 rounded-2xl flex items-center gap-2.5 text-slate-700 font-medium text-xs sm:text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse shrink-0"></span>
                  <div className="leading-tight">
                    <div>Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })},</div>
                    <div>
                      {new Date().getDate()} de {new Date().toLocaleDateString('pt-BR', { month: 'long' })} de {new Date().getFullYear()}.
                    </div>
                  </div>
                </div>
                <WeatherWidget cidade={profile?.cidade} />
              </div>
              {/* Welcome message below date */}
              <p className="text-[#64748b] text-sm font-semibold tracking-wide ml-1">Bem-vindo de volta</p>
            </div>

            {/* Classification badge ahead of the two items */}
            {(() => {
              const rawLevel = (profile?.level || "Bronze").trim();
              const levelKey = rawLevel.toLowerCase();

              let badgeImage = badgeBronze;
              let badgeAlt = "Categoria Bronze";
              let badgeBorderClass = "border-amber-200/80 hover:border-amber-300";
              let textClass = "text-[#78350f]";

              if (levelKey === "prata") {
                badgeImage = badgePrata;
                badgeAlt = "Categoria Prata";
                badgeBorderClass = "border-slate-200 hover:border-slate-300";
                textClass = "text-[#334155]";
              } else if (levelKey === "ouro") {
                badgeImage = badgeOuro;
                badgeAlt = "Categoria Ouro";
                badgeBorderClass = "border-amber-300/80 hover:border-amber-400";
                textClass = "text-[#854d0e]";
              } else if (levelKey === "diamante") {
                badgeImage = badgeDiamante;
                badgeAlt = "Categoria Diamante";
                badgeBorderClass = "border-sky-200/80 hover:border-sky-300";
                textClass = "text-[#0369a1]";
              }

              return (
                <div
                  className={`flex flex-col items-center justify-center p-2 sm:p-2.5 min-w-[110px] sm:min-w-[124px] bg-white border rounded-2xl shadow-3xs hover:shadow-xs transition-all duration-300 ${badgeBorderClass}`}
                >
                  {/* Category Medal Image */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mb-1 drop-shadow-2xs transition-transform hover:scale-105 duration-300">
                    <img
                      src={badgeImage}
                      alt={badgeAlt}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[9px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                    Classificação
                  </p>
                  <p className={`text-xs sm:text-sm font-black tracking-wide mt-1 leading-none capitalize ${textClass}`}>
                    {rawLevel}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Customer Identification at the bottom */}
          <div className="w-full">
            <h1 className="text-2xl sm:text-3.5xl font-extrabold text-[#0f172a] leading-tight tracking-tight max-w-[34rem]">
              Olá, {profile?.displayName || "Cliente"}
            </h1>
          </div>
        </div>
      </div>

      {/* Item de Afiliação à União Condominial (Afiliado vs Não Afiliado) */}
      {loadingAfiliado ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs animate-pulse flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        </div>
      ) : isAfiliado ? (
        /* Caso Afiliado: Item com Ícone de Aprovação e data de afiliação */
        <div className="bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white border border-emerald-200/90 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 border border-emerald-400">
                <BadgeCheck className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-xs" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-3xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Afiliado Ativo
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Você é um Afiliado à <span className="notranslate" translate="no">União Condominial</span>, desde à data de:{" "}
                  <span className="text-emerald-700 font-extrabold underline decoration-emerald-300 decoration-2 underline-offset-4">
                    {getFormattedDataAfiliacao()}
                  </span>
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-0.5">
                  Seu condomínio conta com <strong>até 50% de desconto</strong> em todos os serviços condominiais rotineiros agendados, condições diferenciadas em produtos de limpeza e acesso exclusivo aos parceiros do Clube de Benefícios.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0 pt-2 md:pt-0">
              <Link
                to="/cliente/servicos"
                className="inline-flex items-center justify-center gap-2 w-full md:w-auto py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm hover:shadow transition-all active:scale-98"
              >
                <span>Serviços com 50% OFF</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/cliente/meus-dados"
                className="inline-flex items-center justify-center py-3 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-2xl text-xs sm:text-sm shadow-3xs transition-all whitespace-nowrap"
                title="Ver dados do contrato"
              >
                Ver Detalhes
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Caso Não Afiliado: Sugestão de Afiliação com Explicação dos Descontos */
        <div className="bg-gradient-to-br from-blue-50/95 via-sky-50/40 to-white border border-blue-200/90 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 border border-blue-400">
                  <HeartHandshake className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-xs" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#0071e3] border border-blue-200 mb-1.5">
                    <Sparkles size={13} className="text-amber-500" />
                    Oportunidade Exclusiva para seu Condomínio
                  </span>
                  <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 leading-tight">
                    Afilie-se à <span className="notranslate" translate="no">União Condominial</span> e economize até 50%
                  </h2>
                </div>
              </div>

              <Link
                to="/cliente/meus-dados"
                className="inline-flex items-center justify-center gap-2 w-full lg:w-auto py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold rounded-2xl text-sm sm:text-base shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-98 shrink-0"
              >
                <span>Quero me Afiliar Agora</span>
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="bg-white/85 backdrop-blur-xs rounded-2xl p-4 sm:p-5 border border-blue-100 shadow-3xs space-y-3">
              <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-medium">
                Ao afiliar seu condomínio à <strong><span className="notranslate" translate="no">União Condominial.GO</span></strong>, você desbloqueia uma série de vantagens que reduzem significativamente os custos e despesas da gestão:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0071e3] flex items-center justify-center shrink-0 font-bold text-xs">
                    50%
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Serviços até 50% OFF</h4>
                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                      Limpeza de caixas d'água e gordura, jardinagem, portões, elétrica, CFTV e alarmes.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    🧴
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Preços Especiais</h4>
                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                      Produtos de limpeza e conservação de alta performance direto da distribuidora.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    💰
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Cashback Acumulativo</h4>
                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                      Créditos automáticos a cada pedido para abater em novas compras ou resgatar.
                    </p>
                  </div>
                </div>

                <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    🤝
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Clube de Benefícios</h4>
                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                      Rede credenciada de empresas e prestadores homologados em Goiânia e região.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0071e3] flex items-center justify-center shadow-2xs">
               <ShoppingCart className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Última compra</h2>
          </div>
          <p className="text-slate-600 text-base leading-relaxed">
            Você ainda não realizou compras conosco. Que tal <Link to="/produtos" className="text-[#0071e3] font-bold hover:underline">conhecer nossos produtos</Link>?
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
                 <Receipt className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Cashback acumulado</h2>
            </div>
            <p className="text-slate-600 text-base mb-1 font-medium">Até o momento, você tem</p>
            <p className="text-3.5xl sm:text-4xl font-black text-[#0071e3] mb-2">
              R$ {profile?.cashbackBalance?.toFixed(2) || "0,00"}
            </p>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">em cashback para compra de mercadorias e produtos dentro do nosso site.</p>
          </div>
          <Link
            to="/cliente/cashback"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-5 bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-bold rounded-2xl text-sm sm:text-base transition-all active:scale-98"
          >
            <span>Ver Extrato e Resgatar</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <MuralCondominial />

      <PartnersCarousel />
    </div>
  );
}
