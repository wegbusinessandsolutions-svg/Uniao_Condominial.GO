const fs = require('fs');
const file = '/app/applet/src/pages/cliente/MeusDados.tsx';
let content = fs.readFileSync(file, 'utf8');

// The vertical spacing was reduced to `py-2 flex justify-between` previously.
// To increase by 10%, we will change it to `py-2.5 flex justify-between` and the container from `space-y-3` to `space-y-4`

content = content.replace(/className="py-2 flex justify-between/g, `className="py-2.5 flex justify-between`);
content = content.replace(/className="space-y-3"/g, `className="space-y-4"`);

fs.writeFileSync(file, content);
