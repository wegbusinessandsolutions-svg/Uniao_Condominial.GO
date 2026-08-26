const fs = require('fs');

const original = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

// Change component name
let newFile = original.replace(/export default function MeusDados\(\) \{/g, 'export default function Afiliacao() {');

// We need to keep all states and functions because they are intertwined, except we remove the non-affiliation ones if they cause unused vars.
// But it's easier to just strip out the JSX part of MeusDados (the edit form and initial cards) and keep ONLY the affiliation JSX.

const startOfReturn = newFile.indexOf('  return (\n');
if (startOfReturn !== -1) {
  const jsxBeforeAfiliacaoStart = newFile.indexOf('{/* Form Section to become affiliated */}', startOfReturn);
  
  if (jsxBeforeAfiliacaoStart !== -1) {
    const afiliacaoSectionEnd = newFile.indexOf('{/* Modals */}');
    const modalsSection = newFile.substring(afiliacaoSectionEnd);
    
    // the JSX we want is between jsxBeforeAfiliacaoStart and afiliacaoSectionEnd
    const affiliationJSX = newFile.substring(jsxBeforeAfiliacaoStart, afiliacaoSectionEnd);
    
    const newJSX = `  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-[#0071e3] rounded-lg">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Afiliado - União Condominial</h2>
              <p className="text-sm text-slate-500">Gerencie sua afiliação e benefícios exclusivos</p>
            </div>
          </div>
          
          ` + affiliationJSX + `
        </div>
      </div>
      
      ` + modalsSection;
      
    newFile = newFile.substring(0, startOfReturn) + newJSX;
  }
}

fs.writeFileSync('src/pages/cliente/Afiliacao.tsx', newFile);
