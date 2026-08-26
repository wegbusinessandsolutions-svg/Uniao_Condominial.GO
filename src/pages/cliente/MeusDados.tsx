import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { User, Building2, Check, CheckCircle, HeartHandshake, AlertTriangle, AlertCircle, RefreshCw, X, Receipt, Clock, XCircle, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendEmailWithLog } from "../../lib/emailService";
import { syncAfiliacaoContasReceber, getContasReceberAfiliado, processarCancelamentoAfiliacaoFinanceiro, validarAfiliacaoAntesDePersistir } from "../../services/afiliacaoFinanceiroService";

export default function MeusDados() {
  const { profile, user } = useAuth();
  const [queroAfiliar, setQueroAfiliar] = useState(false);
  const [unidades, setUnidades] = useState<number | "">("");
  const [diaVencimento, setDiaVencimento] = useState<number | null>(null);
  const [afiliadoStatus, setAfiliadoStatus] = useState<string | null>(null);
  const [afiliadoData, setAfiliadoData] = useState<any | null>(null);
  const [loadingAfil, setLoadingAfil] = useState(false);
  const [faturasAfil, setFaturasAfil] = useState<any[]>([]);
  const [showFaturasList, setShowFaturasList] = useState(false);

  // Cancellation states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (user?.uid) {
      // Check if already affiliated
      const checkAfil = async () => {
        try {
          const d = await getDoc(doc(db, "afiliados_uc", user.uid));
          if (d.exists()) {
            const data = d.data();
            setAfiliadoData(data);
            setAfiliadoStatus(data.status || "Ativo");
          } else if ((profile as any)?.afiliado || (profile as any)?.isAfiliado) {
            setAfiliadoStatus("Ativo");
          }
        } catch (e) {
          console.warn("Erro ao buscar afiliação:", e);
        }
      };
      checkAfil();

      // Realtime listener for client's affiliation bills
      const qContas = query(
        collection(db, "contas_receber"),
        where("afiliacaoId", "==", user.uid)
      );
      const unsubContas = onSnapshot(
        qContas,
        (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
          list.sort((a, b) => (Number(a.numeroParcela) || 0) - (Number(b.numeroParcela) || 0));
          setFaturasAfil(list);
        },
        (err) => {
          console.warn("Aviso ao carregar faturas da afiliação:", err);
        }
      );

      return () => unsubContas();
    }
  }, [user, profile]);

  const getFormattedDataAfiliacao = () => {
    const rawDate =
      afiliadoData?.dataAtivacao ||
      afiliadoData?.dataAfiliacao ||
      afiliadoData?.createdAt ||
      (profile as any)?.dataAfiliacao ||
      (profile as any)?.dataCadastro;
    if (!rawDate) return new Date().toLocaleDateString("pt-BR");

    if (typeof rawDate === "object" && typeof rawDate.toDate === "function") {
      return rawDate.toDate().toLocaleDateString("pt-BR");
    }
    if (typeof rawDate === "string") {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("pt-BR");
        }
        return rawDate;
      } catch {
        return rawDate;
      }
    }
    return new Date().toLocaleDateString("pt-BR");
  };

  const calcValorUnidade = (u: number) => {
    if (u <= 12) return 9.9;
    if (u <= 24) return 8.5;
    if (u <= 40) return 8.0;
    if (u <= 60) return 7.5;
    if (u <= 80) return 7.0;
    if (u <= 100) return 6.5;
    if (u <= 150) return 6.0;
    if (u <= 200) return 5.5;
    if (u <= 300) return 5.0;
    return 4.5;
  };

  const calcValorMensalidade = () => {
    if (!unidades) return 0;
    const u = Number(unidades);
    if (isNaN(u) || u < 1) return 0;
    return u * calcValorUnidade(u);
  };

  const handleAfiliar = async () => {
    if (!unidades || Number(unidades) < 1) {
      setAfiliadoStatus("Erro: Informe a quantidade válida.");
      return;
    }
    if (!diaVencimento) {
      setAfiliadoStatus("Erro: Selecione o dia.");
      return;
    }
    setLoadingAfil(true);
    try {
      const emailCli = profile?.email || user?.email || "";
      const nomeCondominio = profile?.displayName || profile?.nome || "Condomínio";
      const cnpj = profile?.cnpj || profile?.cpfCnpj || "Não informado";
      const nomeSindico = (profile as any)?.nomeResponsavel || profile?.nome || "Não informado";
      const tel = profile?.telefone || profile?.phone || "Não informado";

      const data = {
        userId: user?.uid,
        nomeCondominio,
        cnpj,
        nomeSindico,
        telefone: tel,
        unidadesHabitacionais: Number(unidades),
        diaVencimento,
        valorMensalidade: calcValorMensalidade(),
        email: emailCli,
        status: "Ativo",
        afiliado: true,
        dataAfiliacao: new Date().toISOString(),
        createdAt: serverTimestamp(),
      };

      // Validação de Integridade Financeira antes da persistência no Firestore
      const validacaoPrevia = validarAfiliacaoAntesDePersistir({
        ...data,
        id: user!.uid,
        diaVencimento: diaVencimento || 10
      });

      if (!validacaoPrevia.isValid) {
        throw new Error(`Inconsistência financeira: ${validacaoPrevia.erros.join("; ")}`);
      }

      await setDoc(doc(db, "afiliados_uc", user!.uid), {
        ...data,
        valorTotalContrato: validacaoPrevia.valorTotalAfiliacao
      });

      // Sincroniza e inclui as 12 parcelas no Contas a Receber com Titular = Nome do Condomínio
      try {
        await syncAfiliacaoContasReceber(
          { id: user!.uid, ...data, valorTotalContrato: validacaoPrevia.valorTotalAfiliacao },
          { actorName: nomeSindico || profile?.displayName || "Cliente", origemAcao: "Painel Meus Dados" }
        );
      } catch (syncErr) {
        console.warn("Aviso ao sincronizar contas a receber:", syncErr);
      }

      const htmlTermo = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px;">
        <h2 style="text-align: center; color: #0071e3; margin-bottom: 4px;">TERMO DE AFILIAÇÃO À UNIÃO CONDOMINIAL</h2>
        <h4 style="text-align: center; color: #555; margin-top: 0;">PRODUTOS DE LIMPEZA E CONSERVAÇÃO</h4>
        <p>Prezado(a) <strong>${nomeSindico}</strong>,</p>
        <p>Recebemos sua solicitação de afiliação do condomínio <strong>${nomeCondominio}</strong> à União Condominial.</p>
        <p>Por favor, confira os dados do contrato abaixo. <strong>Para confirmar sua afiliação e aceitar os termos, responda a este e-mail com a frase: "DE ACORDO"</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        
        <h3 style="color: #0f172a;">QUALIFICAÇÃO DO CONTRATANTE</h3>
        <ul>
          <li><strong>Condomínio:</strong> ${nomeCondominio}</li>
          <li><strong>CNPJ:</strong> ${cnpj}</li>
          <li><strong>Unidades Habitacionais:</strong> ${unidades}</li>
          <li><strong>Síndico/Administrador:</strong> ${nomeSindico}</li>
          <li><strong>Telefone:</strong> ${tel}</li>
          <li><strong>Email:</strong> ${emailCli}</li>
          <li><strong>Vencimento Escolhido:</strong> Dia ${diaVencimento}</li>
          <li><strong>Valor Mensal:</strong> R$ ${calcValorMensalidade().toFixed(2).replace('.', ',')}</li>
        </ul>

        <h3 style="color: #0f172a;">CLÁUSULA 1ª — DO OBJETO</h3>
        <p>O presente Termo tem por objeto a afiliação do CONTRATANTE à União Condominial — Produtos de Limpeza e Conservação, assegurando-lhe acesso a uma lista de serviços condominiais rotineiros, prestados com desconto de até 50% (cinquenta por cento) sobre os valores praticados ao mercado em geral, nos termos e condições estabelecidos neste instrumento.</p>
        
        <h3 style="color: #0f172a;">CLÁUSULA 2ª — DA VIGÊNCIA</h3>
        <p>O presente Termo de Afiliação vigorará pelo prazo de 12 (doze) meses, contados da data de sua assinatura (confirmação por e-mail), sendo automaticamente renovado por iguais e sucessivos períodos de 12 (doze) meses.</p>

        <h3 style="color: #0f172a;">CLÁUSULA 3ª — DOS SERVIÇOS CONDOMINIAIS ROTINEIROS</h3>
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
        <p style="text-align: center; font-size: 15px; color: #0284c7; font-weight: bold;">Para validar legalmente e confirmar, responda a este e-mail com a frase: "DE ACORDO".</p>
      </div>
      `;

      if (emailCli && emailCli.includes("@")) {
        await sendEmailWithLog({
          to: emailCli,
          subject: "Termo de Afiliação - União Condominial",
          html: htmlTermo
        }, "AFILIACAO_UC");
      }

      setAfiliadoData(data);
      setAfiliadoStatus("Ativo");
      setQueroAfiliar(false);
      setCancelFeedback({
        type: "success",
        message: "Afiliação realizada com sucesso! O termo foi encaminhado ao seu e-mail.",
      });
    } catch (err: any) {
      setAfiliadoStatus("Erro: " + err.message);
    } finally {
      setLoadingAfil(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!user?.uid) return;
    setCanceling(true);
    try {
      const emailCli = profile?.email || user?.email || afiliadoData?.email || "";
      const nomeCondominio = profile?.displayName || profile?.nome || afiliadoData?.nomeCondominio || "Condomínio";
      const cnpj = profile?.cnpj || profile?.cpfCnpj || afiliadoData?.cnpj || "Não informado";
      const nomeSindico = (profile as any)?.nomeResponsavel || profile?.nome || afiliadoData?.nomeSindico || "Síndico/Responsável";
      const nowIso = new Date().toISOString();

      // 1. Update in Firestore
      await setDoc(
        doc(db, "afiliados_uc", user.uid),
        {
          status: "Cancelado",
          afiliado: false,
          dataCancelamento: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2. Processa cancelamento financeiro das parcelas > 15 dias
      let cancelFinResult: any = null;
      try {
        cancelFinResult = await processarCancelamentoAfiliacaoFinanceiro(user.uid, {
          dataCancelamento: new Date(),
          actorName: nomeSindico || profile?.displayName || "Cliente",
          nomeCondominio,
          email: emailCli,
          motivo: "Desfiliação confirmada pelo cliente no painel Meus Dados",
        });
      } catch (finErr) {
        console.warn("Aviso ao cancelar parcelas no financeiro:", finErr);
      }

      const temFaturaRestante = (cancelFinResult?.mantidasComMenosDe15Dias || 0) > 0;
      const proximaFatura = cancelFinResult?.parcelasMantidas?.[0];
      const dataVencFormatada = proximaFatura?.vencimento
        ? new Date(proximaFatura.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
        : "";
      const valorFormatado = proximaFatura
        ? `R$ ${Number(proximaFatura.valor || 0).toFixed(2).replace(".", ",")}`
        : "";

      // 3. Prepare automated cancellation & benefits loss email
      const htmlEmailCancelamento = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 680px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0 0 4px 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px;">UNIÃO CONDOMINIAL</h2>
            <span style="font-size: 12px; font-weight: bold; color: #ef4444; letter-spacing: 1.5px; text-transform: uppercase;">COMUNICADO OFICIAL DE DESFILIAÇÃO</span>
          </div>

          <p>Prezado(a) <strong>${nomeSindico}</strong>,</p>
          <p>Confirmamos o processamento da solicitação de cancelamento da afiliação do condomínio <strong>${nomeCondominio}</strong> (CNPJ: ${cnpj}).</p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 13.5px; font-weight: bold;">
              ⚠️ Confirmação do Cancelamento:
            </p>
            <p style="margin: 6px 0 0 0; color: #7f1d1d; font-size: 13px; line-height: 1.5;">
              O cancelamento da sua afiliação é <strong>imediato</strong>. A partir de agora, não constam mais mensalidades ativas e o seu condomínio deixa de usufruir dos descontos e vantagens da União Condominial.
            </p>
          </div>

          <h3 style="color: #0f172a; font-size: 16px; margin-top: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            Perda de Benefícios e Descontos Exclusivos
          </h3>
          <p style="font-size: 13.5px; color: #334155;">
            Com a desfiliação, informamos que o seu condomínio e todos os seus condôminos deixam de usufruir de todas as vantagens exclusivas da União Condominial:
          </p>

          <ul style="color: #334155; font-size: 13px; line-height: 1.6; padding-left: 20px;">
            <li><strong>Descontos de até 50% em Serviços Condominiais Rotineiros:</strong> Limpeza de Caixa d'Água e Reservatório Inferior, Limpeza de Caixas de Gordura, Serviços de Jardinagem, Manutenção de Portões Eletrônicos, Cercas Elétricas, CFTV e Sistemas de Alarme.</li>
            <li><strong>Clube de Benefícios dos Moradores:</strong> Perda de todos os descontos exclusivos em marcas, comércios e empresas parceiras credenciadas para condôminos e familiares.</li>
            <li><strong>Condições Especiais de Negociação e Prioridade de Atendimento.</strong></li>
          </ul>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 24px 0; text-align: center;">
            <strong style="color: #166534; font-size: 14px; display: block; margin-bottom: 4px;">
              O seu condomínio não poderia ficar de fora!
            </strong>
            <span style="font-size: 12.5px; color: #15803d; line-height: 1.4; display: block;">
              Sabemos o quanto esses benefícios representam em economia para o caixa do condomínio e valorização patrimonial. Caso decida retornar, as portas da União Condominial estarão sempre abertas.
            </span>
          </div>

          <p style="font-size: 13px; color: #475569; text-align: center;">
            Para reativar sua afiliação a qualquer momento, basta acessar a área de <strong>Meus Dados</strong> no sistema e clicar na opção <strong>"Afiliar-se Novamente"</strong>.
          </p>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
          <div style="text-align: center; font-size: 11px; color: #94a3b8;">
            União Condominial — Produtos de Limpeza e Conservação<br/>
            <a href="https://www.uniaocondominial.com.br" style="color: #0071e3; text-decoration: none;">www.uniaocondominial.com.br</a>
          </div>
        </div>
      `;

      if (emailCli && emailCli.includes("@")) {
        await sendEmailWithLog(
          {
            to: emailCli,
            subject: "Comunicado de Desfiliação e Perda de Benefícios - União Condominial",
            html: htmlEmailCancelamento,
          },
          "CANCELAMENTO_AFILIACAO"
        );
      }

      setAfiliadoStatus("Cancelado");
      setAfiliadoData((prev: any) => ({ ...prev, status: "Cancelado" }));
      setShowCancelModal(false);
      setCancelFeedback({
        type: "success",
        message: "Afiliação cancelada com sucesso. Caso deseje retornar no futuro, basta clicar em 'Afiliar-se Novamente'.",
      });
    } catch (err: any) {
      console.error("Erro ao cancelar afiliação:", err);
      setCancelFeedback({
        type: "error",
        message: `Erro ao cancelar afiliação: ${err.message || "Tente novamente mais tarde."}`,
      });
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Feedback Toast */}
      {cancelFeedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs ${
            cancelFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {cancelFeedback.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <p className="text-sm font-semibold">{cancelFeedback.message}</p>
          </div>
          <button
            onClick={() => setCancelFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Meus Dados</h1>
            <p className="text-sm text-slate-500">Confira e mantenha seus dados de cadastro atualizados.</p>
          </div>
        </div>
        <div className="p-6">
          <dl className="divide-y divide-slate-100">
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Tipo de cadastro</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.tipoCadastro || (profile?.cnpj ? "Pessoa Jurídica" : "Pessoa Física")}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">{(profile as any)?.tipoCadastro === "Fisica" || !profile?.cnpj ? "Nome Completo" : "Empresa / Condomínio"}</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.displayName || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">{(profile as any)?.tipoCadastro === "Fisica" || !profile?.cnpj ? "C.P.F." : "C.N.P.J."}</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.cnpj || profile?.cpf || profile?.cpfCnpj || profile?.documento || "Não informado"}</dd>
            </div>
            {((profile as any)?.tipoCadastro === "Juridica" || profile?.cnpj) && (
              <>
                <div className="py-4 flex justify-between items-center">
                  <dt className="text-sm font-medium text-slate-500">Responsável / Contato</dt>
                  <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.nomeResponsavel || "Não informado"}</dd>
                </div>
                <div className="py-4 flex justify-between items-center">
                  <dt className="text-sm font-medium text-slate-500">Função</dt>
                  <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.funcao || "Não informado"}</dd>
                </div>
              </>
            )}
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Telefone / Celular</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.telefone || profile?.phone || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Endereço</dt>
              <dd className="text-sm text-slate-900 font-medium text-right max-w-sm">
                {profile?.endereco ? `${profile.endereco}, nº ${profile.numero || 'S/N'}${profile.complemento ? ` - ${profile.complemento}` : ''}, ${profile.bairro || ''}, ${profile.cidade || ''}/${profile.estado || ''}, CEP ${profile.cep || ''}` : "Não informado"}
              </dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">E-mail</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.email}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Data de cadastro</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.dataCadastro || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Código de Indicação</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.codigoIndicacao || "Sem Indicação"}</dd>
            </div>
            
            
          </dl>
        </div>
      </div>
      <div className="mt-6 bg-slate-50 p-4 rounded-xl text-center text-sm text-slate-500 border border-slate-200">
        Para alterar seus dados, fale com nosso atendimento em <a href="mailto:sac@uniaocondominial.com.br" className="font-semibold text-brand-dark">sac@uniaocondominial.com.br</a>.
      </div>
    </div>
  );
}
