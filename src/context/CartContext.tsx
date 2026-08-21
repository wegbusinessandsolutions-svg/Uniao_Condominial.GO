import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ShoppingCart, CheckCircle } from "lucide-react";
import { collection, doc, setDoc, deleteDoc, getDocs, query } from "firebase/firestore";
import { initFirebase } from "../lib/firebase";

export interface CartItem {
  id: string;
  nome: string;
  imagemPrincipal?: string;
  precoOriginal: number;
  precoAplicado: number;
  quantidade: number;
  categoria?: string;
  sku?: string;
}

export interface ToastMessage {
  id: string;
  nome: string;
  imagem?: string;
  quantidade: number;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, profile: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: profile?.uid || null,
      email: profile?.email || null,
      emailVerified: true, // as authenticated profile
      isAnonymous: false,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  addMultipleToCart: (items: { product: any; quantity: number }[]) => Promise<void>;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load cart from localStorage / Firestore on mount and when profile changes
  useEffect(() => {
    const loadCart = async () => {
      if (!profile) {
        const stored = localStorage.getItem("cart_guest");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              setCartItems(parsed);
            } else {
              setCartItems([]);
            }
          } catch (e) {
            setCartItems([]);
          }
        } else {
          setCartItems([]);
        }
        return;
      }

      try {
        const { db } = await initFirebase();
        const cartRef = collection(db, "users", profile.uid, "cart");
        
        // Fetch current Firestore items
        const q = query(cartRef);
        const snapshot = await getDocs(q);
        const firestoreItems: CartItem[] = [];
        snapshot.forEach((docSnap) => {
          firestoreItems.push(docSnap.data() as CartItem);
        });

        // Check if we have guest items to merge
        const guestStored = localStorage.getItem("cart_guest");
        let guestItems: CartItem[] = [];
        if (guestStored) {
          try {
            const parsed = JSON.parse(guestStored);
            if (Array.isArray(parsed)) {
              guestItems = parsed;
            }
          } catch (e) {
            console.error("Error parsing guest cart", e);
          }
        }

        let finalItems = [...firestoreItems];

        if (guestItems.length > 0) {
          for (const gItem of guestItems) {
            const existingIdx = finalItems.findIndex((item) => item.id === gItem.id);
            if (existingIdx > -1) {
              finalItems[existingIdx].quantidade = Number(finalItems[existingIdx].quantidade || 0) + Number(gItem.quantidade);
            } else {
              finalItems.push(gItem);
            }
          }

          // Write merged items to Firestore
          for (const item of finalItems) {
            await setDoc(doc(db, "users", profile.uid, "cart", item.id), item);
          }

          // Clear guest cart
          localStorage.removeItem("cart_guest");
        }

        setCartItems(finalItems);
        localStorage.setItem(`cart_${profile.uid}`, JSON.stringify(finalItems));
      } catch (err) {
        console.error("Error fetching cart from Firestore, using local fallback:", err);
        // Fallback to local storage
        const stored = localStorage.getItem(`cart_${profile.uid}`);
        if (stored) {
          try {
            setCartItems(JSON.parse(stored));
          } catch (e) {
            setCartItems([]);
          }
        } else {
          setCartItems([]);
        }
      }
    };

    loadCart();
  }, [profile]);

  // Save cart to localStorage whenever it changes
  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    const key = profile ? `cart_${profile.uid}` : "cart_guest";
    localStorage.setItem(key, JSON.stringify(items));
  };

  const getPriceForProduct = (product: any): number => {
    if (!profile) return Number(product.precoVenda) || 0;

    let price: any = 0;
    switch (profile.level) {
      case "Bronze":
        price = product.precoBronze;
        break;
      case "Prata":
        price = product.precoPrata;
        break;
      case "Ouro":
        price = product.precoOuro;
        break;
      case "Diamante":
        price = product.precoDiamante;
        break;
      default:
        price = product.precoVenda;
    }

    if (!price && product.precoVenda) price = product.precoVenda;
    return Number(price) || 0;
  };

  const addToCart = async (product: any, quantity = 1) => {
    const price = getPriceForProduct(product);
    const existingIndex = cartItems.findIndex((item) => item.id === product.id);

    let updated: CartItem[];
    let updatedItem: CartItem;

    if (existingIndex > -1) {
      updated = [...cartItems];
      const newQty = Number(updated[existingIndex].quantidade || 0) + Number(quantity);
      updated[existingIndex].quantidade = newQty;
      updated[existingIndex].precoAplicado = Number(price);
      updatedItem = updated[existingIndex];
    } else {
      updatedItem = {
        id: product.id,
        nome: product.nome || product.name || "Produto",
        imagemPrincipal: product.imagemPrincipal || product.imageUrl,
        precoOriginal: Number(product.precoVenda || price),
        precoAplicado: Number(price),
        quantidade: Number(quantity),
        categoria: product.categorias?.length ? product.categorias[0] : (product.categoria || "Geral"),
        sku: product.sku,
      };
      updated = [...cartItems, updatedItem];
    }

    saveCart(updated);

    // Sync with Firestore if logged in
    if (profile) {
      try {
        const { db } = await initFirebase();
        const itemRef = doc(db, "users", profile.uid, "cart", product.id);
        await setDoc(itemRef, {
          ...updatedItem,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}/cart/${product.id}`, profile);
      }
    }

    // Trigger toast confirmation
    const toastId = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      id: toastId,
      nome: product.nome || product.name || "Produto",
      imagem: product.imagemPrincipal || product.imageUrl,
      quantidade: Number(quantity),
    };
    setToasts((prev) => [...prev, newToast]);

    // Auto remove toast after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 4000);
  };

  const addMultipleToCart = async (itemsToAdd: { product: any; quantity: number }[]) => {
    let currentCart = [...cartItems];
    const newToasts: ToastMessage[] = [];

    const { db } = profile ? await initFirebase() : { db: null };

    for (const itemInfo of itemsToAdd) {
      const { product, quantity } = itemInfo;
      const price = getPriceForProduct(product);
      const existingIndex = currentCart.findIndex((item) => item.id === product.id);

      let updatedItem: CartItem;

      if (existingIndex > -1) {
        const newQty = Number(currentCart[existingIndex].quantidade || 0) + Number(quantity);
        currentCart[existingIndex].quantidade = newQty;
        currentCart[existingIndex].precoAplicado = Number(price);
        updatedItem = currentCart[existingIndex];
      } else {
        updatedItem = {
          id: product.id,
          nome: product.nome || product.name || "Produto",
          imagemPrincipal: product.imagemPrincipal || product.imageUrl,
          precoOriginal: Number(product.precoVenda || price),
          precoAplicado: Number(price),
          quantidade: Number(quantity),
          categoria: product.categorias?.length ? product.categorias[0] : (product.categoria || "Geral"),
          sku: product.sku,
        };
        currentCart.push(updatedItem);
      }

      // Sync with Firestore if logged in
      if (profile && db) {
        try {
          const itemRef = doc(db, "users", profile.uid, "cart", product.id);
          await setDoc(itemRef, {
            ...updatedItem,
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn(`Failed to sync item ${product.id} to Firestore`, err);
        }
      }

      // Prepare toast
      const toastId = Math.random().toString(36).substring(2, 9);
      newToasts.push({
        id: toastId,
        nome: product.nome || product.name || "Produto",
        imagem: product.imagemPrincipal || product.imageUrl,
        quantidade: Number(quantity),
      });
    }

    saveCart(currentCart);

    if (newToasts.length > 0) {
      // Trigger toasts (limit to showing at most 3 to not clutter the screen)
      const toastsToShow = newToasts.slice(0, 3);
      setToasts((prev) => [...prev, ...toastsToShow]);

      // Auto remove toasts after 4 seconds
      toastsToShow.forEach((toast) => {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 4000);
      });
    }
  };

  const removeFromCart = async (productId: string) => {
    const updated = cartItems.filter((item) => item.id !== productId);
    saveCart(updated);

    if (profile) {
      try {
        const { db } = await initFirebase();
        const itemRef = doc(db, "users", profile.uid, "cart", productId);
        await deleteDoc(itemRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${profile.uid}/cart/${productId}`, profile);
      }
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity < 1) return;
    const targetItem = cartItems.find((item) => item.id === productId);
    if (!targetItem) return;

    const updatedItem = { ...targetItem, quantidade: quantity };
    const updated = cartItems.map((item) =>
      item.id === productId ? updatedItem : item
    );
    saveCart(updated);

    if (profile) {
      try {
        const { db } = await initFirebase();
        const itemRef = doc(db, "users", profile.uid, "cart", productId);
        await setDoc(itemRef, {
          ...updatedItem,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${profile.uid}/cart/${productId}`, profile);
      }
    }
  };

  const clearCart = async () => {
    saveCart([]);

    if (profile) {
      try {
        const { db } = await initFirebase();
        const cartRef = collection(db, "users", profile.uid, "cart");
        const q = query(cartRef);
        const snapshot = await getDocs(q);
        const batchDeletes = snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
        await Promise.all(batchDeletes);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${profile.uid}/cart`, profile);
      }
    }
  };

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantidade, 0);
  const totalAmount = cartItems.reduce((acc, item) => acc + item.precoAplicado * item.quantidade, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        addMultipleToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
        toasts,
        removeToast,
      }}
    >
      {children}

      {/* Elegant Toast Notifications Container */}
      <div 
        id="toast-container"
        className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              id={`toast-${toast.id}`}
              initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.95, x: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="pointer-events-auto w-full bg-white border border-slate-100 rounded-2xl shadow-xl p-4 flex gap-3 items-center relative overflow-hidden"
            >
              {/* Top accent border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#0071e3]" />

              {/* Product Image */}
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {toast.imagem ? (
                  <img src={toast.imagem} alt={toast.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <ShoppingCart size={18} className="text-[#0071e3]" />
                )}
              </div>

              {/* Toast Text */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Adicionado!</span>
                </div>
                <p className="text-xs font-semibold text-slate-900 truncate leading-snug">{toast.nome}</p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Qtd: <span className="font-bold text-slate-800">{toast.quantidade}</span>
                </p>
              </div>

              {/* Toast Actions */}
              <div className="flex flex-col gap-2 items-end flex-shrink-0">
                <button 
                  onClick={() => removeToast(toast.id)}
                  id={`toast-close-${toast.id}`}
                  className="p-1 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                  title="Fechar"
                >
                  <X size={14} />
                </button>
                <Link 
                  to="/carrinho"
                  id={`toast-view-cart-${toast.id}`}
                  className="text-[10px] font-bold text-[#0071e3] hover:text-[#005bb5] bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  Ver Carrinho
                </Link>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </CartContext.Provider>
  );
};
