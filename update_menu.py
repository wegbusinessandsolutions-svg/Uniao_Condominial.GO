import sys

with open('src/components/layouts/CustomerLayout.tsx', 'r') as f:
    content = f.read()

target = """        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 focus:outline-none transition-colors relative group cursor-pointer"
          aria-label="Toggle Menu"
        >
          <div className="absolute inset-0 rounded-full border border-dashed border-[#0071e3] animate-[spin_3s_linear_infinite] opacity-60 scale-[1.15]"></div>
          <Menu size={24} className="relative z-10" />
        </button>"""

replacement = """        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -ml-2 text-[#0071e3] hover:text-[#005bb5] focus:outline-none transition-colors relative group cursor-pointer animate-blink-3s"
          aria-label="Toggle Menu"
        >
          <Menu size={26} />
        </button>"""

if target in content:
    content = content.replace(target, replacement)
    with open('src/components/layouts/CustomerLayout.tsx', 'w') as f:
        f.write(content)
    print("Success CustomerLayout")
else:
    print("Target not found CustomerLayout")
