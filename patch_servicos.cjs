const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/ServicosEssenciais.tsx', 'utf8');

if (!content.includes('isStaffRole')) {
  content = content.replace('import { useAuth }', 'import { isStaffRole } from "../../lib/permissions";\nimport { useAuth }');
}

const target = 'const handleAddToCart = (servico: any) => {';
const replacement = `const handleAddToCart = (servico: any) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar solicitações de serviços no aplicativo.");
      return;
    }`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/cliente/ServicosEssenciais.tsx', content);
console.log("Patched ServicosEssenciais.tsx");
