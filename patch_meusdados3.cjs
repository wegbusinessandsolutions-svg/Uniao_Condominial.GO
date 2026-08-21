const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

// Update imports
if (!content.includes('HeartHandshake')) {
  content = content.replace('import { User, Building2, Check, CheckCircle } from "lucide-react";', 'import { User, Building2, Check, CheckCircle, HeartHandshake } from "lucide-react";');
}

// Fix the checkbox label
const oldLabel = `<label className="flex items-center gap-3 cursor-pointer group">
                  <div className={\`w-6 h-6 rounded border flex items-center justify-center transition-colors \${queroAfiliar ? "bg-[#0071e3] border-[#0071e3]" : "bg-white border-slate-300 group-hover:border-[#0071e3]"}\`}>
                    {queroAfiliar && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-bold text-slate-900 text-lg">Quero Afiliar o Meu Condomínio à União Condominial</span>
                </label>`;

const newLabel = `<label className="flex items-center gap-3 cursor-pointer group" onClick={() => setQueroAfiliar(!queroAfiliar)}>
                  <div className={\`w-6 h-6 rounded border flex items-center justify-center transition-colors \${queroAfiliar ? "bg-[#0071e3] border-[#0071e3]" : "bg-white border-slate-300 group-hover:border-[#0071e3]"}\`}>
                    {queroAfiliar && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <HeartHandshake className="text-[#0071e3] w-6 h-6" />
                    <span className="font-bold text-slate-900 text-lg">Quero afiliar meu Condomínio à União Condominial</span>
                  </div>
                </label>`;

content = content.replace(oldLabel, newLabel);

fs.writeFileSync('src/pages/cliente/MeusDados.tsx', content);
