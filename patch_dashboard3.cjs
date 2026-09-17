const fs = require('fs');
const file = '/app/applet/src/pages/cliente/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix Date().getDate
content = content.replace(/\{new Date\.getDate de/g, "{new Date().getDate()} de");
content = content.replace(/getFullYear\./g, "getFullYear()}.");

// Fix the end of file
content = content.replace(/  \}\n\s*$/g, "  );\n}\n");

fs.writeFileSync(file, content);
