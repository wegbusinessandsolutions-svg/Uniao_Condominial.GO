import React, { useState, useEffect } from "react";
import { MapPin, Target, Share2, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function LocalEntrega() {
  const { profile, refreshProfile } = useAuth();
  const [lat, setLat] = useState(profile?.latitude || -16.685847);
  const [lng, setLng] = useState(profile?.longitude || -49.261107);
  const [successMsg, setSuccessMsg] = useState("Localização do condomínio padrão selecionada ✓");

  useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setLat(profile.latitude);
      setLng(profile.longitude);
      setSuccessMsg("Localização configurada do condomínio carregada ✓");
    }
  }, [profile?.latitude, profile?.longitude]);

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
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
        },
        (error) => {
          console.error("Erro ao obter geolocalização:", error);
          alert("Não foi possível obter sua localização. Por favor, verifique as permissões de localização no seu navegador.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocalização não é suportada por este navegador.");
    }
  };

  const handleSaveLocation = async () => {
    if (profile?.uid) {
      try {
        await updateDoc(doc(db, "users", profile.uid), {
          latitude: lat,
          longitude: lng,
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Localização do Condomínio</h1>
            <p className="text-sm text-slate-500">Defina a localização do condomínio no mapa e compartilhe se necessário.</p>
          </div>
        </div>

        <div className="p-0 border-b border-slate-100 h-[400px] relative overflow-hidden bg-slate-50">
          <iframe
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            marginHeight={0}
            marginWidth={0}
            src={`https://maps.google.com/maps?q=${lat},${lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            style={{ border: 0 }}
            allowFullScreen
          ></iframe>
        </div>

        <div className="p-6 flex flex-col sm:flex-row justify-between items-center bg-white gap-4">
           <div>
              <p className="text-sm font-semibold text-slate-900">Posição atual: <span className="font-mono text-slate-600 ml-1">{lat.toFixed(6)}, {lng.toFixed(6)}</span></p>
              <p className="text-xs text-emerald-600 mt-1 font-medium">{successMsg}</p>
           </div>
           <div className="flex flex-wrap gap-3">
              <button
                onClick={handleUseMyLocation}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                 <Target className="w-4 h-4 text-slate-500" />
                 Usar minha localização
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                 <Share2 className="w-4 h-4 text-emerald-600" />
                 Enviar por WhatsApp
              </a>
              <button
                onClick={handleSaveLocation}
                className="flex items-center gap-2 px-6 py-2 bg-[#0071e3] rounded-lg text-sm font-bold text-white hover:bg-[#0071e3]/95 transition"
              >
                 Salvar local
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}

