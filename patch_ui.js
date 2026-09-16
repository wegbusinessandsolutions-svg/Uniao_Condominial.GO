const fs = require('fs');
const file = '/app/applet/src/pages/cliente/LocalEntrega.tsx';
let content = fs.readFileSync(file, 'utf8');

const uiBlock = `        <div className="p-6 md:p-8 flex flex-col gap-5 bg-white border-t border-slate-100">
          <h2 className="text-lg font-medium text-slate-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-500" />
            Endereço Completo
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4 space-y-1">
              <label className="text-sm font-medium text-slate-700">CEP</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  placeholder="00000-000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                />
                <button
                  type="button"
                  onClick={handleCepSearch}
                  disabled={isSearchingCep}
                  className="px-4 py-2.5 bg-slate-100 rounded-xl text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center shrink-0 disabled:opacity-50"
                  title="Buscar CEP"
                >
                  {isSearchingCep ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-600"></div>
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="sm:col-span-8 space-y-1">
              <label className="text-sm font-medium text-slate-700">Endereço (Rua/Avenida)</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua Exemplo"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
              />
            </div>
            
            <div className="sm:col-span-4 space-y-1">
              <label className="text-sm font-medium text-slate-700">Número</label>
              <input
                type="text"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="S/N"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
              />
            </div>
            
            <div className="sm:col-span-8 space-y-1">
              <label className="text-sm font-medium text-slate-700">Complemento / Bairro</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto 101"
                  className="w-1/2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                />
                <input
                  type="text"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Centro"
                  className="w-1/2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                />
              </div>
            </div>
            
            <div className="sm:col-span-8 space-y-1">
              <label className="text-sm font-medium text-slate-700">Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="São Paulo"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
              />
            </div>
            
            <div className="sm:col-span-4 space-y-1">
              <label className="text-sm font-medium text-slate-700">Estado (UF)</label>
              <input
                type="text"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                placeholder="SP"
                maxLength={2}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 uppercase"
              />
            </div>
          </div>
        </div>

        <div className="p-0 h-[400px] relative overflow-hidden bg-slate-50 z-0">`;

content = content.replace(
  /<div className="p-0 h-\[400px\] relative overflow-hidden bg-slate-50 z-0">/,
  uiBlock
);

fs.writeFileSync(file, content);
