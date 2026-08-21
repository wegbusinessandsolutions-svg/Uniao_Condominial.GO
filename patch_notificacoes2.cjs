const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

const targetStr = `            {saving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>
      </div>`;

const buttonStr = `            {saving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>

        {activeTab === "provedor" && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
             <button
                onClick={async () => {
                  const testEmail = prompt("Informe o e-mail para receber a mensagem de teste:");
                  if (!testEmail) return;
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
        )}
      </div>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, buttonStr);
    fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Target string not found");
}

