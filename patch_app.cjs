const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetImport = 'import Comissoes from "./pages/comercial/Comissoes";';
const newImport = 'import ControleAfiliados from "./pages/comercial/ControleAfiliados";';
if (!content.includes(newImport)) {
  content = content.replace(targetImport, targetImport + '\\n' + newImport);
}

const targetRoute = '<Route path="comercial/comissoes" element={<Comissoes />} />';
const newRoute = '<Route path="comercial/afiliados" element={<ControleAfiliados />} />';
if (!content.includes(newRoute)) {
  content = content.replace(targetRoute, targetRoute + '\\n                ' + newRoute);
}

fs.writeFileSync('src/App.tsx', content);
