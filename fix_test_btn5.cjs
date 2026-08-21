const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

// First, remove the wrongly placed section inside testador
const wronglyPlacedRegex = /\{\/\* TESTE DE ENVIO SECTION \(INFERIOR\) \*\/\}([\s\S]*?)<\/div>\s*<\/div>/g;
content = content.replace(wronglyPlacedRegex, '');

// Now inject it at the end of 'activeTab === "provedor"'.
// The 'provedor' block ends before '{activeTab === "templates" && ('
const targetProvedorEnd = '              </motion.div>\n            )}\n\n            {activeTab === "templates" && (';

const theButtonBlock = `
                {/* TESTE DE ENVIO SECTION (INFERIOR) */}
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Send size={18} className="text-emerald-500" />
                    Validar Integração (Teste Rápido)
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 w-full">
                       <Mail size={16} className="text-slate-400" />
                       <input 
                         type="email" 
                         placeholder="Digite o e-mail de destino..." 
                         value={testRecipient}
                         onChange={(e) => setTestRecipient(e.target.value)}
                         className="bg-transparent border-none outline-none text-sm w-full text-slate-800"
                       />
                     </div>
                     <button
                        onClick={async () => {
                          const testEmail = testRecipient.trim();
                          if (!testEmail || !testEmail.includes("@")) {
                             setStatusMessage({ type: "error", text: "Por favor, digite um e-mail válido no campo ao lado." });
                             return;
                          }
                          setStatusMessage({ type: "success", text: "Enviando e-mail de teste para " + testEmail + "..." });
                          try {
                            const result = await sendEmailWithLog({
                              apiProvider: config.apiProvider,
                              apiKey: config.apiKey,
                              apiDomain: config.apiDomain,
                              apiEndpoint: config.apiEndpoint,
                              to: testEmail,
                              subject: "Mensagem de Teste - Integração Confirmada",
                              html: "<div style='font-family: Arial, sans-serif; padding: 20px; text-align: center; color: #333;'><h2 style='color: #0071e3;'>Integração Concluída com Sucesso!</h2><p>As suas configurações de SMTP/API para envio de e-mails estão funcionando perfeitamente no sistema da União Condominial.</p></div>"
                            }, "Teste de Configuração", "Teste");
                            
                            if (result.success) {
                              setStatusMessage({ type: "success", text: "Mensagem de teste enviada com sucesso para " + testEmail });
                            } else {
                              setStatusMessage({ type: "error", text: "Falha ao enviar e-mail de teste: " + (result.error || "Verifique os logs e a API Key") });
                            }
                          } catch(e: any) {
                            setStatusMessage({ type: "error", text: "Erro na comunicação: " + e.message });
                          }
                          setTimeout(() => setStatusMessage(null), 8000);
                        }}
                        className="flex shrink-0 items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-sm transition-all hover:shadow-md cursor-pointer w-full sm:w-auto"
                      >
                        <Send size={18} />
                        Enviar Mensagem de Teste
                      </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "templates" && (`;

content = content.replace(targetProvedorEnd, theButtonBlock);
fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
console.log("Fixed!");
