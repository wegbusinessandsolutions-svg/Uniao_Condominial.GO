import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import {
  X,
  MapPin,
  Truck,
  Navigation,
  ExternalLink,
  Clock,
  User,
  Phone,
  MessageCircle,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Copy,
  Check,
  Shield,
  Layers,
  Sparkles,
  Radio,
  Share2
} from "lucide-react";

interface DeliveryGeoStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryItem: any | null;
  baseLocation?: { lat: number; lng: number; name: string; address: string };
}

// Default base
const DEFAULT_BASE = {
  lat: -16.6869,
  lng: -49.2648,
  name: "Centro de Distribuição / Loja Central",
  address: "Av. Anhanguera, 5000 - Setor Central, Goiânia - GO",
};

// Helper to extract Lat/Lng from various string and object formats
function parseCoordinates(item: any): { driverLat: number; driverLng: number; destLat: number; destLng: number; isExactGps: boolean; gpsSource: string } {
  let driverLat: number | null = null;
  let driverLng: number | null = null;
  let isExactGps = false;
  let gpsSource = "Estimado por Endereço";

  // Check structured ultimaLocalizacao
  if (item?.ultimaLocalizacao?.lat && item?.ultimaLocalizacao?.lng) {
    driverLat = Number(item.ultimaLocalizacao.lat);
    driverLng = Number(item.ultimaLocalizacao.lng);
    isExactGps = true;
    gpsSource = "GPS em Tempo Real (Entregador)";
  } else if (item?.latChegada && item?.lngChegada) {
    driverLat = Number(item.latChegada);
    driverLng = Number(item.lngChegada);
    isExactGps = true;
    gpsSource = "Check-in GPS no Local";
  } else if (item?.localizacaoChegada && typeof item.localizacaoChegada === "string") {
    const match = item.localizacaoChegada.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/i);
    if (match) {
      driverLat = parseFloat(match[1]);
      driverLng = parseFloat(match[2]);
      isExactGps = true;
      gpsSource = "Check-in GPS no Local";
    }
  } else if (item?.geolocalizacao && typeof item.geolocalizacao === "string") {
    const match = item.geolocalizacao.match(/Lat\s*([-\d.]+),\s*Lng\s*([-\d.]+)/i);
    if (match) {
      driverLat = parseFloat(match[1]);
      driverLng = parseFloat(match[2]);
      isExactGps = true;
      gpsSource = "GPS na Conclusão da Entrega";
    }
  }

  // Destination coordinates
  let destLat = item?.lat ? Number(item.lat) : null;
  let destLng = item?.lng ? Number(item.lng) : null;

  if (!destLat || isNaN(destLat)) {
    // Approximate by neighborhood if in Goiânia region
    const b = (item?.bairro || "").toLowerCase();
    if (b.includes("bueno")) {
      destLat = -16.7025;
      destLng = -49.255;
    } else if (b.includes("marista")) {
      destLat = -16.715;
      destLng = -49.268;
    } else if (b.includes("sul")) {
      destLat = -16.678;
      destLng = -49.243;
    } else if (b.includes("oeste")) {
      destLat = -16.695;
      destLng = -49.279;
    } else if (b.includes("goiás") || b.includes("goias")) {
      destLat = -16.728;
      destLng = -49.249;
    } else if (b.includes("campinas")) {
      destLat = -16.662;
      destLng = -49.281;
    } else {
      // Default offset from base
      destLat = -16.69 + (Math.sin((item?.pedidoId?.length || 1) * 3) * 0.03);
      destLng = -49.26 + (Math.cos((item?.pedidoId?.length || 1) * 3) * 0.03);
    }
  }

  if (!driverLat || isNaN(driverLat)) {
    // If no driver GPS yet, place driver close to destination if arriving or at base/intermediate
    if (item?.status === "Em trânsito" || item?.statusChegada === "No Local") {
      driverLat = destLat + 0.0025;
      driverLng = destLng - 0.002;
    } else {
      driverLat = DEFAULT_BASE.lat;
      driverLng = DEFAULT_BASE.lng;
    }
  }

  return {
    driverLat,
    driverLng,
    destLat: destLat || DEFAULT_BASE.lat,
    destLng: destLng || DEFAULT_BASE.lng,
    isExactGps,
    gpsSource,
  };
}

