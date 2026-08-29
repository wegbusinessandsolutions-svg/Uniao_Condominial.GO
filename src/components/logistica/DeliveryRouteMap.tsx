import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin, Navigation, ExternalLink, Phone, Building2 } from "lucide-react";

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
  name: "Centro de Distribuição / Loja Central",
  address: "Av. Central, 1000 - Goiânia, GO",
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

  // Filter deliveries
  const visibleDeliveries = deliveries.filter((d) => {
    if (filterStatus === "todos") return true;
    if (filterStatus === "em_rota") return d.status === "Em trânsito";
    if (filterStatus === "despacho") return ["Separando", "Pronta para Envio", "Aguardando"].includes(d.status);
    if (filterStatus === "entregue") return d.status === "Entregue";
    if (filterStatus === "falha") return d.status === "Falha";
    return true;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseLocation.lat, baseLocation.lng],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map alive across standard renders, cleanup on unmount
    };
  }, []);

  // Update Markers and Route Lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Base / Depot Marker
    const baseIcon = L.divIcon({
      className: "custom-depot-marker",
      html: `
        <div style="background-color: #0f172a; color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); font-weight: bold; font-size: 16px;">
          🏢
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -20],
    });

    const baseMarker = L.marker([baseLocation.lat, baseLocation.lng], { icon: baseIcon });
    baseMarker.bindPopup(`
      <div style="font-family: inherit; padding: 4px;">
        <div style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">Ponto de Partida</div>
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px;">${baseLocation.name}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${baseLocation.address}</div>
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
      let bgColor = "#3b82f6"; // Blue (Em trânsito)
      let borderGlow = "rgba(59, 130, 246, 0.4)";
      let badgeLabel = d.sequencia ? `${d.sequencia}º` : `${idx + 1}`;

      if (d.status === "Pronta para Envio" || d.status === "Separando" || d.status === "Aguardando") {
        bgColor = "#f59e0b"; // Amber (Para Despachar)
        borderGlow = "rgba(245, 158, 11, 0.4)";
        badgeLabel = "📦";
      } else if (d.status === "Entregue") {
        bgColor = "#10b981"; // Emerald (Entregue)
        borderGlow = "rgba(16, 185, 129, 0.4)";
        badgeLabel = "✓";
      } else if (d.status === "Falha") {
        bgColor = "#ef4444"; // Red (Falha)
        borderGlow = "rgba(239, 68, 68, 0.4)";
        badgeLabel = "✕";
      }

      const isSelected = selectedDeliveryId === d.id;

      const markerHtml = `
        <div style="
          position: relative;
          background-color: ${bgColor}; 
          color: white; 
          width: ${isSelected ? "44px" : "36px"}; 
          height: ${isSelected ? "44px" : "36px"}; 
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          border: ${isSelected ? "4px solid #ffffff" : "2.5px solid #ffffff"}; 
          box-shadow: 0 4px 12px ${borderGlow}, 0 2px 4px rgba(0,0,0,0.2); 
          font-weight: 800; 
          font-size: ${isSelected ? "14px" : "12px"};
          transition: all 0.2s ease;
          ${isSelected ? "transform: scale(1.15);" : ""}
        ">
          ${badgeLabel}
          ${
            d.status === "Em trânsito"
              ? `<span style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background-color: #00f2fe; border: 1.5px solid #fff; border-radius: 50%; animation: pulse 1.5s infinite;"></span>`
              : ""
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: `delivery-marker-${d.id}`,
        html: markerHtml,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
        popupAnchor: [0, -22],
      });

      const marker = L.marker([d.lat, d.lng], { icon: customIcon });

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}`;
      const wazeUrl = `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`;

      const popupContent = `
        <div style="font-family: inherit; min-width: 240px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: ${
              d.status === 'Em trânsito' ? '#dbeafe; color: #1e40af;' :
              d.status === 'Entregue' ? '#d1fae5; color: #065f46;' :
              d.status === 'Falha' ? '#fee2e2; color: #991b1b;' :
              '#fef3c7; color: #92400e;'
            }">${d.status}</span>
            <span style="font-size: 11px; font-weight: 700; color: #475569;">#${d.pedidoId || "S/N"}</span>
          </div>

          <div style="font-size: 14px; font-weight: 700; color: #0f172a; line-height: 1.2;">${d.cliente}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; line-height: 1.3;">
            📍 ${d.endereco || "Endereço não cadastrado"}${d.bairro ? `, ${d.bairro}` : ""}${d.cidade ? ` - ${d.cidade}` : ""}
          </div>

          ${
            d.entregador
              ? `<div style="font-size: 11px; color: #334155; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                  🚚 <strong>Entregador:</strong> ${d.entregador}
                </div>`
              : ""
          }

          ${
            d.valorTotal
              ? `<div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 6px;">
                  Valor: R$ ${Number(d.valorTotal).toFixed(2)}
                </div>`
              : ""
          }

          <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 8px; font-size: 11px; font-weight: 600; background: #0071e3; color: white; border-radius: 6px; text-decoration: none; text-align: center;">
              Google Maps
            </a>
            <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 8px; font-size: 11px; font-weight: 600; background: #33ccff; color: #04384c; border-radius: 6px; text-decoration: none; text-align: center;">
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
        color: "#0284c7",
        weight: 4,
        opacity: 0.8,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(map);
    }

    // Auto-fit bounds if we have points
    if (visibleDeliveries.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [visibleDeliveries, selectedDeliveryId, baseLocation]);

  const handleCenterAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([[baseLocation.lat, baseLocation.lng]]);
    visibleDeliveries.forEach((d) => bounds.extend([d.lat, d.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  return (
    <div className="relative w-full h-[520px] lg:h-[620px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Floating Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <button
          onClick={handleCenterAll}
          title="Centralizar Rota Completa"
          className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur text-slate-700 hover:text-blue-600 rounded-xl shadow-md border border-slate-200 text-xs font-bold transition-all"
        >
          <Navigation size={14} className="text-blue-500" />
          Centralizar Rota
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-lg border border-slate-200 text-xs space-y-1.5">
        <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">Legenda do Mapa</p>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-white shadow-sm flex items-center justify-center text-[8px] text-white">🏢</span>
          <span className="text-slate-600 font-medium">CD / Ponto de Partida</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white shadow-sm flex items-center justify-center text-[9px] text-white font-bold">1</span>
          <span className="text-slate-600 font-medium">Em Rota (Sequência de Paradas)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-sm"></span>
          <span className="text-slate-600 font-medium">Aguardando Despacho</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-sm"></span>
          <span className="text-slate-600 font-medium">Entregue com Sucesso</span>
        </div>
      </div>
    </div>
  );
}
