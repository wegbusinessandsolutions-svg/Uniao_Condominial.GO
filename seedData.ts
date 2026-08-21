import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function seed() {
  const email = "wegbusinessandsolutions@gmail.com";
  const password = "02210839";
  let user;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    user = cred.user;
    console.log("Created user successfully.");
  } catch (e: any) {
    console.error("Error creating user:", e.message);
    if (e.code === 'auth/email-already-in-use') {
       const cred = await signInWithEmailAndPassword(auth, email, password);
       user = cred.user;
       console.log("Logged in existing user.");
    } else {
       process.exit(1);
    }
  }

  try {
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      displayName: "União Condominial",
      role: "admin",
      level: "Diamante",
      cashbackBalance: 0
    });
    console.log("User doc created/updated successfully.");
  } catch (e: any) {
    console.error("Error writing doc:", e.message);
  }
  process.exit(0);
}

seed();
