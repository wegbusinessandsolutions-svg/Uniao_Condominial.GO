const fs = require('fs');
let content = fs.readFileSync('src/components/layouts/AdminLayout.tsx', 'utf8');

const target = '{ name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },';
const replacement = target + '\n      { name: "Controle de Afiliados U.C.", path: "/admin/comercial/afiliados", icon: Building2 },';

content = content.replace(target, replacement);

fs.writeFileSync('src/components/layouts/AdminLayout.tsx', content);
