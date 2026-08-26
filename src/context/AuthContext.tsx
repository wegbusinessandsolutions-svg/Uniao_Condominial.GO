import React, { createContext, useContext, useState, useEffect } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "../lib/firebase";

interface ModulePermission {
  visible: boolean;
  submodules: Record<string, boolean>;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  role: "Cliente" | "Administrador" | "Comercial" | "Financeiro" | "Estoquista" | "Entregador" | "admin" | "customer";
  permissions?: Record<string, ModulePermission>;
  level: "Bronze" | "Prata" | "Ouro" | "Diamante";
  cashbackBalance: number;
  status?: string;
  phone?: string;
  telefone?: string;
  cpf?: string;
  cnpj?: string;
  cpfResponsavel?: string;
  documento?: string;
  cpfCnpj?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  theme?: "light" | "dark";
  latitude?: number;
  longitude?: number;
  geolocalizacaoAtiva?: boolean;
  geolocalizacaoAtualizadaEm?: any;
  codigoUnidade?: string;
  franqueadaId?: string;
  tipoAcesso?: "Franqueadora" | "Franqueada" | string;
  isFranqueadora?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = () => {};

    const setup = async () => {
      try {
        const { auth, db } = await initFirebase();

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            const isSuperAdminEmail = firebaseUser.email?.toLowerCase() === "wegbusinessandsolutions@gmail.com";
            try {
              // Fetch profile doc
              const docRef = doc(db, "users", firebaseUser.uid);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                if (isSuperAdminEmail && data.role !== "Administrador" && data.role !== "admin") {
                  data.role = "Administrador";
                }
                setProfile(data);
              } else {
                // Default profile if not explicitly set
                const newProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || "",
                  displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Usuário",
                  role: isSuperAdminEmail ? "Administrador" : "Cliente",
                  level: "Bronze",
                  cashbackBalance: 0,
                };
                try {
                  const { setDoc } = await import("firebase/firestore");
                  await setDoc(docRef, newProfile);
                } catch (e) {
                  console.warn("Could not save initial user profile to Firestore:", e);
                }
                setProfile(newProfile);
              }
            } catch (err) {
              console.error("Error fetching user profile inside onAuthStateChanged:", err);
              // Fallback profile in case of network or permissions error so the app continues functioning
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email || "",
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Usuário",
                role: isSuperAdminEmail ? "Administrador" : "Cliente",
                level: "Bronze",
                cashbackBalance: 0,
              });
            }
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error("Auth context setup error", err);
        setLoading(false);
      }
    };

    setup();
    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const { initFirebase } = await import("../lib/firebase");
      const { db } = await initFirebase();
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
