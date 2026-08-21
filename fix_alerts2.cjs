const fs = require('fs');

// Also fix in MeusDados.tsx!
let content = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

// Replace alerts with inline state if possible, but MeusDados already has a loading state. We can use setAfiliadoStatus instead of alert.
content = content.replace('alert("Informe a quantidade de unidades habitacionais válida.");', 'setAfiliadoStatus("Erro: Informe a quantidade válida.");');
content = content.replace('alert("Selecione o melhor dia para vencimento do boleto.");', 'setAfiliadoStatus("Erro: Selecione o dia.");');
content = content.replace('alert("Termo de afiliação enviado para o seu e-mail com sucesso! Verifique sua caixa de entrada.");', '// success alert removed');
content = content.replace('alert("Erro ao afiliar: " + err.message);', 'setAfiliadoStatus("Erro: " + err.message);');

fs.writeFileSync('src/pages/cliente/MeusDados.tsx', content);
console.log('Fixed alerts in MeusDados.tsx');
