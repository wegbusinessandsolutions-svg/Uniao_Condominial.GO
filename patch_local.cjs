const fs = require('fs');
const file = '/app/applet/src/pages/cliente/LocalEntrega.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<div className="p-6 md:p-8 flex flex-col gap-5 bg-white border-t border-slate-100">[\s\S]*?<\/div>\s*<\/div>\s*<div className="p-0 h-\[400px\] relative overflow-hidden bg-slate-50 z-0">/, `<div className="p-0 h-[400px] relative overflow-hidden bg-slate-50 z-0">`);

content = content.replace(/const \[endereco, setEndereco\] = useState\(profile\?\.endereco \|\| ""\);\n/g, "");
content = content.replace(/const \[endereco, setEndereco\] = useState\(""\);\n/g, "");
content = content.replace(/const \[numero, setNumero\] = useState\(""\);\n/g, "");
content = content.replace(/const \[complemento, setComplemento\] = useState\(""\);\n/g, "");
content = content.replace(/const \[bairro, setBairro\] = useState\(""\);\n/g, "");
content = content.replace(/const \[cidade, setCidade\] = useState\(""\);\n/g, "");
content = content.replace(/const \[estado, setEstado\] = useState\(""\);\n/g, "");
content = content.replace(/const \[cep, setCep\] = useState\(""\);\n/g, "");
content = content.replace(/const \[isSearchingCep, setIsSearchingCep\] = useState\(false\);\n/g, "");

content = content.replace(/useEffect\(\(\) => \{[\s\S]*?setCep\(profile\?\.cep \|\| ""\);[\s\S]*?\}\, \[profile\]\);\n/g, "");

content = content.replace(/const handleCepSearch = async \(\) => \{[\s\S]*?setIsSearchingCep\(false\);\n    \}\n  \};\n/g, "");

content = content.replace(/endereco,\n\s*numero,\n\s*complemento,\n\s*bairro,\n\s*cidade,\n\s*estado,\n\s*cep,\n/g, "");

fs.writeFileSync(file, content);
