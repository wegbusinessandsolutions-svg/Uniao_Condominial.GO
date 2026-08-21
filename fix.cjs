const fs = require('fs');
let code = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');

// I will just find the exact corrupted lines and replace them
const toReplace = `                        {statusComputado !== "Ativo" && (
                          <button
                            onClick={() => handleApprove(afiliado)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                            title="Ativar Afiliação"
                          >
                            <Check size={14} />
                            <span>Ativar Afiliação</span>
                          </button>
                        )}
                           {/* Modal de Visualização (Ver Detalhes) */}
      {viewAfiliado && (`;

const replaceWith = `                        {statusComputado !== "Ativo" && (
                          <button
                            onClick={() => handleApprove(afiliado)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                            title="Ativar Afiliação"
                          >
                            <Check size={14} />
                            <span>Ativar Afiliação</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Reenvio do Termo */}
      {modalAfiliado && (`;

const i1 = code.indexOf(toReplace);
if (i1 !== -1) {
    code = code.replace(toReplace, replaceWith);
    fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', code, 'utf8');
    console.log("Fixed part 1");
}

