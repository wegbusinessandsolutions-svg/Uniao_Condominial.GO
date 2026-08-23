const fs = require('fs');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace submission logic
  const submitLogicTarget = `      });
      alert("Sugestão enviada com sucesso! Muito obrigado.");
      setIsSuggestionModalOpen(false);
      setSuggestionText("");
    } catch (error) {`;
  
  const submitLogicReplacement = `      });
      await addDoc(collection(db, "mail"), {
        to: "ceo@uniaocondominial.com.br",
        message: {
          subject: "Nova Sugestão Recebida - Aplicativo",
          html: \`
            <h3>Nova Sugestão Recebida</h3>
            <p><strong>Condomínio/Empresa:</strong> \${(profile as any)?.nomeEmpresa || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
            <p><strong>Responsável:</strong> \${(profile as any)?.nomeResponsavel || (profile as any)?.nomeCompleto || profile?.displayName || ""}</p>
            <p><strong>Telefone:</strong> \${(profile as any)?.telefone || ""}</p>
            <p><strong>E-mail:</strong> \${profile?.email || user?.email || ""}</p>
            <br />
            <p><strong>Sugestão:</strong></p>
            <p>\${suggestionText.replace(/\\n/g, '<br/>')}</p>
          \`
        }
      });
      setIsSuggestionSuccess(true);
      setSuggestionText("");
    } catch (error) {`;

  if (content.includes(submitLogicTarget)) {
    content = content.replace(submitLogicTarget, submitLogicReplacement);
  }

  // Replace modal render
  const modalTarget = `            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-sky-100 text-[#0071e3] rounded-xl flex items-center justify-center shrink-0">
                <Lightbulb size={20} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Envie sua Sugestão
              </h3>
            </div>

            <form onSubmit={handleSubmitSuggestion} className="space-y-4">`;

  const modalReplacement = `            {!isSuggestionSuccess ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-sky-100 text-[#0071e3] rounded-xl flex items-center justify-center shrink-0">
                    <Lightbulb size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Envie sua Sugestão
                  </h3>
                </div>

                <form onSubmit={handleSubmitSuggestion} className="space-y-4">`;
  
  if (content.includes(modalTarget)) {
    content = content.replace(modalTarget, modalReplacement);
  }

  const modalEndTarget = `              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsSuggestionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingSuggestion || !suggestionText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingSuggestion ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>`;

  const modalEndReplacement = `              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsSuggestionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingSuggestion || !suggestionText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingSuggestion ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
            </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lightbulb size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Sugestão Enviada!</h3>
                <p className="text-slate-600 mb-8 max-w-sm mx-auto">
                  A sugestão foi enviada, e será criteriosamente analisada, agradecemos sua contribuição.
                </p>
                <button 
                  onClick={() => {
                    setIsSuggestionModalOpen(false);
                    setTimeout(() => setIsSuggestionSuccess(false), 300);
                  }}
                  className="px-8 py-3 rounded-xl bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold transition-colors"
                >
                  Fechar
                </button>
              </div>
            )}`;

  if (content.includes(modalEndTarget)) {
    content = content.replace(modalEndTarget, modalEndReplacement);
  }

  fs.writeFileSync(filePath, content);
  console.log('Patched', filePath);
}

patchFile('src/pages/shop/Home.tsx');
patchFile('src/pages/cliente/Dashboard.tsx');
