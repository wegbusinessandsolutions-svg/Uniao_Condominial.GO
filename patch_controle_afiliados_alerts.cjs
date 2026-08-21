const fs = require('fs');

let content = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');

// Update handleResendEmail
content = content.replace(
  'await sendEmailWithLog({',
  'const emailResult = await sendEmailWithLog({'
);

content = content.replace(
  'alert("E-mail de afiliação reenviado com sucesso!");',
  `if (emailResult.success) {
        alert("E-mail de afiliação reenviado com sucesso!");
      } else {
        alert("Falha ao enviar e-mail: " + (emailResult.error || "Verifique as configurações de e-mail."));
      }`
);

// Update handleApprove
// This has an await sendEmailWithLog for BOLETO_AFILIACAO
content = content.replace(
  'await sendEmailWithLog({\n          apiProvider: emailConfig.apiProvider || "sendgrid",\n          apiKey: emailConfig.apiKey || "",\n          apiDomain: emailConfig.apiDomain || "",\n          apiEndpoint: emailConfig.apiEndpoint || "",\n          to: userEmail,\n          subject: "Boleto de Afiliação - União Condominial",\n          html: htmlBoleto\n        }, "BOLETO_AFILIACAO");\n      }\n\n      alert("Afiliação aprovada! O Contas a Receber foi gerado e o e-mail de cobrança foi enviado.");',
  `const emailResult = await sendEmailWithLog({
          apiProvider: emailConfig.apiProvider || "sendgrid",
          apiKey: emailConfig.apiKey || "",
          apiDomain: emailConfig.apiDomain || "",
          apiEndpoint: emailConfig.apiEndpoint || "",
          to: userEmail,
          subject: "Boleto de Afiliação - União Condominial",
          html: htmlBoleto
        }, "BOLETO_AFILIACAO");
        
        if (emailResult.success) {
          alert("Afiliação aprovada! O Contas a Receber foi gerado e o e-mail de cobrança foi enviado.");
        } else {
          alert("Afiliação aprovada, Contas a Receber gerado, MAS houve erro ao enviar e-mail: " + (emailResult.error || "Erro desconhecido."));
        }
      } else {
        alert("Afiliação aprovada, mas não foi possível enviar o e-mail (endereço não encontrado).");
      }`
);

// Add fallbacks to doc references just in case userId is missing
content = content.replace('doc(db, "users", afiliado.userId)', 'doc(db, "users", afiliado.userId || "UNDEFINED_USER")');
content = content.replace('doc(db, "users", afiliado.userId)', 'doc(db, "users", afiliado.userId || "UNDEFINED_USER")');

fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', content);
console.log('Patched ControleAfiliados.tsx with robust alerts');
