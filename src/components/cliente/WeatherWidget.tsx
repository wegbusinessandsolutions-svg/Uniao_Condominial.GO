import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Wind, Loader2, CloudLightning, CloudSnow, CloudSun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface WeatherWidgetProps {
  cidade?: string;
  className?: string;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ cidade: propCidade, className = "" }) => {
  const { profile } = useAuth();
  const cidade = (propCidade || profile?.cidade || (profile as any)?.city || "Goiânia").trim();
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadWeather() {
      try {
        setLoading(true);
        let lat = -16.6869;
        let lon = -49.2648;

        if (cidade) {
          try {
            const geoRes = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`
            );
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.results && geoData.results.length > 0) {
                lat = geoData.results[0].latitude;
                lon = geoData.results[0].longitude;
              }
            }
          } catch (e) {
            console.warn("Erro ao buscar coordenadas da cidade, utilizando fallback:", e);
          }
        }

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        if (!res.ok) throw new Error('Erro na API de clima');
        const data = await res.json();
        if (isMounted && data.current_weather) {
          setWeather({
            temp: data.current_weather.temperature,
            code: data.current_weather.weathercode,
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar clima:', err);
        if (isMounted) {
          setWeather({
            temp: 27,
            code: 0,
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWeather();
    return () => {
      isMounted = false;
    };
  }, [cidade]);

  // WMO Weather interpretation codes
  const getWeatherInfo = (code: number) => {
    if (code === 0) return { icon: <Sun className="w-4 h-4 text-amber-500 shrink-0" />, desc: 'Ensolarado' };
    if (code === 1 || code === 2) return { icon: <CloudSun className="w-4 h-4 text-amber-500 shrink-0" />, desc: 'Parcialmente nublado' };
    if (code === 3) return { icon: <Cloud className="w-4 h-4 text-slate-400 shrink-0" />, desc: 'Nublado' };
    if (code >= 45 && code <= 48) return { icon: <Wind className="w-4 h-4 text-slate-400 shrink-0" />, desc: 'Neblina' };
    if (code >= 51 && code <= 67) return { icon: <CloudRain className="w-4 h-4 text-sky-500 shrink-0" />, desc: 'Chuva' };
    if (code >= 71 && code <= 77) return { icon: <CloudSnow className="w-4 h-4 text-slate-300 shrink-0" />, desc: 'Neve' };
    if (code >= 80 && code <= 82) return { icon: <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />, desc: 'Pancadas de chuva' };
    if (code >= 95) return { icon: <CloudLightning className="w-4 h-4 text-amber-600 shrink-0" />, desc: 'Tempestade' };
    
    return { icon: <Sun className="w-4 h-4 text-amber-500 shrink-0" />, desc: 'Tempo bom' };
  };

  const currentInfo = weather ? getWeatherInfo(weather.code) : { icon: <Sun className="w-4 h-4 text-amber-500 shrink-0" />, desc: 'Tempo bom' };
  const tempNumber = weather ? Math.round(weather.temp) : 27;

  if (loading && !weather) {
    return (
      <div className={`bg-white shadow-xs px-4 py-2.5 rounded-2xl flex items-center gap-2 text-slate-600 text-xs sm:text-sm font-normal min-h-[56px] ${className}`}>
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-slate-500 text-xs sm:text-sm">Em {cidade || "Goiânia"}, carregando...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow-xs hover:shadow-md px-4 py-2.5 rounded-2xl flex items-center gap-2 text-slate-700 text-xs sm:text-sm font-normal transition-shadow min-h-[56px] ${className}`}>
      <span>
        Em <span className="text-slate-900 font-medium">{cidade || "Goiânia"}</span>,{" "}
        <span className="text-slate-900 font-medium">{tempNumber} Graus</span>
      </span>
      {currentInfo.icon}
    </div>
  );
};

export default WeatherWidget;
