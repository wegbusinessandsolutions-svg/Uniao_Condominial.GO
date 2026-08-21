import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, profile } = useAuth();
  
  // 1. Initial State: Read from localStorage first, fallback to "light"
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    return (stored === "dark" || stored === "light") ? stored : "light";
  });

  // 2. Synchronize theme with Firestore on mount or profile change
  useEffect(() => {
    if (profile && "theme" in profile && profile.theme) {
      const dbTheme = profile.theme as Theme;
      if (dbTheme === "light" || dbTheme === "dark") {
        setThemeState(dbTheme);
        localStorage.setItem("theme", dbTheme);
      }
    }
  }, [profile]);

  // 3. Apply class to documentElement whenever state changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Helper to save theme to Firestore DB
  const saveThemeToDb = async (newTheme: Theme) => {
    if (!user) return;
    try {
      const { initFirebase } = await import("../lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await initFirebase();
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { theme: newTheme });
    } catch (error) {
      console.error("Error saving theme preference to database:", error);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveThemeToDb(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
