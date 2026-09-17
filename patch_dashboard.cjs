const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\{.* GPS Confirmado removido a pedido do cliente \*\/\}/g, `{/* GPS Confirmado removido a pedido do cliente */}`);
fs.writeFileSync(file, content);
