const fs = require('fs');

function patch(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(
      /União Condominial\.GO/g,
      '<span className="notranslate" translate="no">União Condominial.GO</span>'
    );
    // Remove if double wrapped
    content = content.replace(
      /<span className="notranslate" translate="no"><span className="notranslate" translate="no">União Condominial\.GO<\/span><\/span>/g,
      '<span className="notranslate" translate="no">União Condominial.GO</span>'
    );
    fs.writeFileSync(file, content);
  }
}

patch('src/components/common/LegalModal.tsx');
patch('src/components/common/GuidedTour.tsx');
patch('src/components/cliente/FloatingSupportChat.tsx');
patch('src/pages/shop/SignupForm.tsx');
patch('src/pages/cliente/Suporte.tsx');
patch('src/pages/admin/relatorios/ReportFooter.tsx');
console.log("Text patched.");
