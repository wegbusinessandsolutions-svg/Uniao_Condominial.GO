import sys

with open('src/components/layouts/CustomerLayout.tsx', 'r') as f:
    content = f.read()

target_mobile = """        <div className="w-10"></div>"""
replacement_mobile = """        <div className="w-12 flex items-center justify-end">
          {totalItems > 0 && (
            <button
              onClick={() => navigate("/carrinho")}
              className="relative p-2 text-[#0071e3] hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
              title="Ir para o carrinho"
            >
              <ShoppingCart size={22} />
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">
                {totalItems}
              </span>
            </button>
          )}
        </div>"""

if target_mobile in content:
    content = content.replace(target_mobile, replacement_mobile)

target_floating = """        {/* Floating Cart Indicator */}
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
        )}"""

replacement_floating = """        {/* Floating Cart Indicator (Desktop) */}
        {totalItems > 0 && (
          <div className="hidden md:block fixed top-6 right-6 z-50">
            <button
              onClick={() => navigate("/carrinho")}
              className="bg-[#0071e3] hover:bg-[#005bb5] text-white p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center relative cursor-pointer"
              title="Ir para o carrinho"
            >
              <ShoppingCart size={24} />
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm border border-white">
                {totalItems}
              </span>
            </button>
          </div>
        )}"""

if target_floating in content:
    content = content.replace(target_floating, replacement_floating)

with open('src/components/layouts/CustomerLayout.tsx', 'w') as f:
    f.write(content)
print("Success")
