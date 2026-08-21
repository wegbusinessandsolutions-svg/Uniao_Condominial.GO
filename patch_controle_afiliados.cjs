const fs = require('fs');

let content = `import React, { useState, useEffect } from "react";
import { Building2, Search, Edit2, Eye, MapPin, CheckCircle, Clock, Mail, Check } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendEmailWithLog } from "../../lib/emailService";

export default function ControleAfiliados() {
  const [afiliados, setAfiliados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "afiliados_uc"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setAfiliados(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleResendEmail = async (afiliado: any) => {
    if (!window.confirm(\`Deseja re-enviar o termo de afiliação para \${afiliado.nomeCondominio}?\`)) return;
    try {
      const configSnap = await getDoc(doc(db, "config_empresa", "email_settings"));
      const emailConfig = configSnap.exists() ? configSnap.data() : {};

      const userSnap = await getDoc(doc(db, "users", afiliado.userId));
      const userEmail = userSnap.exists() ? userSnap.data().email : "";

      if (!userEmail) {
        alert("E-mail do cliente não encontrado.");
        return;
      }

      const htmlTermo = \\\`
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6;">
        <h2 style="text-align: center; color: #0071e3;">TERMO DE AFILIAÇÃO À UNIÃO CONDOMINIAL</h2>
        <h4 style="text-align: center; color: #555;">PRODUTOS DE LIMPEZA E CONSERVAÇÃO</h4>
        <p>Prezado(a) <strong>\${afiliado.nomeSindico}</strong>,</p>
        <p>Re-enviamos sua solicitação de afiliação do condomínio <strong>\${afiliado.nomeCondominio}</strong> à União Condominial.</p>
        <p>Por favor, confira os dados do contrato abaixo. <strong>Para confirmar sua afiliação e aceitar os termos, responda a este e-mail com a frase: "DE ACORDO"</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        
        <h3>QUALIFICAÇÃO DO CONTRATANTE</h3>
        <ul>
          <li><strong>Condomínio:</strong> \${afiliado.nomeCondominio}</li>
          <li><strong>CNPJ:</strong> \${afiliado.cnpj || "Não informado"}</li>
          <li><strong>Unidades Habitacionais:</strong> \${afiliado.unidadesHabitacionais}</li>
          <li><strong>Síndico/Administrador:</strong> \${afiliado.nomeSindico}</li>
          <li><strong>Telefone:</strong> \${afiliado.telefone}</li>
          <li><strong>Vencimento Escolhido:</strong> Dia \${afiliado.diaVencimento}</li>
          <li><strong>Valor Mensal:</strong> R$ \${Number(afiliado.valorMensalidade).toFixed(2).replace('.', ',')}</li>
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

        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="text-align: center; font-size: 14px; color: #777;">Responda "DE ACORDO" para validar este termo legalmente.</p>
      </div>
      \\\`;

      await sendEmailWithLog({
        apiProvider: emailConfig.apiProvider || "sendgrid",
        apiKey: emailConfig.apiKey || "",
        apiDomain: emailConfig.apiDomain || "",
        apiEndpoint: emailConfig.apiEndpoint || "",
        to: userEmail,
        subject: "Re-envio: Termo de Afiliação - União Condominial",
        html: htmlTermo
      }, "AFILIACAO_UC");

      alert("E-mail de afiliação reenviado com sucesso!");
    } catch (err: any) {
      alert("Erro ao re-enviar e-mail: " + err.message);
    }
  };

  const handleApprove = async (afiliado: any) => {
    if (!window.confirm(\`Confirmar a afiliação de \${afiliado.nomeCondominio}? Isso gerará a taxa de afiliação no Contas a Receber e enviará o boleto por e-mail.\`)) return;
    
    try {
      // 1. Atualizar status para Ativo
      await updateDoc(doc(db, "afiliados_uc", afiliado.id), {
        status: "Ativo",
        dataAtivacao: new Date().toISOString()
      });

      // 2. Criar no Contas a Receber
      const hoje = new Date();
      let mesVencimento = hoje.getMonth() + 1;
      let anoVencimento = hoje.getFullYear();
      
      // Se o dia escolhido for menor que o dia de hoje (ex: hoje é 20, diaVencimento é 10), joga para o próximo mês
      if (afiliado.diaVencimento <= hoje.getDate()) {
         mesVencimento++;
         if (mesVencimento > 12) {
             mesVencimento = 1;
             anoVencimento++;
         }
      }
      const vencimentoStr = \\\`\${anoVencimento}-\\\${mesVencimento.toString().padStart(2, '0')}-\\\${afiliado.diaVencimento.toString().padStart(2, '0')}\\\`;

      const contasReceberPayload = {
        descricao: "Taxa de Afiliação a U.C.",
        valor: Number(afiliado.valorMensalidade),
        vencimento: vencimentoStr,
        parcelas: 1,
        clienteId: afiliado.userId,
        clienteNome: afiliado.nomeCondominio,
        status: "Aberto",
        categoria: "Afiliação",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, "contas_receber"), contasReceberPayload);

      // 3. Obter email do cliente e enviar o Boleto
      const userSnap = await getDoc(doc(db, "users", afiliado.userId));
      const userEmail = userSnap.exists() ? userSnap.data().email : "";

      if (userEmail) {
        const configSnap = await getDoc(doc(db, "config_empresa", "email_settings"));
        const emailConfig = configSnap.exists() ? configSnap.data() : {};

        const htmlBoleto = \\\`
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
          <h2 style="color: #0071e3;">Sua Afiliação foi Ativada com Sucesso!</h2>
          <p>Olá <strong>\${afiliado.nomeSindico}</strong>,</p>
          <p>Recebemos o seu "DE ACORDO" e informamos que o condomínio <strong>\${afiliado.nomeCondominio}</strong> agora é oficialmente um Afiliado à União Condominial.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0f172a;">Detalhes da Cobrança</h3>
            <p><strong>Descrição:</strong> Taxa de Afiliação a U.C.</p>
            <p><strong>Valor:</strong> R$ \${Number(afiliado.valorMensalidade).toFixed(2).replace('.', ',')}</p>
            <p><strong>Vencimento:</strong> \${afiliado.diaVencimento.toString().padStart(2, '0')}/\${mesVencimento.toString().padStart(2, '0')}/\${anoVencimento}</p>
            <br>
            <p>O seu boleto bancário já está disponível no sistema. Você também pode efetuar o pagamento via PIX acessando a área do cliente ou utilizando a chave abaixo.</p>
            <div style="text-align: center; margin-top: 15px;">
              <a href="#" style="background-color: #0071e3; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar Meu Boleto</a>
            </div>
          </div>
          <p>Agradecemos a parceria!</p>
          <p>Atenciosamente,<br>Equipe União Condominial</p>
        </div>
        \\\`;

        await sendEmailWithLog({
          apiProvider: emailConfig.apiProvider || "sendgrid",
          apiKey: emailConfig.apiKey || "",
          apiDomain: emailConfig.apiDomain || "",
          apiEndpoint: emailConfig.apiEndpoint || "",
          to: userEmail,
          subject: "Boleto de Afiliação - União Condominial",
          html: htmlBoleto
        }, "BOLETO_AFILIACAO");
      }

      alert("Afiliação aprovada! O Contas a Receber foi gerado e o e-mail de cobrança foi enviado.");
    } catch (err: any) {
      alert("Erro ao aprovar afiliação: " + err.message);
    }
  };

  const filtered = afiliados.filter(a => 
    a.nomeCondominio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.nomeSindico?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Controle de Afiliados U.C.</h1>
          <p className="text-slate-500 mt-1">Gerencie os condomínios afiliados à União Condominial.</p>
        </div>
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
          <Building2 size={24} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por condomínio ou síndico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Nome do Condomínio</th>
                <th className="px-6 py-4 font-medium">Qtd Unid. Habitac.</th>
                <th className="px-6 py-4 font-medium">Nome do Síndico</th>
                <th className="px-6 py-4 font-medium">Telefone</th>
                <th className="px-6 py-4 font-medium">Data Afiliação</th>
                <th className="px-6 py-4 font-medium">Dia Venc.</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Carregando afiliados...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Nenhum afiliado encontrado.</td>
                </tr>
              ) : (
                filtered.map((afiliado) => {
                   let dataAfil = "-";
                   if (afiliado.createdAt) {
                     // Handle both Firestore Timestamp and String formats
                     const d = afiliado.createdAt.toDate ? afiliado.createdAt.toDate() : new Date(afiliado.createdAt);
                     dataAfil = isNaN(d) ? "-" : d.toLocaleDateString("pt-BR");
                   }

                   return (
                  <tr key={afiliado.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{afiliado.nomeCondominio || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{afiliado.unidadesHabitacionais || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{afiliado.nomeSindico || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{afiliado.telefone || "-"}</td>
                    <td className="px-6 py-4 text-slate-600">{dataAfil}</td>
                    <td className="px-6 py-4 text-slate-600">Dia {afiliado.diaVencimento || "-"}</td>
                    <td className="px-6 py-4">
                      {afiliado.status === "Ativo" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <CheckCircle size={14} /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock size={14} /> {afiliado.status || "Pendente"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {afiliado.status !== "Ativo" && (
                          <button onClick={() => handleApprove(afiliado)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Confirmar Aceite (Gerar Boleto)">
                            <Check size={18} />
                          </button>
                        )}
                        <button onClick={() => handleResendEmail(afiliado)} className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Re-enviar E-mail de Afiliação">
                          <Mail size={18} />
                        </button>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalhes">
                          <Eye size={18} />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/comercial/ControleAfiliados.tsx', content);
