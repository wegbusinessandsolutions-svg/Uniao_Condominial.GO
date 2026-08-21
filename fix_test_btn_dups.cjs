const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

const regex = /\{\/\* TESTE DE ENVIO SECTION \(INFERIOR\) \*\/\}([\s\S]*?)<\/div>\s*<\/div>/g;
let matches = [...content.matchAll(regex)];

if (matches.length > 1) {
    // Keep the first one and remove the second
    const secondMatch = matches[1][0];
    content = content.replace(secondMatch, '');
    fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
    console.log("Removed duplicate!");
}

