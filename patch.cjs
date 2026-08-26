const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/Franqueadora.tsx', 'utf8');

file = file.replace('interface FranqueadoraData {', 'interface FranqueadoraData {\n  numeroFranqueada: string;');
file = file.replace('const emptyFranqueadora: FranqueadoraData = {', 'const emptyFranqueadora: FranqueadoraData = {\n  numeroFranqueada: "",');
file = file.replace('Dados da Franqueadora', 'Empresas Franqueadas');
file = file.replace('Configurações e informações legais da sua franqueadora.', 'Gestão e cadastro de empresas franqueadas para controle de royalties.');
file = file.replace('Nova Franqueadora', 'Nova Empresa Franqueada');
file = file.replace('Nova Franqueadora', 'Nova Empresa Franqueada');
file = file.replace('Editar Franqueadora', 'Editar Empresa Franqueada');
file = file.replace('Ficha da Franqueadora', 'Ficha da Empresa Franqueada');
file = file.replace('Configuração da Franqueadora', 'Configuração da Empresa Franqueada');
file = file.replace('Logo da Franqueadora', 'Logo da Empresa Franqueada');
file = file.replace('Relatório da Franqueadora', 'Relatório da Empresa Franqueada');

const basicTabContent = `
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Razão Social *
                      </label>
`;

const replaceContent = `
                    <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="sm:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Nº da Franqueada (3 dígitos) *
                        </label>
                        <input
                          type="text"
                          name="numeroFranqueada"
                          required
                          maxLength={3}
                          value={formData.numeroFranqueada}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\\D/g, '').substring(0, 3);
                            handleChange({
                              ...e,
                              target: {
                                ...e.target,
                                name: "numeroFranqueada",
                                value: val
                              }
                            } as any);
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm text-center font-bold"
                          placeholder="Ex: 001"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Razão Social *
                        </label>
                        <input
                          type="text"
                          name="razaoSocial"
                          required
                          value={formData.razaoSocial}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-brand-dark focus:border-brand-dark sm:text-sm"
                        />
                      </div>
                    </div>
`;

// There is only one Razao Social block under Básico tab.
file = file.replace(
  /<div className="col-span-1 md:col-span-2">\s*<label className="block text-sm font-medium text-slate-700 mb-1\.5">\s*Razão Social \*\s*<\/label>\s*<input[^>]+name="razaoSocial"[^>]+>\s*<\/div>/, 
  replaceContent
);

fs.writeFileSync('src/pages/admin/Franqueadora.tsx', file);
