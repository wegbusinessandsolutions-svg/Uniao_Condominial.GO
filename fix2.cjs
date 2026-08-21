const fs = require('fs');
let code = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');
const toReplace2 = `      {/* Modal de Visualização (Ver Detalhes) */}
      {viewAfiliado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Detalhes da Afiliação</h3>
                  <p className="text-xs text-slate-500">{viewAfiliado.nomeCondominio}</p>
                </div>
              </div>
              <button
                onClick={() => setViewAfiliado(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Atual</label>
                  <div className="font-semibold text-slate-900">
                    <span className={\`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold \${
                        getAffiliateStatus(viewAfiliado) === "Ativo" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        getAffiliateStatus(viewAfiliado) === "Pendente - Financeiro" ? "bg-red-50 text-red-700 border border-red-200" :
                        getAffiliateStatus(viewAfiliado) === "Inativo" ? "bg-slate-100 text-slate-700 border border-slate-300" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }\`}>
                      {getAffiliateStatus(viewAfiliado)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data de Ativação</label>
                  <div className="font-semibold text-slate-900">
                    {viewAfiliado.dataAtivacao ? new Date(viewAfiliado.dataAtivacao).toLocaleDateString("pt-BR") : "Pendente"}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-2 text-sm uppercase">Dados do Condomínio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <span className="block text-xs text-slate-500 font-semibold mb-0.5">Nome do Condomínio</span>
                    <span className="font-medium text-slate-900">{viewAfiliado.nomeCondominio || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-semibold mb-0.5">CNPJ</span>
                    <span className="font-medium text-slate-900">{viewAfiliado.cnpj || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-semibold mb-0.5">Síndico/Administrador</span>
                    <span className="font-medium text-slate-900">{viewAfiliado.nomeSindico || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 font-semibold mb-0.5">Telefone</span>
                    <span className="font-medium text-slate-900">{viewAfiliado.telefone || "Não informado"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-xs text-slate-500 font-semibold mb-0.5">E-mail</span>
                    <span className="font-medium text-slate-900">{viewAfiliado.email || viewAfiliado.clienteEmail || "Não informado"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 space-y-3">
                <h4 className="font-bold text-sky-900 border-b border-sky-200 pb-2 mb-2 text-sm uppercase">Dados do Contrato</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  <div>
                    <span className="block text-xs text-sky-700 font-semibold mb-0.5">Unidades Habitacionais</span>
                    <span className="font-medium text-sky-900">{viewAfiliado.unidadesHabitacionais || "0"} unidades</span>
                  </div>
                  <div>
                    <span className="block text-xs text-sky-700 font-semibold mb-0.5">Valor da Mensalidade</span>
                    <span className="font-bold text-emerald-600 text-base">R$ {Number(viewAfiliado.valorMensalidade || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-sky-700 font-semibold mb-0.5">Dia de Vencimento</span>
                    <span className="font-medium text-sky-900">Dia {viewAfiliado.diaVencimento || "10"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setViewAfiliado(null)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Fechar
              </button>
              <button
                onClick={() => handleImprimirAfiliado(viewAfiliado)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
              >
                <Printer size={16} />
                <span>Imprimir Ficha</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}`;

const replaceWith2 = `
    </div>
  );
}`;

if (code.split(toReplace2).length > 2) {
    let lastIndex = code.lastIndexOf(toReplace2);
    code = code.substring(0, lastIndex) + replaceWith2;
    fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', code, 'utf8');
    console.log("Fixed part 2");
}

