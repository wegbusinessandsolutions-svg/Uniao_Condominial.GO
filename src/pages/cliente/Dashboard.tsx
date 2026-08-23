import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { ShoppingCart, Receipt, ArrowRight, HeartHandshake, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
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
import { addDoc } from "firebase/firestore";

export default function CustomerDashboard() {
  const { profile, user } = useAuth();
  const [isAfiliado, setIsAfiliado] = useState<boolean | null>(null);
  const [loadingAfiliado, setLoadingAfiliado] = useState(true);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isSuggestionSuccess, setIsSuggestionSuccess] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("openSuggestion") === "true") {
      setIsSuggestionModalOpen(true);
      localStorage.removeItem("openSuggestion");
    }
  }, []);

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    
    setIsSubmittingSuggestion(true);
    try {
      await addDoc(collection(db, "sugestoes"), {
        userId: user?.uid || null,
        condominio: (profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || "",
        sindico: (profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || "",
        telefone: (profile as any)?.telefone || "",
        email: profile?.email || user?.email || "",
        titulo: "Sugestão",
        mensagem: suggestionText,
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
              <p><strong>Condomínio/Empresa:</strong> ${(profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
              <p><strong>Responsável:</strong> ${(profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
              <p><strong>Telefone:</strong> ${(profile as any)?.telefone || ""}</p>
              <p><strong>E-mail:</strong> ${profile?.email || user?.email || ""}</p>
              <br />
              <p><strong>Sugestão:</strong></p>
              <p>${suggestionText.replace(/\n/g, '<br/>')}</p>
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
                <button
                  type="button"
                  onClick={() => setIsClassificationModalOpen(true)}
                  title="Clique para ampliar a classificação do condomínio"
                  className="group flex flex-col items-center justify-center p-2 sm:p-2.5 min-w-[110px] sm:min-w-[124px] bg-transparent hover:bg-white/70 active:scale-95 rounded-2xl transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                >
                  {/* Category Medal Image */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden flex items-center justify-center mb-1 drop-shadow-2xs transition-transform group-hover:scale-110 duration-300">
                    <img
                      src={badgeImage}
                      alt={badgeAlt}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[9px] text-black font-extrabold uppercase tracking-widest leading-none group-hover:text-[#0071e3] transition-colors">
                    Classificação
                  </p>
                  <p className={`text-xs sm:text-sm font-black tracking-wide mt-1 leading-none capitalize ${textClass}`}>
                    {rawLevel}
                  </p>
                </button>
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

      {/* Sugestão de Afiliação para Não Afiliados */}
      {!loadingAfiliado && !isAfiliado && (
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

      {/* Principal Item: Acompanhamento em Tempo Real de Pedidos e Ordens de Serviço */}
      <DashboardLiveTracker isAfiliado={isAfiliado ?? false} />

      {/* Cartão de Cashback e Benefícios */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs shrink-0 border border-emerald-100">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Cashback Acumulado no Condomínio</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">
              Saldo disponível para abater em novos pedidos de produtos ou serviços.
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-[#0071e3]">
                R$ {profile?.cashbackBalance?.toFixed(2) || "0,00"}
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Disponível para Resgate
              </span>
            </div>
          </div>
        </div>

        <Link
          to="/cliente/cashback"
          className="inline-flex items-center justify-center gap-2 w-full md:w-auto py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold rounded-2xl text-xs sm:text-sm shadow-sm transition-all active:scale-98 shrink-0"
        >
          <span>Ver Extrato e Resgatar</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      <MuralCondominial />

      <PartnersCarousel />
      {isSuggestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsSuggestionModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            {!isSuggestionSuccess ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-sky-100 text-[#0071e3] rounded-xl flex items-center justify-center shrink-0">
                    <Lightbulb size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Envie sua Sugestão
                  </h3>
                </div>

                <form onSubmit={handleSubmitSuggestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nome do Condomínio</label>
                  <input 
                    type="text" 
                    readOnly 
                    disabled
                    value={(profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || ""}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Nome do Síndico / Responsável</label>
                  <input 
                    type="text" 
                    readOnly 
                    disabled
                    value={(profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || ""}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Telefone para contato</label>
                  <input 
                    type="text" 
                    readOnly 
                    disabled
                    value={(profile as any)?.telefone || ""}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">E-mail</label>
                  <input 
                    type="email" 
                    readOnly 
                    disabled
                    value={profile?.email || user?.email || ""}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Título</label>
                <input 
                  type="text" 
                  readOnly 
                  disabled
                  value="Sugestão"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Descreva abaixo a sua sugestão</label>
                <textarea 
                  required
                  rows={4}
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="Descreva abaixo a sua sugestão, iremos analisar tudo, juntaremos com as demais, estudaremos tudo e sendo em benefício a classe e viável a todos, logo ela poderá ser implementada. Muito Obrigado."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-sm focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsSuggestionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingSuggestion || !suggestionText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingSuggestion ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
            </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lightbulb size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Sugestão Enviada!</h3>
                <p className="text-slate-600 mb-8 max-w-sm mx-auto">
                  A sugestão foi enviada, e será criteriosamente analisada, agradecemos sua contribuição.
                </p>
                <button 
                  onClick={() => {
                    setIsSuggestionModalOpen(false);
                    setTimeout(() => setIsSuggestionSuccess(false), 300);
                  }}
                  className="px-8 py-3 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold transition-colors"
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
              className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
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
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#0071e3] border border-sky-100 uppercase tracking-wider">
                  <Sparkles size={13} className="text-amber-500" />
                  Classificação do Condomínio
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate px-4">
                  {profile?.displayName || "Condomínio"}
                </h3>
              </div>

              {/* Apresentação da Classificação: Ícone Medalha 4x Maior que o tamanho inicial (224px ~ 256px) */}
              <div className="relative z-10 flex flex-col items-center justify-center py-2">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-full overflow-hidden flex items-center justify-center p-2 bg-gradient-to-b from-slate-50 to-white shadow-xl border border-slate-100 transition-transform duration-300 hover:scale-105">
                  <img
                    src={badgeImage}
                    alt={badgeAlt}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>

                <p className="text-xs sm:text-sm text-slate-500 font-extrabold uppercase tracking-widest leading-none mt-5">
                  Classificação
                </p>
                <p className={`text-2xl sm:text-3xl font-black tracking-wide mt-1.5 leading-none capitalize ${textClass}`}>
                  {rawLevel}
                </p>
              </div>

              {/* Botão Fechar abaixo da apresentação da classificação */}
              <div className="relative z-10 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsClassificationModalOpen(false)}
                  className="w-full py-3.5 px-6 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold rounded-2xl text-base shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
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
