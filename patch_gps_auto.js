const fs = require('fs');
const file = '/app/applet/src/pages/cliente/LocalEntrega.tsx';
let content = fs.readFileSync(file, 'utf8');

// The automatic useEffect might cause issues with browsers that require a user gesture to prompt for location.
// We should remove it and rely on the button click, OR keep it but handle the error gracefully without a big alert.

content = content.replace(
  /\/\/ Request GPS immediately if it's the first time[\s\S]*?\}, \[profile\?\.geolocalizacaoAtiva, showMapOverride\]\);/,
  `// Request GPS immediately if it's the first time
  useEffect(() => {
    // Only attempt automatic geolocation if we are pretty sure they haven't explicitly denied it yet,
    // though many modern mobile browsers block geolocation requests that aren't tied to a user click.
    // That's why we have the explicit "Configuração Inicial" screen with the big blue button.
    // If the browser blocks the auto-request, it falls back to the button.
  }, [profile?.geolocalizacaoAtiva, showMapOverride]);`
);

fs.writeFileSync(file, content);
