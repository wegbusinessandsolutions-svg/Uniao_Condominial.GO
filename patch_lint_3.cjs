const fs = require('fs');

function replaceFileContent(filePath, regexMap) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [regex, replacement] of Object.entries(regexMap)) {
    content = content.replace(new RegExp(regex, 'g'), replacement);
  }
  fs.writeFileSync(filePath, content);
}

replaceFileContent('/app/applet/src/pages/cliente/Afiliacao.tsx', {
  'user\\?\\.displayName': 'user?.email || "Usuário"'
});

console.log("Lint patches 3 applied.");
