import React, { useState, useEffect, useRef } from "react";
import { MapPin, Target, Share2, MessageCircle, Search, Building } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

const parseCoordinate = (val: any, fallback: number) => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return val;
  const num = Number(String(val).replace(',', '.'));
  return isNaN(num) ? fallback : num;
};

export default function LocalEntrega() {
  const { profile, refreshProfile } = useAuth();
  
  const defaultLat = -16.685847;
  const defaultLng = -49.261107;

  const [lat, setLat] = useState(parseCoordinate(profile?.latitude, defaultLat));
  const [lng, setLng] = useState(parseCoordinate(profile?.longitude, defaultLng));
  const [successMsg, setSuccessMsg] = useState("Localização do condomínio padrão selecionada ✓");
  const [showMapOverride, setShowMapOverride] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const [cep, setCep] = useState(profile?.cep || "");
    const [numero, setNumero] = useState(profile?.numero || "");
  const [complemento, setComplemento] = useState(profile?.complemento || "");
  const [bairro, setBairro] = useState(profile?.bairro || "");
  const [cidade, setCidade] = useState(profile?.cidade || "");
  const [estado, setEstado] = useState(profile?.estado || "");
  
  
  useEffect(() => {
    if (profile && profile.latitude !== undefined && profile.longitude !== undefined) {
      setLat(parseCoordinate(profile.latitude, defaultLat));
      setLng(parseCoordinate(profile.longitude, defaultLng));
      setSuccessMsg("Localização configurada do condomínio carregada ✓");
    }
  }, [profile?.latitude, profile?.longitude]);

  // Removed automatic GPS request because mobile browsers block it without direct user click.
  // The user MUST click the "Obter Localização por GPS" button on the first-time screen.

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          setLat(newLat);
          setLng(newLng);
          setSuccessMsg("Sua localização atual foi obtida com sucesso ✓");

          if (profile?.uid) {
            try {
              await updateDoc(doc(db, "users", profile.uid), {
                latitude: newLat,
                longitude: newLng,
                geolocalizacaoAtiva: true,
                geolocalizacaoAtualizadaEm: serverTimestamp()
              });
              await refreshProfile();
            } catch (err) {
              console.error("Erro ao sincronizar localização:", err);
            }
          }
          setIsLocating(false);
        },
        (error) => {
          console.error("Erro ao obter geolocalização:", error);
          alert("Não foi possível obter sua localização. Por favor, verifique as permissões de localização no seu dispositivo.");
          setIsLocating(false);
          setShowMapOverride(true);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocalização não é suportada por este navegador.");
      setShowMapOverride(true);
    }
  };

  const handleSaveLocation = async () => {
    if (profile?.uid) {
      try {
        await updateDoc(doc(db, "users", profile.uid), {
          latitude: lat,
          longitude: lng,
          cep,
          endereco,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          geolocalizacaoAtiva: true,
          geolocalizacaoAtualizadaEm: serverTimestamp()
        });
        await refreshProfile();
        setSuccessMsg("Localização do condomínio salva com sucesso ✓");
      } catch (err) {
        console.error("Erro ao salvar localização:", err);
        setSuccessMsg("Localização atualizada na tela ✓");
      }
    } else {
      setSuccessMsg("Localização do condomínio salva com sucesso ✓");
    }
  };

  const clientName = profile?.displayName || "Condomínio do Edifício Denver";
  
  const getFullAddress = () => {
    if (!profile) return "Rua 19, nº 81, Edifício Denver, Setor Oeste, Goiânia/GO, CEP 74120-100";
    
    // If the profile has only the single address string and no subfields, use that
    if (profile.endereco && !profile.numero && !profile.bairro && !profile.cep) {
      return profile.endereco;
    }
    
    const parts = [];
    if (profile.endereco) {
      parts.push(profile.endereco);
    }
    
    if (profile.numero) {
      parts.push(`nº ${profile.numero}`);
    }
    
    if (profile.complemento) {
      parts.push(profile.complemento);
    }
    
    if (profile.bairro) {
      parts.push(profile.bairro);
    }
    
    if (profile.cidade || profile.estado) {
      const cityState = [profile.cidade, profile.estado].filter(Boolean).join("/");
      if (cityState) parts.push(cityState);
    }
    
    if (profile.cep) {
      parts.push(`CEP ${profile.cep}`);
    }
    
    if (parts.length === 0) {
      return "Endereço não cadastrado";
    }
    
    return parts.join(", ");
  };

  const clientAddress = getFullAddress();
  const shareText = `Olá! Seguem os dados para a minha entrega:

*Cliente:* ${clientName}
*Endereço:* ${clientAddress}
*Localização Exata no Mapa:* https://www.google.com/maps?q=${lat},${lng}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  const isFirstTime = profile && !profile.geolocalizacaoAtiva && !showMapOverride;

  if (isFirstTime) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-md overflow-hidden p-8 md:p-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-full bg-blue-50 text-[#0071e3] flex items-center justify-center shadow-inner mb-6">
             <MapPin className="w-10 h-10" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight mb-4">Configuração Inicial de Localização</h1>
          <p className="text-base text-slate-600 font-normal max-w-md mx-auto mb-10 leading-relaxed">
            Para garantir que as entregas e os serviços cheguem corretamente ao seu condomínio, precisamos obter a localização exata por GPS. Esta configuração é feita apenas no primeiro acesso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3.5 bg-[#0071e3] rounded-2xl text-base font-medium text-white hover:bg-[#0071e3]/90 transition-all shadow-md cursor-pointer disabled:opacity-70"
            >
              {isLocating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Obtendo GPS...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Obter Localização por GPS
                </>
              )}
            </button>
            <button
              onClick={() => setShowMapOverride(true)}
              disabled={isLocating}
              className="flex-1 sm:flex-none px-8 py-3.5 bg-slate-100 rounded-2xl text-base font-medium text-slate-700 hover:bg-slate-200 transition-colors shadow-xs cursor-pointer disabled:opacity-70"
            >
              Definir no Mapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8 flex items-center gap-4 bg-gradient-to-r from-slate-50 to-white">
          <div className="w-12 h-12 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center shadow-md">
             <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-normal text-slate-900 tracking-tight">Localização do Condomínio</h1>
            <p className="text-sm text-slate-500 font-normal">Defina a localização do condomínio no mapa e compartilhe se necessário.</p>
          </div>
        </div>

        <div className="p-0 h-[400px] relative overflow-hidden bg-slate-50 z-0">
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
              <Map
                mapId="MAP_ID_LOCAL_ENTREGA"
                defaultZoom={15}
                defaultCenter={{ lat, lng }}
                center={{ lat, lng }}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
                zoomControl={true}
                onDragend={(e) => {
                  if (e.map) {
                    const center = e.map.getCenter();
                    if (center) {
                      setLat(center.lat());
                      setLng(center.lng());
                      setSuccessMsg("Localização ajustada no mapa. Não se esqueça de salvar ✓");
                    }
                  }
                }}
              >
                <AdvancedMarker 
                  position={{ lat, lng }} 
                  draggable={true}
                  onDragEnd={(e) => {
                    if (e.latLng) {
                      setLat(e.latLng.lat());
                      setLng(e.latLng.lng());
                      setSuccessMsg("Localização ajustada no mapa. Não se esqueça de salvar ✓");
                    }
                  }}
                >
                  <Pin background={"#0071e3"} borderColor={"#005bb5"} glyphColor={"#fff"} />
                </AdvancedMarker>
              </Map>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
              <MapPin className="w-12 h-12 text-slate-400 mb-3" />
              <h3 className="text-sm font-medium text-slate-700">Google Maps Não Configurado</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Para exibir o Google Maps, adicione a variável de ambiente VITE_GOOGLE_MAPS_API_KEY com a sua chave de API.</p>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 flex flex-col sm:flex-row justify-between items-center bg-white gap-4">
           <div>
              <p className="text-sm font-medium text-slate-900">Posição atual: <span className="font-mono text-slate-600 ml-1">{lat.toFixed(6)}, {lng.toFixed(6)}</span></p>
              <p className="text-xs text-emerald-600 mt-1 font-normal">{successMsg}</p>
           </div>
           <div className="flex flex-wrap gap-3">
              <button
                onClick={handleUseMyLocation}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-2xl text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors shadow-xs"
              >
                 <Target className="w-4 h-4 text-slate-500" />
                 Usar minha localização
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 rounded-2xl text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors shadow-xs"
              >
                 <Share2 className="w-4 h-4 text-emerald-600" />
                 Enviar por WhatsApp
              </a>
              <button
                onClick={handleSaveLocation}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0071e3] rounded-2xl text-sm font-medium text-white hover:bg-[#0071e3]/90 transition-colors shadow-md"
              >
                 Salvar local
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

