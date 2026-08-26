const fs = require('fs');
let file = fs.readFileSync('src/components/cliente/ClientAfiliacaoAlert.tsx', 'utf8');

const replacement = `
    const checkDocs = async () => {
      try {
        let afiliacaoId = user.uid;

        // Tentar achar o ID real de afiliado
        const directSnap = await getDocs(query(collection(db, "afiliados_uc"), where("userId", "==", user.uid)));
        if (!directSnap.empty) {
          afiliacaoId = directSnap.docs[0].id;
        } else if (user.email) {
          const emailSnap = await getDocs(query(collection(db, "afiliados_uc"), where("email", "==", user.email)));
          if (!emailSnap.empty) {
            afiliacaoId = emailSnap.docs[0].id;
          }
        }

        const q = query(
          collection(db, "contas_receber"),
          where("afiliacaoId", "==", afiliacaoId),
          where("status", "in", ["Aberto", "Vencido", "Pendente", "pendente", "aberto", "vencido"])
        );
`;

file = file.replace(
  /const checkDocs = async \(\) => \{\s*try \{\s*const q = query\([\s\S]*?where\("status", "in", \["Aberto", "Vencido", "Pendente", "pendente", "aberto", "vencido"\]\)\s*\);/,
  replacement
);

// Updating the text for upcoming
file = file.replace(
  '<p className="text-amber-800 font-medium text-sm">\n                    O seu próximo vencimento é dia: <strong>{dia}/{mes}</strong>\n                  </p>',
  '<p className="text-amber-800 font-medium text-sm">\n                    O seu vence dia: <strong>{dia}/{mes}</strong>\n                  </p>'
);

file = file.replace(
  'Esteja atento à data de vencimento de sua Anuidade/Mensalidade.',
  'Esteja atento a data de vencimento de sua Anuidade.'
);

fs.writeFileSync('src/components/cliente/ClientAfiliacaoAlert.tsx', file);
