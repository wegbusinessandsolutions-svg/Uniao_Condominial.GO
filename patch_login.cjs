const fs = require('fs');
let content = fs.readFileSync('src/pages/shop/CustomerArea.tsx', 'utf8');

// Update login verification to check firestore
const loginCheck = `        if (!userCred.user.emailVerified && userCred.user.email !== "wegbusinessandsolutions@gmail.com") {
          const { db } = await initFirebase();
          const { doc, getDoc } = await import("firebase/firestore");
          const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
          const userData = userDoc.data();
          if (!userData || !userData.emailConfirmadoAdmin) {
            await auth.signOut();
            setAuthError("Você deve confirmar o seu cadastro através do e-mail que fora enviado para que possa utilizar o aplicativo.");
            return;
          }
        }`;

content = content.replace(
  /        if \(!userCred\.user\.emailVerified && userCred\.user\.email !== "wegbusinessandsolutions@gmail\.com"\) {\s*await auth\.signOut\(\);\s*setAuthError\("Você deve confirmar o seu cadastro através do e-mail que fora enviado para que possa utilizar o aplicativo\."\);\s*return;\s*}/,
  loginCheck
);

fs.writeFileSync('src/pages/shop/CustomerArea.tsx', content);
