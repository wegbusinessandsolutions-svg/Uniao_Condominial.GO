import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ShoppingCart, Receipt, ArrowRight, HeartHandshake, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { doc, getDoc, getDocs, collection, query, where, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import PartnersCarousel from "../../components/cliente/PartnersCarousel";
import MuralCondominial from "../../components/cliente/MuralCondominial";
import WeatherWidget from "../../components/cliente/WeatherWidget";
import { DashboardLiveTracker } from "../../components/cliente/DashboardLiveTracker";

import badgeBronze from "../../assets/images/badge_bronze_1787100127454.jpg";
import badgePrata from "../../assets/images/badge_prata_1787100145745.jpg";
import badgeOuro from "../../assets/images/badge_ouro_1787100156882.jpg";
import badgeDiamante from "../../assets/images/badge_diamante_1787100168869.jpg";
import { Lightbulb, X } from "lucide-react";

export default function CustomerDashboard() {
  const { profile, user } = useAuth();
  const location = useLocation();
  const [isAfiliado, setIsAfiliado] = useState<boolean | null>(null);
  const [loadingAfiliado, setLoadingAfiliado] = useState(true);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isSuggestionSuccess, setIsSuggestionSuccess] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const hasSugestaoQuery = queryParams.get("sugestao") === "true";
    const hasStoredFlag = localStorage.getItem("openSuggestion") === "true" || sessionStorage.getItem("openSuggestion") === "true";

    if (hasSugestaoQuery || hasStoredFlag) {
      setIsSuggestionModalOpen(true);
      localStorage.removeItem("openSuggestion");
      sessionStorage.removeItem("openSuggestion");
    }
  }, [location.search]);

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    
    setIsSubmittingSuggestion(true);
    try {
      const nomeCondominio = (profile as any)?.nomeEmpresa || (profile as any)?.condominio || profile?.displayName || (profile as any)?.nomeCompleto || "Condomínio Não Informado";
      const nomeSindico = (profile as any)?.nomeResponsavel || (profile as any)?.sindico || (profile as any)?.nomeCompleto || profile?.displayName || "Síndico Não Informado";
      const telefone = (profile as any)?.telefone || (profile as any)?.phone || "";
      const email = profile?.email || user?.email || "";

      await addDoc(collection(db, "sugestoes"), {
        userId: user?.uid || null,
        condominio: nomeCondominio,
        sindico: nomeSindico,
        nomeEmpresa: nomeCondominio,
        nomeResponsavel: nomeSindico,
        telefone: telefone,
        email: email,
        titulo: "Sugestão",
        mensagem: suggestionText.trim(),
        status: "Nova",
        createdAt: new Date(),
      });

      try {
        await addDoc(collection(db, "mail"), {
          to: "ceo@uniaocondominial.com.br",
          message: {
            subject: "Nova Sugestão Recebida - Aplicativo",
            html: `
              <h3>Nova Sugestão Recebida</h3>
              <p><strong>Condomínio/Empresa:</strong> ${nomeCondominio}</p>
              <p><strong>Responsável/Síndico:</strong> ${nomeSindico}</p>
              <p><strong>Telefone:</strong> ${telefone}</p>
              <p><strong>E-mail:</strong> ${email}</p>
              <br />
              <p><strong>Sugestão:</strong></p>
              <p>${suggestionText.trim().replace(/\n/g, '<br/>')}</p>
            `
          }
        });
      } catch (mailErr) {
        console.warn("Disparo de e-mail assíncrono em fila não processado:", mailErr);
      }

      setIsSuggestionSuccess(true);
      setSuggestionText("");
    } catch (error) {
      console.error("Erro ao enviar sugestão:", error);
      alert("Ocorreu um erro ao enviar sua sugestão. Tente novamente.");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-[#f4f9fc] rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        {/* Subtle decorative glowing lights in background for modern depth */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#46bad4]/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-[#12235a]/5 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Top Row: Left side has Date & Weather + Greeting; Right side has Classification aligned by the top */}
          <div className="flex flex-row justify-between items-start w-full gap-3 sm:gap-4">
            {/* Left Column: Date & Weather widgets on top, greeting below */}
            <div className="flex flex-col items-start gap-2 flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-sm w-full max-w-xl">
                {/* 1. Date Card */}
                <div className="bg-white shadow-xs hover:shadow-md px-4 py-2.5 rounded-2xl flex items-center justify-start gap-2.5 text-slate-700 text-xs sm:text-sm font-normal min-h-[56px] transition-shadow w-full">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse shrink-0"></span>
                  <div className="leading-tight">
                    <div>Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })},</div>
                    <div>
                      {new Date().getDate()} de {new Date().toLocaleDateString('pt-BR', { month: 'long' })} de {new Date().getFullYear()}.
                    </div>
                  </div>
                </div>

                {/* 2. Temperature Card */}
                <WeatherWidget cidade={profile?.cidade} className="w-full justify-start" />
              </div>

            </div>

            {/* Right Column: Classification Badge (aligned at the top with Date, spacious padding) */}
            {(() => {
              const rawLevel = (profile?.level || "Bronze").trim();
              const levelKey = rawLevel.toLowerCase();

              let badgeImage = badgeBronze;
              let badgeAlt = "Categoria Bronze";
              let textClass = "text-[#78350f]";

              if (levelKey === "prata") {
                badgeImage = badgePrata;
                badgeAlt = "Categoria Prata";
                textClass = "text-[#334155]";
              } else if (levelKey === "ouro") {
                badgeImage = badgeOuro;
                badgeAlt = "Categoria Ouro";
                textClass = "text-[#854d0e]";
              } else if (levelKey === "diamante") {
                badgeImage = badgeDiamante;
                badgeAlt = "Categoria Diamante";
                textClass = "text-[#0369a1]";
              }

              return (
                <button
                  type="button"
                  onClick={() => setIsClassificationModalOpen(true)}
                  title="Clique para ampliar a classificação do condomínio"
                  className="group flex flex-col items-center justify-center p-3.5 sm:px-5 sm:py-4 min-w-[122px] sm:min-w-[145px] bg-white shadow-xs hover:shadow-md active:scale-95 rounded-2xl transition-all duration-200 cursor-pointer shrink-0 focus:outline-none"
                >
                  {/* Category Medal Image */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden flex items-center justify-center mb-1.5 drop-shadow-2xs transition-transform group-hover:scale-105 duration-200">
                    <img
                      src={badgeImage}
                      alt={badgeAlt}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Title with comfortable breathing room */}
                  <span className="text-[11px] sm:text-xs text-slate-400 font-normal uppercase tracking-wider block px-2 py-0.5 mb-0.5 leading-tight text-center">
                    Classificação
                  </span>

                  {/* Level value */}
                  <span className={`text-[13px] sm:text-base font-medium tracking-wide capitalize leading-tight text-center ${textClass}`}>
                    {rawLevel}
                  </span>
                </button>
              );
            })()}
          </div>

          {/* Customer Identification (Font size reduced by 10%) */}
          <div className="w-full -mt-2">
            <p className="text-slate-500 text-sm sm:text-base font-normal tracking-wide ml-0.5 mb-1.5">Bem-vindo de volta,</p>
            <h1 className="text-[27px] sm:text-[32.4px] font-normal text-[#0f172a] leading-tight tracking-tight max-w-[34rem]">
              Olá, {profile?.displayName || "Cliente"}
            </h1>
          </div>
        </div>
      </div>

      {/* Sugestão de Afiliação para Não Afiliados */}
      {!loadingAfiliado && !isAfiliado && (
        /* Caso Não Afiliado: Sugestão de Afiliação com Explicação dos Descontos */
        <div className="bg-gradient-to-br from-blue-50/95 via-sky-50/40 to-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden transition-all hover:shadow-lg">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                  <HeartHandshake className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-xs" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-normal bg-blue-100 text-[#0071e3] mb-1.5 shadow-2xs">
                    <Sparkles size={13} className="text-amber-500" />
                    Oportunidade Exclusiva para seu Condomínio
                  </span>
                  <h2 className="text-xl sm:text-2xl font-normal text-slate-900 leading-tight">
                    Afilie-se à <span className="notranslate" translate="no">União Condominial</span> e economize até 50%
                  </h2>
                </div>
              </div>

              <Link
                to="/cliente/meus-dados"
                className="inline-flex items-center justify-center gap-2 w-full lg:w-auto py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium rounded-2xl text-base shadow-md shadow-blue-500/20 hover:shadow-lg transition-all active:scale-98 shrink-0"
              >
                <span>Quero me Afiliar Agora</span>
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <p className="text-base text-slate-700 leading-relaxed font-normal">
                Ao afiliar seu condomínio à <span className="font-medium notranslate" translate="no">União Condominial.GO</span>, você desbloqueia uma série de vantagens que reduzem significativamente os custos e despesas da gestão:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="bg-blue-50/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#0071e3] flex items-center justify-center shrink-0 font-medium text-sm">
                    50%
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">Serviços até 50% OFF</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-normal">
                      Limpeza de caixas d'água e gordura, jardinagem, portões, elétrica, CFTV e alarmes.
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-medium text-sm">
                    🧴
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">Preços Especiais</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-normal">
                      Produtos de limpeza e conservação de alta performance direto da distribuidora.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-medium text-sm">
                    💰
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">Cashback Acumulativo</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-normal">
                      Créditos automáticos a cada pedido para abater em novas compras ou resgatar.
                    </p>
                  </div>
                </div>

                <div className="bg-purple-50/80 rounded-2xl p-4 shadow-xs flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 font-medium text-sm">
                    🤝
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-900">Clube de Benefícios</h4>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-normal">
                      Rede credenciada de empresas e prestadores homologados em Goiânia e região.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Principal Item: Acompanhamento em Tempo Real de Pedidos e Ordens de Serviço */}
      <DashboardLiveTracker isAfiliado={isAfiliado ?? false} />

      {/* Cartão de Cashback e Benefícios */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-normal text-slate-900">Cashback Acumulado no Condomínio</h2>
            <p className="text-slate-500 text-sm sm:text-base mt-1 font-normal">
              Saldo disponível para abater em novos pedidos de produtos ou serviços.
            </p>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-3xl sm:text-4xl font-light text-[#0071e3]">
                R$ {profile?.cashbackBalance?.toFixed(2) || "0,00"}
              </span>
              <span className="text-xs sm:text-sm font-normal text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg shadow-2xs">
                Disponível para Resgate
              </span>
            </div>
          </div>
        </div>

        <Link
          to="/cliente/cashback"
          className="inline-flex items-center justify-center gap-2 w-full md:w-auto py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium rounded-2xl text-sm sm:text-base shadow-sm transition-all active:scale-98 shrink-0"
        >
          <span>Ver Extrato e Resgatar</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <MuralCondominial />

      <PartnersCarousel />
      {isSuggestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2.5 sm:p-4 overflow-x-hidden overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 w-full max-w-[calc(100vw-1.25rem)] sm:max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto overflow-x-hidden box-border">
            <button 
              onClick={() => setIsSuggestionModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            
            {!isSuggestionSuccess ? (
              <div className="w-full max-w-full">
                <div className="flex items-center gap-3 mb-4 sm:mb-6 pr-8">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-sky-100 text-[#0071e3] rounded-xl flex items-center justify-center shrink-0">
                    <Lightbulb size={20} />
                  </div>
                  <h3 className="text-base sm:text-xl font-medium text-slate-900 truncate">
                    Envie sua Sugestão
                  </h3>
                </div>

                <form onSubmit={handleSubmitSuggestion} className="space-y-3 sm:space-y-4 w-full max-w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4 w-full max-w-full">
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Nome do Condomínio</label>
                      <input 
                        type="text" 
                        readOnly 
                        disabled
                        value={(profile as any)?.nomeEmpresa || (profile as any)?.condominio || profile?.displayName || (profile as any)?.nomeCompleto || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs sm:text-sm font-normal shadow-xs box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Nome do Síndico / Responsável</label>
                      <input 
                        type="text" 
                        readOnly 
                        disabled
                        value={(profile as any)?.nomeResponsavel || (profile as any)?.sindico || (profile as any)?.nomeCompleto || profile?.displayName || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs sm:text-sm font-normal shadow-xs box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Telefone para contato</label>
                      <input 
                        type="text" 
                        readOnly 
                        disabled
                        value={(profile as any)?.telefone || (profile as any)?.phone || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs sm:text-sm font-normal shadow-xs box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">E-mail</label>
                      <input 
                        type="email" 
                        readOnly 
                        disabled
                        value={profile?.email || user?.email || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs sm:text-sm font-normal shadow-xs box-border truncate"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1 w-full min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Título</label>
                    <input 
                      type="text" 
                      readOnly 
                      disabled
                      value="Sugestão"
                      className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs sm:text-sm font-normal shadow-xs box-border truncate"
                    />
                  </div>

                  <div className="space-y-1 w-full min-w-0">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Descreva abaixo a sua sugestão</label>
                    <textarea 
                      required
                      rows={4}
                      value={suggestionText}
                      onChange={(e) => setSuggestionText(e.target.value)}
                      placeholder="Descreva abaixo a sua sugestão. Iremos analisar cuidadosamente para trazer melhorias para toda a rede."
                      className="w-full min-w-0 max-w-full px-3 py-2 sm:py-2.5 rounded-xl bg-slate-50 text-slate-900 text-xs sm:text-sm shadow-xs focus:ring-2 focus:ring-[#0071e3]/20 transition-all resize-none font-normal box-border break-words"
                    ></textarea>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2 w-full">
                    <button 
                      type="button"
                      onClick={() => setIsSuggestionModalOpen(false)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-normal hover:bg-slate-200 transition-colors cursor-pointer text-center text-xs sm:text-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmittingSuggestion || !suggestionText.trim()}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center text-xs sm:text-sm"
                    >
                      {isSubmittingSuggestion ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-5 sm:py-8 w-full max-w-full">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Lightbulb size={26} className="sm:hidden" />
                  <Lightbulb size={32} className="hidden sm:block" />
                </div>
                <h3 className="text-lg sm:text-2xl font-normal text-slate-900 mb-2">Sugestão Enviada!</h3>
                <p className="text-slate-600 mb-5 sm:mb-8 max-w-sm mx-auto text-xs sm:text-base font-normal leading-relaxed">
                  A sugestão foi enviada, e será criteriosamente analisada, agradecemos sua contribuição.
                </p>
                <button 
                  onClick={() => {
                    setIsSuggestionModalOpen(false);
                    setTimeout(() => setIsSuggestionSuccess(false), 300);
                  }}
                  className="w-full sm:w-auto px-7 py-2.5 sm:py-3 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium transition-colors cursor-pointer shadow-md text-sm"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de Classificação do Condomínio (Centralizado com ícone 4x maior) */}
      {isClassificationModalOpen && (() => {
        const rawLevel = (profile?.level || "Bronze").trim();
        const levelKey = rawLevel.toLowerCase();

        let badgeImage = badgeBronze;
        let badgeAlt = "Categoria Bronze";
        let textClass = "text-[#78350f]";
        let bgGradient = "from-amber-500/10 via-amber-500/5 to-transparent";

        if (levelKey === "prata") {
          badgeImage = badgePrata;
          badgeAlt = "Categoria Prata";
          textClass = "text-[#334155]";
          bgGradient = "from-slate-400/10 via-slate-400/5 to-transparent";
        } else if (levelKey === "ouro") {
          badgeImage = badgeOuro;
          badgeAlt = "Categoria Ouro";
          textClass = "text-[#854d0e]";
          bgGradient = "from-amber-400/15 via-amber-400/5 to-transparent";
        } else if (levelKey === "diamante") {
          badgeImage = badgeDiamante;
          badgeAlt = "Categoria Diamante";
          textClass = "text-[#0369a1]";
          bgGradient = "from-sky-500/15 via-sky-500/5 to-transparent";
        }

        return (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setIsClassificationModalOpen(false)}
          >
            <div 
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Efeito sutil de iluminação decorativa no topo */}
              <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${bgGradient} pointer-events-none`} />

              {/* Botão Fechar no canto superior direito */}
              <button 
                type="button"
                onClick={() => setIsClassificationModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer z-10"
                title="Fechar janela"
              >
                <X size={20} />
              </button>

              {/* Título do Condomínio e Classificação */}
              <div className="relative z-10 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-normal bg-sky-50 text-[#0071e3] shadow-2xs uppercase tracking-wider">
                  <Sparkles size={13} className="text-amber-500" />
                  Classificação do Condomínio
                </span>
                <h3 className="text-2xl font-normal text-slate-900 mt-2 truncate px-4">
                  {profile?.displayName || "Condomínio"}
                </h3>
              </div>

              {/* Apresentação da Classificação: Ícone Medalha 4x Maior */}
              <div className="relative z-10 flex flex-col items-center justify-center py-2">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center p-2 bg-gradient-to-b from-slate-50 to-white shadow-xl transition-transform duration-300 hover:scale-105">
                  <img
                    src={badgeImage}
                    alt={badgeAlt}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>

                <div className="mt-5 mb-2 px-3.5 py-1 bg-slate-100/70 rounded-full inline-flex items-center justify-center">
                  <p className="text-xs sm:text-sm text-slate-500 font-normal uppercase tracking-wider leading-none">
                    Classificação
                  </p>
                </div>
                <p className={`text-2xl sm:text-3xl font-light tracking-wide mt-1 leading-none capitalize ${textClass}`}>
                  {rawLevel}
                </p>
              </div>

              {/* Botão Fechar abaixo da apresentação da classificação */}
              <div className="relative z-10 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsClassificationModalOpen(false)}
                  className="w-full py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-medium rounded-2xl text-base shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
