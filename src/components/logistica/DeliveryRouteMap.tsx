import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Phone, 
  Building2, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  Compass, 
  Layers, 
  CheckCircle2, 
  Truck, 
  AlertTriangle, 
  Clock 
} from "lucide-react";

export interface DeliveryLocation {
  id: string;
  pedidoId?: string;
  cliente: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  cep?: string;
  valorTotal?: number | string;
  status: string;
  entregador?: string;
  prioridade?: string;
  lat: number;
  lng: number;
  sequencia?: number;
  telefone?: string;
  itensResumo?: string;
  horaSaida?: string;
}

interface DeliveryRouteMapProps {
  deliveries: DeliveryLocation[];
  selectedDeliveryId?: string | null;
  onSelectDelivery?: (id: string) => void;
  baseLocation?: { lat: number; lng: number; name: string; address: string };
  filterStatus?: string;
}

// Default center: Goiânia / Base Franqueada
const DEFAULT_BASE = {
  lat: -16.6869,
  lng: -49.2648,
  name: "Centro de Distribuição Principal",
  address: "Av. Anhanguera, 5000 - Setor Central, Goiânia - GO",
};

export default function DeliveryRouteMap({
  deliveries,
  selectedDeliveryId,
  onSelectDelivery,
  baseLocation = DEFAULT_BASE,
  filterStatus = "todos",
}: DeliveryRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Filter deliveries
  const visibleDeliveries = deliveries.filter((d) => {
    if (filterStatus === "todos") return true;
    if (filterStatus === "em_rota") return d.status === "Em trânsito";
    if (filterStatus === "despacho") return ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status);
    if (filterStatus === "entregue") return d.status === "Entregue";
    if (filterStatus === "falha") return d.status === "Falha";
    return true;
  });

  const selectedDelivery = deliveries.find((d) => d.id === selectedDeliveryId);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseLocation.lat, baseLocation.lng],
        zoom: 13,
        zoomControl: false, // We render custom polished controls
      });

      const streetTile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      tileLayerRef.current = streetTile;
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Map stays alive
    };
  }, [baseLocation]);

  // Handle Map Style Switch
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    if (mapStyle === "satellite") {
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
    }
  }, [mapStyle]);

  // Update Markers and Route Lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    markerMapRef.current.clear();

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Base / Depot Marker
    const baseIcon = L.divIcon({
      className: "custom-depot-marker",
      html: `
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 6px 16px rgba(0,0,0,0.35); font-weight: bold; font-size: 18px;">
          🏢
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
    });

    const baseMarker = L.marker([baseLocation.lat, baseLocation.lng], { icon: baseIcon });
    baseMarker.bindPopup(`
      <div style="font-family: inherit; padding: 4px; min-width: 200px;">
        <div style="font-size: 10px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">Ponto de Partida Central</div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">${baseLocation.name}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">📍 ${baseLocation.address}</div>
      </div>
    `);
    markersLayer.addLayer(baseMarker);
    bounds.extend([baseLocation.lat, baseLocation.lng]);

    // 2. Deliveries Markers
    const routePoints: [number, number][] = [[baseLocation.lat, baseLocation.lng]];

    // Sort deliveries by sequence for route line
    const sortedInTransit = [...visibleDeliveries]
      .filter((d) => d.status === "Em trânsito")
      .sort((a, b) => (a.sequencia || 999) - (b.sequencia || 999));

    visibleDeliveries.forEach((d, idx) => {
      let bgColor = "linear-gradient(135deg, #2563eb, #1d4ed8)"; // Blue (Em trânsito)
      let borderGlow = "rgba(37, 99, 235, 0.5)";
      let badgeLabel = d.sequencia ? `${d.sequencia}º` : `${idx + 1}`;

      if (d.status === "Pronta para Envio" || d.status === "Separando" || d.status === "Aguardando") {
        bgColor = "linear-gradient(135deg, #f59e0b, #d97706)"; // Amber (Para Despachar)
        borderGlow = "rgba(245, 158, 11, 0.5)";
        badgeLabel = "📦";
      } else if (d.status === "Entregue") {
        bgColor = "linear-gradient(135deg, #10b981, #059669)"; // Emerald (Entregue)
        borderGlow = "rgba(16, 185, 129, 0.5)";
        badgeLabel = "✓";
      } else if (d.status === "Falha") {
        bgColor = "linear-gradient(135deg, #ef4444, #dc2626)"; // Red (Falha)
        borderGlow = "rgba(239, 68, 68, 0.5)";
        badgeLabel = "✕";
      }

      const isSelected = selectedDeliveryId === d.id;

      const markerHtml = `
        <div style="
          position: relative;
          background: ${bgColor}; 
          color: white; 
          width: ${isSelected ? "46px" : "36px"}; 
          height: ${isSelected ? "46px" : "36px"}; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: ${isSelected ? "3.5px solid #ffffff" : "2.5px solid #ffffff"}; 
          box-shadow: 0 4px 14px ${borderGlow}, 0 2px 6px rgba(0,0,0,0.25); 
          font-weight: 800; 
          font-size: ${isSelected ? "14px" : "12px"};
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          ${isSelected ? "transform: scale(1.15); z-index: 999;" : ""}
        ">
          ${badgeLabel}
          ${
            d.status === "Em trânsito"
              ? `<span style="position: absolute; top: -2px; right: -2px; width: 11px; height: 11px; background-color: #38bdf8; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #0284c7;"></span>`
              : ""
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: `delivery-marker-${d.id}`,
        html: markerHtml,
        iconSize: [isSelected ? 46 : 36, isSelected ? 46 : 36],
        iconAnchor: [isSelected ? 23 : 18, isSelected ? 23 : 18],
        popupAnchor: [0, -24],
      });

      const marker = L.marker([d.lat, d.lng], { icon: customIcon });

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`;
      const wazeUrl = `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`;

      const popupContent = `
        <div style="font-family: inherit; min-width: 250px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; background: ${
              d.status === 'Em trânsito' ? '#dbeafe; color: #1e40af;' :
              d.status === 'Entregue' ? '#d1fae5; color: #065f46;' :
              d.status === 'Falha' ? '#fee2e2; color: #991b1b;' :
              '#fef3c7; color: #92400e;'
            }">${d.status}</span>
            <span style="font-size: 11px; font-weight: 800; color: #475569;">#${d.pedidoId || "S/N"}</span>
          </div>

          <div style="font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.25;">${d.cliente}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.35;">
            📍 ${d.endereco || "Endereço cadastrado"}${d.bairro ? `, ${d.bairro}` : ""}${d.cidade ? ` - ${d.cidade}` : ""}
          </div>

          ${
            d.sequencia
              ? `<div style="font-size: 11px; color: #0369a1; font-weight: 700; margin-top: 4px;">
                  🚀 Sequência de Parada: ${d.sequencia}ª parada
                </div>`
              : ""
          }

          ${
            d.entregador
              ? `<div style="font-size: 11px; color: #334155; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                  🚚 <strong>Entregador:</strong> ${d.entregador}
                </div>`
              : ""
          }

          ${
            d.valorTotal
              ? `<div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 6px;">
                  Valor Total: R$ ${Number(d.valorTotal).toFixed(2)}
                </div>`
              : ""
          }

          <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 8px; font-size: 11px; font-weight: 700; background: #0071e3; color: white; border-radius: 8px; text-decoration: none; text-align: center;">
              Google Maps
            </a>
            <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 8px; font-size: 11px; font-weight: 700; background: #00d2d3; color: #04384c; border-radius: 8px; text-decoration: none; text-align: center;">
              Waze
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        if (onSelectDelivery) {
          onSelectDelivery(d.id);
        }
      });

      markersLayer.addLayer(marker);
      markerMapRef.current.set(d.id, marker);
      bounds.extend([d.lat, d.lng]);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Draw route polyline for active in-transit deliveries
    if (sortedInTransit.length > 0) {
      sortedInTransit.forEach((d) => {
        routePoints.push([d.lat, d.lng]);
      });

      routePolylineRef.current = L.polyline(routePoints, {
        color: "#2563eb",
        weight: 4.5,
        opacity: 0.85,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(map);
    }

    // Auto-fit bounds if we have points and no specific selection
    if (visibleDeliveries.length > 0 && !selectedDeliveryId) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [visibleDeliveries, selectedDeliveryId, baseLocation]);

  // Fly to selected delivery smoothly
  useEffect(() => {
    if (!selectedDeliveryId) return;
    const map = mapInstanceRef.current;
    const marker = markerMapRef.current.get(selectedDeliveryId);
    const target = deliveries.find((d) => d.id === selectedDeliveryId);

    if (map && target) {
      map.flyTo([target.lat, target.lng], 15, {
        duration: 0.7,
      });
      if (marker) {
        marker.openPopup();
      }
    }
  }, [selectedDeliveryId, deliveries]);

  const handleCenterAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([[baseLocation.lat, baseLocation.lng]]);
    visibleDeliveries.forEach((d) => bounds.extend([d.lat, d.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  const handleCenterBase = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([baseLocation.lat, baseLocation.lng], 15, { duration: 0.7 });
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 transition-all duration-300 ${
        isFullscreen ? "fixed inset-4 z-50 h-[calc(100vh-32px)] shadow-2xl" : "h-[540px] lg:h-[640px]"
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Control Toolbar (Top Right) */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 p-1 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            title="Aproximar Zoom"
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            title="Afastar Zoom"
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <ZoomOut size={16} />
          </button>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 p-1 flex flex-col gap-1">
          <button
            onClick={handleCenterAll}
            title="Enquadrar todas as paradas da rota"
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Navigation size={15} className="text-blue-600" />
          </button>
          <button
            onClick={handleCenterBase}
            title="Centralizar na Base Central (CD)"
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 flex items-center justify-center text-sm font-bold transition-colors"
          >
            🏢
          </button>
          <button
            onClick={() => setMapStyle((s) => (s === "streets" ? "satellite" : "streets"))}
            title={mapStyle === "streets" ? "Mudar para Visual Satélite" : "Mudar para Visual Mapa Padrão"}
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <Layers size={15} />
          </button>
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            title={isFullscreen ? "Sair da Tela Cheia" : "Expandir Mapa em Tela Cheia"}
            className="w-8 h-8 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Floating Selected Delivery Quick-Pill (Top Left) */}
      {selectedDelivery && (
        <div className="absolute top-3 left-3 z-10 max-w-sm bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-blue-200/80 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              #{selectedDelivery.pedidoId || "S/N"} {selectedDelivery.sequencia ? `• ${selectedDelivery.sequencia}ª Parada` : ""}
            </span>
            <span className="text-xs font-black text-slate-900">
              R$ {Number(selectedDelivery.valorTotal || 0).toFixed(2)}
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-xs mt-1 truncate">{selectedDelivery.cliente}</h4>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            📍 {selectedDelivery.endereco || "Endereço"}{selectedDelivery.bairro ? `, ${selectedDelivery.bairro}` : ""}
          </p>
        </div>
      )}

      {/* Map Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-200 text-xs space-y-1.5 hidden sm:block">
        <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider mb-1">Status Geográfico</p>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-white shadow-xs flex items-center justify-center text-[8px] text-white">🏢</span>
          <span className="text-slate-600 font-semibold text-[11px]">Centro de Distribuição (Base)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-white shadow-xs flex items-center justify-center text-[9px] text-white font-bold">1</span>
          <span className="text-slate-600 font-semibold text-[11px]">Em Rota ({visibleDeliveries.filter((d) => d.status === "Em trânsito").length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-xs flex items-center justify-center text-[8px] text-white font-bold">📦</span>
          <span className="text-slate-600 font-semibold text-[11px]">Para Despacho ({visibleDeliveries.filter((d) => ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status)).length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-xs flex items-center justify-center text-[8px] text-white font-bold">✓</span>
          <span className="text-slate-600 font-semibold text-[11px]">Entregue ({visibleDeliveries.filter((d) => d.status === "Entregue").length})</span>
        </div>
      </div>
    </div>
  );
}

