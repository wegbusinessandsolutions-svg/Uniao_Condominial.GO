const fs = require('fs');
let file = fs.readFileSync('src/components/cliente/ClientAfiliacaoAlert.tsx', 'utf8');

file = file.replace(
  '<p className="text-amber-700 text-sm mb-1">\n                Esteja atento a data de vencimento de sua Anuidade.\n              </p>',
  ''
);

file = file.replace(
  'e informe o seu vence dia: <strong>{dia}/{mes}</strong>',
  'Esteja atento a data de vencimento de sua Anuidade, e informe o seu vence dia: <strong>{dia}/{mes}</strong>'
);

fs.writeFileSync('src/components/cliente/ClientAfiliacaoAlert.tsx', file);
