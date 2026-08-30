import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Building2, Check, CheckCircle, HeartHandshake, AlertTriangle, AlertCircle, X, Receipt, ChevronDown, ChevronUp, FileText, Barcode, Printer, Mail, Send, Calendar, DollarSign, UserCheck, ShieldCheck, Building } from "lucide-react";
import { doc, setDoc, addDoc, serverTimestamp, collection, onSnapshot, query, where, getDocs, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendEmailWithLog } from "../../lib/emailService";
import { syncAfiliacaoContasReceber, validarAfiliacaoAntesDePersistir } from "../../services/afiliacaoFinanceiroService";

export default function Afiliacao() {
  const { user, profile } = useAuth();
  
  const [queroAfiliar, setQueroAfiliar] = useState(false);
  const [unidades, setUnidades] = useState<number | "">("");
  const [diaVencimento, setDiaVencimento] = useState<number | null>(null);
  const [afiliadoStatus, setAfiliadoStatus] = useState<string | null>(null);
  const [afiliadoData, setAfiliadoData] = useState<any | null>(null);
  const [loadingAfil, setLoadingAfil] = useState(false);
  const [faturasAfil, setFaturasAfil] = useState<any[]>([]);
  const [showFaturasList, setShowFaturasList] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelFeedback, setCancelFeedback] = useState<{type: 'success'|'error', message: string} | null>(null);

  // Solicitação de envio de boleto para mensalidade em atraso
  const [showSolicitacaoBoletoModal, setShowSolicitacaoBoletoModal] = useState(false);
  const [selectedParcelaParaBoleto, setSelectedParcelaParaBoleto] = useState<any | null>(null);
  const [emailDestinoBoleto, setEmailDestinoBoleto] = useState("");
  const [solicitandoBoleto, setSolicitandoBoleto] = useState(false);
  const [franqueadaModalInfo, setFranqueadaModalInfo] = useState<{
    id: string;
    codigoUnidade: string;
    nomeFranqueada: string;
    emailFinanceiro: string;
    emailGeral: string;
    cidade?: string;
    uf?: string;
  } | null>(null);

  // Helper para identificar a empresa franqueada responsável e seu e-mail financeiro
  const findFranqueadaParaCliente = async (
    afiliado: any,
    userProfile: any,
    parcela: any
  ) => {
    try {
      const rawTarget =
        parcela?.codigoUnidade ||
        parcela?.franqueadaId ||
        afiliado?.codigoUnidade ||
        afiliado?.franqueadaId ||
        userProfile?.codigoUnidade ||
        userProfile?.franqueadaId ||
        "";

      const targetClean = String(rawTarget || "").trim().toUpperCase();

      // 1. Buscar na coleção principal config_empresa
      const empSnap = await getDocs(collection(db, "config_empresa"));
      let matchingDoc: any = null;
      let fallbackDoc: any = null;

      empSnap.forEach((d) => {
        const data = d.data();
        const currentObj = { id: d.id, ...data };
        if (!fallbackDoc) fallbackDoc = currentObj;
        if (data.statusFranquia === "Ativa" && (!fallbackDoc || fallbackDoc.statusFranquia !== "Ativa")) {
          fallbackDoc = currentObj;
        }

        if (targetClean) {
          if (
            d.id === rawTarget ||
            (data.codigoUnidade && data.codigoUnidade.toUpperCase() === targetClean) ||
            (data.cnpj && data.cnpj === rawTarget)
          ) {
            matchingDoc = currentObj;
          }
        }
      });

      // 2. Se não encontrou em config_empresa, busca em config_franqueadora (legado)
      if (!matchingDoc) {
        try {
          const frqSnap = await getDocs(collection(db, "config_franqueadora"));
          frqSnap.forEach((d) => {
            const data = d.data();
            const currentObj = { id: d.id, ...data };
            if (!fallbackDoc) fallbackDoc = currentObj;
            if (targetClean) {
              if (
                d.id === rawTarget ||
                (data.codigoUnidade && data.codigoUnidade.toUpperCase() === targetClean) ||
                (data.numeroFranqueada && data.numeroFranqueada.toUpperCase() === targetClean)
              ) {
                matchingDoc = currentObj;
              }
            }
          });
        } catch (err) {
          console.warn("Aviso ao buscar config_franqueadora:", err);
        }
      }

      const finalDoc = matchingDoc || fallbackDoc;
      if (!finalDoc) return null;

      return {
        id: finalDoc.id,
        codigoUnidade: finalDoc.codigoUnidade || finalDoc.numeroFranqueada || "",
        nomeFranqueada: finalDoc.nomeFantasia || finalDoc.razaoSocial || "Empresa Franqueada",
        emailFinanceiro: (finalDoc.emailFinanceiro || "").trim(),
        emailGeral: (finalDoc.email || "").trim(),
        cidade: finalDoc.cidade || "",
        uf: finalDoc.uf || ""
      };
    } catch (error) {
      console.warn("Erro ao identificar franqueada para solicitação de boleto:", error);
      return null;
    }
  };

  // Monitor Afiliacao
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "afiliados_uc", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAfiliadoData(data);
        if (data.status === "Cancelado") {
          setAfiliadoStatus("Cancelado");
        } else if (data.status === "Pendente") {
          setAfiliadoStatus("Pendente de Aceite por E-mail");
        } else if (data.status === "Ativo" || data.afiliado === true) {
          setAfiliadoStatus("Ativo");
        }
        if (data.unidadesHabitacionais) {
          setUnidades(data.unidadesHabitacionais);
        }
      } else {
        setAfiliadoStatus(null);
        setAfiliadoData(null);
      }
    });

    return () => unsub();
  }, [user]);

  // Carregar Faturas de Afiliação (contas_receber)
  useEffect(() => {
    if (user?.uid) {
      const targetId = user.uid;
      const qContas = query(collection(db, "contas_receber"), where("afiliacaoId", "==", targetId));
      
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
  }, [user]);

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

      try {
        await syncAfiliacaoContasReceber(
          { id: user!.uid, ...data, valorTotalContrato: validacaoPrevia.valorTotalAfiliacao },
          { actorName: nomeSindico || profile?.displayName || "Cliente", origemAcao: "Painel Afiliacao" }
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
      const nowIso = new Date().toISOString();

      await setDoc(
        doc(db, "afiliados_uc", user.uid),
        {
          status: "Cancelado",
          afiliado: false,
          canceladoEm: nowIso,
          dataCancelamento: nowIso,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const htmlCancel = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px;">
        <h2 style="text-align: center; color: #e11d48; margin-bottom: 4px;">AVISO DE CANCELAMENTO DE AFILIAÇÃO</h2>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p>Prezado(a) responsável pelo <strong>${nomeCondominio}</strong>,</p>
        <p>Confirmamos o recebimento do seu pedido de cancelamento da afiliação à <strong>União Condominial</strong>, efetivado em ${new Date().toLocaleDateString('pt-BR')}.</p>
        <p>Informamos que, a partir desta data, os descontos exclusivos de até 50% em serviços condominiais rotineiros e os benefícios oferecidos ao condomínio foram suspensos.</p>
        <p>Caso deseje reativar sua afiliação e voltar a aproveitar todas as nossas vantagens, você pode fazê-lo a qualquer momento diretamente pelo nosso painel, clicando no botão "Afiliar-se Novamente".</p>
        <p>Agradecemos a confiança e continuamos à disposição para quaisquer dúvidas.</p>
        <br/>
        <p style="color: #64748b; font-size: 13px;">Atenciosamente,<br/><strong>Equipe União Condominial</strong></p>
      </div>
      `;

      if (emailCli && emailCli.includes("@")) {
        await sendEmailWithLog({
          to: emailCli,
          subject: "Confirmação de Cancelamento - União Condominial",
          html: htmlCancel
        }, "CANCELAMENTO_AFILIACAO_CLIENTE");
      }

      setAfiliadoStatus("Cancelado");
      setShowCancelModal(false);
      setCancelFeedback({
        type: "success",
        message: "Sua afiliação foi cancelada com sucesso.",
      });
      setQueroAfiliar(false);
    } catch (error) {
      console.error("Erro ao cancelar afiliação:", error);
      setCancelFeedback({
        type: "error",
        message: "Ocorreu um erro ao cancelar a afiliação. Tente novamente mais tarde.",
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleAbrirSolicitacaoBoleto = async (parcela: any) => {
    setSelectedParcelaParaBoleto(parcela);
    const defaultEmail = profile?.email || user?.email || afiliadoData?.email || "";
    setEmailDestinoBoleto(defaultEmail);
    setShowSolicitacaoBoletoModal(true);

    // Carrega informações da franqueada responsável
    const frq = await findFranqueadaParaCliente(afiliadoData, profile, parcela);
    setFranqueadaModalInfo(frq);
  };

  const handleConfirmarSolicitacaoBoleto = async () => {
    if (!selectedParcelaParaBoleto) return;
    const finalEmailDestino = (emailDestinoBoleto || profile?.email || user?.email || afiliadoData?.email || "").trim();
    if (!finalEmailDestino || !finalEmailDestino.includes("@")) {
      setCancelFeedback({
        type: "error",
        message: "Não foi possível identificar o e-mail do cliente cadastrado para recebimento."
      });
      return;
    }

    setSolicitandoBoleto(true);
    try {
      const nomeCliente = profile?.displayName || profile?.nome || (profile as any)?.nomeFantasia || (profile as any)?.razaoSocial || afiliadoData?.nomeCondominio || "Condomínio Afiliado";
      const cnpjCliente = profile?.cnpj || profile?.cpfCnpj || (profile as any)?.cpf || (profile as any)?.documento || afiliadoData?.cnpj || "Não informado";
      const representante = (profile as any)?.nomeResponsavel || (profile as any)?.responsavel || profile?.nome || afiliadoData?.nomeSindico || "Não informado";
      const numParcela = selectedParcelaParaBoleto.numeroParcela || "1";
      const valorFormatado = Number(selectedParcelaParaBoleto.valor || 0).toFixed(2).replace('.', ',');
      const vencFormatado = selectedParcelaParaBoleto.vencimento ? new Date(selectedParcelaParaBoleto.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "Não informado";

      // 1. Identificar a franqueada e o e-mail do departamento financeiro
      const franqueadaInfo = franqueadaModalInfo || (await findFranqueadaParaCliente(afiliadoData, profile, selectedParcelaParaBoleto));
      const emailFinanceiroFranqueada = (franqueadaInfo?.emailFinanceiro || franqueadaInfo?.emailGeral || "").trim();
      const nomeFranqueada = franqueadaInfo?.nomeFranqueada || "União Condominial";
      const codigoUnidadeFranqueada = franqueadaInfo?.codigoUnidade || "";

      // 2. Salvar solicitação no Firestore (com dados de rastreio e vínculo da franqueada)
      await addDoc(collection(db, "solicitacoes_boletos"), {
        userId: user?.uid || "",
        afiliacaoId: user?.uid || "",
        nomeCliente,
        cnpj: cnpjCliente,
        representadoPor: representante,
        emailEnvio: finalEmailDestino,
        emailFinanceiroFranqueada: emailFinanceiroFranqueada || null,
        franqueadaId: franqueadaInfo?.id || "",
        codigoUnidade: codigoUnidadeFranqueada,
        nomeFranqueada: nomeFranqueada,
        parcelaId: selectedParcelaParaBoleto.id || "",
        numeroParcela: numParcela,
        valor: selectedParcelaParaBoleto.valor || 0,
        vencimentoOriginal: selectedParcelaParaBoleto.vencimento || "",
        status: "Solicitado",
        tipo: "Emissão de Boleto em Atraso",
        solicitadoEm: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });

      // 3. Enviar mensagem ao e-mail cadastrado no item "Departamento Financeiro" da referida franqueada
      if (emailFinanceiroFranqueada) {
        const htmlFinanceiro = `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0071e3; margin: 0 0 4px 0;">UNIÃO CONDOMINIAL</h2>
            <p style="color: #0f172a; font-size: 14px; font-weight: bold; margin: 0;">DEPARTAMENTO FINANCEIRO DA FRANQUEADA</p>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Unidade: <strong>${nomeFranqueada}</strong> ${codigoUnidadeFranqueada ? `(${codigoUnidadeFranqueada})` : ""}</p>
          </div>

          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />

          <div style="background-color: #eff6ff; border-left: 4px solid #0071e3; padding: 14px 16px; border-radius: 6px; margin-bottom: 18px;">
            <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: bold;">
              Notificação: Solicitação de Boleto em Atraso
            </p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #334155;">
              O cliente abaixo registrou uma solicitação de 2ª via / novo boleto bancário atualizado para pagamento da mensalidade de afiliação em atraso.
            </p>
          </div>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin-top: 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Dados do Cliente Solicitante</h3>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Nome do Condomínio / Cliente:</strong> ${nomeCliente}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>C.N.P.J. Nº:</strong> ${cnpjCliente}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Representado por:</strong> ${representante}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>E-mail do Cliente para Envio do Boleto:</strong> <a href="mailto:${finalEmailDestino}" style="color: #0071e3; font-weight: bold;">${finalEmailDestino}</a></p>
          </div>

          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <h3 style="margin-top: 0; font-size: 14px; color: #92400e; border-bottom: 1px solid #fde68a; padding-bottom: 8px;">Detalhes da Parcela em Atraso</h3>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Parcela:</strong> ${numParcela}/12</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Vencimento Original:</strong> ${vencFormatado}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Valor da Mensalidade:</strong> R$ ${valorFormatado}</p>
            <p style="margin: 6px 0; font-size: 13px;"><strong>Data/Hora do Registro:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          </div>

          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #334155;">
            <strong style="color: #0f172a;">Ação Necessária do Departamento Financeiro:</strong>
            <ol style="margin: 8px 0 0 0; padding-left: 20px; line-line-height: 1.6;">
              <li>Emitir o novo boleto bancário referente à <strong>Parcela ${numParcela}/12</strong> com a nova data de vencimento;</li>
              <li>Encaminhar o boleto bancário atualizado diretamente para o e-mail: <strong>${finalEmailDestino}</strong>.</li>
            </ol>
          </div>

          <br />
          <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: center;">
            União Condominial — Gestão Financeira Franqueadora & Franqueadas
          </p>
        </div>
        `;

        await sendEmailWithLog({
          to: emailFinanceiroFranqueada,
          subject: `[Depto. Financeiro] Solicitação de Novo Boleto em Atraso - Parcela ${numParcela}/12 - ${nomeCliente}`,
          html: htmlFinanceiro
        }, "SOLICITACAO_BOLETO_FINANCEIRO_FRANQUEADA");
      }

      // 4. Montar e enviar e-mail de confirmação ao cliente
      const htmlEmailCliente = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0071e3; margin: 0 0 6px 0;">UNIÃO CONDOMINIAL</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0;">Solicitação de Emissão de Boleto para Pagamento de Mensalidade em Atraso</p>
        </div>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />

        <p style="font-size: 15px; color: #334155;">
          Confirmamos o registro da sua solicitação de emissão de um novo boleto bancário atualizado para pagamento de mensalidade da Afiliação à União Condominial.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 18px 0;">
          <h3 style="margin-top: 0; font-size: 15px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Dados do Cliente Solicitante</h3>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Nome do Cliente / Condomínio:</strong> ${nomeCliente}</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>C.N.P.J. Nº:</strong> ${cnpjCliente}</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Representado por:</strong> ${representante}</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>E-mail de envio:</strong> ${finalEmailDestino}</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Unidade Franqueada Responsável:</strong> ${nomeFranqueada}</p>
        </div>

        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 18px 0;">
          <h3 style="margin-top: 0; font-size: 15px; color: #92400e; border-bottom: 1px solid #fde68a; padding-bottom: 8px;">Mensalidade em Atraso</h3>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Parcela:</strong> ${numParcela}/12</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Vencimento Original:</strong> ${vencFormatado}</p>
          <p style="margin: 6px 0; font-size: 13px;"><strong>Valor:</strong> R$ ${valorFormatado}</p>
        </div>

        <p style="font-size: 13px; color: #475569;">
          Sua solicitação foi encaminhada diretamente ao <strong>Departamento Financeiro</strong> da unidade franqueada responsável (<strong>${nomeFranqueada}</strong>), que emitirá a 2ª via atualizada com a nova data de vencimento e enviará o boleto diretamente para o seu e-mail cadastrado (<strong>${finalEmailDestino}</strong>).
        </p>

        <br />
        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; text-align: center;">
          União Condominial — Produtos de Limpeza e Conservação
        </p>
      </div>
      `;

      await sendEmailWithLog({
        to: finalEmailDestino,
        subject: `Solicitação de Boleto em Atraso - Parcela ${numParcela}/12 - ${nomeCliente}`,
        html: htmlEmailCliente
      }, "SOLICITACAO_BOLETO_CLIENTE");

      setShowSolicitacaoBoletoModal(false);
      setCancelFeedback({
        type: "success",
        message: `Solicitação de emissão de novo boleto referente à Parcela ${numParcela}/12 enviada com sucesso! O Departamento Financeiro foi notificado.`
      });
    } catch (error: any) {
      console.error("Erro ao solicitar novo boleto:", error);
      setCancelFeedback({
        type: "error",
        message: "Ocorreu um erro ao enviar a solicitação do boleto. Tente novamente."
      });
    } finally {
      setSolicitandoBoleto(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Feedback Toast */}
      {cancelFeedback && (
        <div
          className={`p-4 rounded-3xl flex items-center justify-between gap-3 shadow-md ${
            cancelFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {cancelFeedback.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{cancelFeedback.message}</p>
          </div>
          <button
            onClick={() => setCancelFeedback(null)}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              cancelFeedback.type === "success" ? "hover:bg-emerald-100" : "hover:bg-rose-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-50 text-[#0071e3] rounded-2xl shadow-xs">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-normal text-slate-900 tracking-tight">Afiliado - União Condominial</h2>
              <p className="text-sm text-slate-500 font-normal">Gerencie sua afiliação e benefícios exclusivos</p>
            </div>
          </div>
          
          <div className="mt-8">
            {(!afiliadoStatus || afiliadoStatus === "Cancelado" || queroAfiliar) && (
              <div className="py-6">
                <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setQueroAfiliar(!queroAfiliar)}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors shadow-xs ${queroAfiliar ? "bg-[#0071e3]" : "bg-slate-100 group-hover:bg-slate-200"}`}>
                    {queroAfiliar && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-normal text-slate-800 text-base select-none">Quero tornar meu condomínio Afiliado para obter vantagens exclusivas.</span>
                </label>

                {queroAfiliar && (
                  <div className="mt-5 p-6 bg-slate-50 rounded-3xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-sm text-slate-600 mb-5 leading-relaxed font-normal">
                      Assinando o plano corporativo <span className="font-medium text-slate-800">União Condominial</span>, seu condomínio terá acesso a <span className="font-medium text-slate-900">descontos de até 50%</span> em serviços como limpeza de caixas d'água, manutenção de portões, CFTV, alarme e jardinagem. Além disso, a cada ano renovado, uma nova tabela de benefícios e cashback pode ser liberada.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                      <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Unidades do Condomínio</label>
                        <input
                          type="number"
                          placeholder="Qtd. de apartamentos/casas"
                          value={unidades}
                          onChange={(e) => setUnidades(e.target.value ? Number(e.target.value) : "")}
                          className="w-full bg-slate-50 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 font-normal transition-all"
                        />
                      </div>
                      
                      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col justify-center">
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Valor da Mensalidade</label>
                        {Number(unidades) > 0 ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-normal text-[#0071e3]">
                              R$ {calcValorMensalidade().toFixed(2).replace(".", ",")}
                            </span>
                            <span className="text-sm font-normal text-slate-500">/mês</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 font-normal italic">Informe a quantidade</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Melhor dia para Vencimento</label>
                      <div className="flex flex-wrap gap-2">
                        {[5, 10, 15, 20, 25, 30].map(dia => (
                          <label key={dia} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl cursor-pointer transition-all ${diaVencimento === dia ? 'bg-[#0071e3] text-white shadow-md font-medium' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 font-normal'}`}>
                            <input type="radio" name="dia" value={dia} checked={diaVencimento === dia} onChange={() => setDiaVencimento(dia)} className="hidden" />
                            Dia {dia}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleAfiliar}
                        disabled={loadingAfil}
                        className="w-full bg-[#0071e3] hover:bg-blue-600 text-white font-medium py-3.5 px-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
                      >
                        {loadingAfil ? "Processando..." : "Aceitar e Assinar Termo de Afiliação"}
                      </button>
                      <p className="text-xs text-slate-500 text-center mt-3 font-normal">
                        Ao dar o aceite, o Termo de Afiliação à União Condominial será gerado e enviado para o e-mail cadastrado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {afiliadoStatus && afiliadoStatus !== "Cancelado" && (
              <div className="py-6">
                <div className="bg-sky-50 rounded-3xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#0071e3] shadow-md">
                    <Building2 size={32} />
                  </div>
                  <h3 className="font-normal text-xl text-slate-900">
                    Seu condomínio é um Afiliado a União Condominial desde: <span className="text-[#0071e3] font-medium">{getFormattedDataAfiliacao()}</span>
                  </h3>
                  
                  <div className="text-slate-800 text-sm font-normal">
                    Status atual: <span className="font-medium text-emerald-600">Ativo</span>.{" "}
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="text-red-600 underline font-medium hover:text-red-800 transition-colors ml-1 cursor-pointer"
                    >
                      Cancelar Afiliação
                    </button>
                  </div>

                  {afiliadoStatus === "Pendente de Aceite por E-mail" && (
                    <p className="text-sm text-slate-600 bg-white p-4 rounded-2xl mt-2 shadow-sm font-normal">
                      Acesse seu e-mail e responda "DE ACORDO" ao termo enviado para concluir sua afiliação.
                    </p>
                  )}
                </div>
              </div>
            )}

            {afiliadoStatus === "Cancelado" && !queroAfiliar && (
              <div className="py-6 space-y-4">
                <div className="bg-rose-50/60 rounded-3xl p-6 flex flex-col items-center text-center gap-3 shadow-sm">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-md">
                    <Building2 size={32} />
                  </div>
                  <h3 className="font-normal text-xl text-slate-900">
                    Seu condomínio é um Afiliado a União Condominial desde: <span className="text-slate-700 font-medium">{getFormattedDataAfiliacao()}</span>
                  </h3>
                  <div className="text-slate-800 text-sm font-normal">
                    Status atual: <span className="font-medium text-red-600">Cancelado</span>.
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg mt-1 leading-relaxed font-normal">
                    Sua afiliação encontra-se cancelada. Os descontos de até 50% em serviços condominiais rotineiros e os benefícios exclusivos aos condôminos foram suspensos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQueroAfiliar(true)}
                    className="mt-3 inline-flex items-center gap-2 bg-[#0071e3] hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    <HeartHandshake className="w-5 h-5" />
                    Afiliar-se Novamente
                  </button>
                </div>
              </div>
            )}
            
            {(afiliadoStatus === "Cancelado" || (afiliadoStatus && afiliadoStatus !== "Cancelado")) && (
                <div className="bg-slate-50/50 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-white text-slate-600 rounded-2xl shadow-xs">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-normal text-slate-900 text-lg">Situação da Afiliação</h4>
                      <p className="text-xs text-slate-500 font-normal">Status do cadastro e histórico de mensalidades</p>
                    </div>
                  </div>
                  
                  {afiliadoStatus === "Cancelado" && (
                  <div className="p-4 bg-white rounded-2xl flex items-start gap-3 shadow-xs">
                    <CheckCircle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900 text-sm">
                        Afiliação Desativada
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed font-normal">
                        Sua afiliação encontra-se cancelada e não há cobranças ativas. Para reativar seu plano e recuperar os descontos e vantagens, clique em <span className="font-medium">Afiliar-se Novamente</span>.
                      </p>
                    </div>
                  </div>
                  )}

                  {faturasAfil.length > 0 && (
                    <div className="mt-4 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowFaturasList(!showFaturasList)}
                        className="w-full flex items-center justify-between text-xs font-medium text-slate-700 hover:text-[#0071e3] transition-colors py-2 cursor-pointer bg-white p-3 rounded-2xl shadow-xs"
                      >
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          Histórico de Parcelas da Afiliação ({faturasAfil.length} registradas)
                        </span>
                        {showFaturasList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showFaturasList && (
                        <div className="mt-3 overflow-x-auto bg-white rounded-2xl shadow-sm p-2">
                          <table className="w-full text-xs text-left">
                            <thead className="text-slate-500 uppercase font-medium">
                              <tr>
                                <th className="px-3 py-2.5">Parc.</th>
                                <th className="px-3 py-2.5">Vencimento</th>
                                <th className="px-3 py-2.5">Valor</th>
                                <th className="px-3 py-2.5">Situação</th>
                                <th className="px-3 py-2.5 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/60">
                              {faturasAfil.map((parc, idx) => {
                                const isPago = parc.status === "Recebido" || parc.status === "Pago";
                                const isCancelado = parc.status === "Cancelado";
                                
                                // Determina se a NF-e pode ser impressa (24h após a baixa)
                                let nfeDisponivel = false;
                                if (isPago) {
                                  const baseDate = parc.updatedAt || parc.recebidoEm;
                                  if (baseDate) {
                                    let dt;
                                    if (typeof baseDate === 'object' && baseDate.toDate) {
                                      dt = baseDate.toDate();
                                    } else {
                                      dt = new Date(baseDate);
                                    }
                                    if (!isNaN(dt.getTime())) {
                                      const diffHours = (new Date().getTime() - dt.getTime()) / (1000 * 60 * 60);
                                      nfeDisponivel = diffHours >= 24;
                                    } else {
                                      nfeDisponivel = true; // Se fallback falhar, assumimos que pode por estar pago
                                    }
                                  } else {
                                    nfeDisponivel = true; // Se não tem data de atualização mas está pago
                                  }
                                }

                                return (
                                  <tr key={parc.id || idx} className={`hover:bg-slate-50 transition-colors ${isCancelado ? "opacity-60 bg-slate-50/50" : ""}`}>
                                    <td className="px-3 py-2.5 font-medium text-slate-700">
                                      {parc.numeroParcela || idx + 1}/12
                                    </td>
                                    <td className="px-3 py-2.5 font-normal text-slate-800">
                                      {parc.vencimento ? new Date(parc.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                                    </td>
                                    <td className="px-3 py-2.5 font-medium text-slate-900">
                                      R$ {Number(parc.valor || 0).toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium shadow-2xs ${
                                        isPago ? "bg-emerald-100 text-emerald-800" :
                                        isCancelado ? "bg-slate-200 text-slate-700 line-through" :
                                        "bg-amber-100 text-amber-800"
                                      }`}>
                                        {isPago ? "Pago" : isCancelado ? "Cancelado (>15d)" : "Aberto (<=15d)"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center flex items-center justify-center gap-2">
                                      {!isPago && !isCancelado && (
                                        <button
                                          onClick={() => handleAbrirSolicitacaoBoleto(parc)}
                                          className="p-1.5 rounded-xl text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                          title="Solicitação de envio de boleto para pagamento de mensalidade em atraso"
                                        >
                                          <Mail className="w-4 h-4" />
                                        </button>
                                      )}
                                      
                                      {isPago ? (
                                        nfeDisponivel ? (
                                          <button
                                            onClick={() => alert("Gerando arquivo PDF da Nota Fiscal...")}
                                            className="p-1.5 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer shadow-2xs"
                                            title="Imprimir NF-e"
                                          >
                                            <Printer className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => alert("A Nota Fiscal estará disponível para impressão 24h após a baixa bancária.")}
                                            className="p-1.5 rounded-xl text-slate-300 cursor-not-allowed"
                                            title="NF-e em processamento (disponível 24h após pagamento)"
                                          >
                                            <Printer className="w-4 h-4" />
                                          </button>
                                        )
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
            )}
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 shadow-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-normal text-xl text-slate-900">Cancelar Afiliação</h3>
                <p className="text-xs text-slate-500 font-normal">Confirmação de desfiliação do condomínio</p>
              </div>
            </div>
            
            <div className="space-y-4 text-sm text-slate-600 mb-6 font-normal">
              <p className="text-sm leading-relaxed text-slate-700 font-normal">
                Tem certeza de que deseja cancelar a afiliação do condomínio <span className="font-medium">{afiliadoData?.nomeCondominio || user?.nome}</span>?
              </p>
              
              <div className="p-4 bg-rose-50/70 rounded-2xl text-rose-950 space-y-2 shadow-xs">
                <p className="font-medium text-xs uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  Impacto do Cancelamento
                </p>
                <p className="text-xs leading-relaxed text-rose-900 font-normal">
                  O cancelamento é <span className="font-medium">imediato</span>. Seu condomínio perderá o acesso aos descontos de até <span className="font-medium">50%</span> em todos os serviços condominiais rotineiros e às vantagens exclusivas do Clube de Benefícios para síndicos e moradores.
                </p>
              </div>
              
              <p className="text-xs text-slate-500 font-normal">
                Caso decida retornar no futuro, você poderá reativar sua afiliação a qualquer momento.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="px-5 py-2.5 text-slate-600 font-normal hover:bg-slate-100 rounded-2xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={canceling}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {canceling ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Envio de Boleto para Mensalidade em Atraso */}
      {showSolicitacaoBoletoModal && selectedParcelaParaBoleto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0071e3] flex items-center justify-center shrink-0 shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-normal text-xl text-slate-900 leading-tight">
                    Solicitação de Envio de Boleto
                  </h3>
                  <p className="text-xs text-slate-500 font-normal">
                    Pagamento de mensalidade de afiliado em atraso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSolicitacaoBoletoModal(false)}
                disabled={solicitandoBoleto}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Card de Identificação do Cliente Conectado */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-2.5 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block font-normal">Nome do Cliente / Condomínio:</span>
                    <span className="font-medium text-slate-900 text-sm">
                      {profile?.displayName || profile?.nome || (profile as any)?.nomeFantasia || (profile as any)?.razaoSocial || afiliadoData?.nomeCondominio || "Condomínio"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block font-normal">C.N.P.J. Nº:</span>
                    <span className="font-medium text-slate-900 font-mono text-sm">
                      {profile?.cnpj || profile?.cpfCnpj || (profile as any)?.cpf || (profile as any)?.documento || afiliadoData?.cnpj || "Não informado"}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block font-normal">Representado por:</span>
                    <span className="font-medium text-slate-800 text-sm">
                      {(profile as any)?.nomeResponsavel || (profile as any)?.responsavel || profile?.nome || afiliadoData?.nomeSindico || "Não informado"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detalhes da Mensalidade / Parcela */}
              <div className="bg-amber-50/70 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-amber-900 block mb-0.5">
                      Mensalidade Solicitada
                    </span>
                    <p className="font-normal text-slate-900 text-lg">
                      Parcela {selectedParcelaParaBoleto.numeroParcela || 1}/12
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-amber-800 block font-normal">Valor da Mensalidade</span>
                    <span className="text-xl font-normal text-amber-900">
                      R$ {Number(selectedParcelaParaBoleto.valor || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 flex items-center justify-between text-xs text-amber-900">
                  <span>
                    Vencimento original: <span className="font-medium">{selectedParcelaParaBoleto.vencimento ? new Date(selectedParcelaParaBoleto.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium text-[11px] shadow-2xs">
                    Em Aberto / Atraso
                  </span>
                </div>
              </div>

              {/* Declaração formal de solicitação */}
              <div className="bg-blue-50/60 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed shadow-xs font-normal">
                <p>
                  O cliente <span className="font-medium">{profile?.displayName || profile?.nome || afiliadoData?.nomeCondominio || "Condomínio"}</span>, C.N.P.J. Nº <span className="font-medium">{profile?.cnpj || profile?.cpfCnpj || afiliadoData?.cnpj || "Não informado"}</span>, representado por <span className="font-medium">{(profile as any)?.nomeResponsavel || profile?.nome || afiliadoData?.nomeSindico || "Não informado"}</span>, solicita a emissão de um novo boleto bancário atualizado para pagamento da mensalidade em atraso.
                </p>
                <p className="mt-2 text-[11px] text-slate-500 font-normal">
                  Ao clicar em <span className="font-medium">Solicitar</span>, a notificação será encaminhada diretamente ao departamento financeiro responsável pela unidade para emissão e envio do novo boleto com a data de vencimento atualizada.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-5 mt-5">
              <button
                type="button"
                onClick={() => setShowSolicitacaoBoletoModal(false)}
                disabled={solicitandoBoleto}
                className="w-full sm:w-auto px-5 py-2.5 text-slate-600 font-normal hover:bg-slate-100 rounded-2xl transition-colors disabled:opacity-50 cursor-pointer text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarSolicitacaoBoleto}
                disabled={solicitandoBoleto}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#0071e3] hover:bg-blue-600 text-white font-medium rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                {solicitandoBoleto ? (
                  <>Processando...</>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Solicitar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
