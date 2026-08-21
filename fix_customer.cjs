const fs = require('fs');
const file = 'src/components/layouts/CustomerLayout.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /<span className="font-bold text-slate-800 text-\[17px\] block leading-none">/g,
  '<span className="font-bold text-slate-800 text-[17px] block leading-none notranslate" translate="no">'
);
content = content.replace(
  /<h2 className="text-\[14px\] text-brand-dark font-bold uppercase tracking-wider mb-1">/g,
  '<h2 className="text-[14px] text-brand-dark font-bold uppercase tracking-wider mb-1 notranslate" translate="no">'
);
fs.writeFileSync(file, content);
console.log("CustomerLayout patched.");
