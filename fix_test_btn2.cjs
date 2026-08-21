const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

const faultyBlock = `        {activeTab === "provedor" && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
             <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full sm:w-auto">
               <Mail size={16} className="text-slate-400" />
               <input 
                 type="email" 
                 placeholder="Digite o e-mail de destino..." 
                 value={testRecipient}
                 onChange={(e) => setTestRecipient(e.target.value)}
                 className="bg-transparent border-none outline-none text-sm w-full sm:w-64"
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
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-xs md:text-sm shadow-sm transition-all hover:shadow-md cursor-pointer"
              >
                <Send size={16} />
                Enviar Mensagem de Teste
              </button>
          </div>
        )}`;

// 1. Remove it from the header.
content = content.replace(faultyBlock, '');

// 2. Put it at the bottom of the provider tab content.
const targetBottomStr = `                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notificações Automatizadas Tab */}`;

const replaceWith = `                  </div>
                </div>
              </>
            )}

            {/* TESTE DE ENVIO SECTION */}
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
                    className="flex shrink-0 items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-sm transition-all hover:shadow-md cursor-pointer w-full sm:w-auto justify-center"
                  >
                    <Send size={18} />
                    Enviar Mensagem de Teste
                  </button>
              </div>
            </div>

          </div>
        )}

        {/* Notificações Automatizadas Tab */}`;

if (content.includes(targetBottomStr)) {
    content = content.replace(targetBottomStr, replaceWith);
    fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
    console.log("Moved to the bottom successfully!");
} else {
    console.log("Target bottom str not found!");
}

