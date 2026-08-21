const fs = require('fs');

let content = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');
// Oh wait, handleApprove had window.confirm which was removed, but we want it to actually run!
// If window.confirm is removed, it runs immediately when the button is clicked. That's fine for now, we just want to avoid the crash.
content = content.replace('if (!window.confirm(`Deseja re-enviar', '// window.confirm removed');
content = content.replace('if (!window.confirm(`Confirmar a afiliação', '// window.confirm removed');

fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', content);
