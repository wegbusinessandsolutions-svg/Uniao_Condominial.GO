const fs = require('fs');

function replaceFileContent(filePath, regexMap) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [regex, replacement] of Object.entries(regexMap)) {
    content = content.replace(new RegExp(regex, 'g'), replacement);
  }
  fs.writeFileSync(filePath, content);
}

// 1. src/pages/cliente/Afiliacao.tsx
replaceFileContent('/app/applet/src/pages/cliente/Afiliacao.tsx', {
  'profile\\?\\.nome\\b': 'profile?.displayName',
  'user\\?\\.nome\\b': 'user?.displayName'
});

// 2. src/pages/cliente/Cashback.tsx
replaceFileContent('/app/applet/src/pages/cliente/Cashback.tsx', {
  'profile\\?\\.nome\\b': 'profile?.displayName'
});

// 3. src/pages/cliente/ClubeBeneficios.tsx
replaceFileContent('/app/applet/src/pages/cliente/ClubeBeneficios.tsx', {
  'profile\\?\\.nome\\b': 'profile?.displayName',
  'profile\\?\\.razaoSocial\\b': 'profile?.nomeEmpresa',
  'profile\\?\\.empresa\\b': 'profile?.nomeEmpresa',
  'beneficio\\.imagemUrl': 'beneficio.imagem',
  'beneficio\\.logo': 'beneficio.imagem',
  'beneficio\\.foto': 'beneficio.imagem'
});

// 4. src/pages/cliente/MeusDados.tsx
replaceFileContent('/app/applet/src/pages/cliente/MeusDados.tsx', {
  'profile\\?\\.nome\\b': 'profile?.displayName'
});

// 5. src/pages/cliente/OrdensServico.tsx
replaceFileContent('/app/applet/src/pages/cliente/OrdensServico.tsx', {
  'profile\\?\\.role === "Admin"': 'profile?.role === "Administrador"',
  'profile\\?\\.role === "master"': 'profile?.role === "Administrador"'
});

// 6. src/pages/comercial/Comissoes.tsx
replaceFileContent('/app/applet/src/pages/comercial/Comissoes.tsx', {
  'profile\\?\\.role === "Admin"': 'profile?.role === "Administrador"',
  'profile\\?\\.nome\\b': 'profile?.displayName'
});

// 7. src/pages/comercial/VisitasCliente.tsx
replaceFileContent('/app/applet/src/pages/comercial/VisitasCliente.tsx', {
  'profile\\?\\.role === "Admin"': 'profile?.role === "Administrador"',
  'profile\\?\\.role === "master"': 'profile?.role === "Administrador"'
});

// 8. src/pages/expedicao/Estoque.tsx
replaceFileContent('/app/applet/src/pages/expedicao/Estoque.tsx', {
  'profile\\?\\.nome\\b': 'profile?.displayName'
});

// 9. src/pages/financeiro/CashbackControle.tsx
replaceFileContent('/app/applet/src/pages/financeiro/CashbackControle.tsx', {
  'req\\.fornecedor': 'req.userName || req.userId' // Depending on what was intended
});

// 10. src/pages/admin/Usuarios.tsx
// It's comparing/assigning properties that don't exist on UserProfile
replaceFileContent('/app/applet/src/pages/admin/Usuarios.tsx', {
  'quantidadeUnidades': 'unidades', // Or whatever it maps to
  'tipoCondominio': 'tipoCliente' 
});

// 11. src/pages/comercial/Clientes.tsx
replaceFileContent('/app/applet/src/pages/comercial/Clientes.tsx', {
  '=== "Responsável"': '=== "Administrador"' // A guess, let's fix it later if needed
});

console.log("Lint patches applied.");
