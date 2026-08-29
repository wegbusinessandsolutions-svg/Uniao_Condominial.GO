import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
  MessageCircle,
  Phone,
  Navigation,
  Route,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Search,
  SlidersHorizontal,
  Compass,
  Check,
  UserCheck,
  LayoutGrid,
  ShieldCheck,
  RefreshCw,
  ArrowRight
} from "lucide-react";
import { logAction } from "../../lib/audit";
import DeliveryConfirmModal from "../../components/logistica/DeliveryConfirmModal";
import DeliveryOccurrenceModal from "../../components/logistica/DeliveryOccurrenceModal";

export default function EntregadorDashboard() {
  const { profile } = useAuth();
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transito" | "concluidas" | "todas">("transito");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<string>("todos");
  const [confirmModalItem, setConfirmModalItem] = useState<any | null>(null);
  const [occurrenceModalItem, setOccurrenceModalItem] = useState<any | null>(null);
  const [arrivingDeliveryId, setArrivingDeliveryId] = useState<string | null>(null);
  const [justConfirmedArrivalId, setJustConfirmedArrivalId] = useState<string | null>(null);

  // Fetch or subscribe to deliveries in real-time
  useEffect(() => {
    let unsubscribe: () => void = () => {};

    const setupListener = async () => {
      setLoading(true);
      try {
        const { db } = await initFirebase();
        const q = collection(db, "entregas");

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const items = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

            // Sort logically: first by sequence (if present), then by date/id
            items.sort((a: any, b: any) => {
              const seqA = a.sequencia ?? 999;
              const seqB = b.sequencia ?? 999;
              return seqA - seqB;
            });

            setEntregas(items);
            setLoading(false);
          },
          (err) => {
            console.error("Erro ao escutar entregas:", err);
            setLoading(false);
          }
        );
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Set default driver from user profile if matched
  useEffect(() => {
    if (profile?.displayName || profile?.nomeCompleto) {
      const myName = profile.nomeCompleto || profile.displayName || "";
      const matched = entregas.find(
        (e) => e.entregador && e.entregador.toLowerCase().includes(myName.toLowerCase().split(" ")[0])
      );
      if (matched && selectedDriver === "todos") {
        setSelectedDriver(matched.entregador);
      }
    }
  }, [profile, entregas]);

  // Extract unique driver list
  const availableDrivers = useMemo(() => {
    const drivers = new Set<string>();
    entregas.forEach((e) => {
      if (e.entregador && typeof e.entregador === "string") {
        drivers.add(e.entregador);
      }
    });
    return Array.from(drivers);
  }, [entregas]);

  // Filter deliveries for current view and driver
  const filteredDeliveries = useMemo(() => {
    return entregas.filter((item) => {
      // Driver filter
      if (selectedDriver !== "todos" && item.entregador !== selectedDriver) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const clientName = (typeof item.cliente === "object" ? item.cliente?.nome : item.cliente) || "";
        const orderId = item.pedidoId || "";
        const address = item.endereco || "";
        const neighborhood = item.bairro || "";
        if (
          !clientName.toLowerCase().includes(term) &&
          !orderId.toLowerCase().includes(term) &&
          !address.toLowerCase().includes(term) &&
          !neighborhood.toLowerCase().includes(term)
        ) {
          return false;
        }
      }

      // Tab filter
      if (activeTab === "transito") {
        return item.status === "Em trânsito" || item.status === "No local da entrega" || ["Separando", "Pronta para Envio"].includes(item.status);
      }
      if (activeTab === "concluidas") {
        return item.status === "Entregue" || item.status === "Falha";
      }

      return true;
    });
  }, [entregas, selectedDriver, searchTerm, activeTab]);

  // Specific groups for progress bar
  const driverDeliveries = useMemo(() => {
    if (selectedDriver === "todos") return entregas;
    return entregas.filter((e) => e.entregador === selectedDriver);
  }, [entregas, selectedDriver]);

  const totalStops = driverDeliveries.length;
  const completedStops = driverDeliveries.filter((d) => d.status === "Entregue").length;
  const inTransitStops = driverDeliveries.filter((d) => d.status === "Em trânsito" || d.status === "No local da entrega").length;
  const failedStops = driverDeliveries.filter((d) => d.status === "Falha").length;
  const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  // Active Next Stop (The highest-priority stop currently in transit or pending)
  const currentActiveStop = useMemo(() => {
    return (
      driverDeliveries.find((d) => d.status === "Em trânsito" || d.status === "No local da entrega") ||
      driverDeliveries.find((d) => d.status === "Pronta para Envio" || d.status === "Separando")
    );
  }, [driverDeliveries]);

  // Quick Action: Confirm Arrival at location with GPS capture
  const handleConfirmArrival = async (item: any) => {
    setArrivingDeliveryId(item.id);
    try {
      const { db } = await initFirebase();

      let locationText = "";
      let numericLat: number | null = null;
      let numericLng: number | null = null;
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true,
            });
          });
          numericLat = pos.coords.latitude;
          numericLng = pos.coords.longitude;
          locationText = `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`;
        }
      } catch (geoErr) {
        console.warn("GPS não capturado:", geoErr);
      }

      const now = new Date();
      const horaChegada = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const updateData: any = {
        statusChegada: "No Local",
        horaChegada: horaChegada,
        chegadaRegistradaEm: now.toISOString(),
        localizacaoChegada: locationText || "Confirmado manualmente pelo entregador",
        updatedAt: now.toISOString(),
      };

      if (numericLat !== null && numericLng !== null) {
        updateData.latChegada = numericLat;
        updateData.lngChegada = numericLng;
        updateData.ultimaLocalizacao = {
          lat: numericLat,
          lng: numericLng,
          timestamp: now.toISOString(),
          texto: locationText,
          tipo: "Chegada no Local"
        };
      }

      await updateDoc(doc(db, "entregas", item.id), updateData);

      await logAction("Chegada confirmada no endereço pelo entregador", "Logística", {
        entregaId: item.id,
        pedidoId: item.pedidoId,
        cliente: typeof item.cliente === "object" ? item.cliente?.nome : item.cliente,
        horaChegada,
        gps: locationText,
      });

      setJustConfirmedArrivalId(item.id);
      setTimeout(() => setJustConfirmedArrivalId(null), 3000);
    } catch (err: any) {
      console.error("Erro ao confirmar chegada:", err);
      alert("Erro ao confirmar chegada: " + (err.message || "Erro de conexão"));
    } finally {
      setArrivingDeliveryId(null);
    }
  };

  // Quick Action: Start Route for a pending stop
  const handleStartRoute = async (item: any) => {
    try {
      const { db } = await initFirebase();
      const now = new Date();
      let startGps: any = {};
      try {
        if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              enableHighAccuracy: true,
            });
          });
          startGps = {
            ultimaLocalizacao: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: now.toISOString(),
              texto: `Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`,
              tipo: "Início de Rota"
            }
          };
        }
      } catch (e) {
        // Continue if GPS unavailable
      }

      await updateDoc(doc(db, "entregas", item.id), {
        status: "Em trânsito",
        horaSaida: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        updatedAt: now.toISOString(),
        ...startGps
      });

      await logAction("Início de rota para parada", "Logística", {
        id: item.id,
        pedidoId: item.pedidoId,
      });
    } catch (err: any) {
      console.error("Erro ao iniciar rota:", err);
      alert("Erro ao iniciar rota.");
    }
  };

  // Navigation Links
  const openWaze = (address: string) => {
    if (!address) return;
    const url = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
    window.open(url, "_blank");
  };

  const openGoogleMaps = (address: string) => {
    if (!address) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, "_blank");
  };

  const openWhatsApp = (item: any) => {
    const phone = item.telefone || item.telefoneCliente || "";
    const cleanPhone = phone.replace(/\D/g, "");
    const clientName = typeof item.cliente === "object" ? item.cliente?.nome : item.cliente;
    const message = encodeURIComponent(
      `Olá ${clientName || "Cliente"}! Sou o entregador da franquia e estou a caminho com a entrega do seu Pedido #${
        item.pedidoId || ""
      }. Em breve chego ao seu condomínio.`
    );

    if (cleanPhone) {
      window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
  };

  const makePhoneCall = (item: any) => {
    const phone = item.telefone || item.telefoneCliente || "";
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone) {
      window.location.href = `tel:${cleanPhone}`;
    } else {
      alert("Nenhum telefone cadastrado para esta entrega.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-16 px-1 sm:px-0">
      {/* Top Header Card with Driver Identification & Progress */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
              <Truck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                  Painel de Campo
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Minha Rota de Entregas
              </h1>
            </div>
          </div>

          {/* Driver Switcher & View Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 shadow-sm">
              <UserCheck size={14} className="text-blue-400" />
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="todos" className="bg-slate-900 text-white">
                  Todos os Motoristas ({entregas.length})
                </option>
                {availableDrivers.map((d, i) => (
                  <option key={i} value={d} className="bg-slate-900 text-white">
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <Link
              to="/admin/expedicao/logistica-roteirizacao"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold shadow-md transition-all"
              title="Abrir mapa geral da rota"
            >
              <Route size={14} />
              <span className="hidden sm:inline">Mapa</span> Geral
            </Link>
          </div>
        </div>

        {/* Daily Route Progress Metric Bar */}
        <div className="mt-5 pt-5 border-t border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Compass size={14} className="text-blue-400" />
                Progresso do Roteiro Diário
              </span>
              <span className="font-black text-blue-300">
                {completedStops} de {totalStops} Paradas ({progressPercent}%)
              </span>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-around sm:justify-end gap-3 text-center">
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Em Rota</div>
              <div className="text-sm font-black text-blue-400">{inTransitStops}</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Concluídas</div>
              <div className="text-sm font-black text-emerald-400">{completedStops}</div>
            </div>
            {failedStops > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-900/50">
                <div className="text-[10px] text-rose-300 font-bold uppercase">Falhas</div>
                <div className="text-sm font-black text-rose-400">{failedStops}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero Highlight: Current Active Stop ("PRÓXIMA PARADA") */}
      {currentActiveStop && (
        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-blue-400/30 relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-white/20 text-white text-xs font-black uppercase tracking-wider backdrop-blur-xs flex items-center gap-1.5">
                <Sparkles size={13} className="text-yellow-300" />
                Parada Atual em Foco
              </span>
              <span className="w-6 h-6 rounded-full bg-white text-blue-900 text-xs font-black flex items-center justify-center shadow-xs">
                {currentActiveStop.sequencia || "1"}º
              </span>
            </div>

            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-300/30 text-blue-100">
              Pedido #{currentActiveStop.pedidoId || currentActiveStop.id.substring(0, 6)}
            </span>
          </div>

          {/* Client & Address details */}
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              {typeof currentActiveStop.cliente === "object"
                ? currentActiveStop.cliente?.nome
                : currentActiveStop.cliente}
            </h2>
            <div className="flex items-start gap-1.5 text-blue-100 text-sm font-medium">
              <MapPin size={16} className="text-blue-200 shrink-0 mt-0.5" />
              <span>
                {currentActiveStop.endereco || "Endereço cadastrado na O.S."}
                {currentActiveStop.bairro ? ` • ${currentActiveStop.bairro}` : ""}
                {currentActiveStop.cidade ? ` • ${currentActiveStop.cidade}` : ""}
              </span>
            </div>
          </div>

          {/* Status info & arrival timestamp if already reached */}
          {currentActiveStop.statusChegada === "No Local" && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-300/40 flex items-center gap-2 text-xs font-bold text-emerald-200">
              <CheckCircle2 size={16} className="text-emerald-300" />
              <span>
                Chegada confirmada às {currentActiveStop.horaChegada || "recente"}. Pronto para descarregar e colher recebimento.
              </span>
            </div>
          )}

          {/* Action Row 1: Direct GPS Navigation & Communication */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/20">
            <button
              onClick={() => openWaze(currentActiveStop.endereco)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all backdrop-blur-xs border border-white/10"
            >
              <Navigation size={15} className="text-cyan-300" />
              Abrir no Waze
            </button>

            <button
              onClick={() => openGoogleMaps(currentActiveStop.endereco)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all backdrop-blur-xs border border-white/10"
            >
              <Compass size={15} className="text-amber-300" />
              Google Maps
            </button>

            <button
              onClick={() => openWhatsApp(currentActiveStop)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all backdrop-blur-xs border border-white/10"
            >
              <MessageCircle size={15} className="text-emerald-300" />
              WhatsApp
            </button>

            <button
              onClick={() => makePhoneCall(currentActiveStop)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold transition-all backdrop-blur-xs border border-white/10"
            >
              <Phone size={15} className="text-blue-200" />
              Ligar
            </button>
          </div>

          {/* Action Row 2: Big Fast Action Buttons (Confirm Arrival & Complete Delivery) */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Button 1: Confirm Arrival */}
            <button
              onClick={() => handleConfirmArrival(currentActiveStop)}
              disabled={arrivingDeliveryId === currentActiveStop.id || currentActiveStop.statusChegada === "No Local"}
              className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-black shadow-lg transition-all active:scale-[0.98] ${
                currentActiveStop.statusChegada === "No Local"
                  ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 cursor-default"
                  : "bg-white text-blue-900 hover:bg-blue-50 border border-white/50"
              }`}
            >
              {arrivingDeliveryId === currentActiveStop.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                  Obtendo GPS e Confirmando Chegada...
                </>
              ) : currentActiveStop.statusChegada === "No Local" ? (
                <>
                  <Check size={18} className="text-emerald-300" />
                  Chegada Confirmada no Local
                </>
              ) : (
                <>
                  <MapPin size={18} className="text-blue-600" />
                  Confirmar Chegada no Local
                </>
              )}
            </button>

            {/* Button 2: Complete Delivery (Opens confirmation modal) */}
            <button
              onClick={() => setConfirmModalItem(currentActiveStop)}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-emerald-950/20 active:scale-[0.98] transition-all"
            >
              <CheckCircle2 size={18} />
              Finalizar Entrega (Comprovante)
            </button>
          </div>
        </div>
      )}

      {/* Filter and Tab Navigation Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto p-1 bg-slate-100 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("transito")}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeTab === "transito"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Truck size={14} />
            Em Rota ({inTransitStops})
          </button>

          <button
            onClick={() => setActiveTab("concluidas")}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeTab === "concluidas"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 size={14} />
            Concluídas ({completedStops})
          </button>

          <button
            onClick={() => setActiveTab("todas")}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center justify-center gap-1.5 ${
              activeTab === "todas"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid size={14} />
            Todas ({totalStops})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, pedido ou rua..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Stops Feed (Mobile-Optimized Touch Cards) */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-600">Sincronizando paradas da rota...</p>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Package size={24} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Nenhuma entrega encontrada nesta visualização</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Não há pedidos correspondentes ao filtro ou status selecionado no momento.
            </p>
          </div>
        ) : (
          filteredDeliveries.map((item, index) => {
            const isCompleted = item.status === "Entregue";
            const isFailed = item.status === "Falha";
            const isArrived = item.statusChegada === "No Local";
            const isInTransit = item.status === "Em trânsito";
            const isPending = ["Separando", "Pronta para Envio"].includes(item.status);
            const clientName = typeof item.cliente === "object" ? item.cliente?.nome : item.cliente;

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  isCompleted
                    ? "border-emerald-200 bg-emerald-50/20"
                    : isFailed
                    ? "border-rose-200 bg-rose-50/20"
                    : isArrived
                    ? "border-blue-400 ring-2 ring-blue-400/20"
                    : "border-slate-200 hover:border-blue-300"
                }`}
              >
                {/* Card Top: Sequence, Client, Status Badge */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* Sequence Badge */}
                      <div
                        className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center text-xs font-black shrink-0 shadow-xs ${
                          isCompleted
                            ? "bg-emerald-600 text-white"
                            : isFailed
                            ? "bg-rose-600 text-white"
                            : isArrived
                            ? "bg-blue-600 text-white animate-pulse"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        <span>{item.sequencia || index + 1}º</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                            {clientName || "Cliente"}
                          </h3>
                          <span className="text-[11px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            #{item.pedidoId || item.id.substring(0, 6)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin size={13} className="text-slate-400 shrink-0" />
                            {item.endereco || "Endereço não informado"}
                            {item.bairro ? `, ${item.bairro}` : ""}
                          </span>
                          {item.cidade && <span className="text-slate-400">• {item.cidade}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : isFailed
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : isArrived
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : isInTransit
                            ? "bg-sky-100 text-sky-800 border border-sky-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {isCompleted && <CheckCircle2 size={12} />}
                        {isFailed && <XCircle size={12} />}
                        {isArrived && <MapPin size={12} />}
                        {isInTransit && !isArrived && <Truck size={12} />}
                        {isArrived ? "No Local" : item.status}
                      </span>

                      {item.valorTotal && (
                        <div className="text-xs font-black text-slate-800 mt-1">
                          R$ {Number(item.valorTotal).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery details & info badges */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap pt-1">
                    {item.prioridade && (
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          item.prioridade === "Alta"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-slate-50 text-slate-600 border border-slate-200"
                        }`}
                      >
                        Prioridade {item.prioridade}
                      </span>
                    )}

                    {item.horaChegada && (
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Clock size={11} /> Chegada: {item.horaChegada}
                      </span>
                    )}

                    {item.recebedor && (
                      <span className="flex items-center gap-1 text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                        <UserCheck size={11} /> Recebido por: {item.recebedor}
                      </span>
                    )}

                    {item.motivoFalha && (
                      <span className="flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertTriangle size={11} /> Ocorrência: {item.motivoFalha}
                      </span>
                    )}
                  </div>

                  {/* Action Bar per Card */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    {/* Navigation shortcuts */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openWaze(item.endereco)}
                        className="flex-1 sm:flex-none px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-cyan-50 hover:text-cyan-700 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Abrir no Waze"
                      >
                        <Navigation size={13} className="text-cyan-600" />
                        Waze
                      </button>

                      <button
                        onClick={() => openGoogleMaps(item.endereco)}
                        className="flex-1 sm:flex-none px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-700 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Abrir no Google Maps"
                      >
                        <Compass size={13} className="text-amber-600" />
                        Maps
                      </button>

                      <button
                        onClick={() => openWhatsApp(item)}
                        className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Enviar mensagem no WhatsApp"
                      >
                        <MessageCircle size={13} className="text-emerald-600" />
                      </button>

                      <button
                        onClick={() => makePhoneCall(item)}
                        className="px-2.5 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Ligar para o cliente"
                      >
                        <Phone size={13} className="text-blue-600" />
                      </button>
                    </div>

                    {/* Operational Action Buttons */}
                    <div className="flex items-center gap-2">
                      {isPending && (
                        <button
                          onClick={() => handleStartRoute(item)}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <Truck size={14} />
                          Iniciar Esta Entrega
                        </button>
                      )}

                      {(isInTransit || isArrived) && (
                        <>
                          {/* Fast Action: Confirm Arrival */}
                          {!isArrived && (
                            <button
                              onClick={() => handleConfirmArrival(item)}
                              disabled={arrivingDeliveryId === item.id}
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                            >
                              {arrivingDeliveryId === item.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                                  GPS...
                                </>
                              ) : (
                                <>
                                  <MapPin size={14} className="text-blue-600" />
                                  Confirmar Chegada
                                </>
                              )}
                            </button>
                          )}

                          {/* Fast Action: Complete Delivery */}
                          <button
                            onClick={() => setConfirmModalItem(item)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <CheckCircle2 size={14} />
                            Finalizar Entrega
                          </button>

                          {/* Fast Action: Report Occurrence */}
                          <button
                            onClick={() => setOccurrenceModalItem(item)}
                            className="p-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                            title="Relatar insucesso / ocorrência"
                          >
                            <AlertTriangle size={14} />
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <button
                          onClick={() => setConfirmModalItem(item)}
                          className="w-full sm:w-auto px-3 py-1.5 text-emerald-700 hover:bg-emerald-100/60 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <ShieldCheck size={14} />
                          Ver Comprovante
                        </button>
                      )}

                      {isFailed && (
                        <button
                          onClick={() => handleStartRoute(item)}
                          className="w-full sm:w-auto px-3 py-1.5 text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                        >
                          <RefreshCw size={13} />
                          Tentar Novamente
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delivery Confirmation Modal */}
      {confirmModalItem && (
        <DeliveryConfirmModal
          isOpen={!!confirmModalItem}
          onClose={() => setConfirmModalItem(null)}
          onSuccess={() => setConfirmModalItem(null)}
          deliveryItem={confirmModalItem}
        />
      )}

      {/* Delivery Failure / Occurrence Modal */}
      {occurrenceModalItem && (
        <DeliveryOccurrenceModal
          isOpen={!!occurrenceModalItem}
          onClose={() => setOccurrenceModalItem(null)}
          onSuccess={() => setOccurrenceModalItem(null)}
          deliveryItem={occurrenceModalItem}
        />
      )}
    </div>
  );
}
