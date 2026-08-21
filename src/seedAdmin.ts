import { initializeApp } from "firebase/app";
import { initializeFirestore, setDoc, doc, getDocs, collection } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

async function seed() {
  await setDoc(doc(db, "users", "temp-admin-123"), {
    uid: "temp-admin-123",
    email: "wegbusinessandsolutions@gmail.com",
    displayName: "Administrador WEG",
    role: "admin",
    level: "Diamante",
    cashbackBalance: 0
  });
  console.log("Admin seeded!");
  
  // Also check if there's any other admin user created through firebase Auth
  const docs = await getDocs(collection(db, "users"));
  console.log("Total users:", docs.size);
  docs.forEach(d => console.log(d.id, "=>", d.data().email));
  process.exit(0);
}
seed();
