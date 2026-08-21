const fs = require('fs');

function patch(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /União Condominial\.<span className="text-emerald-600 font-bold">GO<\/span>/g,
      '<span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span>'
    );
    content = content.replace(
      /União Condominial\.<span className="text-emerald-600">GO<\/span>/g,
      '<span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600">GO</span></span>'
    );
    fs.writeFileSync(file, content);
  }
}

patch('src/pages/shop/Home.tsx');
patch('src/pages/shop/Sobre.tsx');
patch('src/components/cliente/MuralCondominial.tsx');
console.log("Content patched.");
