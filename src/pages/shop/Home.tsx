import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star, ShieldCheck, Truck, MapPin, Zap, Award, Users, Droplets, Sprout, HandCoins, Building, Wrench, Tag, Calendar, Heart, Lightbulb, X } from "lucide-react";
import { collection, getDocs, query, where, limit, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import OptimizedImage from "../../components/ui/OptimizedImage";



export default function Home() {
  const { profile, user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isSuggestionSuccess, setIsSuggestionSuccess] = useState(false);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const catSnap = await getDocs(collection(db, "categorias_produtos"));
        const cats = catSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCategories(cats);

        // Fetch active products
        const prodQuery = query(collection(db, "produtos"), where("ativo", "==", true), limit(8));
        const prodSnap = await getDocs(prodQuery);
        const prods = prodSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setFeaturedProducts(prods);
      } catch (err) {
        console.error("Error fetching home data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasSugestaoParam = params.get("sugestao") === "true";
    const hasStoredFlag = localStorage.getItem("openSuggestion") === "true" || sessionStorage.getItem("openSuggestion") === "true";
    
    if (user && (hasSugestaoParam || hasStoredFlag)) {
      setIsSuggestionModalOpen(true);
      localStorage.removeItem("openSuggestion");
      sessionStorage.removeItem("openSuggestion");
    }
  }, [user]);

  const handleSuggestionClick = () => {
    if (user) {
      setIsSuggestionModalOpen(true);
    } else {
      setIsAuthPromptOpen(true);
    }
  };

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

  const getPriceDisplay = (product: any) => {
    if (!profile) {
      return (
        <span
          className="text-xs sm:text-sm text-[#0071e3] hover:underline font-bold mt-1 cursor-pointer block"
        >
          Faça login para ver o preço
        </span>
      );
    }

    let price = 0;
    switch (profile.level) {
      case "Bronze":
        price = product.precoBronze;
        break;
      case "Prata":
        price = product.precoPrata;
        break;
      case "Ouro":
        price = product.precoOuro;
        break;
      case "Diamante":
        price = product.precoDiamante;
        break;
      default:
        price = product.precoVenda;
    }
    
    // Fallback to precoVenda if specific tier price is missing
    if (!price && product.precoVenda) {
      price = product.precoVenda;
    }

    if (!price) return <span className="text-sm font-semibold text-slate-500">Preço sob consulta</span>;

    return (
      <div className="flex flex-col">
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
          Seu preço ({profile.level})
        </span>
        <span className="text-xl sm:text-2xl font-black text-slate-900">
          R$ {Number(price).toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-10 sm:space-y-16">
      {/* Por que nos escolher Section */}
      <section className="bg-white rounded-[2rem] p-6 sm:p-10 md:p-12 border border-slate-200/80 shadow-sm space-y-8 sm:space-y-12">
        <div>
          <div className="inline-flex items-center gap-2 bg-sky-50 text-[#0071e3] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase mb-4 border border-blue-100 shadow-2xs">
            <Building size={14} className="text-[#0071e3]" />
            <span><span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600">GO</span></span></span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-6 md:mb-8">
            Por que nos escolher?
          </h2>
          
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-md w-full max-w-full bg-slate-100 flex items-center justify-center">
            <picture className="w-full max-w-full block">
              <img
                src="/Cond_Vert_Horiz_UC.png"
                alt="Goiânia é feita de grandes condomínios. Verticais e horizontais. Todos precisam de soluções. Todos podem ganhar juntos."
                className="w-full max-w-full h-auto object-contain sm:object-cover block"
                loading="eager"
                decoding="async"
              />
            </picture>
          </div>
        </div>

        <div className="max-w-5xl">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 mb-3 sm:mb-4">
            Porque fomos feitos para o seu condomínio.
          </h3>
          <div className="w-12 h-1 bg-[#0071e3] rounded mb-5 sm:mb-6"></div>
          <p className="text-slate-600 text-base sm:text-lg md:text-xl leading-relaxed font-normal text-justify">
            A <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span> nasceu da experiência de um consultor de empresas que também atua como síndico e vivencia, diariamente, os desafios de encontrar produtos de qualidade e bom preço, aliados a prestadores de serviços dos mais diversos segmentos, para atender às necessidades de um condomínio — seja ele residencial ou comercial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
          <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-100 flex flex-col">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
              <Tag size={24} />
            </div>
            <h4 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2.5">Economia Coletiva</h4>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed text-justify">
              Ao se afiliar, seu condomínio se une a outros da Grande Goiânia para conquistar condições que sozinho não conseguiria — até 50% mais barato que o mercado local.
            </p>
          </div>
          
          <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-100 flex flex-col">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
              <Calendar size={24} />
            </div>
            <h4 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2.5">Serviços Agendados, Sem Imprevistos</h4>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed text-justify">
              Equipe própria com dia e hora marcada para as demandas rotineiras do seu condomínio. Chega de imprevisto e de 'quebra-galho'.
            </p>
          </div>

          <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-100 flex flex-col">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
              <Heart size={24} />
            </div>
            <h4 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2.5">Clube de Benefícios do Afiliado</h4>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed text-justify">
              Mais que produtos: condomínios afiliados têm acesso a um clube de vantagens e à troca de informações da categoria em nosso mural.
            </p>
          </div>

          <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-100 flex flex-col">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
              <Users size={24} />
            </div>
            <h4 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2.5">Criada por Quem Vive o Condomínio</h4>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed text-justify">
              Desenvolvida por um síndico e administrador em atuação, que conhece de perto os entraves do dia a dia condominial.
            </p>
          </div>

          <div className="bg-slate-50/70 p-6 sm:p-8 rounded-3xl border border-slate-100 flex flex-col md:col-span-2 lg:col-span-2">
            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-sky-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
              <Lightbulb size={24} />
            </div>
            <h4 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2.5">Sua Sugestão, Nossa Próxima Solução</h4>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed text-justify mb-6">
              Estamos sempre abertos a ouvir síndicos e administradores. Sugestões viram estudo, e as boas viram novos serviços — porque a União Condominial cresce junto com as necessidades reais do seu condomínio.
            </p>
            <div className="mt-auto self-start">
              <button 
                onClick={handleSuggestionClick}
                className="inline-flex items-center gap-2 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold py-3 px-6 rounded-2xl text-sm sm:text-base transition-all shadow-sm active:scale-98"
              >
                Envie aqui sua Sugestão
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#f5f5f7] rounded-3xl p-6 sm:p-10 md:p-12 border border-slate-200 shadow-xs">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            {/* Left Content Side */}
            <div className="flex-1">
              <div className="flex items-start gap-4 sm:gap-5 mb-6">
                <div className="h-14 w-14 sm:h-16 sm:w-16 bg-[#0071e3] text-white rounded-2xl sm:rounded-3xl flex items-center justify-center shrink-0 shadow-md">
                  <HandCoins size={28} className="sm:hidden" />
                  <HandCoins size={34} className="hidden sm:block" />
                </div>
                <div>
                  <span className="text-[#0071e3] text-xs sm:text-sm font-bold tracking-wider uppercase block mb-1">
                    Economia e Praticidade para Síndicos
                  </span>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                    Pacote de Serviços Condominiais Rotineiros
                  </h3>
                </div>
              </div>

              <div className="text-slate-600 text-base sm:text-lg leading-relaxed space-y-4 text-justify">
                <p>
                  Na <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span>, funciona assim:
                </p>
                <p>
                  Os serviços rotineiros do condomínio custam até 50% menos do que os valores praticados no mercado local. Os condomínios afiliados à <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span> têm direito ao uso desses serviços, pagando praticamente a metade do que pagariam a um profissional autônomo ou a uma empresa prestadora de serviços.
                </p>
                <p>
                  Dessa forma, o <strong>síndico</strong> ou <strong>administrador</strong> do condomínio não precisa mais se preocupar em cotar preços no mercado: na <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span>, ele encontra tudo o que precisa por, em média, metade do valor praticado na região.
                </p>
                <p>
                  Basta acessar a Área Privativa do Cliente, selecionar a guia Serviços Condominiais, escolher o(s) serviço(s) desejado(s) e indicar a data de preferência para execução em nossa Agenda Virtual. Nossa equipe verificará os agendamentos do período e entrará em contato para confirmar a visita técnica referente ao(s) serviço(s) solicitado(s) no condomínio.
                </p>
              </div>
            </div>

            {/* Right Banner Image */}
            <div className="w-full max-w-full lg:w-[480px] xl:w-[520px] shrink-0 self-center lg:self-start">
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 bg-white w-full max-w-full flex items-center justify-center">
                <picture className="w-full max-w-full block">
                  <img
                    src="/servicos-rotineiros-oficial.png"
                    alt="São mais de 10 Serviços a disposição - União Condominial"
                    className="w-full max-w-full h-auto object-contain sm:object-cover block"
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
              </div>
            </div>
          </div>

          {/* Service badges list */}
          <div className="mt-8 pt-8 border-t border-slate-200/80">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
              Serviços Rotineiros Condominiais:
            </h4>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {[
                { icon: Droplets, text: "Limpeza de Caixa de Gordura" },
                { icon: Droplets, text: "Limpeza de Reservatório Inferior de Água" },
                { icon: Droplets, text: "Limpeza de Caixa de Água" },
                { icon: Sprout, text: "Serviços de Jardinagem" },
                { icon: Wrench, text: "Manutenção em Portas e Portões Eletrônicos" },
                { icon: Zap, text: "Manutenção de Cercas Elétricas" },
                { icon: Zap, text: "Serviços de Troca de Plafons ou Spots de Led e Lâmpadas de Emergência" },
                { icon: ShieldCheck, text: "Serviços de Manutenção em Sistemas CFTV (Câmeras de Segurança)" },
                { icon: ShieldCheck, text: "Manutenção em Sistema de Alarme" },
                { icon: Zap, text: "Manutenção em Porteiros Eletrônicos" }
              ].map((service, idx) => (
                <div key={idx} className="bg-white px-3.5 py-2 rounded-full border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs hover:border-blue-300 transition-colors">
                  <service.icon size={15} className="text-[#0071e3]" />
                  {service.text}
                </div>
              ))}
            </div>

            <div className="text-slate-600 text-base sm:text-lg mt-8 leading-relaxed text-justify">
              <p className="mb-4">
                No clube de benefícios, o usuário da <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span> contará também com verdadeiros parceiros comerciais, que oferecerão valores diferenciados, nos serviços obrigatórios ao condomínio:
              </p>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {[
                  { icon: ShieldCheck, text: "Recarga de Extintores" },
                  { icon: ShieldCheck, text: "Dedetização Predial" },
                  { icon: Wrench, text: "Manutenção nas Portas de Acesso (Vidro Temperado)" },
                  { icon: Wrench, text: "Serviços de Manutenção em Motobombas" },
                  { icon: Wrench, text: "Serviços de Pintura" },
                  { icon: Wrench, text: "Reformas e Pequenos Reparos" }
                ].map((service, idx) => (
                  <div key={idx} className="bg-white px-3.5 py-2 rounded-full border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs hover:border-blue-300 transition-colors">
                    <service.icon size={15} className="text-[#0071e3]" />
                    {service.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 sm:gap-8 items-center justify-between border-t border-slate-200 pt-6 sm:pt-10">
          <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-[#0071e3] text-white rounded-full flex items-center justify-center font-black text-base sm:text-2xl shadow-sm shrink-0">
              UC
            </div>
            <div>
              <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">Atendemos toda a Grande Goiânia</h4>
              <p className="text-slate-600 text-sm sm:text-base mb-2 sm:mb-3 font-medium">Condomínios residenciais e comerciais nas regiões abaixo:</p>
              <div className="flex flex-wrap gap-2">
                {["Goiânia", "Aparecida de Goiânia", "Senador Canedo", "Trindade"].map((city) => (
                  <span key={city} className="bg-slate-100 px-3 py-1 rounded-full text-slate-800 text-xs sm:text-sm font-bold border border-slate-200">
                    {city}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Link
            to="/produtos"
            className="bg-[#0071e3] hover:bg-[#005bb5] text-white px-6 py-3.5 sm:px-9 sm:py-4 rounded-2xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-center text-base sm:text-lg mt-2 md:mt-0 active:scale-98"
          >
            Confira o nosso Catálogo <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="bg-white rounded-[2rem] p-6 sm:p-10 border border-slate-200/80 shadow-sm">
          <div>
            <span className="text-[#0071e3] text-xs sm:text-sm font-bold tracking-wider uppercase mb-2 block">
              Produtos de Limpeza e Conservação
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2.5">
              Compre por categoria
            </h2>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg leading-relaxed mb-4">
              Explore nossas categorias e encontre rápido o que o seu condomínio precisa.
            </p>
            <Link
              to="/produtos"
              className="inline-flex items-center gap-1.5 text-[#0071e3] hover:text-[#005bb5] font-bold text-sm sm:text-base mb-6 sm:mb-8 transition-colors"
            >
              Ver todos os produtos <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/produtos?categoria=${cat.nome}`}
                className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 w-full max-w-full"
              >
                <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-slate-100 w-full max-w-full p-2">
                  <OptimizedImage
                    src={cat.imagem}
                    alt={cat.nome}
                    objectFit="contain"
                    className="group-hover:scale-105 transition-transform duration-500 max-w-full h-full object-contain"
                  />
                </div>
                <div className="p-3.5 sm:p-5 flex items-center justify-center text-center min-h-[60px] bg-white">
                  <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#0071e3] transition-colors leading-tight">
                    {cat.nome}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="bg-white rounded-[2rem] p-6 sm:p-10 border border-slate-200/80 shadow-sm">
        <div className="flex justify-between items-end mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Destaques
            </h2>
            <p className="text-slate-600 text-sm sm:text-base md:text-lg mt-1 sm:mt-2">
              Os mais vendidos para condomínios residenciais e comerciais.
            </p>
          </div>
          <Link
            to="/produtos"
            className="text-[#0071e3] hover:text-[#005bb5] text-sm sm:text-base font-bold flex items-center gap-1.5 shrink-0"
          >
            Ver todos <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-60 sm:h-84"></div>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/produto/${product.id}`}
                className="group bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col w-full max-w-full"
              >
                <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center w-full max-w-full p-2 sm:p-4">
                  <OptimizedImage
                    src={product.imagemPrincipal || product.imageUrl}
                    alt={product.nome || product.name}
                    objectFit="contain"
                    className="group-hover:scale-105 transition-transform duration-500 max-w-full h-full object-contain"
                  />
                </div>
                <div className="p-3.5 sm:p-5 flex-1 flex flex-col">
                  <p className="text-[11px] sm:text-xs font-bold text-[#0071e3] mb-1 sm:mb-2 uppercase tracking-wider">
                    {product.categories?.length ? product.categories[0] : (product.categoria || "Geral")}
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2 group-hover:text-[#0071e3] transition-colors line-clamp-2 leading-snug">
                    {product.nome || product.name}
                  </h3>
                  <div className="mt-auto flex flex-col pt-1.5">
                    {getPriceDisplay(product)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 sm:p-12 rounded-2xl text-center shadow-sm border border-slate-100">
            <p className="text-slate-500 text-base">Nenhum produto em destaque no momento.</p>
          </div>
        )}
      </section>

      {/* About the Union CTA */}
      <section className="bg-white rounded-[2rem] p-6 sm:p-10 md:p-12 border border-slate-200/80 shadow-sm mt-8 mb-8 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 bg-sky-50 text-[#0071e3] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wider uppercase border border-blue-100 shadow-2xs">
              <span>União Condominial.<span className="text-emerald-600">GO</span></span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              A união que transforma a gestão condominial na Grande Goiânia
            </h2>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed text-justify">
              Descubra como a força coletiva está gerando economia, qualidade e eficiência para os condomínios da nossa região. Conectamos o seu condomínio a produtos de alta qualidade com preços direto de fornecedores e prestadores de serviços qualificados.
            </p>
            <div className="pt-2">
              <Link
                to="/sobre"
                className="inline-flex items-center gap-2 bg-[#0071e3] hover:bg-[#005bb5] text-white px-7 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm sm:text-base cursor-pointer"
              >
                Conheça a União Condominial <ArrowRight size={18} />
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full max-w-full lg:max-w-none relative">
            <div className="w-full max-w-full aspect-[4/3] sm:aspect-[16/10] md:aspect-[4/3] rounded-3xl overflow-hidden shadow-xl border border-slate-100 bg-slate-50 relative flex items-center justify-center">
              <picture className="w-full max-w-full h-full block">
                <img 
                  src="/img_end_page.png" 
                  alt="A união que transforma a gestão condominial na Grande Goiânia"
                  className="w-full max-w-full h-auto sm:h-full object-contain sm:object-contain md:object-cover block"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-blue-500/10 rounded-full blur-2xl -z-10"></div>
            <div className="absolute -top-4 -left-4 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* Suggestion Modals */}
      {isAuthPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-4 overflow-x-hidden overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full max-w-[calc(100vw-1.5rem)] shadow-2xl relative max-h-[90vh] overflow-y-auto box-border break-words">
            <button 
              onClick={() => setIsAuthPromptOpen(false)}
              className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="w-12 h-12 bg-sky-100 text-[#0071e3] rounded-2xl flex items-center justify-center mb-4 sm:mb-5 shrink-0">
              <Lightbulb size={24} />
            </div>
            <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3 break-words">
              Identifique-se para enviar sugestões
            </h3>
            <p className="text-slate-600 text-xs sm:text-base leading-relaxed mb-5 sm:mb-8">
              Para enviar as sugestões, você deverá se identificar, então te convido a se cadastrar no aplicativo e teremos o maior prazer em ouví-lo. Seja bem vindo à União Condominial.GO
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full">
              <button 
                onClick={() => setIsAuthPromptOpen(false)}
                className="w-full sm:w-auto flex-1 px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-center text-sm"
              >
                Cancelar
              </button>
              <Link 
                to="/minha-conta?redirect=sugestao"
                onClick={() => {
                  localStorage.setItem('openSuggestion', 'true');
                  sessionStorage.setItem('openSuggestion', 'true');
                  setIsAuthPromptOpen(false);
                }}
                className="w-full sm:w-auto flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold text-center shadow-sm transition-colors cursor-pointer text-sm"
              >
                Fazer Login / Cadastro
              </Link>
            </div>
          </div>
        </div>
      )}

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
                  <h3 className="text-base sm:text-xl font-bold text-slate-900 truncate">
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
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs sm:text-sm font-medium box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Nome do Síndico / Responsável</label>
                      <input 
                        type="text" 
                        readOnly 
                        disabled
                        value={(profile as any)?.nomeResponsavel || (profile as any)?.sindico || (profile as any)?.nomeCompleto || profile?.displayName || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs sm:text-sm font-medium box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">Telefone para contato</label>
                      <input 
                        type="text" 
                        readOnly 
                        disabled
                        value={(profile as any)?.telefone || (profile as any)?.phone || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs sm:text-sm font-medium box-border truncate"
                      />
                    </div>
                    <div className="space-y-1 w-full min-w-0">
                      <label className="text-[11px] sm:text-xs font-bold text-slate-700 block">E-mail</label>
                      <input 
                        type="email" 
                        readOnly 
                        disabled
                        value={profile?.email || user?.email || ""}
                        className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs sm:text-sm font-medium box-border truncate"
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
                      className="w-full min-w-0 max-w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs sm:text-sm font-medium box-border truncate"
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
                      className="w-full min-w-0 max-w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs sm:text-sm focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] transition-all resize-none box-border break-words"
                    ></textarea>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2 w-full">
                    <button 
                      type="button"
                      onClick={() => setIsSuggestionModalOpen(false)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer text-center text-xs sm:text-sm"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmittingSuggestion || !suggestionText.trim()}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center text-xs sm:text-sm"
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
                <h3 className="text-lg sm:text-2xl font-bold text-slate-900 mb-2">Sugestão Enviada!</h3>
                <p className="text-slate-600 mb-5 sm:mb-8 max-w-sm mx-auto text-xs sm:text-base leading-relaxed">
                  A sugestão foi enviada, e será criteriosamente analisada, agradecemos sua contribuição.
                </p>
                <button 
                  onClick={() => {
                    setIsSuggestionModalOpen(false);
                    setTimeout(() => setIsSuggestionSuccess(false), 300);
                  }}
                  className="w-full sm:w-auto px-7 py-2.5 sm:py-3 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold transition-colors cursor-pointer text-sm"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
