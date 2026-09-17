const fs = require('fs');
const file = '/app/applet/src/pages/cliente/MeusDados.tsx';
let content = fs.readFileSync(file, 'utf8');

// The vertical spacing was reduced previously from py-2.5 to py-1.5. 
// We want to increase it by 10%. py-2 seems appropriate (between py-1.5 and py-2.5)
content = content.replace(/className="py-1\.5 flex justify-between/g, `className="py-2 flex justify-between`);
// Also adjust the container spacing slightly if needed
content = content.replace(/className="space-y-2"/g, `className="space-y-3"`);

fs.writeFileSync(file, content);
