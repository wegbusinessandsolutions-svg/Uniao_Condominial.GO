const fs = require('fs');

// 1. Fix AdminLayout.tsx
let adminLayout = fs.readFileSync('src/components/layouts/AdminLayout.tsx', 'utf8');

// Remove from the wrong place (Permissoes de Usuario)
adminLayout = adminLayout.replace('      { name: "Controle de Afiliados U.C.", path: "/admin/comercial/afiliados", icon: Building2 },\n', '');

// Add to the right place
const targetMenu = '{ name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },';
// Let's make sure we find the second occurrence if there are multiple, or just use the whole line with context.
const correctTargetMenu = '{ name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },\n      { name: "Visitas ao Cliente", path: "/admin/comercial/visitas", icon: MapPin },';

if (adminLayout.includes(correctTargetMenu)) {
    adminLayout = adminLayout.replace(correctTargetMenu, correctTargetMenu + '\n      { name: "Controle de Afiliados U.C.", path: "/admin/comercial/afiliados", icon: Building2 },');
} else {
    // try a more generic approach if that fails
    const regex = /title:\s*"Comercial",\s*items:\s*\[([\s\S]*?)\]/g;
    adminLayout = adminLayout.replace(regex, (match, p1) => {
        if (!p1.includes('Controle de Afiliados U.C.')) {
            return match.replace('{ name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },', '{ name: "Dashboard - Comercial Externo", path: "/admin/comercial-externo", icon: MapPin },\n      { name: "Controle de Afiliados U.C.", path: "/admin/comercial/afiliados", icon: Building2 },');
        }
        return match;
    });
}
fs.writeFileSync('src/components/layouts/AdminLayout.tsx', adminLayout);
console.log("Fixed AdminLayout.tsx");


// 2. Fix App.tsx
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');

if (!appTsx.includes('import ControleAfiliados')) {
    const targetImport = 'import Comissoes from "./pages/comercial/Comissoes";';
    const newImport = 'import ControleAfiliados from "./pages/comercial/ControleAfiliados";';
    appTsx = appTsx.replace(targetImport, targetImport + '\n' + newImport);
}

if (!appTsx.includes('path="comercial/afiliados"')) {
    const targetRoute = '<Route path="comercial/comissoes" element={<Comissoes />} />';
    const newRoute = '<Route path="comercial/afiliados" element={<ControleAfiliados />} />';
    appTsx = appTsx.replace(targetRoute, targetRoute + '\n                ' + newRoute);
}

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Fixed App.tsx");

