import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { initFirebase } from "./firebase";

export interface SystemLog {
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  category: "Administrativo" | "Comercial" | "Financeiro" | "Estoque" | "Sistema";
  ip: string;
  userAgent: string;
  date: any;
  details?: any;
  before?: any;
  after?: any;
}

let cachedIp = "";

async function fetchUserIp(): Promise<string> {
  if (cachedIp) return cachedIp;
  try {
    // Try to get public IP. timeout of 3s to not hold up UI operations
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        cachedIp = data.ip;
        return cachedIp;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch public IP via ipify", err);
  }
  return "IP Indisponível (Client)";
}

/**
 * Audit system logger. Logs a system action with current authenticated user details.
 * @param action Short description of the critical action
 * @param category Action department/category
 * @param details Dynamic object with further information (ids, state details, names, etc)
 * @param before Initial state of the record before changes
 * @param after Final state of the record after changes
 */
export async function logAction(
  action: string,
  category: "Administrativo" | "Comercial" | "Financeiro" | "Estoque" | "Sistema",
  details?: any,
  before?: any,
  after?: any
) {
  try {
    const { auth, db } = await initFirebase();
    const currentUser = auth.currentUser;
    
    const userId = currentUser?.uid || "não-autenticado";
    const userEmail = currentUser?.email || "anonimo@sistema.com";
    const userName = currentUser?.displayName || "Usuário Anônimo";
    
    const ip = await fetchUserIp();
    const userAgent = navigator.userAgent || "Browser";

    const logData: Omit<SystemLog, "date"> & { date: any } = {
      userId,
      userEmail,
      userName,
      action,
      category,
      ip,
      userAgent,
      date: serverTimestamp(),
      details: details ? JSON.parse(JSON.stringify(details)) : null,
      before: before ? JSON.parse(JSON.stringify(before)) : null,
      after: after ? JSON.parse(JSON.stringify(after)) : null,
    };

    const docRef = await addDoc(collection(db, "logs_sistema"), logData);
    console.log("Audit log registered successfully:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
