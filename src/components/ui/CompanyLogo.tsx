import React, { useEffect, useState } from "react";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";

export function CompanyLogo({ className }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string>("/uniao-condominial-logo.png"); // Default logo

  useEffect(() => {
    let isMounted = true;

    async function fetchLogo() {
      try {
        const { db } = await initFirebase();
        const q = query(collection(db, "config_empresa"), limit(1));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          if (data.logoUrl) {
            if (isMounted) setLogoUrl(data.logoUrl);
          }
        }
      } catch (error) {
        console.error("Error fetching company logo:", error);
      }
    }

    fetchLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <img 
      src={logoUrl} 
      alt="Logomarca da Empresa" 
      className={className || "w-auto h-32 object-contain"} 
    />
  );
}
