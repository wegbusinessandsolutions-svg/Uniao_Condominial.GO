const fs = require('fs');
const file = 'src/components/layouts/AdminLayout.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /<span className="font-bold text-slate-800 text-\[17px\] block leading-none">/g,
  '<span className="font-bold text-slate-800 text-[17px] block leading-none notranslate" translate="no">'
);
content = content.replace(
  /<span className="text-xl font-bold block">/g,
  '<span className="text-xl font-bold block notranslate" translate="no">'
);
fs.writeFileSync(file, content);
console.log("AdminLayout patched.");
