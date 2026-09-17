const fs = require('fs');
const file = '/app/applet/src/pages/cliente/LocalEntrega.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
  /import \{ MapContainer, TileLayer, Marker, useMap \} from "react-leaflet";\nimport L from "leaflet";[\s\S]*?function MapUpdater[\s\S]*?return null;\n\}/,
  `import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";`
);

// Replace MapContainer usage
content = content.replace(
  /<MapContainer[\s\S]*?<\/MapContainer>/,
  `{import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
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
          )}`
);

fs.writeFileSync(file, content);