// Calculate rough distance in km between two lat/lng points
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function DeliveryGeoStatusModal({
  isOpen,
  onClose,
  deliveryItem,
  baseLocation = DEFAULT_BASE,
}: DeliveryGeoStatusModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [activeMapLayer, setActiveMapLayer] = useState<"standard" | "satellite">("standard");

  if (!isOpen || !deliveryItem) return null;

  const { driverLat, driverLng, destLat, destLng, isExactGps, gpsSource } = parseCoordinates(deliveryItem);
  const distanceKm = calculateDistanceKm(driverLat, driverLng, destLat, destLng);

  const clientName =
    typeof deliveryItem.cliente === "object" ? deliveryItem.cliente?.nome : deliveryItem.cliente;
  const driverName = deliveryItem.entregador || "Entregador da Frota";
  const isArrived = deliveryItem.statusChegada === "No Local";
  const isInTransit = deliveryItem.status === "Em trânsito";
  const isCompleted = deliveryItem.status === "Entregue";
  const isFailed = deliveryItem.status === "Falha";

  const lastUpdateTimestamp =
    deliveryItem.chegadaRegistradaEm ||
    deliveryItem.updatedAt ||
    deliveryItem.horaChegada ||
    deliveryItem.horaSaida ||
    "Registrado hoje";

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Small delay to ensure modal DOM is mounted and sized
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [driverLat, driverLng],
        zoom: 14,
        zoomControl: true,
      });

      const tileUrl =
        activeMapLayer === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // 1. Depot / CD Marker
      const depotIcon = L.divIcon({
        className: "custom-geo-depot",
        html: `
          <div style="background-color: #0f172a; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-size: 14px;">
            🏢
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([baseLocation.lat, baseLocation.lng], { icon: depotIcon })
        .bindPopup(`<b>Ponto de Partida:</b><br>${baseLocation.name}`)
        .addTo(map);

      // 2. Destination Marker
      const destIcon = L.divIcon({
        className: "custom-geo-dest",
        html: `
          <div style="background-color: #ef4444; color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.45); font-size: 16px; font-weight: bold;">
            📍
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      L.marker([destLat, destLng], { icon: destIcon })
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; min-width: 180px;">
            <div style="font-weight: 800; color: #ef4444; text-transform: uppercase;">Destino da Entrega</div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 2px;">${clientName || "Cliente"}</div>
            <div style="color: #64748b; margin-top: 4px;">${deliveryItem.endereco || ""}</div>
          </div>
        `)
        .addTo(map);

      // 3. Driver Live Location Marker (Pulsing vehicle pin)
      const driverIconHtml = `
        <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; background-color: ${isArrived ? "rgba(16, 185, 129, 0.35)" : "rgba(37, 99, 235, 0.35)"}; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; z-index: 10; background-color: ${isArrived ? "#10b981" : "#2563eb"}; color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.3); font-size: 18px;">
            🚚
          </div>
          <div style="position: absolute; -bottom: 6px; background: #0f172a; color: #ffffff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px; white-space: nowrap; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            ${isArrived ? "NO LOCAL" : "MOTORISTA"}
          </div>
        </div>
      `;

      const driverIcon = L.divIcon({
        className: "custom-geo-driver",
        html: driverIconHtml,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });

      const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon, zIndexOffset: 1000 })
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; min-width: 200px;">
            <div style="font-weight: 800; color: ${isArrived ? "#059669" : "#2563eb"}; text-transform: uppercase;">
              ${isArrived ? "📍 Chegada Confirmada" : "🚚 Última Localização Registrada"}
            </div>
            <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-top: 2px;">${driverName}</div>
            <div style="color: #64748b; margin-top: 4px;">Lat: ${driverLat.toFixed(5)}, Lng: ${driverLng.toFixed(5)}</div>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">Fonte: ${gpsSource}</div>
          </div>
        `)
        .addTo(map);

      // Open driver popup by default
      driverMarker.openPopup();

      // Route Line between Driver and Destination
      const routePoints: [number, number][] = [
        [driverLat, driverLng],
        [destLat, destLng],
      ];

      L.polyline(routePoints, {
        color: isArrived ? "#10b981" : "#3b82f6",
        weight: 4,
        opacity: 0.8,
        dashArray: "6, 8",
      }).addTo(map);

      // Fit bounds to show driver and destination comfortably
      const bounds = L.latLngBounds([[driverLat, driverLng], [destLat, destLng]]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });

      mapInstanceRef.current = map;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, driverLat, driverLng, destLat, destLng, activeMapLayer, isArrived]);

  const handleCopyCoordinates = () => {
    navigator.clipboard.writeText(`${driverLat.toFixed(6)}, ${driverLng.toFixed(6)}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2500);
  };

  const openGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${driverLat},${driverLng}`;
    window.open(url, "_blank");
  };

  const openWaze = () => {
    const url = `https://waze.com/ul?ll=${driverLat},${driverLng}&navigate=yes`;
    window.open(url, "_blank");
  };

  const openWhatsAppDriver = () => {
    const phone = deliveryItem.telefoneEntregador || deliveryItem.telefoneMotorista || "";
    const clean = phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${driverName}! Acompanhando a rota da entrega #${deliveryItem.pedidoId || ""}. Como está o trajeto?`
    );
    window.open(clean ? `https://wa.me/55${clean}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                  Rastreamento GPS em Tempo Real
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Pedido #{deliveryItem.pedidoId || deliveryItem.id?.substring(0, 6)}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Status Geográfico do Entregador
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Map + Live Telemetry Side-by-Side on Desktop */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Interactive Leaflet Map (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Map Container */}
            <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100">
              <div ref={mapContainerRef} className="w-full h-full z-0" />

              {/* Map Layer Switcher Floating Button */}
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setActiveMapLayer("standard")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    activeMapLayer === "standard"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Mapa
                </button>
                <button
                  onClick={() => setActiveMapLayer("satellite")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    activeMapLayer === "satellite"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Satélite
                </button>
              </div>

              {/* Live Status Badge on Map */}
              <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/60 text-xs flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isArrived
                      ? "bg-emerald-400 animate-ping"
                      : isInTransit
                      ? "bg-blue-400 animate-ping"
                      : "bg-amber-400"
                  }`}
                />
                <span className="font-bold">
                  {isArrived
                    ? "Chegada confirmada no local"
                    : isInTransit
                    ? "Em deslocamento para o destino"
                    : isCompleted
                    ? "Entrega finalizada"
                    : "Em preparação de rota"}
                </span>
              </div>
            </div>

            {/* Quick External Map Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={openGoogleMaps}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all active:scale-95"
              >
                <Compass size={14} className="text-blue-600" />
                Google Maps
                <ExternalLink size={12} className="opacity-70" />
              </button>

              <button
                onClick={openWaze}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold transition-all active:scale-95"
              >
                <Navigation size={14} className="text-cyan-600" />
                Abrir no Waze
                <ExternalLink size={12} className="opacity-70" />
              </button>

              <button
                onClick={handleCopyCoordinates}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all active:scale-95"
              >
                {copiedCoords ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copiar GPS
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Telemetry, Driver Details, Destination Details (5 cols) */}
          <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
            {/* Status Card */}
            <div
              className={`p-4 rounded-2xl border ${
                isArrived
                  ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                  : isInTransit
                  ? "bg-blue-50/70 border-blue-200 text-blue-900"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Status Operacional
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                    isArrived
                      ? "bg-emerald-200 text-emerald-800"
                      : isInTransit
                      ? "bg-blue-200 text-blue-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {isArrived ? "No Local" : deliveryItem.status}
                </span>
              </div>

              <div className="text-sm font-bold mt-1 flex items-center gap-2">
                {isArrived ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <Truck size={16} className="text-blue-600 shrink-0" />
                )}
                <span>
                  {isArrived
                    ? `Chegada registrada às ${deliveryItem.horaChegada || "recente"}`
                    : `Distância estimada: ~${distanceKm} km do destino`}
                </span>
              </div>

              {deliveryItem.horaSaida && (
                <div className="text-xs text-slate-600 mt-2 flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-400" />
                  Saída da Base: <strong>{deliveryItem.horaSaida}</strong>
                </div>
              )}
            </div>

            {/* Courier Information Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User size={13} className="text-blue-500" />
                  Entregador em Campo
                </span>
                {deliveryItem.sequencia && (
                  <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    Parada {deliveryItem.sequencia}º
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{driverName}</h4>
                  <p className="text-xs text-slate-500">Frota Própria / Terceirizada</p>
                </div>

                <button
                  onClick={openWhatsAppDriver}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  title="Falar no WhatsApp"
                >
                  <MessageCircle size={13} />
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Destination & Order Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Building2 size={13} className="text-amber-500" />
                Destino / Cliente
              </span>

              <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                {clientName || "Cliente"}
              </h4>

              <p className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
                <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                <span>
                  {deliveryItem.endereco || "Endereço cadastrado na O.S."}
                  {deliveryItem.bairro ? `, ${deliveryItem.bairro}` : ""}
                  {deliveryItem.cidade ? ` - ${deliveryItem.cidade}` : ""}
                </span>
              </p>

              {deliveryItem.valorTotal && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Valor dos Produtos:</span>
                  <span className="font-black text-slate-900">
                    R$ {Number(deliveryItem.valorTotal).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* GPS Telemetry Specs */}
            <div className="bg-slate-900 text-slate-300 p-3.5 rounded-2xl text-[11px] font-mono space-y-1 shadow-inner">
              <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1">
                <span className="flex items-center gap-1">
                  <Shield size={11} className="text-blue-400" />
                  Telemetria & Coordenadas
                </span>
                <span className="text-[10px] text-blue-300">{gpsSource}</span>
              </div>
              <div className="flex justify-between">
                <span>Latitude:</span>
                <span className="text-white font-bold">{driverLat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span>Longitude:</span>
                <span className="text-white font-bold">{driverLng.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span>Último Sinal:</span>
                <span className="text-emerald-400 font-bold">
                  {typeof lastUpdateTimestamp === "string" && lastUpdateTimestamp.includes("T")
                    ? new Date(lastUpdateTimestamp).toLocaleTimeString("pt-BR")
                    : lastUpdateTimestamp}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles size={14} className="text-blue-500" />
            <span>Dados geográficos sincronizados com o painel do motorista.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
}
