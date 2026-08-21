const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add imports
const importsToAdd = `
import MinhasOrdensServico from "./pages/cliente/OrdensServico";
import ServicosEssenciaisAdmin from "./pages/admin/ServicosEssenciais";
import OrdensServicoAdmin from "./pages/admin/OrdensServico";
`;
code = code.replace(/import ServicosEssenciais from ".\/pages\/cliente\/ServicosEssenciais";/, 'import ServicosEssenciais from "./pages/cliente/ServicosEssenciais";' + importsToAdd);

// Add customer route
code = code.replace(/<Route path="servicos" element={<ServicosEssenciais \/>} \/>/, '<Route path="servicos" element={<ServicosEssenciais />} />\n            <Route path="ordens-servico" element={<MinhasOrdensServico />} />');

// Add admin routes
code = code.replace(/<Route path="comercial\/categorias" element={<CategoriasAdmin \/>} \/>/, '<Route path="comercial/categorias" element={<CategoriasAdmin />} />\n              <Route path="comercial/servicos" element={<ServicosEssenciaisAdmin />} />\n              <Route path="comercial/ordens-servico" element={<OrdensServicoAdmin />} />');

fs.writeFileSync('src/App.tsx', code);
