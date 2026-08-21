const fs = require('fs');

function patchShopLayout() {
  const file = 'src/components/layouts/ShopLayout.tsx';
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-1 shrink-0"/g,
    'className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-1 shrink-0 notranslate" translate="no"'
  );
  content = content.replace(
    /className="inline-block text-2xl sm:text-3xl italic tracking-tight"/g,
    'className="inline-block text-2xl sm:text-3xl italic tracking-tight notranslate" translate="no"'
  );
  content = content.replace(
    /<div>\s*© 2026 União Condominial.GO. Todos os direitos reservados.\s*<\/div>/g,
    '<div className="notranslate" translate="no">\n              © 2026 União Condominial.GO. Todos os direitos reservados.\n            </div>'
  );
  fs.writeFileSync(file, content);
}

patchShopLayout();
console.log("ShopLayout patched.");
