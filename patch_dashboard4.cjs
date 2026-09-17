const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\{new Date\(\)\.getDate de/g, "{new Date().getDate()} de");

fs.writeFileSync(file, content);
