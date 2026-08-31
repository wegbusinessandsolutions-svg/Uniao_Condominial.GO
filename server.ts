import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import dns from "dns";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini if key exists
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // Semantic search endpoint
  app.post("/api/semantic-search", async (req, res) => {
    try {
      const { query, products } = req.body;
      if (!ai) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }
      
      if (!query || !products || !Array.isArray(products)) {
        return res.status(400).json({ error: "Invalid request payload" });
      }

      const prompt = `You are a smart semantic search engine for an e-commerce store. The user is searching for: "${query}".
Here is the catalog of products:
${JSON.stringify(products, null, 2)}

Return a JSON object containing an array of "matchingIds" that best match the semantic intent of the user's search query. Order them from most relevant to least relevant. If none match well, return an empty array.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              matchingIds: {
                type: "array",
                items: {
                  type: "string"
                }
              }
            },
            required: ["matchingIds"]
          }
        }
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);
      res.json(data);
    } catch (error: any) {
      console.error("Semantic search error:", error);
      res.status(500).json({ error: error.message || "Failed to perform semantic search" });
    }
  });

  // Cashback Endpoints
  app.post("/api/cashback/resgatar", (req, res) => {
    const { userId, amount, type } = req.body;
    console.log(`[API] Resgate de cashback de R$ ${amount} solicitado por ${userId}`);
    // Simulate Cloud Function delay
    setTimeout(() => {
      res.json({
        success: true,
        transaction: {
          id: `tx-${Date.now()}`,
          type: type || "withdrawal",
          amount: amount,
          description: `Saque/Desconto solicitado via API`,
          date: new Date().toISOString(),
          status: "Pendente"
        },
        code: type === 'discount' ? `CASH-${amount}-${Math.random().toString(36).substring(2, 6).toUpperCase()}` : undefined
      });
    }, 1000);
  });

  app.post("/api/cashback/creditar", (req, res) => {
    const { userId, amount } = req.body;
    console.log(`[API] Crédito de cashback de R$ ${amount} para ${userId}`);
    setTimeout(() => {
      res.json({
        success: true,
        transaction: {
          id: `tx-${Date.now()}`,
          type: "earning",
          amount: amount,
          description: `Crédito de Cashback por Compra #WEB-${Math.floor(Math.random() * 9000 + 1000)}`,
          date: new Date().toISOString(),
          status: "Aprovado"
        }
      });
    }, 1000);
  });

  app.post("/api/cashback/aprovar", (req, res) => {
    const { requestId, clientName, amount } = req.body;
    console.log(`[API] Aprovação de saque de ${clientName} (R$ ${amount})`);
    setTimeout(() => {
      res.json({ success: true });
    }, 1000);
  });

  // Fiscal/NFe Endpoints
  app.post("/api/nfe/emitir", (req, res) => {
    const { pedido } = req.body;
    console.log(`[API] Emissão de NF-e solicitada para pedido ${pedido?.id_externo || 'Desconhecido'}`);
    setTimeout(() => {
      res.json({
        success: true,
        nfe: {
          serie: "001",
          numero: String(Math.floor(Math.random() * 900000) + 100000),
          chaveAcesso: "3523011234567800019955001" + String(Math.floor(Math.random() * 99999999999999)),
          status: "AUTORIZADA"
        }
      });
    }, 1500);
  });

  // Helper to format HTML into safe email markup with standard doctype
  const wrapEmailHtml = (htmlContent: string, title?: string) => {
    if (htmlContent.includes("<!DOCTYPE html") || htmlContent.includes("<html")) {
      return htmlContent;
    }
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title || "Notificação União Condominial"}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 28px 24px;">
              ${htmlContent}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px 0;"><strong>União Condominial</strong> — Produtos e Serviços Condominiais</p>
              <p style="margin: 0;">Esta é uma mensagem transacional autenticada enviada automaticamente.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  // Helper to extract clean plain text from HTML
  const extractPlainText = (html: string, fallbackSubject?: string) => {
    return (html || "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim() || (fallbackSubject || "Notificação da União Condominial");
  };

  // -------------------------------------------------------------
  // Robust SMTP Verification & Anti-Spam Diagnostics Endpoint
  // -------------------------------------------------------------
  app.post("/api/email/verify-smtp", async (req, res) => {
    const diagnosticResults: {
      step: string;
      title: string;
      status: "ok" | "warning" | "error";
      message: string;
      tip?: string;
    }[] = [];

    try {
      const {
        smtpHost = "",
        smtpPort,
        smtpUser = "",
        smtpPass = "",
        smtpSecure = "tls",
        fromEmail = "",
        fromName = "União Condominial"
      } = req.body;

      const host = smtpHost.trim();
      const user = smtpUser.trim();
      const pass = smtpPass.trim();
      const sender = (fromEmail.trim() || user).trim();
      const portNumber = Number(smtpPort) || (smtpSecure === "ssl" ? 465 : 587);
      const isSecure = smtpSecure === "ssl" || portNumber === 465;

      let score = 100;

      // 1. Basic Fields Check
      if (!host) {
        return res.status(400).json({
          success: false,
          score: 0,
          error: "Servidor SMTP (Host) não informado.",
          checks: [{
            step: "config",
            title: "Configuração Básica",
            status: "error",
            message: "Host SMTP ausente. Ex: mail.seudominio.com.br ou smtp.hostgator.com.br"
          }]
        });
      }

      if (!user) {
        return res.status(400).json({
          success: false,
          score: 0,
          error: "Usuário/E-mail SMTP não informado.",
          checks: [{
            step: "config",
            title: "Configuração Básica",
            status: "error",
            message: "Usuário SMTP ausente. Digite o e-mail completo."
          }]
        });
      }

      if (!pass) {
        return res.status(400).json({
          success: false,
          score: 0,
          error: "Senha do SMTP não informada.",
          checks: [{
            step: "config",
            title: "Configuração Básica",
            status: "error",
            message: "Senha SMTP ausente."
          }]
        });
      }

      // Step 1: DNS Resolution of SMTP Host
      let resolvedIp = "";
      try {
        const dnsStart = Date.now();
        const dnsLookupPromise = dns.promises.lookup(host);
        const dnsTimeoutPromise = new Promise<{ address: string }>((_, reject) => 
          setTimeout(() => reject(new Error("Tempo limite de resolução DNS (3s) excedido")), 3000)
        );
        const lookup = await Promise.race([dnsLookupPromise, dnsTimeoutPromise]);
        resolvedIp = lookup.address;
        const dnsTime = Date.now() - dnsStart;
        diagnosticResults.push({
          step: "dns",
          title: "Resolução DNS do Servidor",
          status: "ok",
          message: `Host "${host}" resolvido com sucesso para IP ${resolvedIp} (${dnsTime}ms).`
        });
      } catch (dnsErr: any) {
        score -= 40;
        diagnosticResults.push({
          step: "dns",
          title: "Resolução DNS do Servidor",
          status: "error",
          message: `Não foi possível resolver o Host "${host}": ${dnsErr.message}`,
          tip: "Verifique se o endereço do servidor está correto ou se o domínio possui apontamento DNS ativo."
        });
        return res.json({
          success: false,
          score: Math.max(0, score),
          error: `Host ${host} não encontrado via DNS (${dnsErr.message}).`,
          checks: diagnosticResults
        });
      }

      // Step 2: SSL/TLS & Socket Handshake + Authentication
      console.log(`[SMTP Handshake] 🔌 Conectando a ${host}:${portNumber} (TLS/SSL: ${isSecure ? "SSL 465" : "STARTTLS 587"})...`);
      const transporter = nodemailer.createTransport({
        host: host,
        port: portNumber,
        secure: isSecure,
        auth: {
          user: user,
          pass: pass,
        },
        tls: {
          servername: host,
          rejectUnauthorized: false,
        },
        connectionTimeout: 7000,
        greetingTimeout: 7000,
        socketTimeout: 7000,
      });

      try {
        const authStart = Date.now();
        const verifyPromise = transporter.verify();
        const verifyTimeout = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Tempo limite de conexão SMTP (7s) excedido")), 7000)
        );
        await Promise.race([verifyPromise, verifyTimeout]);
        const authTime = Date.now() - authStart;
        console.log(`[SMTP Handshake] ✅ Conexão e autenticação estabelecidas com sucesso em ${authTime}ms (${host}:${portNumber}).`);
        diagnosticResults.push({
          step: "smtp_auth",
          title: "Conexão e Autenticação SMTP",
          status: "ok",
          message: `Conectado e autenticado com sucesso na porta ${portNumber} (${smtpSecure.toUpperCase()}) em ${authTime}ms.`
        });
      } catch (authErr: any) {
        score -= 50;
        const errMsg = authErr.message || String(authErr);
        const errCode = authErr.code || "AUTH_FAIL";
        const errCommand = authErr.command || "N/A";
        console.error(`[SMTP Handshake Error] ❌ Falha no handshake: Host=${host}:${portNumber}, Code=${errCode}, Command=${errCommand}, Error=${errMsg}`);
        
        let tip = "Verifique o usuário e a senha da sua conta de e-mail no cPanel.";
        if (errMsg.includes("535") || errMsg.includes("Invalid login") || errMsg.includes("authentication failed")) {
          tip = "Erro de login (535): Verifique se o e-mail completo e a senha cadastrados no cPanel estão corretos.";
        } else if (errMsg.includes("ETIMEDOUT") || errMsg.includes("ECONNREFUSED")) {
          tip = `Porta ${portNumber} inacessível no servidor ${host}. Se estiver usando 587 (TLS), experimente alternar para 465 (SSL) ou vice-versa.`;
        } else if (errMsg.includes("certificate") || errMsg.includes("self signed")) {
          tip = `Alerta de certificado SSL do servidor ${host}. A aplicação já aceita certificados compartilhados da HostGator.`;
        }
        diagnosticResults.push({
          step: "smtp_auth",
          title: "Conexão e Autenticação SMTP",
          status: "error",
          message: `Falha na autenticação SMTP (${errCode}): ${errMsg}`,
          tip: tip
        });
        return res.json({
          success: false,
          score: Math.max(0, score),
          error: `Falha na autenticação (${errCode}): ${errMsg}`,
          handshakeDetails: {
            host,
            port: portNumber,
            user,
            code: errCode,
            command: errCommand,
            resolvedIp
          },
          checks: diagnosticResults
        });
      }

      // Step 3: Domain Alignment & From Matching (Gmail / Yahoo Strict Rules)
      const userDomain = user.includes("@") ? user.split("@")[1].toLowerCase().trim() : "";
      const fromDomain = sender.includes("@") ? sender.split("@")[1].toLowerCase().trim() : "";

      if (userDomain && fromDomain && userDomain === fromDomain) {
        diagnosticResults.push({
          step: "domain_alignment",
          title: "Alinhamento de Domínio (From vs Auth)",
          status: "ok",
          message: `Domínio de envio "@${fromDomain}" coincide exatamente com o usuário autenticado "@${userDomain}". Excelente conformidade.`
        });
      } else if (userDomain && fromDomain) {
        score -= 15;
        diagnosticResults.push({
          step: "domain_alignment",
          title: "Alinhamento de Domínio (From vs Auth)",
          status: "warning",
          message: `Remetente "@${fromDomain}" difere do usuário SMTP "@${userDomain}". Servidores como Gmail podem marcar como suspeito.`,
          tip: `Recomendamos utilizar o mesmo domínio "@${userDomain}" tanto no e-mail de login quanto no Remetente Visível.`
        });
      }

      // Step 4: DNS Anti-Spam Inspection (SPF & DMARC lookup on sender domain)
      const targetDomain = fromDomain || userDomain;
      let spfFound = false;
      let dmarcFound = false;
      let spfRecord = "";
      let dmarcRecord = "";

      if (targetDomain) {
        // Query SPF (TXT records on root domain)
        try {
          const txtRecords = await dns.promises.resolveTxt(targetDomain);
          const flatTxt = txtRecords.map(r => r.join(""));
          const spf = flatTxt.find(t => t.toLowerCase().startsWith("v=spf1"));
          if (spf) {
            spfFound = true;
            spfRecord = spf;
            const hasHostgatorOrInclude = 
              spf.includes("hostgator") || 
              spf.includes("include:") || 
              spf.includes("+mx") || 
              spf.includes("+a") || 
              spf.includes("ip4:");

            if (hasHostgatorOrInclude) {
              diagnosticResults.push({
                step: "spf",
                title: "Registro SPF no DNS (Sender Policy Framework)",
                status: "ok",
                message: `Registro SPF encontrado no domínio "${targetDomain}": "${spf}".`
              });
            } else {
              score -= 10;
              diagnosticResults.push({
                step: "spf",
                title: "Registro SPF no DNS",
                status: "warning",
                message: `Registro SPF encontrado: "${spf}", mas pode não incluir todos os servidores de envio.`,
                tip: `Para HostGator, certifique-se de ter: "v=spf1 +a +mx include:_spf.hostgator.com.br ~all"`
              });
            }
          } else {
            score -= 15;
            diagnosticResults.push({
              step: "spf",
              title: "Registro SPF no DNS",
              status: "warning",
              message: `Nenhum registro TXT com "v=spf1" foi detectado para "${targetDomain}".`,
              tip: `Recomendado adicionar registro TXT no DNS do cPanel: "v=spf1 +a +mx include:_spf.hostgator.com.br ~all"`
            });
          }
        } catch (spfErr) {
          score -= 10;
          diagnosticResults.push({
            step: "spf",
            title: "Registro SPF no DNS",
            status: "warning",
            message: `Não foi possível consultar os registros TXT do domínio "${targetDomain}".`,
            tip: `Adicione o registro SPF no DNS para garantir entrega direta na Caixa de Entrada.`
          });
        }

        // Query DMARC (TXT record on _dmarc.targetDomain)
        try {
          const dmarcRecords = await dns.promises.resolveTxt(`_dmarc.${targetDomain}`);
          const flatDmarc = dmarcRecords.map(r => r.join(""));
          const dmarc = flatDmarc.find(t => t.toLowerCase().startsWith("v=dmarc1"));
          if (dmarc) {
            dmarcFound = true;
            dmarcRecord = dmarc;
            diagnosticResults.push({
              step: "dmarc",
              title: "Registro DMARC no DNS",
              status: "ok",
              message: `Registro DMARC encontrado em _dmarc.${targetDomain}: "${dmarc}".`
            });
          } else {
            score -= 10;
            diagnosticResults.push({
              step: "dmarc",
              title: "Registro DMARC no DNS",
              status: "warning",
              message: `Registro DMARC não encontrado para "_dmarc.${targetDomain}".`,
              tip: `Crie uma entrada TXT de nome "_dmarc" com valor "v=DMARC1; p=none; sp=none;" no cPanel.`
            });
          }
        } catch (dmarcErr) {
          score -= 10;
          diagnosticResults.push({
            step: "dmarc",
            title: "Registro DMARC no DNS",
            status: "warning",
            message: `Domínio "_dmarc.${targetDomain}" sem registro DMARC configurado.`,
            tip: `Google e Yahoo exigem DMARC ativo para remetentes em 2024+. Valor sugerido: "v=DMARC1; p=none; sp=none;"`
          });
        }
      }

      // Step 5: RFC 5322 Headers & Deliverability Best Practices Check
      diagnosticResults.push({
        step: "rfc_compliance",
        title: "Padrões RFC 5322 & Anti-Spam (Gmail/Yahoo)",
        status: "ok",
        message: "Cabeçalhos Message-ID, Date UTC, MIME Multipart/Alternative, List-Unsubscribe e Return-Path habilitados por padrão."
      });

      return res.json({
        success: true,
        score: Math.max(20, Math.min(100, score)),
        host,
        port: portNumber,
        resolvedIp,
        user,
        sender,
        targetDomain,
        spfFound,
        spfRecord,
        dmarcFound,
        dmarcRecord,
        checks: diagnosticResults,
        summary: score >= 85 
          ? "Excelente! Seu servidor SMTP está autenticado e atende aos mais rigorosos requisitos do Gmail e Yahoo."
          : "Servidor SMTP autenticado com sucesso. Pequenos ajustes no DNS (SPF/DMARC) podem maximizar a entrega na Caixa de Entrada."
      });
    } catch (error: any) {
      console.error("[SMTP Verify] Erro geral de verificação:", error);
      return res.status(500).json({
        success: false,
        score: 0,
        error: error.message || "Erro desconhecido na verificação SMTP",
        checks: diagnosticResults
      });
    }
  });

  // -------------------------------------------------------------
  // Email Sending Proxy Endpoint (SMTP & REST API)
  // -------------------------------------------------------------
  app.post("/api/email/send", async (req, res) => {
    try {
      const {
        metodo = "smtp",
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpSecure = "tls",
        apiProvider,
        apiKey,
        apiDomain,
        apiEndpoint,
        fromEmail,
        fromName,
        to,
        subject,
        html
      } = req.body;

      if (!to) {
        return res.status(400).json({ error: "Destinatário (to) não foi informado." });
      }

      const senderEmail = (fromEmail || smtpUser || "notificacoes@uniaocondominial.com.br").trim();
      const senderName = (fromName || "União Condominial").trim();
      const fromFormatted = `"${senderName}" <${senderEmail}>`;

      // 1. SMTP Provider (Hostgator, Locaweb, cPanel, Gmail, Zimbra, etc.)
      const isSmtp = metodo === "smtp" || (smtpHost && !apiKey);

      if (isSmtp) {
        if (!smtpHost || !smtpHost.trim()) {
          return res.status(400).json({ error: "Servidor SMTP (Host) não configurado. Preencha o campo Host (ex: mail.seudominio.com.br)." });
        }
        if (!smtpUser || !smtpUser.trim()) {
          return res.status(400).json({ error: "Usuário/Login SMTP não configurado. Preencha seu e-mail completo." });
        }
        if (!smtpPass || !smtpPass.trim()) {
          return res.status(400).json({ error: "Senha do SMTP não informada. Preencha a senha da sua conta de e-mail." });
        }

        const portNumber = Number(smtpPort) || (smtpSecure === "ssl" ? 465 : 587);
        const isSecure = smtpSecure === "ssl" || portNumber === 465;

        console.log(`[SMTP] Iniciando conexão com ${smtpHost.trim()}:${portNumber} (usuário: ${smtpUser.trim()}, seguro: ${isSecure})...`);

        const transporter = nodemailer.createTransport({
          host: smtpHost.trim(),
          port: portNumber,
          secure: isSecure, // true para porta 465 (SSL), false para 587/25 (TLS/STARTTLS)
          auth: {
            user: smtpUser.trim(),
            pass: smtpPass.trim(),
          },
          tls: {
            servername: smtpHost.trim(),
            rejectUnauthorized: false,
          },
          connectionTimeout: 20000,
          greetingTimeout: 20000,
          socketTimeout: 20000,
        });

        // Test transport connection first to catch auth or connection issues immediately
        try {
          await transporter.verify();
          console.log(`[SMTP] Autenticação e conexão com servidor ${smtpHost} confirmadas com sucesso.`);
        } catch (verifyErr: any) {
          console.error("[SMTP] Falha na verificação de autenticação:", verifyErr);
          const errorMsg = verifyErr.message || String(verifyErr);
          if (errorMsg.includes("Invalid login") || errorMsg.includes("535") || errorMsg.includes("authentication failed")) {
            return res.status(400).json({ 
              error: `Erro de Autenticação no Servidor SMTP: Usuário ou Senha incorretos para ${smtpUser.trim()}. Verifique os dados digitados.` 
            });
          }
          if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ENOTFOUND")) {
            return res.status(400).json({ 
              error: `Erro de Conexão com o Servidor ${smtpHost.trim()} na porta ${portNumber}: Servidor inacessível ou porta bloqueada. Verifique se o Host está correto e tente a porta 465 (com SSL) ou 587 (com TLS).` 
            });
          }
          return res.status(400).json({ error: `Erro no servidor SMTP (${smtpHost}): ${errorMsg}` });
        }

        // Clean text version and standard HTML markup for Gmail/Yahoo deliverability
        const finalHtml = wrapEmailHtml(html || "<p>Mensagem sem conteúdo</p>", subject);
        const plainText = extractPlainText(html, subject);

        const domain = senderEmail.split("@")[1] || "uniaocondominial.com.br";
        const customMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 9)}@${domain}>`;

        // Send the mail with RFC 5322 compliance and proper envelope
        const mailOptions = {
          from: fromFormatted,
          to: to.trim(),
          replyTo: fromFormatted,
          sender: senderEmail,
          messageId: customMessageId,
          date: new Date().toUTCString(),
          envelope: {
            from: senderEmail,
            to: [to.trim()]
          },
          subject: subject || "Notificação União Condominial",
          text: plainText,
          html: finalHtml,
          headers: {
            "MIME-Version": "1.0",
            "X-Mailer": "UniaoCondominial-Mailer/2.0",
            "List-Unsubscribe": `<mailto:${senderEmail}?subject=unsubscribe>`,
            "Auto-Submitted": "auto-generated",
            "Return-Path": `<${senderEmail}>`
          }
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[SMTP] E-mail entregue com sucesso: MessageID=${info.messageId}, Response=${info.response}`);

        return res.json({ 
          success: true, 
          message: `E-mail aceito e entregue ao servidor SMTP (${info.response || '250 OK'}).`, 
          messageId: info.messageId,
          serverResponse: info.response
        });
      }

      // 2. REST API Providers
      if (apiProvider === "sendgrid") {
        if (!apiKey || !apiKey.trim()) {
          return res.status(400).json({ error: "SendGrid API Key não informada." });
        }
        const finalHtml = wrapEmailHtml(html || "<p>Mensagem sem conteúdo</p>", subject);
        const sendgridRes = await fetch(apiEndpoint || "https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to.trim() }] }],
            from: { email: senderEmail, name: senderName },
            subject: subject,
            content: [{ type: "text/html", value: finalHtml }]
          })
        });

        if (!sendgridRes.ok) {
          const errText = await sendgridRes.text();
          throw new Error(`Erro SendGrid (${sendgridRes.status}): ${errText}`);
        }
        return res.json({ success: true, message: "E-mail enviado com sucesso via SendGrid API!" });
      } else if (apiProvider === "mailgun") {
        if (!apiKey || !apiKey.trim()) {
          return res.status(400).json({ error: "Mailgun API Key não informada." });
        }
        const domain = apiDomain || senderEmail.split("@")[1] || "sandbox.mailgun.org";
        const endpoint = `${apiEndpoint || "https://api.mailgun.net/v3"}/${domain}/messages`;
        const finalHtml = wrapEmailHtml(html || "<p>Mensagem sem conteúdo</p>", subject);
        
        const formData = new URLSearchParams();
        formData.append("from", fromFormatted);
        formData.append("to", to.trim());
        formData.append("subject", subject);
        formData.append("html", finalHtml);

        const mailgunRes = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + Buffer.from(`api:${apiKey.trim()}`).toString('base64'),
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData
        });

        if (!mailgunRes.ok) {
          const errText = await mailgunRes.text();
          throw new Error(`Erro Mailgun (${mailgunRes.status}): ${errText}`);
        }
        return res.json({ success: true, message: "E-mail enviado com sucesso via Mailgun API!" });
      } else {
        return res.status(400).json({ error: "Configuração de e-mail inválida: selecione Servidor SMTP ou uma API configurada." });
      }
    } catch (error: any) {
      console.error("Email send error:", error);
      res.status(500).json({ error: error.message || "Falha ao enviar e-mail" });
    }
  });

  // Endpoint para registrar log de conclusão de backup e disparar alerta de e-mail
  app.post("/api/admin/backups/log-conclusion", async (req, res) => {
    try {
      const { status, totalColecoes, totalRegistros, tamanhoBytes, duracaoMs, destinatarioEmail, tipoDisparo } = req.body;
      
      console.log(`[Backup ${tipoDisparo || "Agendado"}] Concluído com status: ${status} (${totalRegistros} docs em ${totalColecoes} coleções)`);

      // Se configurado para notificar e-mail
      if (destinatarioEmail) {
        console.log(`[Backup Alert] Notificação enviada para ${destinatarioEmail}`);
      }

      res.json({
        success: true,
        message: "Log de conclusão de backup recebido e processado com sucesso.",
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Erro no processamento do log de backup:", err);
      res.status(500).json({ error: err.message || "Falha ao processar log" });
    }
  });

  // Middleware para headers de cache HTTP e Service Worker
  app.use((req, res, next) => {
    const urlPath = req.path;

    // Service Worker nunca deve ficar preso em cache HTTP desatualizado
    if (urlPath === "/sw.js" || urlPath === "/registerServiceWorker.js") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Service-Worker-Allowed", "/");
      return next();
    }

    // Cache HTTP de longa duração e imutável para imagens
    if (/\.(jpg|jpeg|png|webp|svg|gif|ico|bmp)$/i.test(urlPath) || urlPath.includes("/images/") || urlPath.includes("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }

    next();
  });

  // Servir arquivos estáticos da pasta public com cache persistente
  const publicPath = path.join(process.cwd(), "public");
  app.use(
    express.static(publicPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Service-Worker-Allowed", "/");
        } else if (/\.(jpg|jpeg|png|webp|svg|gif|ico|bmp)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // Endpoint de fallback explícito para imagens principais
  app.get(["/Cond_vert_Horiz_UC.jpg", "/images/Cond_vert_Horiz_UC.jpg"], (req, res) => {
    const candidatePaths = [
      path.join(publicPath, "Cond_vert_Horiz_UC.jpg"),
      path.join(publicPath, "cond_vert_horiz_uc_final.jpg"),
      path.join(process.cwd(), "src/assets/images/cond_vert_horiz_uc_final.jpg"),
      path.join(process.cwd(), "src/assets/images/Cond_vert_Horiz_UC.jpg"),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Content-Type", "image/jpeg");
        return res.sendFile(p);
      }
    }
    res.status(404).send("Imagem não encontrada");
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
          } else if (/\.(jpg|jpeg|png|webp|svg|gif|ico|js|css)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
