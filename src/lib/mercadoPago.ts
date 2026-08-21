import { collection, query, where, getDocs, updateDoc, doc, addDoc } from "firebase/firestore";
import { initFirebase } from "./firebase";
import { logAction } from "./audit";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  try {
    const authModule = require("firebase/auth");
    const auth = authModule.getAuth();
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth?.currentUser?.uid,
        email: auth?.currentUser?.email,
        emailVerified: auth?.currentUser?.emailVerified,
        isAnonymous: auth?.currentUser?.isAnonymous,
        tenantId: auth?.currentUser?.tenantId,
      },
      operationType,
      path,
    };
    console.error("Firestore Error: ", JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } catch {
    // Fallback if auth is not available or require fails in ESM
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: null,
        email: null,
        emailVerified: null,
        isAnonymous: null,
        tenantId: null,
      },
      operationType,
      path,
    };
    console.error("Firestore Error: ", JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
}

export interface MercadoPagoConfig {
  id?: string;
  provedor: string;
  publicKey: string;
  clientId: string;
  status: "Ativo" | "Modo Teste" | "Inativo";
}

/**
 * Fetches the active Mercado Pago API configuration.
 */
export async function getMercadoPagoConfig(): Promise<MercadoPagoConfig | null> {
  const pathName = "integracao_pagamentos";
  try {
    const { db } = await initFirebase();
    const q = query(
      collection(db, pathName),
      where("provedor", "==", "Mercado Pago")
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const configs = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        provedor: data.provedor,
        publicKey: data.publicKey,
        clientId: data.clientId,
        status: data.status
      } as MercadoPagoConfig;
    });
    
    // Prioritize "Ativo", then "Modo Teste", ignoring "Inativo"
    const activeConfig = configs.find(c => c.status === "Ativo") || configs.find(c => c.status === "Modo Teste");
    return activeConfig || null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, pathName);
    return null;
  }
}
