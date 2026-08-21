const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/MeusPedidos.tsx', 'utf8');

if (!content.includes('isStaffRole')) {
  content = content.replace('import { useAuth }', 'import { isStaffRole } from "../../lib/permissions";\nimport { useAuth }');
}

const target = 'const handleRepeatOrder = async (pedido: any) => {';
const replacement = `const handleRepeatOrder = async (pedido: any) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar compras no aplicativo.");
      return;
    }`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/cliente/MeusPedidos.tsx', content);
console.log("Patched MeusPedidos.tsx");
