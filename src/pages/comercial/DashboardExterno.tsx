import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  Building2,
  Users,
  Compass,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Edit,
  MessageCircle,
  X,
  UserX,
  Check,
  ExternalLink,
  PieChart as PieChartIcon,
  ShieldCheck,
  Award,
  Crown,
  Gem,
  Medal,
  Phone,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { collection, getDocs, query, orderBy, where, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { initFirebase, db } from "../../lib/firebase";
import { Link } from "react-router-dom";

export default function ComercialExternoDashboard() {
  const { profile } = useAuth();
  const isAdmin = ["Administrador", "admin", "Admin", "master"].includes(profile?.role || "");

  // Dashboard configuration
  const [config, setConfig] = useState<any>({
    moduloVisitas: true,
    cardDestaqueVisitas: true,
    kpiTotalVisitas: true,
    kpiVisitasMes: true,
    kpiSindicosContatados: true,
    kpiRetornosAgendados: true,
    recursoGeolocalizacao: true,
    recursoModelosWhatsApp: true,
    recursoGestaoStatus: true,
    secaoUltimasVisitas: true,
    secaoBannerTopo: true,
  });

  // Visitas CRM Data & State
  const [visitas, setVisitas] = useState<any[]>([]);
  const [filteredVisitas, setFilteredVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("Mensal"); // Diário, Semanal, Quinzenal, Mensal, Todos

  // Modals & WhatsApp Templates
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [whatsappTemplates, setWhatsappTemplates] = useState<any>(null);

  // Form Data for New/Edit Visit
  const [formData, setFormData] = useState({
    nomeCondominio: "",
    pessoaContato: "",
    funcaoCargo: "Não informado",
    nomeSindico: "",
    pronomeTratamento: "",
    telefoneContato: "",
    qtdUnidades: "",
    observacoes: "",
    statusSindico: "Não Encontrado",
    dataRetorno: ""
  });

  // Fetch WhatsApp Templates
  const fetchTemplates = async () => {
    try {
      const docRef = doc(db, "config", "whatsapp_templates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().templates) {
        setWhatsappTemplates(docSnap.data().templates);
      }
    } catch (error) {
      console.error("Erro ao buscar templates do WhatsApp:", error);
    }
  };

  // Get current GPS coordinates
  const getCurrentCoordinates = (): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn("Geolocalização não capturada:", err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });
  };

  // Load Dashboard Config & Visitas
  const loadData = async () => {
    setLoading(true);
    try {
      const { db: firestoreDb } = await initFirebase();

      // Load config
      try {
        const cfgSnap = await getDoc(doc(firestoreDb, "config", "comercial_externo_dashboard"));
        if (cfgSnap.exists()) {
          setConfig((prev: any) => ({ ...prev, ...cfgSnap.data() }));
        }
      } catch (e) {
        console.warn("Could not load comercial externo config:", e);
      }

      // Load visits
      let q;
      if (isAdmin) {
        q = query(collection(firestoreDb, "visitas_crm"), orderBy("dataVisita", "desc"));
      } else if (profile?.uid) {
        q = query(
          collection(firestoreDb, "visitas_crm"),
          where("colaboradorId", "==", profile.uid)
        );
      } else {
        q = query(collection(firestoreDb, "visitas_crm"), orderBy("dataVisita", "desc"));
      }

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      // Client-side sort if query where was applied
      list.sort((a: any, b: any) => new Date(b.dataVisita || 0).getTime() - new Date(a.dataVisita || 0).getTime());

      setVisitas(list);
    } catch (err) {
      console.error("Erro ao carregar dados do Comercial Externo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchTemplates();
  }, [profile]);

  // Filter Visits based on searchTerm and filterPeriod
  useEffect(() => {
    let filtered = [...visitas];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.nomeCondominio?.toLowerCase().includes(lower) ||
        v.nomeSindico?.toLowerCase().includes(lower) ||
        v.colaboradorNome?.toLowerCase().includes(lower) ||
        v.pessoaContato?.toLowerCase().includes(lower)
      );
    }

    const now = new Date();
    filtered = filtered.filter(v => {
      if (filterPeriod === "Todos") return true;
      const vDate = new Date(v.dataVisita);
      const diffTime = Math.abs(now.getTime() - vDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filterPeriod === "Diário") return diffDays <= 1;
      if (filterPeriod === "Semanal") return diffDays <= 7;
      if (filterPeriod === "Quinzenal") return diffDays <= 15;
      if (filterPeriod === "Mensal") return diffDays <= 30;
      return true;
    });

    setFilteredVisitas(filtered);
  }, [visitas, searchTerm, filterPeriod]);

  // Calculate stats & chart breakdown
  const stats = useMemo(() => {
    const total = visitas.length;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let hojeCount = 0;
    let mesCount = 0;
    let retornosCount = 0;
    let sindicosCount = 0;
    let afiliadosCount = 0;

    visitas.forEach((v: any) => {
      if (v.dataVisita) {
        const vDate = new Date(v.dataVisita);
        if (v.dataVisita.startsWith(todayStr) || vDate.toISOString().slice(0, 10) === todayStr) {
          hojeCount++;
        }
        if (vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear) {
          mesCount++;
        }
      }
      if (v.statusSindico === "Visitado Retornar" || v.dataRetorno) {
        retornosCount++;
      }
      if (v.statusSindico === "Visitado Afiliado") {
        afiliadosCount++;
      }
      if (v.statusSindico && v.statusSindico !== "Não Encontrado") {
        sindicosCount++;
      }
    });

    return {
      total,
      hoje: hojeCount,
      mes: mesCount,
      retornos: retornosCount,
      sindicosEncontrados: sindicosCount,
      afiliados: afiliadosCount
    };
  }, [visitas]);

  // Donut chart status proportions for filtered visits
  const statusStats = useMemo(() => {
    const list = filteredVisitas;
    const total = list.length;

    let afiliado = 0;
    let retornar = 0;
    let naoAfiliado = 0;
    let agendamentoTel = 0;
    let naoEncontrado = 0;

    list.forEach((v) => {
      const s = v.statusSindico;
      if (s === "Visitado Afiliado") afiliado++;
      else if (s === "Visitado Retornar") retornar++;
      else if (s === "Visitado não afiliado") naoAfiliado++;
      else if (s === "Contato Telefônico - Novo Agendamento") agendamentoTel++;
      else if (s === "Não Encontrado") naoEncontrado++;
      else naoEncontrado++;
    });

    const afiliadoPercent = total > 0 ? Math.round((afiliado / total) * 100) : 0;
    const retornarPercent = total > 0 ? Math.round((retornar / total) * 100) : 0;
    const naoAfiliadoPercent = total > 0 ? Math.round((naoAfiliado / total) * 100) : 0;
    const agendamentoTelPercent = total > 0 ? Math.round((agendamentoTel / total) * 100) : 0;
    const naoEncontradoPercent = total > 0 ? Math.round((naoEncontrado / total) * 100) : 0;

    const chartData = [
      {
        name: "Visitado Afiliado",
        shortLabel: "Afiliado",
        value: afiliado,
        color: "#0071e3",
        percent: afiliadoPercent,
      },
      {
        name: "Visitado Retornar",
        shortLabel: "Retornar",
        value: retornar,
        color: "#0284c7",
        percent: retornarPercent,
      },
      {
        name: "Visitado não afiliado",
        shortLabel: "Não Afiliado",
        value: naoAfiliado,
        color: "#64748b",
        percent: naoAfiliadoPercent,
      },
      {
        name: "Contato Telefônico - Novo Agendamento",
        shortLabel: "Contato Telefônico",
        value: agendamentoTel,
        color: "#38bdf8",
        percent: agendamentoTelPercent,
      },
      {
        name: "Não Encontrado",
        shortLabel: "Não Encontrado",
        value: naoEncontrado,
        color: "#94a3b8",
        percent: naoEncontradoPercent,
      },
    ].filter((item) => item.value > 0);

    return {
      total,
      afiliado,
      retornar,
      naoAfiliado,
      agendamentoTel,
      naoEncontrado,
      afiliadoPercent,
      retornarPercent,
      naoAfiliadoPercent,
      agendamentoTelPercent,
      naoEncontradoPercent,
      chartData,
    };
  }, [filteredVisitas]);

  // Modal Handlers
  const openNewModal = () => {
    setSelectedVisita(null);
    setFormData({
      nomeCondominio: "",
      pessoaContato: "",
      funcaoCargo: "Não informado",
      nomeSindico: "",
      pronomeTratamento: "",
      telefoneContato: "",
      qtdUnidades: "",
      observacoes: "",
      statusSindico: "Não Encontrado",
      dataRetorno: ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (v: any) => {
    setSelectedVisita(v);
    setFormData({
      nomeCondominio: v.nomeCondominio || "",
      pessoaContato: v.pessoaContato || "",
      funcaoCargo: v.funcaoCargo || "Não informado",
      nomeSindico: v.nomeSindico || "",
      pronomeTratamento: v.pronomeTratamento || "",
      telefoneContato: v.telefoneContato || "",
      qtdUnidades: v.qtdUnidades || "",
      observacoes: v.observacoes || "",
      statusSindico: v.statusSindico || "Não Encontrado",
      dataRetorno: v.dataRetorno || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveVisit = async () => {
    if (!profile?.uid) return;
    try {
      if (selectedVisita && selectedVisita.id) {
        await updateDoc(doc(db, "visitas_crm", selectedVisita.id), {
          ...formData
        });
      } else {
        const coords = await getCurrentCoordinates();
        await addDoc(collection(db, "visitas_crm"), {
          ...formData,
          colaboradorId: profile.uid,
          colaboradorNome: profile.displayName || "Representante",
          colaboradorTelefone: profile.telefone || "",
          dataVisita: new Date().toISOString(),
          geolocalizacao: coords ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy || null,
            capturadoEm: new Date().toISOString(),
            mapsUrl: `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
          } : null
        });
      }
      setIsModalOpen(false);
      setSelectedVisita(null);
      await loadData();
    } catch (error) {
      console.error("Erro ao salvar visita:", error);
    }
  };

  const handleWhatsAppSend = (templateKey: string) => {
    if (!selectedVisita || !selectedVisita.telefoneContato) return;

    let text = "";
    if (whatsappTemplates && whatsappTemplates[templateKey]) {
      text = whatsappTemplates[templateKey];
    } else {
      if (templateKey === "apresentacao") {
        text = `Olá, *${selectedVisita.nomeSindico || selectedVisita.pessoaContato || "Síndico(a)"}*!\n\nAqui é da *União Condominial.GO*. Estivemos recentemente em visita ao *${selectedVisita.nomeCondominio || "seu condomínio"}* para apresentar nossa linha completa de produtos de limpeza e serviços condominiais com condições e descontos exclusivos de até 50%.\n\nPodemos conversar sobre as necessidades do condomínio?`;
      } else if (templateKey === "proposta") {
        text = `Olá, *${selectedVisita.nomeSindico || selectedVisita.pessoaContato || "Síndico(a)"}*!\n\nConforme conversamos em nossa visita ao *${selectedVisita.nomeCondominio}*, segue a nossa apresentação de serviços e produtos da *União Condominial.GO* com cashback e economia garantida para a sua gestão.\n\nFicamos à disposição para agendar a entrega dos seus pedidos!`;
      } else {
        text = `Olá, *${selectedVisita.nomeSindico || selectedVisita.pessoaContato || "Síndico(a)"}*!\n\nAqui é da *União Condominial.GO*. Gostaríamos de confirmar o nosso retorno/reagendamento de visita técnica para o *${selectedVisita.nomeCondominio}*.\n\nQual o melhor horário para conversarmos?`;
      }
    }

    const cleanPhone = selectedVisita.telefoneContato.replace(/\D/g, "");
    const url = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setIsMsgModalOpen(false);
  };

  const formatReturnDate = (dateVal: any) => {
    if (!dateVal) return "";
    if (dateVal.includes("T")) {
      const d = new Date(dateVal);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}`;
    }
    return String(dateVal);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Visitado Afiliado":
        return (
          <span className="px-2.5 py-1 bg-[#0071e3]/10 text-[#0071e3] text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-[#0071e3]/20 shadow-3xs">
            <Check size={12} /> Afiliado
          </span>
        );
      case "Visitado Retornar":
        return (
          <span className="px-2.5 py-1 bg-sky-50 text-sky-800 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-sky-200">
            <Clock size={12} /> Retornar
          </span>
        );
      case "Contato Telefônico - Novo Agendamento":
        return (
          <span className="px-2.5 py-1 bg-cyan-50 text-cyan-900 border border-cyan-200 text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-3xs">
            <Clock size={12} className="text-cyan-600" /> Contato Tel. - Novo Agendamento
          </span>
        );
      case "Visitado não afiliado":
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-slate-200">
            <UserX size={12} /> Não Afiliado
          </span>
        );
      case "Não Encontrado":
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg flex items-center gap-1.5 border border-slate-200">
            <UserX size={12} /> Não Encontrado
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg">
            {status}
          </span>
        );
    }
  };

  const showAnyKpi =
    config.kpiTotalVisitas !== false ||
    config.kpiVisitasMes !== false ||
    config.kpiSindicosContatados !== false ||
    config.kpiRetornosAgendados !== false;

  return (
    <div className="w-[98%] max-w-[98%] mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      
      {/* 1. Top Header Card (Herança fiel da estrutura do Dashboard Cliente com paleta de cores frias) */}
      <div className="bg-[#f4f9fc] border border-[#e2eef5] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
        {/* Subtle decorative cool-toned glowing lights in background for modern depth */}
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#0071e3]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[#0284c7]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5">
          {/* Top Row: Date & Greeting on left, Classification / Role Badge on right */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4">
            <div className="flex flex-col gap-2">
              {/* Date in first position */}
              <div className="flex items-center text-sm">
                <span className="bg-white border border-slate-200/90 shadow-xs px-4 py-2 rounded-2xl flex items-center gap-2.5 text-slate-700 font-medium text-xs sm:text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0071e3] animate-pulse shrink-0"></span>
                  Hoje é {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {/* Welcome subtitle */}
              <div className="flex items-center gap-2 ml-1">
                <Compass size={15} className="text-[#0071e3]" />
                <p className="text-[#64748b] text-sm font-semibold tracking-wide">
                  Painel de Vendas Externas & Campo • União Condominial
                </p>
              </div>
            </div>

            {/* Right Badge / Actions */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              {isAdmin && (
                <Link
                  to="/admin/config-dashboard-comercial-externo"
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-[#0071e3] hover:border-[#0071e3]/30 shadow-xs text-xs font-bold transition-all"
                  title="Configurar opções exibidas neste painel"
                >
                  <Sliders size={14} className="text-[#0071e3]" />
                  <span className="hidden md:inline">Opções do Painel</span>
                </Link>
              )}

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-[#0071e3] shadow-xs text-xs font-bold transition-all cursor-pointer"
                title="Atualizar dados em tempo real"
              >
                <RefreshCw size={14} className={`text-[#0071e3] ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>

              {/* Classification / Profile Badge */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-3 min-w-[120px] border border-slate-200/90 rounded-2xl shadow-3xs bg-white/90 backdrop-blur-xs">
                <div className="p-1.5 rounded-full border mb-1 flex items-center justify-center text-[#0071e3] bg-[#0071e3]/10 border-[#0071e3]/20 shadow-3xs">
                  <Award className="w-3.5 h-3.5" />
                </div>
                <p className="text-[8px] sm:text-[9px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                  Nível Comercial
                </p>
                <p className="text-xs sm:text-sm font-black tracking-wide mt-1 leading-none text-[#0071e3]">
                  {profile?.role || "Consultor Externo"}
                </p>
              </div>
            </div>
          </div>

          {/* User Identification & Welcome Message */}
          <div className="w-full">
            <h1 className="text-2xl sm:text-3.5xl font-extrabold text-[#0f172a] leading-tight tracking-tight max-w-[42rem]">
              Olá, {profile?.displayName || "Consultor(a) Comercial"}
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1.5 max-w-3xl leading-relaxed">
              Acompanhe suas metas de campo, prospecções presenciais em condomínios e contatos com síndicos na Grande Goiânia.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Resumo de Métricas e KPIs (Cores frias: Azul Royal #0071e3, Sky Blue, Cyan, Slate) */}
      {showAnyKpi && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.kpiTotalVisitas !== false && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between transition-all hover:border-[#0071e3]/40">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Total de Visitas
                </span>
                <span className="text-3xl font-black text-slate-900 mt-1 block">
                  {loading ? "..." : stats.total}
                </span>
                <span className="text-xs text-slate-500 font-medium">Registradas no histórico</span>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shadow-2xs">
                <MapPin size={24} />
              </div>
            </div>
          )}

          {config.kpiVisitasMes !== false && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between transition-all hover:border-sky-400">
              <div>
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">
                  Visitas no Mês
                </span>
                <span className="text-3xl font-black text-sky-600 mt-1 block">
                  {loading ? "..." : stats.mes}
                </span>
                <span className="text-xs text-slate-500 font-medium">Mês vigente em andamento</span>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                <Calendar size={24} />
              </div>
            </div>
          )}

          {config.kpiSindicosContatados !== false && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between transition-all hover:border-[#0071e3]/40">
              <div>
                <span className="text-xs font-bold text-[#0071e3] uppercase tracking-wider block">
                  Síndicos Contatados
                </span>
                <span className="text-3xl font-black text-[#0071e3] mt-1 block">
                  {loading ? "..." : stats.sindicosEncontrados}
                </span>
                <span className="text-xs text-slate-500 font-medium">Contatos efetivos com decisores</span>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center shadow-2xs">
                <Users size={24} />
              </div>
            </div>
          )}

          {config.kpiRetornosAgendados !== false && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex items-center justify-between transition-all hover:border-cyan-400">
              <div>
                <span className="text-xs font-bold text-cyan-800 uppercase tracking-wider block">
                  Retornos Agendados
                </span>
                <span className="text-3xl font-black text-cyan-700 mt-1 block">
                  {loading ? "..." : stats.retornos}
                </span>
                <span className="text-xs text-slate-500 font-medium">Follow-ups e visitas programadas</span>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center shadow-2xs">
                <Clock size={24} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Cards Duplos de Destaque Operacional (Estilo Dashboard Cliente: Última Compra / Cashback) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Meta de Visitas & Produtividade */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3.5 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0071e3] flex items-center justify-center shadow-2xs">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Meta Diária de Campo</h2>
                  <p className="text-xs text-slate-500 font-medium">Produtividade recomendada por consultor</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-[#0071e3] border border-blue-200 text-xs font-bold rounded-xl">
                Meta Mínima: 4 visitas/dia
              </span>
            </div>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-4 text-justify">
              O registro imediato da visita com <strong>coordenadas GPS</strong> e a captura do telefone do síndico garantem a qualificação do lead e o envio ágil de propostas com até 50% de economia em produtos e serviços.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200/60">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Visitas Hoje</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">{stats.hoje}</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200/60">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Afiliados</span>
              <span className="text-xl font-black text-[#0071e3] mt-0.5 block">{stats.afiliados}</span>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3 text-center border border-slate-200/60 col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">Retornos</span>
              <span className="text-xl font-black text-sky-600 mt-0.5 block">{stats.retornos}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Lançamento Rápido & Ação Integrada */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Novo Registro Presencial</h2>
                <p className="text-xs text-slate-500 font-medium">Cadastre condomínio e contate via WhatsApp</p>
              </div>
            </div>
            <p className="text-slate-600 text-base mb-1 font-medium">Pronto para lançar um atendimento?</p>
            <p className="text-3.5xl sm:text-4xl font-black text-[#0071e3] mb-2">
              {stats.total} {stats.total === 1 ? "Visita" : "Visitas"}
            </p>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Capture a localização em tempo real com 1 clique e envie modelos prontos de apresentação pelo WhatsApp.
            </p>
          </div>
          
          <button
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-5 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white font-bold rounded-2xl text-sm sm:text-base transition-all shadow-md active:scale-98 cursor-pointer"
          >
            <Plus size={18} />
            <span>Registrar Nova Visita ao Cliente</span>
          </button>
        </div>
      </div>

      {/* 4. COMPONENTE INTEGRADO: GESTÃO COMPLETA DE VISITAS AO CLIENTE */}
      <div className="space-y-6">
        {/* Header do Módulo de Visitas & Filtros */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#0071e3]/10 text-[#0071e3] rounded-xl">
                  <MapPin size={22} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Visitas ao Cliente & Prospecção
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Histórico de atendimentos em campo, status do síndico, retornos e coordenadas GPS.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={openNewModal}
                className="bg-[#0071e3] hover:bg-[#0071e3]/90 text-white px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
              >
                <Plus size={18} />
                <span>Nova Visita</span>
              </button>
            </div>
          </div>

          {/* Barra de Busca e Filtros por Período */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por condomínio, síndico, consultor ou contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-56">
                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <select
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:bg-white appearance-none cursor-pointer"
                >
                  {["Diário", "Semanal", "Quinzenal", "Mensal", "Todos"].map((period) => {
                    const count = visitas.filter(v => {
                      if (period === "Todos") return true;
                      const vDate = new Date(v.dataVisita);
                      const diffTime = Math.abs(new Date().getTime() - vDate.getTime());
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      if (period === "Diário") return diffDays <= 1;
                      if (period === "Semanal") return diffDays <= 7;
                      if (period === "Quinzenal") return diffDays <= 15;
                      if (period === "Mensal") return diffDays <= 30;
                      return true;
                    }).length;

                    return (
                      <option key={period} value={period}>
                        Período: {period} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Gráfico de Rosca - Proporção de Status dos Síndicos (Cores Frias: Azul, Sky, Cyan, Slate) */}
          <div className="bg-[#f8fafc] rounded-2xl p-5 md:p-6 border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200/60">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <div className="p-1.5 bg-[#0071e3]/10 text-[#0071e3] rounded-lg">
                    <PieChartIcon size={18} />
                  </div>
                  <h3>Proporção de Status dos Síndicos</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Distribuição dos atendimentos realizados ({filterPeriod.toLowerCase()})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-3xs">
                  Total no período: <strong className="text-slate-900 font-extrabold text-sm">{statusStats.total}</strong> visitas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Donut Chart */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[220px]">
                {statusStats.total > 0 && statusStats.chartData.length > 0 ? (
                  <div className="w-full h-56 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusStats.chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={88}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {statusStats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, name: any) => {
                            const numVal = Number(value) || 0;
                            const pct = statusStats.total > 0 ? Math.round((numVal / statusStats.total) * 100) : 0;
                            return [`${numVal} visitas (${pct}%)`, name];
                          }}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "14px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                            fontSize: "12px",
                            fontWeight: "600",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                      <span className="text-2xl font-black text-slate-800 tracking-tight">
                        {statusStats.afiliadoPercent}%
                      </span>
                      <span className="text-[11px] font-bold text-[#0071e3] uppercase tracking-wide">
                        Afiliados
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-52 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-200 text-center p-4">
                    <PieChartIcon className="text-slate-300 mb-2" size={36} />
                    <span className="text-xs text-slate-500 font-semibold">
                      Nenhuma visita encontrada para o período selecionado
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Cadastre uma nova visita ou ajuste os filtros
                    </span>
                  </div>
                )}
              </div>

              {/* Status Breakdown Legend & Cards */}
              <div className="lg:col-span-7 space-y-2.5">
                {/* 1. Visitado Afiliado */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-[#0071e3]/40 transition-all shadow-3xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#0071e3] shrink-0 ring-2 ring-[#0071e3]/20"></span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Visitado Afiliado</span>
                      <span className="text-[10px] text-[#0071e3] font-semibold">Síndicos convertidos e afiliados à rede</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[#0071e3]">{statusStats.afiliado}</span>
                    <span className="text-[11px] font-bold text-slate-500 ml-1.5">({statusStats.afiliadoPercent}%)</span>
                  </div>
                </div>

                {/* 2. Visitado Retornar */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:border-sky-300 transition-all shadow-3xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#0284c7] shrink-0 ring-2 ring-sky-200"></span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Visitado Retornar</span>
                      <span className="text-[10px] text-sky-700 font-medium">Reagendamento ou nova visita presencial</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-sky-800">{statusStats.retornar}</span>
                    <span className="text-[11px] font-bold text-slate-500 ml-1.5">({statusStats.retornarPercent}%)</span>
                  </div>
                </div>

                {/* 3. Visitado não afiliado */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 transition-all shadow-3xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0 ring-2 ring-slate-200"></span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Visitado não afiliado</span>
                      <span className="text-[10px] text-slate-500 font-medium">Atendido porém sem interesse imediato</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-800">{statusStats.naoAfiliado}</span>
                    <span className="text-[11px] font-bold text-slate-500 ml-1.5">({statusStats.naoAfiliadoPercent}%)</span>
                  </div>
                </div>

                {/* 4. Contato Telefônico - Novo Agendamento */}
                {statusStats.agendamentoTel > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-cyan-200/80 hover:bg-cyan-50/40 transition-all shadow-3xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-[#38bdf8] shrink-0 ring-2 ring-cyan-200"></span>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Contato Telefônico - Novo Agendamento</span>
                        <span className="text-[10px] text-cyan-700 font-medium">Agendamento por ligação</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-cyan-800">{statusStats.agendamentoTel}</span>
                      <span className="text-[11px] font-bold text-slate-500 ml-1.5">({statusStats.agendamentoTelPercent}%)</span>
                    </div>
                  </div>
                )}

                {/* 5. Não Encontrado */}
                {statusStats.naoEncontrado > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-3xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-300 shrink-0 ring-2 ring-slate-100"></span>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Não Encontrado</span>
                        <span className="text-[10px] text-slate-500 font-medium">Síndico/responsável ausente</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-700">{statusStats.naoEncontrado}</span>
                      <span className="text-[11px] font-bold text-slate-500 ml-1.5">({statusStats.naoEncontradoPercent}%)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Visitas Registradas */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    <th className="px-4 py-3.5 whitespace-nowrap">Data / Hora</th>
                    {isAdmin && <th className="px-4 py-3.5 whitespace-nowrap">Consultor</th>}
                    <th className="px-4 py-3.5">Condomínio / Endereço</th>
                    <th className="px-4 py-3.5">Síndico / Contato</th>
                    <th className="px-4 py-3.5">Telefone</th>
                    <th className="px-4 py-3.5">Status</th>
                    {isAdmin && <th className="px-4 py-3.5 whitespace-nowrap">Geolocalização</th>}
                    <th className="px-4 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 6} className="px-4 py-10 text-center text-slate-500">
                        <div className="flex justify-center mb-2">
                          <div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                        Carregando visitas de campo...
                      </td>
                    </tr>
                  ) : filteredVisitas.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 6} className="px-4 py-10 text-center text-slate-500">
                        <MapPin className="mx-auto h-8 w-8 mb-2 text-slate-300" />
                        <p className="font-medium">Nenhuma visita encontrada para os filtros selecionados.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredVisitas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="text-slate-900 font-bold whitespace-nowrap">
                            {new Date(v.dataVisita).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-slate-400 text-xs whitespace-nowrap">
                            {new Date(v.dataVisita).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {isAdmin && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-semibold text-slate-800 text-xs">
                              {v.colaboradorNome || "Representante"}
                            </div>
                          </td>
                        )}

                        <td className="px-4 py-3.5">
                          <div className="text-slate-900 font-extrabold flex items-center gap-2">
                            {v.nomeCondominio}
                            {v.statusSindico === "Visitado Afiliado" && (
                              <CheckCircle2 size={14} className="text-[#0071e3]" title="Afiliado à U.C." />
                            )}
                          </div>
                          {v.qtdUnidades && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {v.qtdUnidades} unidades
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-slate-700 font-semibold">{v.nomeSindico || v.pessoaContato || "Não informado"}</div>
                          <div className="text-slate-400 text-[11px]">{v.funcaoCargo}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-slate-600 text-xs font-mono whitespace-nowrap">{v.telefoneContato || "—"}</div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5 items-start">
                            {getStatusBadge(v.statusSindico)}
                            {v.dataRetorno && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-900 border border-sky-200 font-bold text-xs shadow-3xs">
                                <Clock size={12} className="text-sky-600 shrink-0" />
                                <span>Retorno: {formatReturnDate(v.dataRetorno)}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {isAdmin && (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {v.geolocalizacao ? (
                              <a
                                href={v.geolocalizacao.mapsUrl || `https://www.google.com/maps?q=${v.geolocalizacao.latitude},${v.geolocalizacao.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/20 font-semibold text-xs border border-[#0071e3]/20 transition-colors"
                                title={`Lat: ${v.geolocalizacao.latitude}, Long: ${v.geolocalizacao.longitude}${v.geolocalizacao.accuracy ? ` (±${Math.round(v.geolocalizacao.accuracy)}m)` : ''}`}
                              >
                                <MapPin size={13} className="text-[#0071e3] shrink-0" />
                                <span>{v.geolocalizacao.latitude.toFixed(4)}, {v.geolocalizacao.longitude.toFixed(4)}</span>
                                <ExternalLink size={11} className="text-[#0071e3] shrink-0" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Não capturada</span>
                            )}
                          </td>
                        )}

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(v)}
                              className="p-2 text-slate-500 hover:text-[#0071e3] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                              title="Visualizar / Editar Visita"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedVisita(v);
                                setIsMsgModalOpen(true);
                              }}
                              className="p-2 text-slate-500 hover:text-[#0071e3] hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                              title="Enviar Mensagem via WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da Tabela */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
              <span>
                Exibindo <strong>{filteredVisitas.length}</strong> de <strong>{visitas.length}</strong> visitas registradas.
              </span>
              <span className="text-slate-400">
                Adaptabilidade 98% • Painel Comercial Externo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: CADASTRAR / EDITAR VISITA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 bg-[#0071e3]/10 text-[#0071e3] rounded-2xl flex items-center justify-center shadow-3xs">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selectedVisita ? "Editar Registro de Visita" : "Novo Atendimento Presencial"}
                </h3>
                <p className="text-xs text-slate-500">
                  Geolocalização GPS capturada automaticamente ao salvar.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveVisit();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Nome do Condomínio / Edifício *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nomeCondominio}
                  onChange={(e) => setFormData({ ...formData, nomeCondominio: e.target.value })}
                  placeholder="Ex: Condomínio Residencial Jardins do Lago"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#0071e3] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Nome do Síndico(a) / Administrador
                  </label>
                  <input
                    type="text"
                    value={formData.nomeSindico}
                    onChange={(e) => setFormData({ ...formData, nomeSindico: e.target.value })}
                    placeholder="Ex: Carlos Eduardo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Pessoa Contatada no Local
                  </label>
                  <input
                    type="text"
                    value={formData.pessoaContato}
                    onChange={(e) => setFormData({ ...formData, pessoaContato: e.target.value })}
                    placeholder="Ex: Zelador Marcos / Porteiro"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Cargo / Função
                  </label>
                  <select
                    value={formData.funcaoCargo}
                    onChange={(e) => setFormData({ ...formData, funcaoCargo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                  >
                    <option value="Síndico Morador">Síndico Morador</option>
                    <option value="Síndico Profissional">Síndico Profissional</option>
                    <option value="Administradora">Administradora</option>
                    <option value="Zelador / Gerente Predial">Zelador / Gerente Predial</option>
                    <option value="Portaria">Portaria</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.telefoneContato}
                    onChange={(e) => setFormData({ ...formData, telefoneContato: e.target.value })}
                    placeholder="(62) 99999-9999"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#0071e3] outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Qtd. de Unidades
                  </label>
                  <input
                    type="text"
                    value={formData.qtdUnidades}
                    onChange={(e) => setFormData({ ...formData, qtdUnidades: e.target.value })}
                    placeholder="Ex: 120"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Status do Síndico / Visita *
                  </label>
                  <select
                    value={formData.statusSindico}
                    onChange={(e) => setFormData({ ...formData, statusSindico: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#0071e3] outline-none"
                  >
                    <option value="Visitado Afiliado">Visitado Afiliado</option>
                    <option value="Visitado Retornar">Visitado Retornar</option>
                    <option value="Contato Telefônico - Novo Agendamento">Contato Telefônico - Novo Agendamento</option>
                    <option value="Visitado não afiliado">Visitado não afiliado</option>
                    <option value="Não Encontrado">Não Encontrado</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Data / Hora de Retorno
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dataRetorno}
                    onChange={(e) => setFormData({ ...formData, dataRetorno: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Observações / Detalhes da Visita
                </label>
                <textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Produtos de interesse, cotações solicitadas, melhor horário para contato..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm focus:ring-2 focus:ring-[#0071e3] outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#0071e3] hover:bg-[#0071e3]/90 text-white rounded-2xl text-sm font-bold transition shadow-md cursor-pointer"
                >
                  {selectedVisita ? "Atualizar Visita" : "Gravar Visita & GPS"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ENVIAR MENSAGEM WHATSAPP */}
      {isMsgModalOpen && selectedVisita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsMsgModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 bg-blue-50 text-[#0071e3] rounded-2xl flex items-center justify-center shadow-3xs">
                <MessageCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Enviar WhatsApp
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedVisita.nomeCondominio} ({selectedVisita.telefoneContato})
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleWhatsAppSend("apresentacao")}
                className="w-full p-3.5 text-left rounded-2xl border border-slate-200 hover:border-[#0071e3] hover:bg-blue-50/50 transition-all cursor-pointer group"
              >
                <span className="text-xs font-extrabold text-[#0071e3] block group-hover:underline">
                  1. Apresentação Inicial da União Condominial
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Apresentação dos benefícios, descontos de 50% e linha de produtos/serviços.
                </span>
              </button>

              <button
                onClick={() => handleWhatsAppSend("proposta")}
                className="w-full p-3.5 text-left rounded-2xl border border-slate-200 hover:border-[#0071e3] hover:bg-blue-50/50 transition-all cursor-pointer group"
              >
                <span className="text-xs font-extrabold text-[#0071e3] block group-hover:underline">
                  2. Envio de Catálogo & Proposta
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Envio da lista de produtos de limpeza, kits rotineiros e cashback.
                </span>
              </button>

              <button
                onClick={() => handleWhatsAppSend("retorno")}
                className="w-full p-3.5 text-left rounded-2xl border border-slate-200 hover:border-[#0071e3] hover:bg-blue-50/50 transition-all cursor-pointer group"
              >
                <span className="text-xs font-extrabold text-[#0071e3] block group-hover:underline">
                  3. Confirmação de Retorno / Follow-up
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Confirmação de data para nova visita ou fechamento de pedido.
                </span>
              </button>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsMsgModalOpen(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
