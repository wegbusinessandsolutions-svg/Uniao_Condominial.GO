const fs = require('fs');

// Fix ControleAfiliados.tsx
let content = fs.readFileSync('src/pages/comercial/ControleAfiliados.tsx', 'utf8');

// Add a state for messages
content = content.replace(
  'const [searchTerm, setSearchTerm] = useState("");',
  'const [searchTerm, setSearchTerm] = useState("");\n  const [feedback, setFeedback] = useState<{type: "success" | "error", message: string} | null>(null);\n\n  const showFeedback = (type: "success" | "error", message: string) => {\n    setFeedback({ type, message });\n    setTimeout(() => setFeedback(null), 5000);\n  };'
);

// Remove window.confirm and alert from handleResendEmail
content = content.replace(
  'if (!window.confirm(`Deseja re-enviar o termo de afiliação para ${afiliado.nomeCondominio}?`)) return;\n    try {',
  'try {\n      setFeedback({ type: "success", message: "Enviando e-mail..." });'
);

content = content.replace('alert("E-mail do cliente não encontrado.");', 'showFeedback("error", "E-mail do cliente não encontrado.");');

content = content.replace(
  'if (emailResult.success) {\n        alert("E-mail de afiliação reenviado com sucesso!");\n      } else {\n        alert("Falha ao enviar e-mail: " + (emailResult.error || "Verifique as configurações de e-mail."));\n      }',
  'if (emailResult.success) {\n        showFeedback("success", "E-mail de afiliação reenviado com sucesso!");\n      } else {\n        showFeedback("error", "Falha ao enviar e-mail: " + (emailResult.error || "Verifique as configurações de e-mail."));\n      }'
);

content = content.replace('alert("Erro ao re-enviar e-mail: " + err.message);', 'showFeedback("error", "Erro ao re-enviar e-mail: " + err.message);');


// Remove window.confirm and alert from handleApprove
content = content.replace(
  'if (!window.confirm(`Confirmar a afiliação de ${afiliado.nomeCondominio}? Isso gerará a taxa de afiliação no Contas a Receber e enviará o boleto por e-mail.`)) return;\n    \n    try {',
  'try {\n      setFeedback({ type: "success", message: "Processando afiliação..." });'
);

content = content.replace(
  'if (emailResult.success) {\n          alert("Afiliação aprovada! O Contas a Receber foi gerado e o e-mail de cobrança foi enviado.");\n        } else {\n          alert("Afiliação aprovada, Contas a Receber gerado, MAS houve erro ao enviar e-mail: " + (emailResult.error || "Erro desconhecido."));\n        }\n      } else {\n        alert("Afiliação aprovada, mas não foi possível enviar o e-mail (endereço não encontrado).");\n      }',
  'if (emailResult.success) {\n          showFeedback("success", "Afiliação aprovada! Contas a Receber gerado e e-mail enviado.");\n        } else {\n          showFeedback("error", "Afiliação aprovada, mas houve erro no e-mail: " + (emailResult.error || "Erro desconhecido."));\n        }\n      } else {\n        showFeedback("success", "Afiliação aprovada, mas não foi possível enviar e-mail (não encontrado).");\n      }'
);

content = content.replace('alert("Erro ao aprovar afiliação: " + err.message);', 'showFeedback("error", "Erro ao aprovar afiliação: " + err.message);');

// Insert feedback UI
content = content.replace(
  '<div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">',
  '{feedback && (\n        <div className={`mb-6 p-4 rounded-xl border ${feedback.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>\n          {feedback.message}\n        </div>\n      )}\n\n      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">'
);

fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', content);
console.log('Fixed alerts in ControleAfiliados.tsx');
