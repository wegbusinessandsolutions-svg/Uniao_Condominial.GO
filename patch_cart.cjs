const fs = require('fs');
let content = fs.readFileSync('src/pages/shop/Cart.tsx', 'utf8');

if (!content.includes('isStaffRole')) {
  content = content.replace('import { useAuth }', 'import { isStaffRole } from "../../lib/permissions";\nimport { useAuth }');
}

const target = 'const handleCheckout = async (e: React.FormEvent) => {';
const replacement = `const handleCheckout = async (e: React.FormEvent) => {
    if (isStaffRole(profile?.role)) {
      alert("Apenas clientes podem realizar compras no aplicativo.");
      return;
    }`;

content = content.replace(target, replacement);

const btnTarget = `onClick={() => setStep("checkout")}`;
const btnReplacement = `onClick={() => {
                  if (isStaffRole(profile?.role)) {
                    alert("Apenas clientes podem realizar faturamento.");
                    return;
                  }
                  setStep("checkout");
                }}`;
content = content.replace(btnTarget, btnReplacement);

fs.writeFileSync('src/pages/shop/Cart.tsx', content);
console.log("Patched Cart.tsx");
