const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

const targetStr = '<div className="flex justify-end pt-4 border-t border-slate-100">';

const buttonStr = `
            <div className="flex justify-end pt-4 mt-6 border-t border-slate-100">
              <button
                onClick={async () => {
                  const testEmail = prompt("Informe o e-mail para receber a mensagem de teste:");
                  if (!testEmail) return;
                  try {
                    const result = await sendEmailWithLog({
                      apiProvider: config.apiProvider,
                      apiKey: config.apiKey,
                      apiDomain: config.apiDomain,
                      apiEndpoint: config.apiEndpoint,
                      to: testEmail,
                      subject: "Mensagem de Teste - Integração Confirmada",
                      html: "<div style='font-family: Arial, sans-serif; padding: 20px; text-align: center; color: #333;'><h2 style='color: #0071e3;'>Integração Concluída com Sucesso!</h2><p>As suas configurações de SMTP/API para envio de e-mails estão funcionando perfeitamente no sistema.</p></div>"
                    }, "Teste de Configuração", "Teste");
                    
                    if (result.success) {
                      setStatusMessage({ type: "success", text: "Mensagem de teste enviada com sucesso para " + testEmail });
                    } else {
                      setStatusMessage({ type: "error", text: "Falha ao enviar e-mail de teste: " + (result.error || "Verifique os logs") });
                    }
                  } catch(e: any) {
                    setStatusMessage({ type: "error", text: "Erro: " + e.message });
                  }
                  setTimeout(() => setStatusMessage(null), 5000);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors shadow-sm mr-4"
              >
                <Send size={18} />
                Enviar Mensagem de Teste
              </button>
`;

if (content.includes(targetStr)) {
    // Only replace the first occurrence (which should be the provider save button section)
    content = content.replace(targetStr, buttonStr + '\n              ' + targetStr);
    fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
    console.log("Patched first occurrence");
} else {
    console.log("Target string not found");
}

