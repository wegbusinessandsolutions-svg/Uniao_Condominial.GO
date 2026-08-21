const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

content = content.replace('alert("Por favor, digite um e-mail válido no campo ao lado.");', 'setStatusMessage({ type: "error", text: "Por favor, digite um e-mail válido no campo ao lado." });');

fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
