const fs = require('fs');
let content = fs.readFileSync('src/pages/entregador/Dashboard.tsx', 'utf8');

// Remove unused imports
content = content.replace(/import \{ registrarMudancaStatusPedido \} from "\.\.\/\.\.\/lib\/orderLogger";\n/, '');
content = content.replace(/ChevronRight, /, '');

fs.writeFileSync('src/pages/entregador/Dashboard.tsx', content);
