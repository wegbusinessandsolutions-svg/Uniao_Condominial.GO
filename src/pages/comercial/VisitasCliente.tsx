import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, orderBy, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { MapPin, Search, Plus, Filter, FileText, Edit, MessageCircle, X, CheckCircle2, UserX, Clock, Calendar, Check, MessageSquare, ExternalLink, PieChart as PieChartIcon, TrendingUp, Users, CheckCheck } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export default function VisitasCliente() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "Administrador" || profile?.role === "admin" || profile?.role === "Admin" || profile?.role === "master";

  const [visitas, setVisitas] = useState<any[]>([]);
  const [filteredVisitas, setFilteredVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("Diário"); // Diário, Semanal, Quinzenal, Mensal
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [whatsappTemplates, setWhatsappTemplates] = useState<any>(null);

  const fetchTemplates = async () => {
    try {
      const docRef = doc(db, "config", "whatsapp_templates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().templates) {
        setWhatsappTemplates(docSnap.data().templates);
      }
    } catch (error) {
      console.error("Erro ao buscar templates do whatsapp", error);
    }
  };

  
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

  const fetchVisitas = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      let q;
      if (isAdmin) {
        q = query(collection(db, "visitas_crm"));
      } else {
        q = query(
          collection(db, "visitas_crm"),
          where("colaboradorId", "==", profile.uid)
        );
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      // Sort by dataVisita descending
      data.sort((a: any, b: any) => new Date(b.dataVisita || 0).getTime() - new Date(a.dataVisita || 0).getTime());
      
      setVisitas(data);
    } catch (error) {
      console.error("Erro ao buscar visitas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitas();
    fetchTemplates();
  }, [profile]);

  useEffect(() => {
    // Aplicar filtros
    let filtered = [...visitas];
    
    // Filtro de Busca
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.nomeCondominio?.toLowerCase().includes(lower) || 
        v.nomeSindico?.toLowerCase().includes(lower) ||
        v.colaboradorNome?.toLowerCase().includes(lower)
      );
    }
    
    // Filtro de Período
    const now = new Date();
    filtered = filtered.filter(v => {
      const vDate = new Date(v.dataVisita);
      const diffTime = Math.abs(now.getTime() - vDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (filterPeriod === "Diário") return diffDays <= 1;
      if (filterPeriod === "Semanal") return diffDays <= 7;
      if (filterPeriod === "Quinzenal") return diffDays <= 15;
      if (filterPeriod === "Mensal") return diffDays <= 30;
      return true; // Todos
    });
    
    setFilteredVisitas(filtered);
  }, [visitas, searchTerm, filterPeriod]);

  // Estatísticas e proporções de status para o gráfico de rosca (recharts)
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
        color: "#10b981",
        percent: afiliadoPercent,
      },
      {
        name: "Visitado Retornar",
        shortLabel: "Retornar",
        value: retornar,
        color: "#f59e0b",
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
        color: "#ea580c",
        percent: agendamentoTelPercent,
      },
      {
        name: "Não Encontrado",
        shortLabel: "Não Encontrado",
        value: naoEncontrado,
        color: "#f43f5e",
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

  const handleSave = async () => {
    if (!profile?.uid) return;
    try {
      if (selectedVisita && selectedVisita.id) {
        // Edit
        await updateDoc(doc(db, "visitas_crm", selectedVisita.id), {
          ...formData
        });
      } else {
        // Create - Capture geolocation
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
      fetchVisitas();
      fetchTemplates();
    } catch (error) {
      console.error("Erro ao salvar visita:", error);
      alert("Erro ao salvar a visita. Tente novamente.");
    }
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? "BOM DIA" : hour < 18 ? "BOA TARDE" : "BOA NOITE";
  };

  const getFormattedDate = () => {
    const days = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString("pt-BR");
    return { dayName, dateStr };
  };

  const { dayName, dateStr } = getFormattedDate();

  const handleSendWhatsapp = (opcao: number) => {
    if (!selectedVisita) return;
    
    const repNome = profile?.displayName || "Representante";
    const repTel = profile?.telefone || "(62) 99999-9999";
    const sindico = selectedVisita.nomeSindico || "Síndico(a)";
    const pronome = selectedVisita.pronomeTratamento || "Sr.(a)";
    const cond = selectedVisita.nomeCondominio || "Condomínio";
    const contato = selectedVisita.pessoaContato || "Recepção";
    
    const vDate = new Date(selectedVisita.dataVisita || new Date());
    const dataV = vDate.toLocaleDateString("pt-BR");
    const horaV = vDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute:"2-digit" });

    let template = "";
    if (opcao === 1) {
      template = whatsappTemplates?.template1 || `Olá, {pronome} *{sindico}*! Aqui é a *{repNome}*, da União Condominial.\n\nFoi um prazer conversar com você hoje e agradeço muito pela atenção e pelo tempo que nos dedicou.\n\nComo conversamos, a União Condominial foi criada para unir os condomínios da Grande Goiânia, proporcionando acesso a produtos de limpeza e conservação de qualidade, serviços agendados com 50% de desconto, parceiros especializados e condições mais vantajosas para o condomínio.\n\nEstou deixando o convite para que o *{cond}* também faça parte dessa união.\n\nQuando tiver um tempinho, será um prazer continuar nossa conversa e apresentar todos os benefícios.\n\nO seu condomínio não precisa ficar de fora dessa oportunidade.\n\nUm grande abraço,\n\n*{repNome}*\n{repTel}\nUnião Condominial\nwww.uniaocondominial.com.br`;
    } else if (opcao === 2) {
      template = whatsappTemplates?.template2 || `Olá, {pronome} *{sindico}*! Aqui é a *{repNome}*, da União Condominial.\n\nQuero agradecer novamente pela atenção e pelo excelente atendimento que recebi hoje.\n\nE, principalmente, parabenizá-lo(a) pela decisão de incluir o *{cond}* na União Condominial! 👏\n\nTenho certeza de que essa parceria trará boas oportunidades, economia e mais tranquilidade para a gestão do condomínio.\n\nAgora fazemos parte da mesma união, trabalhando para buscar qualidade, preços justos e soluções que realmente façam diferença no dia a dia do condomínio.\n\nSeja muito bem-vindo(a) à União Condominial!\n\nConte conosco.\n\n*{repNome}*\n{repTel}\nUnião Condominial\nwww.uniaocondominial.com.br`;
    } else if (opcao === 3) {
      template = whatsappTemplates?.template3 || `Olá, {pronome} *{sindico}*! Meu nome é *{repNome}*, da União Condominial.\n\nEstive no *{cond}* no dia {dataV}, às {horaV}, porém não consegui encontrá-lo(a) pessoalmente.\n\nDeixei na recepção, com *{contato}*, um livreto explicativo sobre a União Condominial, que apresenta nossa proposta, serviços, benefícios e as vantagens de fazer parte dessa união.\n\nQuando tiver um tempinho, peço que faça uma leitura com carinho. Tenho certeza de que encontrará oportunidades interessantes para o *{cond}*.\n\nAssim que possível, gostaria de marcar um horário para apresentar tudo pessoalmente e explicar como podemos ajudar o condomínio.\n\nO *{cond}* não pode perder essa oportunidade.\n\nFico à disposição.\n\n*{repNome}*\n{repTel}\nUnião Condominial\nwww.uniaocondominial.com.br`;
    }
    
    let text = template
      .replace(/{sindico}/g, sindico)
      .replace(/{pronome}/g, pronome)
      .replace(/{repNome}/g, repNome)
      .replace(/{repTel}/g, repTel)
      .replace(/{cond}/g, cond)
      .replace(/{contato}/g, contato)
      .replace(/{dataV}/g, dataV)
      .replace(/{horaV}/g, horaV);

    const telFormatado = selectedVisita.telefoneContato.replace(/\D/g, "");
    const url = `https://api.whatsapp.com/send?phone=55${telFormatado}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    setIsMsgModalOpen(false);
  };

  const formatReturnDate = (dateVal?: any) => {
    if (!dateVal) return "";
    try {
      if (typeof dateVal === "string") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
          const [y, m, d] = dateVal.split("-");
          return `${d}/${m}/${y}`;
        }
        if (dateVal.includes("T")) {
          const d = new Date(dateVal);
          if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
        }
        const parsed = new Date(`${dateVal}T12:00:00`);
        if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString("pt-BR");
      }
      if (dateVal?.seconds) {
        return new Date(dateVal.seconds * 1000).toLocaleDateString("pt-BR");
      }
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    } catch {
      // fallback
    }
    return String(dateVal);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Visitado Afiliado": return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg flex items-center gap-1.5"><Check size={12}/> Afiliado</span>;
      case "Visitado Retornar": return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg flex items-center gap-1.5"><Clock size={12}/> Retornar</span>;
      case "Contato Telefônico - Novo Agendamento": return <span className="px-2.5 py-1 bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-bold rounded-lg flex items-center gap-1.5 shadow-2xs"><Clock size={12} className="text-orange-600"/> Contato Tel. - Novo Agendamento</span>;
      case "Visitado não afiliado": return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg flex items-center gap-1.5"><UserX size={12}/> Não Afiliado</span>;
      case "Não Encontrado": return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-lg flex items-center gap-1.5"><UserX size={12}/> Não Encontrado</span>;
      default: return <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Saudação */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 uppercase">
            {getGreeting()}, {profile?.displayName?.toUpperCase() || "COLABORADOR(A)"}
          </h1>
          <p className="text-sm text-slate-600 mt-2 font-medium">
            Hoje é: <strong className="text-slate-800">{dayName}</strong>, dia: <strong className="text-slate-800">{dateStr}</strong>
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
          <span className="block text-xs font-bold text-emerald-700 uppercase">Meta Mínima Visita</span>
          <span className="block text-2xl font-extrabold text-emerald-600 mt-1">4</span>
        </div>
      </div>

      {/* Ações e Filtros */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por condomínio ou síndico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full md:w-56 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3] appearance-none cursor-pointer"
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
                    {period} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
        <button
          onClick={openNewModal}
          className="w-full md:w-auto bg-[#0071e3] hover:bg-[#005bb5] text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Plus size={18} />
          Nova Visita
        </button>
      </div>

      {/* Gráfico de Rosca - Proporção de Status dos Síndicos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <div className="p-1.5 bg-[#0071e3]/10 text-[#0071e3] rounded-lg">
                <PieChartIcon size={18} />
              </div>
              <h2>Proporção de Status dos Síndicos</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visão consolidada da distribuição dos atendimentos ({filterPeriod.toLowerCase()})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
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
                        borderRadius: "12px",
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
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">
                    Afiliados
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-52 flex flex-col items-center justify-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-center p-4">
                <PieChartIcon className="text-slate-300 mb-2" size={36} />
                <span className="text-xs text-slate-500 font-semibold">
                  Nenhuma visita encontrada para o período selecionado
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  Cadastre uma nova visita ou altere o filtro
                </span>
              </div>
            )}
          </div>

          {/* Status Breakdown Legend & Cards */}
          <div className="lg:col-span-7 space-y-2.5">
            {/* 1. Visitado Afiliado */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 hover:bg-emerald-50 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200"></span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Visitado Afiliado</span>
                  <span className="text-[10px] text-emerald-700 font-medium">Síndicos convertidos e afiliados</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-emerald-800">{statusStats.afiliado}</span>
                <span className="text-[11px] font-bold text-emerald-600 ml-1.5">({statusStats.afiliadoPercent}%)</span>
              </div>
            </div>

            {/* 2. Visitado Retornar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-50 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0 ring-2 ring-amber-200"></span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Visitado Retornar</span>
                  <span className="text-[10px] text-amber-700 font-medium">Reagendamento ou nova visita presencial</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-amber-800">{statusStats.retornar}</span>
                <span className="text-[11px] font-bold text-amber-600 ml-1.5">({statusStats.retornarPercent}%)</span>
              </div>
            </div>

            {/* 3. Visitado não afiliado */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/60 transition-all">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-slate-500 shrink-0 ring-2 ring-slate-200"></span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Visitado não afiliado</span>
                  <span className="text-[10px] text-slate-500 font-medium">Atendido porém sem interesse no momento</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-slate-800">{statusStats.naoAfiliado}</span>
                <span className="text-[11px] font-bold text-slate-600 ml-1.5">({statusStats.naoAfiliadoPercent}%)</span>
              </div>
            </div>

            {/* 4. Contato Telefônico - Novo Agendamento */}
            {statusStats.agendamentoTel > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/70 border border-orange-200/80 hover:bg-orange-50 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0 ring-2 ring-orange-200"></span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Contato Telefônico - Novo Agendamento</span>
                    <span className="text-[10px] text-orange-700 font-medium">Agendamento por ligação</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-orange-800">{statusStats.agendamentoTel}</span>
                  <span className="text-[11px] font-bold text-orange-600 ml-1.5">({statusStats.agendamentoTelPercent}%)</span>
                </div>
              </div>
            )}

            {/* 5. Não Encontrado */}
            {statusStats.naoEncontrado > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-50 transition-all">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 ring-2 ring-rose-200"></span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Não Encontrado</span>
                    <span className="text-[10px] text-rose-700 font-medium">Síndico/responsável ausente</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-rose-800">{statusStats.naoEncontrado}</span>
                  <span className="text-[11px] font-bold text-rose-600 ml-1.5">({statusStats.naoEncontradoPercent}%)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="px-4 py-3 whitespace-nowrap">Data</th>
                <th className="px-4 py-3 whitespace-nowrap">Hora</th>
                {isAdmin && <th className="px-4 py-3 whitespace-nowrap">Consultor</th>}
                <th className="px-4 py-3">Condomínio/Endereço</th>
                <th className="px-4 py-3">SÍNDICO/ADM</th>
                <th className="px-4 py-3">TELEFONE</th>
                <th className="px-4 py-3">STATUS</th>
                {isAdmin && <th className="px-4 py-3 whitespace-nowrap">Geolocalização</th>}
                <th className="px-4 py-3 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-4 py-8 text-center text-slate-500">
                    <div className="flex justify-center mb-2"><div className="w-6 h-6 border-2 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div></div>
                    Carregando visitas...
                  </td>
                </tr>
              ) : filteredVisitas.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma visita encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredVisitas.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-medium whitespace-nowrap">
                        {new Date(v.dataVisita).toLocaleDateString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-500 text-sm whitespace-nowrap">
                        {new Date(v.dataVisita).toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">
                          {v.colaboradorNome || "Representante"}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-bold flex items-center gap-2">
                        {v.nomeCondominio}
                        {v.statusSindico === "Visitado Afiliado" && (
                          <CheckCircle2 size={14} className="text-emerald-500" title="Afiliado à U.C." />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 font-medium">{v.nomeSindico || "Não informado"}</div>
                      <div className="text-slate-500 text-[11px]">{v.funcaoCargo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-600 text-sm whitespace-nowrap">{v.telefoneContato}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5 items-start">
                        {getStatusBadge(v.statusSindico)}
                        {v.dataRetorno && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100/90 text-orange-900 border border-orange-300 font-bold text-xs shadow-xs ring-1 ring-orange-400/20">
                            <Calendar size={13} className="text-orange-600 shrink-0" />
                            <span>Retorno: {formatReturnDate(v.dataRetorno)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {v.geolocalizacao ? (
                          <a
                            href={v.geolocalizacao.mapsUrl || `https://www.google.com/maps?q=${v.geolocalizacao.latitude},${v.geolocalizacao.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-xs border border-emerald-200 transition-colors"
                            title={`Lat: ${v.geolocalizacao.latitude}, Long: ${v.geolocalizacao.longitude}${v.geolocalizacao.accuracy ? ` (±${Math.round(v.geolocalizacao.accuracy)}m)` : ''}`}
                          >
                            <MapPin size={13} className="text-emerald-600 shrink-0" />
                            <span>{v.geolocalizacao.latitude.toFixed(4)}, {v.geolocalizacao.longitude.toFixed(4)}</span>
                            <ExternalLink size={11} className="text-emerald-500 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Não capturada</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1.5 text-slate-400 hover:text-[#0071e3] hover:bg-sky-50 rounded-lg transition-colors"
                          title="Visualizar / Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedVisita(v);
                            setIsMsgModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Enviar Msg Zap"
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
      </div>

      {/* Modal Nova/Editar Visita */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="text-[#0071e3]" size={20} />
                {selectedVisita ? "Editar Visita" : "Nova Visita"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              {isAdmin && selectedVisita?.geolocalizacao && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950 mb-2">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="text-sky-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <div className="font-bold text-sky-900 flex items-center gap-1.5">
                        <span>Geolocalização Capturada no Registro</span>
                        <span className="bg-sky-200/80 text-sky-800 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase">Visível apenas Admin</span>
                      </div>
                      <div className="text-slate-600 mt-0.5 font-mono">
                        Lat: {selectedVisita.geolocalizacao.latitude} | Long: {selectedVisita.geolocalizacao.longitude}
                        {selectedVisita.geolocalizacao.accuracy && (
                          <span className="font-sans text-slate-500 ml-1.5">(Precisão: ±{Math.round(selectedVisita.geolocalizacao.accuracy)}m)</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <a
                    href={selectedVisita.geolocalizacao.mapsUrl || `https://www.google.com/maps?q=${selectedVisita.geolocalizacao.latitude},${selectedVisita.geolocalizacao.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold rounded-lg transition-colors shrink-0 text-xs shadow-2xs"
                  >
                    <span>Ver no Maps</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <p className="text-sm text-slate-600 font-medium mb-4">Preencha abaixo os dados de sua visita:</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Condomínio:</label>
                  <input
                    type="text"
                    value={formData.nomeCondominio}
                    onChange={(e) => setFormData({...formData, nomeCondominio: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pessoa de Contato:</label>
                  <input
                    type="text"
                    value={formData.pessoaContato}
                    onChange={(e) => setFormData({...formData, pessoaContato: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Função/Cargo:</label>
                  <select
                    value={formData.funcaoCargo}
                    onChange={(e) => setFormData({...formData, funcaoCargo: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  >
                    <option value="Morador(a)">Morador(a)</option>
                    <option value="Porteiro(a)">Porteiro(a)</option>
                    <option value="Zelador(a)">Zelador(a)</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>

                {(formData.statusSindico === "Contato Telefônico - Novo Agendamento" || formData.statusSindico === "Visitado Retornar" || formData.dataRetorno) && (
                  <div className="col-span-1 sm:col-span-2 bg-orange-50/70 p-3 rounded-xl border border-orange-200">
                    <label className="block text-xs font-bold text-orange-900 mb-1 flex items-center gap-1.5">
                      <Calendar size={14} className="text-orange-600" />
                      <span>Data de Retorno:</span>
                    </label>
                    <input
                      type="date"
                      value={formData.dataRetorno}
                      onChange={(e) => setFormData({...formData, dataRetorno: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-semibold text-slate-800"
                    />
                  </div>
                )}

                
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pronome de Tratamento: <span className="text-red-500">*</span></label>
                  <select
                    value={formData.pronomeTratamento}
                    onChange={(e) => setFormData({...formData, pronomeTratamento: e.target.value})}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="Senhor">Senhor</option>
                    <option value="Senhora">Senhora</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome do Síndico(a)/Administrador(a): <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.nomeSindico}
                    onChange={(e) => setFormData({...formData, nomeSindico: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nº Telefone contato:</label>
                  <input
                    type="text"
                    value={formData.telefoneContato}
                    onChange={(e) => setFormData({...formData, telefoneContato: e.target.value})}
                    placeholder="(62) 99999-9999"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Qtd Unidades Habitacionais:</label>
                  <input
                    type="number"
                    value={formData.qtdUnidades}
                    onChange={(e) => setFormData({...formData, qtdUnidades: e.target.value})}
                    placeholder="Ex: 50"
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  />
                </div>

                
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status Síndico(a)/Administrador:</label>
                  <select
                    value={formData.statusSindico}
                    onChange={(e) => setFormData({...formData, statusSindico: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none"
                  >
                    <option value="Não Encontrado">Não Encontrado</option>
                    <option value="Visitado não afiliado">Visitado não afiliado</option>
                    <option value="Visitado Retornar">Visitado Retornar</option>
                    <option value="Visitado Afiliado">Visitado Afiliado</option>
                    <option value="Contato Telefônico - Novo Agendamento">Contato Telefônico - Novo Agendamento</option>
                  </select>
                </div>
                
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex justify-between">
                    Observações:
                    <span className={`text-[10px] ${formData.observacoes.length > 300 ? 'text-red-500' : 'text-slate-400'}`}>
                      {formData.observacoes.length}/300 caracteres
                    </span>
                  </label>
                  <textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value.substring(0, 300)})}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0071e3] focus:border-transparent outline-none resize-none"
                  ></textarea>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.nomeCondominio || !formData.pronomeTratamento || !formData.nomeSindico}
                className="px-4 py-2 text-sm font-bold bg-[#0071e3] hover:bg-[#005bb5] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mensagens WhatsApp */}
      {isMsgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
              <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                <MessageCircle className="text-emerald-600" size={20} />
                Enviar Mensagem - WhatsApp
              </h2>
              <button onClick={() => setIsMsgModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-2">
                Selecione o modelo de mensagem a ser enviado para <strong>{selectedVisita?.nomeSindico || "o cliente"}</strong> ({selectedVisita?.telefoneContato}):
              </p>
              
              <button 
                onClick={() => handleSendWhatsapp(1)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-700">1. Recebeu, mas não se afiliou</h3>
                  <MessageSquare size={16} className="text-slate-400 group-hover:text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">"Foi um prazer conversar com você hoje... Estou deixando o convite para que o condomínio também faça parte dessa união."</p>
              </button>

              <button 
                onClick={() => handleSendWhatsapp(2)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-700">2. Recebeu e afiliou</h3>
                  <MessageSquare size={16} className="text-slate-400 group-hover:text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">"Quero agradecer novamente... parabenizá-lo(a) pela decisão de incluir o condomínio na União Condominial! 👏"</p>
              </button>

              <button 
                onClick={() => handleSendWhatsapp(3)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-700">3. Não encontrou o Síndico</h3>
                  <MessageSquare size={16} className="text-slate-400 group-hover:text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">"Estive no condomínio hoje... Deixei na recepção um livreto explicativo... Gostaria de marcar um horário."</p>
              </button>
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-center">
              <p className="text-[11px] text-slate-500">O WhatsApp será aberto no seu aplicativo com a mensagem formatada pronta para envio.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
