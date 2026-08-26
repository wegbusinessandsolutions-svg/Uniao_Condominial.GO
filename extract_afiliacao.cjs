const fs = require('fs');

const meusDadosContent = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

// We just copy the entire file to Afiliacao.tsx as a starting point.
fs.writeFileSync('src/pages/cliente/Afiliacao.tsx', meusDadosContent);

