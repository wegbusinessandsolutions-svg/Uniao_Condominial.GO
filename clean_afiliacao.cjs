const fs = require('fs');

let file = fs.readFileSync('src/pages/cliente/Afiliacao.tsx', 'utf8');

// Change component name
file = file.replace(/export default function MeusDados\(\) \{/g, 'export default function Afiliacao() {');

// Remove non-affiliation state
file = file.replace(/const \[isEditing, setIsEditing\] = useState\(false\);\n/g, '');
file = file.replace(/const \[editForm, setEditForm\] = useState<any>\(\{\}\);\n/g, '');
file = file.replace(/const \[saving, setSaving\] = useState\(false\);\n/g, '');

// Remove non-affiliation useEffect and handleSave logic
file = file.replace(/useEffect\(\(\) => \{[\s\S]*?if \(profile\) \{[\s\S]*?setEditForm\([\s\S]*?\}\n  \}, \[profile\]\);/g, '');

file = file.replace(/const handleSave = async \(\) => \{[\s\S]*?setIsEditing\(false\);\n    \} catch \(error\) \{[\s\S]*?\}\n  \};/g, '');

// Clean up the returned JSX
const startOfReturn = file.indexOf('return (');
const firstSection = file.indexOf('<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">', startOfReturn);

const afiliacaoSectionStart = file.indexOf('{/* Form Section to become affiliated */}', firstSection);
const afiliacaoSectionEnd = file.indexOf('{/* Modals */}');

const header = `return (
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
`;

const footer = `
        </div>
      </div>
`;

let jsxReplacement = header + file.substring(afiliacaoSectionStart, afiliacaoSectionEnd) + footer + file.substring(afiliacaoSectionEnd);

file = file.substring(0, startOfReturn) + jsxReplacement;

fs.writeFileSync('src/pages/cliente/Afiliacao.tsx', file);
