import sys

with open('src/components/layouts/CustomerLayout.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace(
    'import { Home, FileText, User, ShoppingBag, MapPin, Package, Tag, Heart, CreditCard, LogOut, Book, Menu, Sun, Moon, Coins, MessageSquare, Headphones, Megaphone, Building2, BookUser, Calendar } from "lucide-react";',
    'import { Home, FileText, User, ShoppingBag, ShoppingCart, MapPin, Package, Tag, Heart, CreditCard, LogOut, Book, Menu, Sun, Moon, Coins, MessageSquare, Headphones, Megaphone, Building2, BookUser, Calendar } from "lucide-react";\nimport { useCart } from "../../context/CartContext";'
)

# Add useCart hook
content = content.replace(
    '  const [menuConfig, setMenuConfig] = useState<any>({});',
    '  const [menuConfig, setMenuConfig] = useState<any>({});\n  const { totalItems } = useCart();'
)

# Add floating cart button before </main>
cart_ui = """
        {/* Floating Cart Indicator */}
        {totalItems > 0 && (
          <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
            <button
              onClick={() => navigate("/carrinho")}
              className="bg-[#0071e3] hover:bg-[#005bb5] text-white p-3 md:p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center relative cursor-pointer"
              title="Ir para o carrinho"
            >
              <ShoppingCart size={22} />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] md:text-xs font-bold w-5 h-5 md:w-5 md:h-5 flex items-center justify-center rounded-full shadow-sm border border-white">
                {totalItems}
              </span>
            </button>
          </div>
        )}
"""

content = content.replace(
    '        {/* Abrir Menu (visible only on mobile) */}',
    cart_ui + '\n        {/* Abrir Menu (visible only on mobile) */}'
)

with open('src/components/layouts/CustomerLayout.tsx', 'w') as f:
    f.write(content)
print("Success")
