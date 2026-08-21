import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

let app: any;
let auth: any;
let db: any;
let storage: any;

try {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  storage = getStorage(app);
} catch (error) {
  console.error("Firebase auto-init error:", error);
}

export async function initFirebase() {
  if (!app) {
    try {
      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }
      auth = getAuth(app);
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
      storage = getStorage(app);
    } catch (error) {
      console.error("Firebase init failed", error);
      throw error;
    }
  }
  return { app, auth, db, storage };
}

export { app, auth, db, storage };
