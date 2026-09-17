const fs = require('fs');
const file = '/app/applet/src/pages/cliente/MeusDados.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/className="space-y-4"/g, `className="space-y-2"`);
content = content.replace(/className="py-2\.5 flex justify-between/g, `className="py-1.5 flex justify-between`);

fs.writeFileSync(file, content);
