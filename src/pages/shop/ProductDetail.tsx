import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, ShieldCheck, Truck, Check, Heart } from "lucide-react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import OptimizedImage from "../../components/ui/OptimizedImage";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [isAdded, setIsAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  // Load wishlist from firestore
  useEffect(() => {
    if (!user?.uid) {
      setWishlistIds([]);
      return;
    }
    const fetchWishlist = async () => {
      try {
        const q = collection(db, "users", user.uid, "wishlist");
        const snap = await getDocs(q);
        const ids = snap.docs.map(doc => doc.id);
        setWishlistIds(ids);
      } catch (err) {
        console.error("Error fetching wishlist:", err);
      }
    };
    fetchWishlist();
  }, [user?.uid]);

  const toggleFavorite = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.uid) {
      alert("Por favor, faça login para favoritar produtos.");
      return;
    }

    const isFav = wishlistIds.includes(productId);
    const { doc, setDoc, deleteDoc } = await import("firebase/firestore");
    const favDocRef = doc(db, "users", user.uid, "wishlist", productId);

    if (isFav) {
      try {
        await deleteDoc(favDocRef);
        setWishlistIds(prev => prev.filter(id => id !== productId));
      } catch (err) {
        console.error("Error removing from wishlist:", err);
      }
    } else {
      try {
        await setDoc(favDocRef, {
          id: productId,
          addedAt: new Date().toISOString()
        });
        setWishlistIds(prev => [...prev, productId]);
      } catch (err) {
        console.error("Error adding to wishlist:", err);
      }
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "produtos", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-dark"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Produto não encontrado</h2>
        <Link to="/produtos" className="text-brand-dark hover:underline font-medium">
          Voltar para o catálogo
        </Link>
      </div>
    );
  }

  const getPriceSection = () => {
    if (!profile) {
      return (
        <div className="mb-8 bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-2xs">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">PREÇO EXCLUSIVO</p>
          <div className="space-y-4">
            <Link
              to="/minha-conta"
              className="text-xl sm:text-2xl font-bold text-[#0071e3] hover:underline cursor-pointer block"
            >
              Faça login para visualizar o preço
            </Link>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Preços diferenciados por nível de condomínio visíveis apenas para clientes cadastrados.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/minha-conta"
                className="bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold text-base px-6 py-3 rounded-2xl shadow-sm hover:shadow transition-all text-center"
              >
                Fazer Login
              </Link>
              <Link
                to="/minha-conta?signup=true"
                className="bg-white hover:bg-slate-50 text-[#0071e3] border border-slate-200 font-bold text-base px-6 py-3 rounded-2xl shadow-sm hover:shadow transition-all text-center"
              >
                Cadastrar-se
              </Link>
            </div>
          </div>
        </div>
      );
    }

    let price = 0;
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

    if (!price) {
      return (
        <div className="mb-8 bg-slate-50 rounded-3xl p-6 border border-slate-100">
          <p className="text-xl font-bold text-slate-900">Preço sob consulta</p>
        </div>
      );
    }

    return (
      <div className="mb-8 bg-[#0071e3]/5 rounded-3xl p-6 sm:p-8 border border-[#0071e3]/20 shadow-2xs">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1.5">
          PREÇO ({profile.level})
        </p>
        <div className="flex items-end gap-3">
          <span className="text-3xl sm:text-5xl font-black text-slate-900">
            R$ {Number(price).toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Link to="/produtos" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors font-semibold text-sm sm:text-base">
        <ArrowLeft size={18} /> Voltar ao catálogo
      </Link>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Product Image */}
          <div className="bg-slate-50 aspect-square md:aspect-auto flex items-center justify-center relative p-8 sm:p-12">
            <OptimizedImage
              src={product.imagemPrincipal || product.imageUrl}
              alt={product.nome || product.name}
              className="max-w-full max-h-full object-contain rounded-2xl shadow-lg mix-blend-multiply"
            />
          </div>

          {/* Product Info */}
          <div className="p-8 md:p-12 flex flex-col">
            <div className="mb-8">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0071e3] mb-3 block">
                {product.categorias?.length ? product.categorias[0] : (product.categoria || "Geral")}
              </span>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
                {product.nome || product.name}
              </h1>
              <p className="text-slate-500 text-sm sm:text-base font-medium">SKU: {product.sku || "N/A"}</p>
            </div>

            <div className="mb-8">
              <p className="text-slate-700 leading-relaxed text-base sm:text-lg whitespace-pre-wrap text-justify">
                {product.descricao || "Sem descrição."}
              </p>
            </div>

            {getPriceSection()}

            <div className="mt-auto space-y-5">
              {profile && (
                <div className="flex flex-col gap-2.5 bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">
                    Quantidade Desejada
                  </span>
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white h-12 w-36 justify-between shadow-2xs">
                    <button
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-4 h-full text-slate-600 hover:text-slate-900 font-black hover:bg-slate-50 transition-colors text-lg cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-bold text-slate-900 text-lg">{quantity}</span>
                    <button
                      onClick={() => setQuantity(q => q + 1)}
                      className="px-4 h-full text-slate-600 hover:text-slate-900 font-black hover:bg-slate-50 transition-colors text-lg cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (!profile) {
                      navigate("/minha-conta");
                      return;
                    }
                    if (isStaffRole(profile?.role)) {
                      alert("Apenas clientes podem realizar compras no aplicativo.");
                      return;
                    }
                    addToCart(product, quantity);
                    setIsAdded(true);
                    setTimeout(() => setIsAdded(false), 2000);
                  }}
                  className={`flex-1 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-3 text-base sm:text-lg transition-all active:scale-98 duration-200 shadow-md hover:shadow-lg ${
                    isAdded
                      ? "bg-emerald-600 text-white"
                      : "bg-[#0071e3] hover:bg-[#005bb5] text-white"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check size={22} />
                      Adicionado ao Carrinho!
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={22} />
                      Adicionar ao Carrinho
                    </>
                  )}
                </button>
                
                <button
                  onClick={(e) => toggleFavorite(e, product.id)}
                  className="px-5 py-4 rounded-2xl border border-slate-200 hover:border-red-200 hover:bg-red-50/30 flex items-center justify-center transition-all cursor-pointer group active:scale-95 shadow-2xs shrink-0 select-none"
                  title={wishlistIds.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                >
                  <Heart
                    size={22}
                    className={`transition-colors duration-200 ${
                      wishlistIds.includes(product.id)
                        ? "fill-red-500 text-red-500"
                        : "text-slate-400 group-hover:text-red-500"
                    }`}
                  />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 text-sm sm:text-base text-slate-700 font-medium">
                  <Truck size={22} className="text-[#0071e3] shrink-0" />
                  <span>Entrega rápida para Grande Goiânia</span>
                </div>
                <div className="flex items-center gap-3 text-sm sm:text-base text-slate-700 font-medium">
                  <ShieldCheck size={22} className="text-[#0071e3] shrink-0" />
                  <span>Garantia de Qualidade</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
