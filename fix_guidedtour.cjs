const fs = require('fs');
let content = fs.readFileSync('src/components/common/GuidedTour.tsx', 'utf8');
content = content.replace(
  'title: "Bem-vindo ao <span className="notranslate" translate="no">União Condominial.GO</span>!",',
  'title: "Bem-vindo ao União Condominial.GO!",'
);
fs.writeFileSync('src/components/common/GuidedTour.tsx', content);
console.log("GuidedTour fixed.");
