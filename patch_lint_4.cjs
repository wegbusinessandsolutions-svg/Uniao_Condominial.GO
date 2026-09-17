const fs = require('fs');

function replaceFileContent(filePath, regexMap) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [regex, replacement] of Object.entries(regexMap)) {
    content = content.replace(new RegExp(regex, 'g'), replacement);
  }
  fs.writeFileSync(filePath, content);
}

replaceFileContent('/app/applet/src/pages/admin/Usuarios.tsx', {
  'quantidadeUnidades:': 'unidades:',
  'tipoCondominio:': 'tipoCliente:'
});

replaceFileContent('/app/applet/src/pages/cliente/Afiliacao.tsx', {
  'profile\\?\\.displayName \\|\\| profile\\?\\.displayName': 'profile?.displayName',
  'user\\?\\.email \\|\\| "Usuário"': 'user?.email || "Usuário"'
});

replaceFileContent('/app/applet/src/pages/cliente/MeusDados.tsx', {
  'profile\\?\\.displayName \\|\\| profile\\?\\.displayName': 'profile?.displayName'
});

replaceFileContent('/app/applet/src/pages/cliente/LocalEntrega.tsx', {
  'endereco,': ''
});

console.log("Lint patches 4 applied.");
