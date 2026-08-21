const fs = require('fs');

let content = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

if (!content.includes('email: profile?.email || "",')) {
  content = content.replace(
    'status: "Pendente de Aceite por E-mail",',
    'email: profile?.email || "",\n        status: "Pendente de Aceite por E-mail",'
  );
  fs.writeFileSync('src/pages/cliente/MeusDados.tsx', content);
  console.log('Patched MeusDados.tsx to include email');
}

let content2 = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');

// Use afiliado.email if available
content2 = content2.replace(
  'const userSnap = await getDoc(doc(db, "users", afiliado.userId || "UNDEFINED_USER"));\n      const userEmail = userSnap.exists() ? userSnap.data().email : "";',
  'let userEmail = afiliado.email;\n      if (!userEmail) {\n        const userSnap = await getDoc(doc(db, "users", afiliado.userId || "UNDEFINED_USER"));\n        userEmail = userSnap.exists() ? userSnap.data().email : "";\n      }'
);

content2 = content2.replace(
  'const userSnap = await getDoc(doc(db, "users", afiliado.userId || "UNDEFINED_USER"));\n      const userEmail = userSnap.exists() ? userSnap.data().email : "";',
  'let userEmail = afiliado.email;\n      if (!userEmail) {\n        const userSnap = await getDoc(doc(db, "users", afiliado.userId || "UNDEFINED_USER"));\n        userEmail = userSnap.exists() ? userSnap.data().email : "";\n      }'
);

fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', content2);
console.log('Patched ControleAfiliados.tsx to use afiliado.email');

