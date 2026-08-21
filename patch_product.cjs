const fs = require('fs');
let content = fs.readFileSync('src/pages/shop/ProductDetail.tsx', 'utf8');

// Add import for isStaffRole
if (!content.includes('isStaffRole')) {
  content = content.replace('import { useAuth }', 'import { isStaffRole } from "../../lib/permissions";\nimport { useAuth }');
}

const replacement = `if (!profile) {
                      navigate("/minha-conta");
                      return;
                    }
                    if (isStaffRole(profile?.role)) {
                      alert("Apenas clientes podem realizar compras no aplicativo.");
                      return;
                    }`;

content = content.replace('if (!profile) {\n                      navigate("/minha-conta");\n                      return;\n                    }', replacement);

fs.writeFileSync('src/pages/shop/ProductDetail.tsx', content);
console.log("Patched ProductDetail.tsx");
