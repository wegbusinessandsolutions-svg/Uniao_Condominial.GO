const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{\/\* 3\. Location Confirmed Card[\s\S]*?\}\)/,
  `{/* GPS Confirmado removido a pedido do cliente */}`
);

// We should also adjust the grid column class since we removed the 3rd card
content = content.replace(
  /className=\{\`grid grid-cols-1 gap-2\.5 sm:gap-3 text-sm w-full \$\{profile\?\.geolocalizacaoAtiva && locationDateFormatted \? "sm:grid-cols-2 md:grid-cols-3 max-w-2xl" : "sm:grid-cols-2 max-w-xl"\}\`\}/,
  `className="grid grid-cols-1 gap-2.5 sm:gap-3 text-sm w-full sm:grid-cols-2 max-w-xl"`
);

fs.writeFileSync(file, content);
