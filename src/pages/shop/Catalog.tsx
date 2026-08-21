import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Book, Search, ShoppingCart, Check, Heart, X, Sparkles, Loader2 } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { isStaffRole } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import OptimizedImage from "../../components/ui/OptimizedImage";

interface Categoria {
  id: string;
  nome: string;
}

export default function Catalog() {
  const { user, profile } = useAuth();
  const { addToCart } = useCart();
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("categoria") || "Todos");
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([{ id: "Todos", nome: "Todos" }]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isSemanticSearchMode, setIsSemanticSearchMode] = useState(false);
  const [semanticMatchingIds, setSemanticMatchingIds] = useState<string[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

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
    const fetchData = async () => {
      try {
        const catSnap = await getDocs(collection(db, "categorias_produtos"));
        const cats = catSnap.docs.map((doc) => ({
          id: doc.id,
          nome: doc.data().nome || ""
        })).filter((c) => c.nome);
        setCategories([{ id: "Todos", nome: "Todos" }, ...cats]);

        const prodQuery = query(collection(db, "produtos"), where("ativo", "==", true));
        const prodSnap = await getDocs(prodQuery);
        const prods = prodSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProducts(prods);
      } catch (err) {
        console.error("Error fetching catalog data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const cat = searchParams.get("categoria");
    if (cat) {
      // Find the category to verify if it exists by ID or name
      const found = categories.find(c => c.id === cat || c.nome === cat);
      if (found) {
        setSelectedCategory(found.id);
      } else {
        setSelectedCategory(cat);
      }
    } else {
      setSelectedCategory("Todos");
    }
    
    const search = searchParams.get("search");
    if (search !== null && search !== searchTerm) {
      setSearchTerm(search);
    }
  }, [searchParams, categories]);

  // Debounce syncing local search term to URL searchParams to prevent typing lag or cursor jumps
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentUrlSearch = searchParams.get("search") || "";
      if (searchTerm !== currentUrlSearch) {
        const newParams = new URLSearchParams(searchParams);
        if (searchTerm) {
          newParams.set("search", searchTerm);
        } else {
          newParams.delete("search");
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

  const handleCategorySelect = (cat: Categoria) => {
    setSelectedCategory(cat.id);
    const newParams = new URLSearchParams(searchParams);
    if (cat.id === "Todos") {
      newParams.delete("categoria");
    } else {
      newParams.set("categoria", cat.id);
    }
    setSearchParams(newParams);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsSemanticSearchMode(false);
  };

  const handleSemanticSearch = async () => {
    if (!searchTerm.trim()) {
      setIsSemanticSearchMode(false);
      setSemanticMatchingIds([]);
      return;
    }
    
    setIsSearchingSemantic(true);
    try {
      const minimalProducts = products.map(p => ({
        id: p.id,
        nome: p.nome || p.name,
        descricao: p.descricao || p.description,
        categorias: p.categorias || p.categoria || p.category
      }));
      
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm, products: minimalProducts })
      });
      
      if (!response.ok) throw new Error("Semantic search failed");
      
      const data = await response.json();
      setSemanticMatchingIds(data.matchingIds || []);
      setIsSemanticSearchMode(true);
    } catch (err) {
      console.error(err);
      setIsSemanticSearchMode(false);
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  const getPriceDisplay = (product: any) => {
    if (!profile) {
      return (
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">
            PREÇO
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate("/minha-conta");
            }}
            className="text-xs sm:text-sm font-bold text-[#0071e3] hover:underline leading-tight text-left cursor-pointer"
          >
            Faça login para ver
          </button>
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
    if (!price) return <span className="text-xs sm:text-sm font-bold text-slate-500">Sob consulta</span>;

    return (
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">
          PREÇO
        </span>
        <span className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 leading-none">
          R$ {Number(price).toFixed(2)}
        </span>
      </div>
    );
  };

  const getProductCountForCategory = (cat: Categoria) => {
    if (cat.id === "Todos") return products.length;
    return products.filter((product) => {
      let productCategories: string[] = [];
      if (Array.isArray(product.categorias) && product.categorias.length > 0) {
        productCategories = product.categorias.map(c => String(c).trim().toLowerCase());
      } else if (typeof product.categorias === "string" && product.categorias) {
        productCategories = [product.categorias.trim().toLowerCase()];
      } else if (product.categoria || product.category) {
        productCategories = [String(product.categoria || product.category).trim().toLowerCase()];
      } else {
        productCategories = ["geral"];
      }
      
      const prodCatId = String(product.categoriaId || product.categoria_id || "").trim().toLowerCase();
      const catIdLower = cat.id.toLowerCase();
      const catNameLower = cat.nome.toLowerCase();

      return prodCatId === catIdLower || 
             prodCatId === catNameLower || 
             productCategories.some(c => c === catIdLower || c === catNameLower);
    }).length;
  };

  const filteredProducts = products.filter((product) => {
    // If showFavoritesOnly is true, only include favorited products
    if (showFavoritesOnly && !wishlistIds.includes(product.id)) {
      return false;
    }

    if (isSemanticSearchMode) {
       return semanticMatchingIds.includes(product.id);
    }

    const productName = (product.nome || product.name || "").toLowerCase();
    const productDesc = (product.descricao || product.description || "").toLowerCase();
    const productSku = (product.sku || product.codigo || "").toLowerCase();
    
    // Split search input into individual words for advanced matching
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    
    let productCategories: string[] = [];
    if (Array.isArray(product.categorias) && product.categorias.length > 0) {
      productCategories = product.categorias.map(c => String(c).trim().toLowerCase());
    } else if (typeof product.categorias === "string" && product.categorias) {
      productCategories = [product.categorias.trim().toLowerCase()];
    } else if (product.categoria || product.category) {
      productCategories = [String(product.categoria || product.category).trim().toLowerCase()];
    } else {
      productCategories = ["geral"];
    }

    const matchesSearch = searchWords.every(word => {
      return productName.includes(word) ||
             productDesc.includes(word) ||
             productSku.includes(word) ||
             productCategories.some(cat => cat.includes(word));
    });

    const targetCategory = String(selectedCategory).trim().toLowerCase();
    
    // Find the currently selected category object to know both its ID and its name
    const selCatObj = categories.find(c => c.id.toLowerCase() === targetCategory || c.nome.toLowerCase() === targetCategory);
    const targetCatId = selCatObj ? selCatObj.id.toLowerCase() : targetCategory;
    const targetCatName = selCatObj ? selCatObj.nome.toLowerCase() : targetCategory;

    let matchesCategory = targetCatId === "todos" || targetCatName === "todos";

    if (!matchesCategory) {
      // 1. Check direct categoriaId or categoria_id field on product
      const prodCatId = String(product.categoriaId || product.categoria_id || "").trim().toLowerCase();
      if (prodCatId && (prodCatId === targetCatId || prodCatId === targetCatName)) {
        matchesCategory = true;
      }
      
      // 2. Check product's categories/categoria list
      if (!matchesCategory) {
        const matchesNameOrId = productCategories.some(cat => {
          const cClean = cat.trim().toLowerCase();
          return cClean === targetCatId || cClean === targetCatName;
        });
        if (matchesNameOrId) {
          matchesCategory = true;
        }
      }
    }
    
    return matchesSearch && matchesCategory;
  });

  const getProductPrice = (product: any) => {
    let price: any = null;
    const userLevel = profile?.level;
    
    switch (userLevel) {
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
    return price ? Number(price) : 0;
  };

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (isSemanticSearchMode && sortBy === "name-asc") {
       return semanticMatchingIds.indexOf(a.id) - semanticMatchingIds.indexOf(b.id);
    }
    
    if (sortBy === "price-asc") {
      return getProductPrice(a) - getProductPrice(b);
    } else if (sortBy === "price-desc") {
      return getProductPrice(b) - getProductPrice(a);
    } else if (sortBy === "name-asc") {
      const nameA = (a.nome || a.name || "").toLowerCase();
      const nameB = (b.nome || b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Category Navigation Bar (Visible Grid for Mobile & Tablet) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs lg:hidden space-y-3">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Book size={16} className="text-[#0071e3]" />
            <span className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Categorias de Produtos ({categories.length})
            </span>
          </div>
          <Link
            to="/carrinho"
            className="inline-flex items-center gap-1.5 bg-[#0071e3] hover:bg-[#005bb5] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
          >
            <ShoppingCart size={14} />
            <span>Ver Carrinho</span>
          </Link>
        </div>

        {/* Fully visible open grid of categories (No hidden scrolling) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
          {/* Option for All Categories */}
          <button
            onClick={() => handleCategorySelect({ id: "", nome: "Todos os Produtos" })}
            className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
              !selectedCategory
                ? "bg-[#0071e3] text-white border-[#0071e3] shadow-xs"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
            }`}
          >
            <span className="truncate">Todos os Produtos</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 shrink-0 ${
                !selectedCategory ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {products.length}
            </span>
          </button>

          {/* All 6 Category Cards */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id || selectedCategory === cat.nome;
            const count = getProductCountForCategory(cat);
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all border text-left cursor-pointer ${
                  isSelected
                    ? "bg-[#0071e3] text-white border-[#0071e3] shadow-xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                }`}
              >
                <span className="truncate" title={cat.nome}>{cat.nome}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 shrink-0 ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sleek Top Search Section */}
      <div 
        id="top-search-banner"
        className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden shadow-xs"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#0071e3_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.02]" />
        
        <div className="max-w-2xl w-full space-y-2 relative z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            O que você está procurando hoje?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Digite o nome, código ou descrição de qualquer produto para buscar rapidamente no catálogo.
          </p>
          
          <div className="relative mt-2 shadow-xs rounded-2xl flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                id="top-catalog-search-input"
                placeholder="Buscar produtos por nome ou semântica..."
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSemanticSearch();
                  }
                }}
                className={`w-full pl-12 pr-10 py-3 bg-slate-50 border rounded-2xl focus:bg-white focus:ring-4 outline-none text-sm sm:text-base transition-all text-slate-800 placeholder-slate-400 font-medium ${isSemanticSearchMode ? 'border-purple-300 focus:ring-purple-500/10 focus:border-purple-500 bg-purple-50/30' : 'border-slate-200 focus:ring-[#0071e3]/10 focus:border-[#0071e3]'}`}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setIsSemanticSearchMode(false);
                    setSemanticMatchingIds([]);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100 cursor-pointer flex items-center justify-center"
                  title="Limpar busca"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              onClick={handleSemanticSearch}
              disabled={!searchTerm.trim() || isSearchingSemantic}
              className={`shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${
                isSemanticSearchMode 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border border-purple-700' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Busca por Inteligência Artificial (Semântica)"
            >
              {isSearchingSemantic ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} className={isSemanticSearchMode ? 'text-white' : 'text-purple-600'} />}
              <span className="hidden sm:inline">{isSemanticSearchMode ? 'Busca IA Ativa' : 'Busca IA'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Sidebar (Menu Lateral) + Products Column */}
      <div className="flex flex-col lg:flex-row gap-8 mt-2">
        {/* Sidebar Lateral Menu (Desktop Only) */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs h-fit sticky top-20">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Categorias
            </h3>
            <div className="flex flex-col gap-1">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.id || selectedCategory === cat.nome;
                const count = getProductCountForCategory(cat);
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left group ${
                      isSelected
                        ? "bg-[#0071e3]/10 text-[#0071e3]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span>{cat.nome}</span>
                    <span 
                      className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                        isSelected 
                          ? "bg-[#0071e3] text-white" 
                          : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Book size={18} className="text-slate-600 sm:w-5 sm:h-5" />
                Catálogo de Produtos
              </h1>
              <p className="text-[11px] sm:text-sm text-slate-500 mt-0.5">Valores exclusivos conforme seu plano.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
              {user && (
                <button
                  id="wishlist-filter-btn"
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none ${
                    showFavoritesOnly
                      ? "bg-red-50 border-red-200 text-red-600 shadow-2xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Heart size={14} className={showFavoritesOnly ? "fill-red-500 text-red-500" : ""} />
                  <span className="inline">Favoritos</span>
                  {wishlistIds.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      showFavoritesOnly ? "bg-red-500 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {wishlistIds.length}
                    </span>
                  )}
                </button>
              )}
              <div className="relative w-full sm:w-44">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  id="sort-dropdown"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-[#0071e3]/20 focus:border-[#0071e3] outline-none text-xs sm:text-sm transition-all font-medium text-slate-700 cursor-pointer appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.6rem center',
                    backgroundSize: '1.1em'
                  }}
                >
                  <option value="name-asc">Nome (A-Z)</option>
                  <option value="price-asc">Preço: Menor p/ Maior</option>
                  <option value="price-desc">Preço: Maior p/ Menor</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6 animate-pulse">
               {[1,2,3,4,5,6].map(i => <div key={i} className="bg-white h-52 sm:h-80 rounded-xl sm:rounded-2xl"></div>)}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center shadow-sm border border-slate-100">
              <p className="text-slate-500">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
              {sortedProducts.map((product) => (
                <div
                  key={product.id}
                  id={`product-card-${product.id}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button") || target.closest("a") || target.closest("input")) {
                      return;
                    }
                    navigate(`/produto/${product.id}`);
                  }}
                  className="group bg-white rounded-xl sm:rounded-2xl shadow-sm hover:shadow-lg hover:scale-[1.02] border border-slate-100 overflow-hidden transition-all duration-300 flex flex-col cursor-pointer"
                >
                  <div className="aspect-square bg-slate-50 relative overflow-hidden flex items-center justify-center">
                    <OptimizedImage
                      src={product.imagemPrincipal || product.imageUrl}
                      alt={product.nome || product.name}
                      className="group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    {/* Heart button overlay */}
                    <button
                      id={`wishlist-btn-${product.id}`}
                      onClick={(e) => toggleFavorite(e, product.id)}
                      className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-md active:scale-90 hover:scale-105 transition-all cursor-pointer border border-slate-100"
                      title={wishlistIds.includes(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Heart
                        size={15}
                        className={`transition-colors duration-200 ${
                          wishlistIds.includes(product.id)
                            ? "fill-red-500 text-red-500"
                            : "text-slate-400 group-hover:text-red-500"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="p-3 sm:p-5 flex flex-col flex-1">
                    <p className="text-[10px] sm:text-xs font-bold text-[#0071e3] mb-1 sm:mb-2 uppercase tracking-wider leading-none">
                      {product.categorias?.length ? product.categorias[0] : (product.categoria || "Geral")}
                    </p>
                    <h3 className="text-slate-900 text-xs sm:text-base font-bold mb-2 group-hover:text-[#0071e3] transition-colors line-clamp-2 leading-snug">
                      {product.nome}
                    </h3>
                    <div className="mt-auto flex flex-col gap-2.5 sm:gap-3">
                      {profile && (
                        <div className="flex items-center justify-between border border-slate-100 bg-slate-50/90 rounded-lg sm:rounded-xl p-1 sm:p-1.5">
                          <span className="text-[10px] sm:text-xs font-bold text-slate-600 pl-1.5 uppercase tracking-wider">Qtd:</span>
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuantities(prev => ({
                                  ...prev,
                                  [product.id]: Math.max(1, (prev[product.id] || 1) - 1)
                                }));
                              }}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center bg-white text-slate-700 hover:text-slate-900 font-black border border-slate-200 shadow-2xs active:scale-90 transition-all text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 sm:w-7 text-center font-bold text-slate-900 text-xs sm:text-sm">
                              {quantities[product.id] || 1}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setQuantities(prev => ({
                                  ...prev,
                                  [product.id]: (prev[product.id] || 1) + 1
                                }));
                              }}
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center bg-white text-slate-700 hover:text-slate-900 font-black border border-slate-200 shadow-2xs active:scale-90 transition-all text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        {getPriceDisplay(product)}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!profile) {
                              navigate("/minha-conta");
                              return;
                            }
                            if (isStaffRole(profile?.role)) {
                              alert("Apenas clientes podem realizar compras no aplicativo.");
                              return;
                            }
                            const qty = quantities[product.id] || 1;
                            addToCart(product, qty);
                            setAddedItems((prev) => ({ ...prev, [product.id]: true }));
                            setTimeout(() => {
                              setAddedItems((prev) => ({ ...prev, [product.id]: false }));
                            }, 2000);
                          }}
                          className={`h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-95 duration-200 shadow-xs ${
                            addedItems[product.id]
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-[#0071e3] hover:text-white group-hover:bg-[#0071e3] group-hover:text-white"
                          }`}
                          title={addedItems[product.id] ? "Adicionado ao Carrinho!" : "Adicionar ao carrinho"}
                        >
                          {addedItems[product.id] ? (
                            <Check size={16} className="sm:w-[20px] sm:h-[20px]" />
                          ) : (
                            <ShoppingCart size={16} className="sm:w-[20px] sm:h-[20px]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
