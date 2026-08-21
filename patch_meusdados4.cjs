const fs = require('fs');
let content = fs.readFileSync('src/pages/cliente/MeusDados.tsx', 'utf8');

const target = 'const handleAfiliar = async () => {';
const replacement = `const handleAfiliar = async () => {
    if (!unidades || Number(unidades) < 1) {
      alert("Informe a quantidade de unidades habitacionais válida.");
      return;
    }
    if (!diaVencimento) {
      alert("Selecione o melhor dia para vencimento do boleto.");
      return;
    }
    setLoadingAfil(true);
    try {
      const data = {
        userId: user?.uid,
        nomeCondominio: profile?.displayName || "Não informado",
        cnpj: profile?.cnpj || profile?.cpfCnpj || "",
        nomeSindico: (profile as any)?.nomeResponsavel || "",
        telefone: profile?.telefone || profile?.phone || "",
        unidadesHabitacionais: Number(unidades),
        diaVencimento,
        valorMensalidade: calcValorMensalidade(),
        status: "Pendente de Aceite por E-mail",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "afiliados_uc", user!.uid), data);

      // Get email config
      const configSnap = await getDoc(doc(db, "config_empresa", "email_settings"));
      const emailConfig = configSnap.exists() ? configSnap.data() : {};

      const nomeCondominio = profile?.displayName || "Não informado";
      const cnpj = profile?.cnpj || profile?.cpfCnpj || "Não informado";
      const nomeSindico = (profile as any)?.nomeResponsavel || "Não informado";
      const tel = profile?.telefone || profile?.phone || "Não informado";
      const emailCli = profile?.email || "Não informado";

      const htmlTermo = \`
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6;">
        <h2 style="text-align: center; color: #0071e3;">TERMO DE AFILIAÇÃO À UNIÃO CONDOMINIAL</h2>
        <h4 style="text-align: center; color: #555;">PRODUTOS DE LIMPEZA E CONSERVAÇÃO</h4>
        <p>Prezado(a) <strong>\${nomeSindico}</strong>,</p>
        <p>Recebemos sua solicitação de afiliação do condomínio <strong>\${nomeCondominio}</strong> à União Condominial.</p>
        <p>Por favor, confira os dados do contrato abaixo. <strong>Para confirmar sua afiliação e aceitar os termos, responda a este e-mail com a frase: "DE ACORDO"</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #ddd; my-4;" />
        
        <h3>QUALIFICAÇÃO DO CONTRATANTE</h3>
        <ul>
          <li><strong>Condomínio:</strong> \${nomeCondominio}</li>
          <li><strong>CNPJ:</strong> \${cnpj}</li>
          <li><strong>Unidades Habitacionais:</strong> \${unidades}</li>
          <li><strong>Síndico/Administrador:</strong> \${nomeSindico}</li>
          <li><strong>Telefone:</strong> \${tel}</li>
          <li><strong>Email:</strong> \${emailCli}</li>
          <li><strong>Vencimento Escolhido:</strong> Dia \${diaVencimento}</li>
          <li><strong>Valor Mensal:</strong> R$ \${calcValorMensalidade().toFixed(2).replace('.', ',')}</li>
        </ul>

        <h3>CLÁUSULA 1ª — DO OBJETO</h3>
        <p>O presente Termo tem por objeto a afiliação do CONTRATANTE à União Condominial — Produtos de Limpeza e Conservação, assegurando-lhe acesso a uma lista de serviços condominiais rotineiros, prestados com desconto de até 50% (cinquenta por cento) sobre os valores praticados ao mercado em geral, nos termos e condições estabelecidos neste instrumento.</p>
        
        <h3>CLÁUSULA 2ª — DA VIGÊNCIA</h3>
        <p>O presente Termo de Afiliação vigorará pelo prazo de 12 (doze) meses, contados da data de sua assinatura (confirmação por e-mail), sendo automaticamente renovado por iguais e sucessivos períodos de 12 (doze) meses.</p>

        <h3>CLÁUSULA 3ª — DOS SERVIÇOS CONDOMINIAIS ROTINEIROS</h3>
        <p>Mediante a afiliação, o CONTRATANTE passa a ter à sua disposição, com desconto de até 50%, os seguintes serviços:</p>
        <ul>
          <li>Limpeza de Reservatório de Água Inferior;</li>
          <li>Limpeza de Caixa d'Água;</li>
          <li>Limpeza de Caixa de Gordura;</li>
          <li>Serviços de Jardinagem;</li>
          <li>Manutenção de Portas e Portões Eletrônicos;</li>
          <li>Manutenção de Cercas Elétricas e Elétricos;</li>
          <li>Manutenção de Porteiros Eletrônicos e CFTV;</li>
          <li>Manutenção em Sistemas de Alarme.</li>
        </ul>

        <hr style="border: 0; border-top: 1px solid #ddd; my-4;" />
        <p style="text-align: center; font-size: 14px; color: #777;">Responda "DE ACORDO" para validar este termo legalmente.</p>
      </div>
      \`;

      // Send HTML Email
      await sendEmailWithLog({
        apiProvider: emailConfig.apiProvider || "sendgrid",
        apiKey: emailConfig.apiKey || "",
        apiDomain: emailConfig.apiDomain || "",
        apiEndpoint: emailConfig.apiEndpoint || "",
        to: profile?.email || "",
        subject: "Termo de Afiliação - União Condominial",
        html: htmlTermo
      }, "AFILIACAO_UC");

      setAfiliadoStatus("Pendente de Aceite por E-mail");
      alert("Termo de afiliação enviado para o seu e-mail com sucesso! Verifique sua caixa de entrada.");
    } catch (err: any) {
      alert("Erro ao afiliar: " + err.message);
    } finally {
      setLoadingAfil(false);
    }
  };`;

const originalCodeStart = 'const handleAfiliar = async () => {';
const originalCodeEnd = 'setLoadingAfil(false);\n    }\n  };';

// Since replacing large blocks of code using replace can be error-prone with regex, I'll use substring replace manually.
const startIndex = content.indexOf(originalCodeStart);
if(startIndex !== -1) {
    const endIndex = content.indexOf(originalCodeEnd, startIndex) + originalCodeEnd.length;
    const pre = content.substring(0, startIndex);
    const post = content.substring(endIndex);
    fs.writeFileSync('src/pages/cliente/MeusDados.tsx', pre + replacement + post);
    console.log("Patched MeusDados.tsx with email HTML and emailConfig");
} else {
    console.error("Could not find handleAfiliar block");
}
