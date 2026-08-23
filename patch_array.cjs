const fs = require('fs');
let content = fs.readFileSync('src/pages/shop/Sobre.tsx', 'utf8');
content = content.replace(
  /"Equipe agendada, sem "quebra-galhos"",/g,
  '"Equipe agendada, sem \\"quebra-galhos\\"",'
);
fs.writeFileSync('src/pages/shop/Sobre.tsx', content);
