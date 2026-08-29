import React, { useState, useEffect, useMemo } from "react";
import { 
  Truck, 
  MapPin, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Route, 
  Search, 
  Filter, 
  RefreshCw, 
  Plus, 
  Sparkles, 
  Navigation, 
  Printer, 
  Download, 
  UserCheck, 
  MessageSquare, 
  Building2, 
  DollarSign, 
  SlidersHorizontal,
  ChevronRight,
  Send,
  Calendar,
  Layers,
  ArrowUpDown,
  Compass,
  Radio
} from "lucide-react";
import { collection, getDocs, doc, updateDoc, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import DeliveryRouteMap, { DeliveryLocation } from "../../components/logistica/DeliveryRouteMap";
import RouteOptimizerCard from "../../components/logistica/RouteOptimizerCard";
import DispatchModal from "../../components/logistica/DispatchModal";
import DeliveryConfirmModal from "../../components/logistica/DeliveryConfirmModal";
import DeliveryOccurrenceModal from "../../components/logistica/DeliveryOccurrenceModal";
import ManualRouteReorderModal from "../../components/logistica/ManualRouteReorderModal";
import DeliveryGeoStatusModal from "../../components/logistica/DeliveryGeoStatusModal";

// Predefined demo coordinates around Goiânia/Franchise region if items lack GPS
const GOIANIA_BASE = {
  lat: -16.6869,
  lng: -49.2648,
  name: "Centro de Distribuição Principal",
  address: "Av. Anhanguera, 5000 - Setor Central, Goiânia - GO",
};

const SAMPLE_COORDINATES = [
  { lat: -16.7025, lng: -49.2550, bairro: "Setor Bueno", endereco: "Av. T-4, 1200 - Ed. Metropolitan" },
  { lat: -16.7150, lng: -49.2680, bairro: "Setor Marista", endereco: "Rua 1128, 450 - Cond. Solar das Palmeiras" },
  { lat: -16.6780, lng: -49.2430, bairro: "Setor Sul", endereco: "Rua 84, 320 - Residencial Bela Vista" },
  { lat: -16.6950, lng: -49.2790, bairro: "Setor Oeste", endereco: "Av. República do Líbano, 890" },
  { lat: -16.7280, lng: -49.2490, bairro: "Jardim Goiás", endereco: "Av. Jamel Cecílio, 2100 - Flamboyant Park" },
  { lat: -16.6620, lng: -49.2810, bairro: "Setor Campinas", endereco: "Av. 24 de Outubro, 750" },
  { lat: -16.7380, lng: -49.2730, bairro: "Parque Amazônia", endereco: "Av. Feira de Santana, 410" },
];

const AVAILABLE_DRIVERS = [
  "Carlos Santos (Moto - Placa ABC-1234)",
  "Marcos Oliveira (Fiorino - Placa XYZ-9876)",
  "Roberto Souza (Van Master - Placa KJH-5544)",
  "Lucas Silva (Carro - Placa RTO-7812)",
];

export default function LogisticaRoteirizacao() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"mapa" | "kanban" | "tabela">("mapa");
  const [selectedDriver, setSelectedDriver] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  // Modals state
  const [dispatchItem, setDispatchItem] = useState<any | null>(null);
  const [confirmItem, setConfirmItem] = useState<any | null>(null);
  const [occurrenceItem, setOccurrenceItem] = useState<any | null>(null);
  const [geoStatusItem, setGeoStatusItem] = useState<any | null>(null);
  const [isManualReorderModalOpen, setIsManualReorderModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const snap = await getDocs(collection(db, "entregas"));
      const items = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setDeliveries(items);
    } catch (err) {
      console.error("Erro ao carregar entregas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Update sequence directly when modified by Drag & Drop
  const handleUpdateSequence = async (reorderedDeliveries: DeliveryLocation[]) => {
    try {
      const { db } = await initFirebase();

      for (let i = 0; i < reorderedDeliveries.length; i++) {
        const item = reorderedDeliveries[i];
        await updateDoc(doc(db, "entregas", item.id), {
          sequencia: i + 1,
          updatedAt: new Date().toISOString(),
        });
      }

      await logAction("Reotimização manual de sequência de rota (Drag & Drop)", "Logística", {
        totalParadas: reorderedDeliveries.length,
        motorista: selectedDriver,
      });

      // Update local state instantly so map and cards reflect the change with 0 lag
      setDeliveries((prev) => {
        const seqMap = new Map(reorderedDeliveries.map((it, idx) => [it.id, idx + 1]));
        return prev.map((d) => {
          if (seqMap.has(d.id)) {
            return { ...d, sequencia: seqMap.get(d.id) };
          }
          return d;
        });
      });
    } catch (err: any) {
      console.error("Erro ao salvar reordenação de rota:", err);
      alert("Erro ao salvar ordem de rota: " + err.message);
    }
  };

  // Format deliveries with deterministic coordinates for the Map
  const formattedDeliveries: DeliveryLocation[] = useMemo(() => {
    return deliveries.map((d, index) => {
      let lat = d.lat || d.latitude;
      let lng = d.lng || d.longitude;

      // Fallback coordinate generation for map visualization
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
        const sampleCoord = SAMPLE_COORDINATES[index % SAMPLE_COORDINATES.length];
        // add slight jitter so overlapping points are distinct
        lat = sampleCoord.lat + ((index * 0.002) % 0.015);
        lng = sampleCoord.lng + ((index * 0.003) % 0.015);
      }

      return {
        id: d.id,
        pedidoId: d.pedidoId || d.id_externo || `PED-${d.id.substring(0, 4)}`,
        cliente: typeof d.cliente === "object" ? d.cliente?.nome : d.cliente || "Cliente Não Informado",
        endereco: d.endereco || d.logradouro || (SAMPLE_COORDINATES[index % SAMPLE_COORDINATES.length].endereco),
        bairro: d.bairro || (SAMPLE_COORDINATES[index % SAMPLE_COORDINATES.length].bairro),
        cidade: d.cidade || d.municipio || "Goiânia",
        cep: d.cep || "74000-000",
        valorTotal: d.valorTotal || d.valor || 0,
        status: d.status || "Separando",
        entregador: d.entregador || "",
        prioridade: d.prioridade || "Média",
        lat: Number(lat),
        lng: Number(lng),
        sequencia: d.sequencia || index + 1,
        telefone: d.telefone || d.fone || "(62) 98888-0000",
        horaSaida: d.horaSaida || "",
      };
    });
  }, [deliveries]);

  // Key performance indicators
  const kpis = useMemo(() => {
    const total = formattedDeliveries.length;
    const emRota = formattedDeliveries.filter((d) => d.status === "Em trânsito");
    const paraDespacho = formattedDeliveries.filter((d) =>
      ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status)
    );
    const concluidas = formattedDeliveries.filter((d) => d.status === "Entregue");
    const falhas = formattedDeliveries.filter((d) => d.status === "Falha");

    const valorEmRota = emRota.reduce((acc, curr) => acc + Number(curr.valorTotal || 0), 0);
    const activeDrivers = Array.from(new Set(emRota.map((d) => d.entregador).filter(Boolean))).length;

    const taxaConclusao = total > 0 ? Math.round((concluidas.length / total) * 100) : 0;

    return {
      total,
      emRotaCount: emRota.length,
      paraDespachoCount: paraDespacho.length,
      concluidasCount: concluidas.length,
      falhasCount: falhas.length,
      valorEmRota,
      activeDrivers,
      taxaConclusao,
    };
  }, [formattedDeliveries]);

  // Filtered deliveries for tables/kanban
  const filteredDeliveries = useMemo(() => {
    return formattedDeliveries.filter((item) => {
      // Driver filter
      if (selectedDriver !== "todos" && item.entregador !== selectedDriver) {
        return false;
      }
      // Status filter
      if (statusFilter === "em_rota" && item.status !== "Em trânsito") return false;
      if (statusFilter === "despacho" && !["Separando", "Pronta para Envio", "Aguardando"].includes(item.status)) return false;
      if (statusFilter === "entregue" && item.status !== "Entregue") return false;
      if (statusFilter === "falha" && item.status !== "Falha") return false;

      // Search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCliente = item.cliente.toLowerCase().includes(term);
        const matchPedido = (item.pedidoId || "").toLowerCase().includes(term);
        const matchEndereco = (item.endereco || "").toLowerCase().includes(term);
        const matchBairro = (item.bairro || "").toLowerCase().includes(term);
        const matchEntregador = (item.entregador || "").toLowerCase().includes(term);
        return matchCliente || matchPedido || matchEndereco || matchBairro || matchEntregador;
      }
      return true;
    });
  }, [formattedDeliveries, selectedDriver, statusFilter, searchTerm]);

  // Route Optimizer Algorithm (re-sequences in-transit deliveries logically)
  const handleOptimizeRoute = async () => {
    try {
      const inTransit = deliveries.filter((d) => d.status === "Em trânsito");
      if (inTransit.length === 0) {
        alert("Não há pedidos em trânsito no momento para otimizar.");
        return;
      }

      const { db } = await initFirebase();

      // Sort by proximity/sequence priority
      const sorted = [...inTransit].sort((a, b) => {
        const pMap: any = { Alta: 1, Média: 2, Baixa: 3 };
        return (pMap[a.prioridade] || 2) - (pMap[b.prioridade] || 2);
      });

      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];
        await updateDoc(doc(db, "entregas", item.id), {
          sequencia: i + 1,
          updatedAt: new Date().toISOString(),
        });
      }

      await logAction("Otimização de Sequência de Rota executada", "Logística", {
        totalEntregas: sorted.length,
      });

      alert(`✅ Rota otimizada com sucesso! ${sorted.length} paradas sequenciadas.`);
      fetchDeliveries();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao otimizar rotas: " + err.message);
    }
  };

  // Quick Simulation generator to populate deliveries for real-time demo
  const handleSimularEntregas = async () => {
    setIsSimulating(true);
    try {
      const { db } = await initFirebase();

      const sampleBatch = [
        {
          pedidoId: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente: "Condomínio Residencial Ilhas do Sol",
          endereco: "Av. T-4, 1200",
          bairro: "Setor Bueno",
          cidade: "Goiânia",
          valorTotal: 485.5,
          status: "Em trânsito",
          entregador: AVAILABLE_DRIVERS[0],
          veiculo: "Moto Honda CG 160",
          horaSaida: "14:15",
          sequencia: 1,
          prioridade: "Alta",
          telefone: "(62) 99123-4567",
          createdAt: new Date().toISOString(),
        },
        {
          pedidoId: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente: "Edifício Solar das Palmeiras (Síndica Ana)",
          endereco: "Rua 1128, 450",
          bairro: "Setor Marista",
          cidade: "Goiânia",
          valorTotal: 820.0,
          status: "Em trânsito",
          entregador: AVAILABLE_DRIVERS[0],
          veiculo: "Moto Honda CG 160",
          horaSaida: "14:15",
          sequencia: 2,
          prioridade: "Alta",
          telefone: "(62) 98455-1122",
          createdAt: new Date().toISOString(),
        },
        {
          pedidoId: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente: "Condomínio Flamboyant Park",
          endereco: "Av. Jamel Cecílio, 2100",
          bairro: "Jardim Goiás",
          cidade: "Goiânia",
          valorTotal: 1250.0,
          status: "Pronta para Envio",
          entregador: AVAILABLE_DRIVERS[1],
          veiculo: "Fiorino",
          sequencia: 3,
          prioridade: "Média",
          telefone: "(62) 99344-9988",
          createdAt: new Date().toISOString(),
        },
        {
          pedidoId: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
          cliente: "Residencial Campinas Prime",
          endereco: "Av. 24 de Outubro, 750",
          bairro: "Setor Campinas",
          cidade: "Goiânia",
          valorTotal: 340.0,
          status: "Separando",
          entregador: "",
          sequencia: 4,
          prioridade: "Baixa",
          telefone: "(62) 98111-2233",
          createdAt: new Date().toISOString(),
        },
      ];

      for (const item of sampleBatch) {
        await addDoc(collection(db, "entregas"), item);
      }

      await logAction("Simulação de carga de entregas para testes de logística", "Logística");
      alert("✅ 4 novos pedidos de demonstração gerados com sucesso!");
      fetchDeliveries();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao simular entregas: " + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handlePrintRomaneio = () => {
    window.print();
  };

  const [mapLayoutMode, setMapLayoutMode] = useState<"split" | "map_focus" | "list_focus">("split");

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold text-[11px] uppercase tracking-wider">
              Módulo de Expedição & Entregas
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Operação em Tempo Real
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Logística e Roteirização
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de despacho, monitoramento geográfico de rotas e assistência direta ao entregador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchDeliveries}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            Atualizar
          </button>

          <button
            onClick={() => setIsManualReorderModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-bold transition-all shadow-xs"
            title="Reordenar paradas com arrastar e soltar (Drag and drop)"
          >
            <ArrowUpDown size={15} className="text-blue-600" />
            Reotimização Manual
          </button>

          <button
            onClick={handleSimularEntregas}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold transition-all shadow-xs"
          >
            <Sparkles size={15} className="text-indigo-600" />
            {isSimulating ? "Gerando..." : "Simular Cargas"}
          </button>

          <button
            onClick={handlePrintRomaneio}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 text-xs font-bold shadow-xs transition-all"
          >
            <Printer size={15} />
            Romaneio
          </button>
        </div>
      </div>

      {/* Driver Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Motoristas:
        </span>
        <button
          onClick={() => setSelectedDriver("todos")}
          className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 ${
            selectedDriver === "todos"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Todos ({deliveries.length})
        </button>
        {AVAILABLE_DRIVERS.map((d, i) => {
          const dName = d.split(" ")[0];
          const count = deliveries.filter((item) => item.entregador === d).length;
          const isSelected = selectedDriver === d;
          return (
            <button
              key={i}
              onClick={() => setSelectedDriver(d)}
              className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Truck size={12} />
              {dName}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Em Rota */}
        <div className="bg-white p-5 rounded-2xl border border-blue-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Em Rota de Entrega</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{kpis.emRotaCount}</h3>
            <span className="text-xs text-slate-500 font-medium">pedidos ativos</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Valor em Trânsito:</span>
            <span className="font-extrabold text-blue-700">R$ {kpis.valorEmRota.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Para Despachar */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Aguardando Despacho</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{kpis.paraDespachoCount}</h3>
            <span className="text-xs text-slate-500 font-medium">na base/expedição</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Prontos para envio:</span>
            <span className="font-extrabold text-amber-700">
              {deliveries.filter((d) => d.status === "Pronta para Envio").length} pedidos
            </span>
          </div>
        </div>

        {/* Card 3: Entregues Hoje */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Entregas Concluídas</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{kpis.concluidasCount}</h3>
            <span className="text-xs text-emerald-600 font-bold">({kpis.taxaConclusao}% sucesso)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Comprovantes assinados:</span>
            <span className="font-extrabold text-emerald-700">100% validados</span>
          </div>
        </div>

        {/* Card 4: Ocorrências / Falhas */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Ocorrências na Rota</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={22} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-900">{kpis.falhasCount}</h3>
            <span className="text-xs text-slate-500 font-medium">precisam de ação</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Tentativas frustradas:</span>
            <span className="font-extrabold text-rose-700">Reagendamento</span>
          </div>
        </div>
      </div>

      {/* View Mode Selector & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setViewMode("mapa")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "mapa"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Route size={15} />
            Mapa & Roteirizador
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "kanban"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers size={15} />
            Painel Kanban de Despacho
          </button>
          <button
            onClick={() => setViewMode("tabela")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              viewMode === "tabela"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <SlidersHorizontal size={15} />
            Lista & Tabela de Operações
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === "mapa" && (
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setMapLayoutMode("split")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  mapLayoutMode === "split" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Divisão equilibrada: Mapa e Lista"
              >
                Divisão 50/50
              </button>
              <button
                onClick={() => setMapLayoutMode("map_focus")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  mapLayoutMode === "map_focus" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Expandir mapa"
              >
                Foco no Mapa
              </button>
              <button
                onClick={() => setMapLayoutMode("list_focus")}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  mapLayoutMode === "list_focus" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Expandir lista de sequenciamento"
              >
                Foco na Lista
              </button>
            </div>
          )}

          <div className="relative min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar pedido, cliente..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="em_rota">Em Rota (Trânsito)</option>
            <option value="despacho">Aguardando Despacho</option>
            <option value="entregue">Concluídos</option>
            <option value="falha">Ocorrências</option>
          </select>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "mapa" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Map Column */}
          <div
            className={`transition-all duration-300 ${
              mapLayoutMode === "map_focus"
                ? "lg:col-span-12"
                : mapLayoutMode === "list_focus"
                ? "lg:col-span-4"
                : "lg:col-span-7"
            }`}
          >
            <DeliveryRouteMap
              deliveries={formattedDeliveries}
              selectedDeliveryId={selectedDeliveryId}
              onSelectDelivery={(id) => setSelectedDeliveryId(id)}
              baseLocation={GOIANIA_BASE}
              filterStatus={statusFilter}
            />
          </div>

          {/* Route Optimization & Stops Column */}
          <div
            className={`transition-all duration-300 ${
              mapLayoutMode === "map_focus"
                ? "lg:col-span-12"
                : mapLayoutMode === "list_focus"
                ? "lg:col-span-8"
                : "lg:col-span-5"
            }`}
          >
            <RouteOptimizerCard
              deliveries={formattedDeliveries}
              selectedDriver={selectedDriver}
              onSelectDriver={(driver) => setSelectedDriver(driver)}
              availableDrivers={AVAILABLE_DRIVERS}
              onOptimizeRoute={handleOptimizeRoute}
              onSelectDelivery={(id) => setSelectedDeliveryId(id)}
              selectedDeliveryId={selectedDeliveryId}
              onOpenDispatch={(item) => setDispatchItem(item)}
              onOpenConfirm={(item) => setConfirmItem(item)}
              onOpenOccurrence={(item) => setOccurrenceItem(item)}
              onOpenGeoStatus={(item) => setGeoStatusItem(item)}
              onUpdateSequence={handleUpdateSequence}
              onRefreshDeliveries={fetchDeliveries}
            />
          </div>
        </div>
      )}

      {/* Kanban Dispatch View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Column 1: Para Despachar */}
          <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <span className="font-extrabold text-xs uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Clock size={15} className="text-amber-600" />
                Para Despachar (
                {
                  filteredDeliveries.filter((d) =>
                    ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status)
                  ).length
                }
                )
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredDeliveries
                .filter((d) => ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status))
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-sm space-y-2.5 hover:shadow transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        #{item.pedidoId || "S/N"}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        R$ {Number(item.valorTotal || 0).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.cliente}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      {item.endereco}, {item.bairro}
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-400">
                        {item.status}
                      </span>
                      <button
                        onClick={() => setDispatchItem(item)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        Despachar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Column 2: Em Rota / Trânsito */}
          <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-blue-200 mb-3">
              <span className="font-extrabold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Truck size={15} className="text-blue-600" />
                Em Rota Ativa ({filteredDeliveries.filter((d) => d.status === "Em trânsito").length})
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredDeliveries
                .filter((d) => d.status === "Em trânsito")
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl border border-blue-300 shadow-sm space-y-2.5 hover:shadow transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        #{item.pedidoId || "S/N"} • {item.sequencia}ª Parada
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        R$ {Number(item.valorTotal || 0).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.cliente}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={13} className="shrink-0 text-slate-400" />
                      {item.endereco}, {item.bairro}
                    </p>

                    <div className="p-2 rounded-lg bg-slate-50 text-[11px] text-slate-600 font-medium flex items-center justify-between">
                      <div>
                        🚚 <strong>Entregador:</strong> {item.entregador || "Não informado"}
                      </div>
                      <button
                        onClick={() => setGeoStatusItem(item)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-[10px] transition-colors"
                        title="Ver localização geográfica em tempo real"
                      >
                        <Radio size={11} className="text-blue-600 animate-pulse" />
                        GPS
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setOccurrenceItem(item)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition-colors"
                      >
                        Ocorrência
                      </button>
                      <button
                        onClick={() => setConfirmItem(item)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                      >
                        ✓ Entregue
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Column 3: Concluídas */}
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200 mb-3">
              <span className="font-extrabold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                Concluídas ({filteredDeliveries.filter((d) => d.status === "Entregue").length})
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredDeliveries
                .filter((d) => d.status === "Entregue")
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm space-y-2 opacity-90"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        #{item.pedidoId || "S/N"}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        R$ {Number(item.valorTotal || 0).toFixed(2)}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.cliente}</h4>
                    <p className="text-xs text-slate-500">
                      📍 {item.endereco}, {item.bairro}
                    </p>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      ✓ Recebido e confirmado
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Column 4: Ocorrências */}
          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-rose-200 mb-3">
              <span className="font-extrabold text-xs uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-rose-600" />
                Ocorrências ({filteredDeliveries.filter((d) => d.status === "Falha").length})
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              {filteredDeliveries
                .filter((d) => d.status === "Falha")
                .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-xl border border-rose-300 shadow-sm space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                        #{item.pedidoId || "S/N"}
                      </span>
                      <span className="text-xs font-bold text-rose-700">Falha</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{item.cliente}</h4>
                    <p className="text-xs text-slate-500">
                      📍 {item.endereco}, {item.bairro}
                    </p>
                    <button
                      onClick={() => setDispatchItem(item)}
                      className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                    >
                      Reagendar Rota
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === "tabela" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Listagem Completa de Cargas e Entregas ({filteredDeliveries.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="text-xs text-slate-500 font-semibold border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-5 py-3.5">Pedido</th>
                  <th className="px-5 py-3.5">Cliente / Destino</th>
                  <th className="px-5 py-3.5">Endereço / Bairro</th>
                  <th className="px-5 py-3.5">Entregador</th>
                  <th className="px-5 py-3.5">Valor</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                      Nenhum registro encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        #{item.pedidoId || "S/N"}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">{item.cliente}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {item.endereco || "—"}{item.bairro ? `, ${item.bairro}` : ""}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium text-slate-700">
                        {item.entregador || <span className="text-slate-400 italic">Pendente</span>}
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        R$ {Number(item.valorTotal || 0).toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            item.status === "Em trânsito"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "Entregue"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "Falha"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setGeoStatusItem(item)}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                            title="Ver Status Geográfico e Rastreamento GPS"
                          >
                            <Compass size={14} />
                          </button>
                          {["Separando", "Pronta para Envio", "Aguardando"].includes(item.status) && (
                            <button
                              onClick={() => setDispatchItem(item)}
                              className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                            >
                              Despachar
                            </button>
                          )}
                          {item.status === "Em trânsito" && (
                            <>
                              <button
                                onClick={() => setConfirmItem(item)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                              >
                                ✓ Entregue
                              </button>
                              <button
                                onClick={() => setOccurrenceItem(item)}
                                className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 hover:bg-rose-100"
                              >
                                Ocorrência
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {dispatchItem && (
        <DispatchModal
          isOpen={!!dispatchItem}
          onClose={() => setDispatchItem(null)}
          onSuccess={fetchDeliveries}
          deliveryItem={dispatchItem}
          availableDrivers={AVAILABLE_DRIVERS}
        />
      )}

      {confirmItem && (
        <DeliveryConfirmModal
          isOpen={!!confirmItem}
          onClose={() => setConfirmItem(null)}
          onSuccess={fetchDeliveries}
          deliveryItem={confirmItem}
        />
      )}

      {occurrenceItem && (
        <DeliveryOccurrenceModal
          isOpen={!!occurrenceItem}
          onClose={() => setOccurrenceItem(null)}
          onSuccess={fetchDeliveries}
          deliveryItem={occurrenceItem}
        />
      )}

      {/* Geographic Status Modal */}
      {geoStatusItem && (
        <DeliveryGeoStatusModal
          isOpen={!!geoStatusItem}
          onClose={() => setGeoStatusItem(null)}
          deliveryItem={geoStatusItem}
        />
      )}

      {/* Manual Route Drag & Drop Optimizer Modal */}
      {isManualReorderModalOpen && (
        <ManualRouteReorderModal
          isOpen={isManualReorderModalOpen}
          onClose={() => setIsManualReorderModalOpen(false)}
          onSuccess={fetchDeliveries}
          deliveries={formattedDeliveries}
          selectedDriver={selectedDriver}
          availableDrivers={AVAILABLE_DRIVERS}
        />
      )}
    </div>
  );
}
