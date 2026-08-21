const fs = require('fs');

let content = fs.readFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', 'utf8');

const targetStr = `        {activeTab === "provedor" && (
          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
             <button
                onClick={async () => {
                  const testEmail = prompt("Informe o e-mail para receber a mensagem de teste:");
                  if (!testEmail) return;
                  setStatusMessage({ type: "success", text: "Enviando e-mail de teste para " + testEmail + "..." });`;

// Replace the above block with one that has an input field.
const newBlock = `        {activeTab === "provedor" && (
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
                     alert("Por favor, digite um e-mail válido no campo ao lado.");
                     return;
                  }
                  setStatusMessage({ type: "success", text: "Enviando e-mail de teste para " + testEmail + "..." });`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newBlock);
  
  // also replace prompt("Informe o e-mail para receber a mensagem de teste:"); and its check
  // Actually wait, I replaced the block, so the prompt is already gone! Let's verify.
  fs.writeFileSync('src/pages/admin/ConfiguracaoNotificacoes.tsx', content);
  console.log('Fixed button layout and input');
} else {
  console.log('Could not find target block to replace.');
}

