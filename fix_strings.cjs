const fs = require('fs');

function revert(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /<span className="notranslate" translate="no">União Condominial\.GO<\/span>/g,
      'União Condominial.GO'
    );
    fs.writeFileSync(file, content);
  }
}

revert('src/components/cliente/FloatingSupportChat.tsx');
revert('src/pages/cliente/Suporte.tsx');
revert('src/pages/admin/relatorios/ReportFooter.tsx');
console.log("Strings reverted.");
