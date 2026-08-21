import React, { useState, useEffect } from "react";
import { Building2, Search, Edit2, Eye, MapPin, CheckCircle, Clock, Mail, Check, AlertCircle, RefreshCw, X, Send, ShieldCheck, HelpCircle, Printer, Calendar, DollarSign, FileCheck, Layers, XCircle, UserX, AlertTriangle, MessageCircle, Copy, ExternalLink, CheckCircle2, Phone, Lock, Share2 } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, getDocs, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendEmailWithLog } from "../../lib/emailService";
import { ensureSmtpReady, getSmtpStatus, subscribeSmtpStatus, SmtpRuntimeStatus } from "../../services/smtpInitializer";
import { syncAfiliacaoContasReceber, getContasReceberAfiliado, processarCancelamentoAfiliacaoFinanceiro, SyncAfiliacaoResult, CENTRO_CUSTO_AFILIACAO, garantirCentroCustoAfiliacao, validarAfiliacaoAntesDePersistir, validarIntegridadeFinanceiraAfiliacao } from "../../services/afiliacaoFinanceiroService";

export default function ControleAfiliados() {
  const [afiliados, setAfiliados] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [contasReceber, setContasReceber] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusTab, setStatusTab] = useState<"todos" | "em_dia" | "atrasados" | "cancelados" | "pendentes">("todos");
  const [feedback, setFeedback] = useState<{type: "success" | "error", message: string} | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpRuntimeStatus>(getSmtpStatus());

  // Modal de reenvio do termo
  const [modalAfiliado, setModalAfiliado] = useState<any | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [generatedToken, setGeneratedToken] = useState("");
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    channel?: "email" | "whatsapp";
    message?: string;
    error?: string;
  } | null>(null);

  // Escuta status da validação do SMTP em segundo plano
  useEffect(() => {
    const unsubscribe = subscribeSmtpStatus((state) => {
      setSmtpStatus(state);
    });
    return () => unsubscribe();
  }, []);

  // Modal de visualização
  const [viewAfiliado, setViewAfiliado] = useState<any | null>(null);
  const [viewParcelas, setViewParcelas] = useState<any[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  // Modal de edição (alteração de termos/vencimento/valores)
  const [editAfiliado, setEditAfiliado] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 8000);
  };

  // Helper monetário com duas casas decimais no padrão brasileiro x.xxx,xx
  const formatCurrency = (val: any): string => {
    const num = typeof val === "number" ? val : parseFloat(val) || 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Helper para buscar usuário vinculado no painel de controle de usuários
  const findLinkedUser = (afiliado: any) => {
    if (!afiliado) return null;
    return users.find((u) => {
      const matchId = (u.id && (u.id === afiliado.id || u.id === afiliado.userId)) || (u.uid && (u.uid === afiliado.id || u.uid === afiliado.userId));
      const emailAfiliado = (afiliado.email || afiliado.clienteEmail || afiliado.userEmail || "").trim().toLowerCase();
      const matchEmail = emailAfiliado && u.email && u.email.trim().toLowerCase() === emailAfiliado;
      const cnpjAfiliado = (afiliado.cnpj || "").replace(/\D/g, "");
      const matchCnpj = cnpjAfiliado && u.cnpj && u.cnpj.replace(/\D/g, "") === cnpjAfiliado;
      return matchId || matchEmail || matchCnpj;
    });
  };

  // Diagnóstico financeiro do afiliado com base no Centro de Custo "Rec. Afiliação Mensal"
  const getAfiliadoFinancialSummary = (afiliado: any) => {
    if (!afiliado) {
      return {
        totalParcelas: 0,
        atrasadasCount: 0,
        abertasCount: 0,
        pagasCount: 0,
        canceladasCount: 0,
        valorTotalAtrasado: 0,
        temAtraso: false,
      };
    }

    const isDoCliente = (c: any) => {
      return (
        (c.afiliacaoId && c.afiliacaoId === afiliado.id) ||
        (c.clienteId && (c.clienteId === afiliado.userId || c.clienteId === afiliado.id)) ||
        (c.titular && c.titular.toLowerCase() === afiliado.nomeCondominio?.toLowerCase()) ||
        (c.clienteNome && c.clienteNome.toLowerCase() === afiliado.nomeCondominio?.toLowerCase())
      );
    };

    const parcelasAfiliado = contasReceber.filter(isDoCliente);
    const now = new Date();

    const atrasadas = parcelasAfiliado.filter((c) => {
      if (c.status === "Recebido" || c.status === "Pago" || c.status === "Cancelado") return false;
      if (c.vencimento) {
        const dataVenc = new Date(c.vencimento + "T23:59:59");
        return dataVenc < now;
      }
      return c.status === "Vencido" || c.status === "Atrasado";
    });

    const abertas = parcelasAfiliado.filter((c) => c.status === "Aberto");
    const pagas = parcelasAfiliado.filter((c) => c.status === "Recebido" || c.status === "Pago");
    const canceladas = parcelasAfiliado.filter((c) => c.status === "Cancelado");
    const valorTotalAtrasado = atrasadas.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

    return {
      totalParcelas: parcelasAfiliado.length,
      atrasadasCount: atrasadas.length,
      abertasCount: abertas.length,
      pagasCount: pagas.length,
      canceladasCount: canceladas.length,
      valorTotalAtrasado,
      temAtraso: atrasadas.length > 0,
    };
  };

  // Função para computar o status dinâmico do afiliado (Em Dia, Atrasado, Cancelado, Pendente)
  const getAffiliateStatus = (afiliado: any) => {
    if (!afiliado) return "Pendente";

    // 1. Checar se o próprio registro do afiliado está marcado como Cancelado
    if (afiliado.status === "Cancelado" || afiliado.cancelado === true) {
      return "Cancelado";
    }

    // 2. Checar se o usuário vinculado no painel de controle de usuários foi alterado para Cancelado
    const linkedUser = findLinkedUser(afiliado);
    if (linkedUser && linkedUser.status === "Cancelado") {
      return "Cancelado";
    }

    if (afiliado.status !== "Ativo" && !afiliado.dataAtivacao) {
      return "Pendente Aceite de Termo";
    }

    const ativacao = afiliado.dataAtivacao ? new Date(afiliado.dataAtivacao) : (afiliado.createdAt ? new Date(afiliado.createdAt) : new Date());
    const dozeMesesApos = new Date(ativacao);
    dozeMesesApos.setMonth(dozeMesesApos.getMonth() + 12);
    
    if (new Date() > dozeMesesApos) {
      return "Inativo";
    }

    // Checar atraso nas faturas do centro de custo Rec. Afiliação Mensal
    const finSummary = getAfiliadoFinancialSummary(afiliado);
    if (finSummary.temAtraso) {
      return "Atrasado";
    }

    return "Em Dia";
  };

  // Helper para obter a data e hora do cancelamento
  const getCancellationDateTime = (afiliado: any) => {
    if (!afiliado) return null;
    if (afiliado.dataCancelamento) return afiliado.dataCancelamento;
    if (afiliado.canceladoEm) return afiliado.canceladoEm;

    const linkedUser = findLinkedUser(afiliado);
    if (linkedUser?.dataCancelamento) {
      return linkedUser.dataCancelamento;
    }
    if (linkedUser?.status === "Cancelado") {
      return linkedUser.updatedAt || linkedUser.createdAt || null;
    }
    if (afiliado.status === "Cancelado") {
      return afiliado.updatedAt || afiliado.createdAt || null;
    }
    return null;
  };

  // Formatador de data e horário (ex: 19/08/2026 às 18:05)
  const formatCancellationDateTime = (afiliado: any) => {
    const rawDate = getCancellationDateTime(afiliado);
    if (!rawDate) return null;
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return null;
      const dateFormatted = d.toLocaleDateString("pt-BR");
      const timeFormatted = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${dateFormatted} às ${timeFormatted}`;
    } catch {
      return null;
    }
  };

  const handleImprimirAfiliado = (afiliado: any) => {
    const statusComputado = getAffiliateStatus(afiliado);
    const cancelamentoFormatado = formatCancellationDateTime(afiliado);
    const htmlTermo = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ficha de Afiliação - ${afiliado.nomeCondominio}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #0071e3; padding-bottom: 20px; margin-bottom: 30px; }
          .header h2 { color: #0071e3; margin: 0 0 10px 0; font-size: 24px; }
          .header h4 { color: #555; margin: 0; font-size: 14px; }
          .section { margin-bottom: 25px; }
          .section-title { color: #0f172a; font-size: 16px; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 15px; font-weight: bold; }
          .data-row { display: flex; margin-bottom: 10px; border-bottom: 1px dashed #eee; padding-bottom: 5px; }
          .data-label { font-weight: bold; width: 220px; color: #64748b; }
          .data-value { flex: 1; color: #0f172a; }
          .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; border: 1px solid #ddd; }
          .footer { margin-top: 50px; font-size: 12px; text-align: center; color: #94a3b8; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>FICHA DE AFILIAÇÃO</h2>
          <h4>União Condominial - Produtos de Limpeza e Conservação</h4>
        </div>
        
        <div class="section">
          <div class="section-title">STATUS DA AFILIAÇÃO</div>
          <div class="data-row">
            <div class="data-label">Situação Atual:</div>
            <div class="data-value">
              <span class="status-badge" style="${statusComputado === 'Cancelado' ? 'color: #be123c; border-color: #fecdd3; background-color: #fff1f2;' : ''}">
                ${statusComputado.toUpperCase()}
              </span>
            </div>
          </div>
          ${statusComputado === "Cancelado" && cancelamentoFormatado ? `
          <div class="data-row">
            <div class="data-label">Data e Horário do Cancelamento:</div>
            <div class="data-value" style="color: #be123c; font-weight: bold;">
              ${cancelamentoFormatado}
            </div>
          </div>
          ` : ''}
          <div class="data-row">
            <div class="data-label">Data de Ativação:</div>
            <div class="data-value">${afiliado.dataAtivacao ? new Date(afiliado.dataAtivacao).toLocaleDateString("pt-BR") : "Pendente de Aceite"}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">DADOS DO CONDOMÍNIO (CONTRATANTE)</div>
          <div class="data-row">
            <div class="data-label">Nome do Condomínio:</div>
            <div class="data-value">${afiliado.nomeCondominio || "Não informado"}</div>
          </div>
          <div class="data-row">
            <div class="data-label">CNPJ:</div>
            <div class="data-value">${afiliado.cnpj || "Não informado"}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Unidades Habitacionais:</div>
            <div class="data-value">${afiliado.unidadesHabitacionais || "Não informado"}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Síndico/Administrador:</div>
            <div class="data-value">${afiliado.nomeSindico || "Não informado"}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Telefone:</div>
            <div class="data-value">${afiliado.telefone || "Não informado"}</div>
          </div>
          <div class="data-row">
            <div class="data-label">E-mail:</div>
            <div class="data-value">${afiliado.email || afiliado.clienteEmail || afiliado.userEmail || "Não informado"}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">DADOS DO CONTRATO</div>
          <div class="data-row">
            <div class="data-label">Valor Mensalidade:</div>
            <div class="data-value">R$ ${Number(afiliado.valorMensalidade || 0).toFixed(2).replace('.', ',')}</div>
          </div>
          <div class="data-row">
            <div class="data-label">Dia do Vencimento:</div>
            <div class="data-value">Dia ${afiliado.diaVencimento || "10"} de cada mês</div>
          </div>
        </div>

        <div class="footer">
          Documento gerado pelo sistema União Condominial em ${new Date().toLocaleString("pt-BR")}.<br/>
          ID do Registro: ${afiliado.id}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlTermo);
      printWindow.document.close();
      printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
      };
    }
  };

  useEffect(() => {
    // Garante existência do centro de custo oficial
    garantirCentroCustoAfiliacao().catch(err => console.warn("Aviso ao inicializar centro de custo:", err));

    const qAfiliados = query(collection(db, "afiliados_uc"), orderBy("createdAt", "desc"));
    const unsubAfiliados = onSnapshot(
      qAfiliados,
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setAfiliados(data);
        setLoading(false);
      },
      (err) => {
        console.warn("Aviso ao carregar afiliados_uc em tempo real:", err);
        setLoading(false);
      }
    );

    const qUsers = query(collection(db, "users"));
    const unsubUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setUsers(data);
      },
      (err) => {
        console.warn("Aviso ao carregar usuários em tempo real:", err);
      }
    );

    const qContas = query(collection(db, "contas_receber"));
    const unsubContas = onSnapshot(
      qContas,
      (snapshot) => {
        const data: any[] = [];
        snapshot.forEach((doc) => {
          data.push({ id: doc.id, ...doc.data() });
        });
        setContasReceber(data);
      },
      (err) => {
        console.warn("Aviso ao carregar contas_receber em tempo real:", err);
      }
    );

    return () => {
      unsubAfiliados();
      unsubUsers();
      unsubContas();
    };
  }, []);

  // Ao abrir o modal de detalhes, carrega as parcelas do afiliado no contas a receber
  useEffect(() => {
    if (viewAfiliado?.id) {
      setLoadingParcelas(true);
      getContasReceberAfiliado(viewAfiliado.id, viewAfiliado.nomeCondominio)
        .then((items) => {
          setViewParcelas(items);
        })
        .finally(() => setLoadingParcelas(false));
    } else {
      setViewParcelas([]);
    }
  }, [viewAfiliado]);

  const generateUniqueToken = () => {
    return "tok_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);
  };

  const formatWhatsAppNumber = (phone: string): string => {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    }
    return digits;
  };

  const openResendModal = (afiliado: any) => {
    const linkedUser = findLinkedUser(afiliado);
    setModalAfiliado(afiliado);
    setTargetEmail(afiliado.email || afiliado.clienteEmail || afiliado.userEmail || linkedUser?.email || "");
    setTargetPhone(afiliado.telefone || afiliado.celular || afiliado.whatsapp || linkedUser?.telefone || linkedUser?.celular || "");
    const tok = afiliado.tokenAceite && !afiliado.tokenAceiteUsado ? afiliado.tokenAceite : generateUniqueToken();
    setGeneratedToken(tok);
    setSendResult(null);
    setCopiedWhatsApp(false);
  };

  const handleConfirmResend = async () => {
    if (!modalAfiliado || !targetEmail.trim()) {
      showFeedback("error", "Por favor, informe um endereço de e-mail válido para receber o termo.");
      return;
    }

    setSending(true);
    setSendResult(null);

    const nowIso = new Date().toISOString();
    const token = generateUniqueToken();
    setGeneratedToken(token);

    // 1. Atualiza registro no Firestore com o novo token de aceite de uso único
    try {
      await updateDoc(doc(db, "afiliados_uc", modalAfiliado.id), {
        tokenAceite: token,
        tokenAceiteUsado: false,
        dataEmissaoTermo: nowIso,
        email: targetEmail.trim(),
        telefone: targetPhone.trim(),
        ultimoCanalEnvio: "email",
        updatedAt: nowIso,
      });
    } catch (dbErr: any) {
      console.warn("Aviso ao registrar token no Firestore:", dbErr);
    }

    // 2. Pré-validação do Handshake SMTP antes do disparo do termo
    try {
      const smtpPreflight = await ensureSmtpReady();
      if (!smtpPreflight.ready) {
        const errorDetail = smtpPreflight.handshakeError || smtpPreflight.error || "Servidor SMTP não respondeu ao handshake.";
        setSendResult({ 
          success: false, 
          channel: "email", 
          error: `Falha no transporte SMTP: ${errorDetail}. Utilize a opção de envio via WhatsApp abaixo para enviar o termo diretamente.` 
        });
        showFeedback(
          "error",
          `Envio retido: Falha no handshake SMTP (${errorDetail}). Você pode enviar via WhatsApp com link único.`
        );
        setSending(false);
        return;
      }
    } catch (preflightErr: any) {
      console.warn("[ControleAfiliados] Erro ao validar preflight SMTP:", preflightErr);
    }

    const linkAceite = `${window.location.origin}/aceite-afiliacao/${modalAfiliado.id}?token=${token}`;

    try {
      const htmlTermo = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px;">
        <h2 style="text-align: center; color: #0071e3; margin-bottom: 4px;">TERMO DE AFILIAÇÃO À UNIÃO CONDOMINIAL</h2>
        <h4 style="text-align: center; color: #555; margin-top: 0;">PRODUTOS DE LIMPEZA E CONSERVAÇÃO</h4>
        <p>Prezado(a) <strong>${modalAfiliado.nomeSindico || "Síndico(a)"}</strong>,</p>
        <p>Abaixo estão os dados da proposta de afiliação do condomínio <strong>${modalAfiliado.nomeCondominio}</strong> à União Condominial.</p>
        <p>Por favor, confira os dados do contrato abaixo. <strong>Para confirmar sua afiliação e aceitar os termos, clique no botão de aceite abaixo</strong>.</p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        
        <h3 style="color: #0f172a;">QUALIFICAÇÃO DO CONTRATANTE</h3>
        <ul>
          <li><strong>Condomínio:</strong> ${modalAfiliado.nomeCondominio}</li>
          <li><strong>CNPJ:</strong> ${modalAfiliado.cnpj || "Não informado"}</li>
          <li><strong>Unidades Habitacionais:</strong> ${modalAfiliado.unidadesHabitacionais || "0"}</li>
          <li><strong>Síndico/Administrador:</strong> ${modalAfiliado.nomeSindico || "Não informado"}</li>
          <li><strong>Telefone:</strong> ${modalAfiliado.telefone || targetPhone.trim() || "Não informado"}</li>
          <li><strong>Email:</strong> ${targetEmail.trim()}</li>
          <li><strong>Vencimento Escolhido:</strong> Dia ${modalAfiliado.diaVencimento || 10}</li>
          <li><strong>Valor Mensal:</strong> R$ ${Number(modalAfiliado.valorMensalidade || 0).toFixed(2).replace('.', ',')}</li>
        </ul>

        <h3 style="color: #0f172a;">CLÁUSULA 1ª — DO OBJETO</h3>
        <p>O presente Termo tem por objeto a afiliação do CONTRATANTE à União Condominial — Produtos de Limpeza e Conservação, assegurando-lhe acesso a uma lista de serviços condominiais rotineiros, prestados com desconto de até 50% (cinquenta por cento) sobre os valores praticados ao mercado em geral, nos termos e condições estabelecidos neste instrumento.</p>
        
        <h3 style="color: #0f172a;">CLÁUSULA 2ª — DA VIGÊNCIA</h3>
        <p>O presente Termo de Afiliação vigorará pelo prazo de 12 (doze) meses, contados da data de sua assinatura, sendo automaticamente renovado por iguais e sucessivos períodos de 12 (doze) meses.</p>

        <h3 style="color: #0f172a;">CLÁUSULA 3ª — DOS SERVIÇOS CONDOMINIAIS ROTINEIROS</h3>
        <p>Mediante a afiliação, o CONTRATANTE passa a ter à sua disposição, com desconto de até 50%, os seguintes serviços:</p>
        <ul>
          <li>Limpeza de Reservatório de Água Inferior e Superior;</li>
          <li>Limpeza e Desobstrução de Caixa de Gordura;</li>
          <li>Serviços Especializados de Jardinagem;</li>
          <li>Manutenção de Portas e Portões Eletrônicos;</li>
          <li>Manutenção de Cercas Elétricas e Elétricos;</li>
          <li>Manutenção de Porteiros Eletrônicos e CFTV;</li>
          <li>Manutenção em Sistemas de Alarme.</li>
        </ul>

        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;" />
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${linkAceite}" style="background-color: #0071e3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">ACEITAR TERMO DE AFILIAÇÃO</a>
          <p style="font-size: 11px; color: #64748b; margin-top: 10px;">Este link é exclusivo para este termo e é válido para uso único.</p>
        </div>
      </div>
      `;

      const emailResult = await sendEmailWithLog({
        to: targetEmail.trim(),
        subject: `Termo de Afiliação - ${modalAfiliado.nomeCondominio} - União Condominial`,
        html: htmlTermo
      }, "AFILIACAO_UC");

      if (emailResult.success) {
        setSendResult({
          success: true,
          channel: "email",
          message: `E-mail enviado com sucesso para ${targetEmail.trim()}! O servidor HostGator aceitou o envio do termo e o link de aceite único está ativo.`
        });
        showFeedback("success", `Termo reenviado com sucesso para ${targetEmail.trim()}! O servidor HostGator aceitou o envio.`);
      } else {
        const errorMsg = emailResult.error || "Falha no envio pelo servidor de e-mails.";
        setSendResult({
          success: false,
          channel: "email",
          error: `Falha no envio pelo HostGator: ${errorMsg}. Utilize a opção de Envio via WhatsApp abaixo.`
        });
        showFeedback("error", `Falha no envio pelo HostGator: ${errorMsg}. Você pode enviar via WhatsApp com link único.`);
      }
    } catch (err: any) {
      setSendResult({ 
        success: false, 
        channel: "email", 
        error: `Erro ao disparar e-mail: ${err.message}. Prossiga com o envio via WhatsApp abaixo.` 
      });
      showFeedback("error", "Erro ao disparar e-mail: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const buildWhatsAppMessage = (afiliado: any, token: string) => {
    const nomeCond = afiliado.nomeCondominio || "Condomínio";
    const sindico = afiliado.nomeSindico || "Síndico(a) / Responsável";
    const valorNum = Number(afiliado.valorMensalidade || 0).toFixed(2).replace(".", ",");
    const diaVenc = afiliado.diaVencimento || "10";
    const link = `${window.location.origin}/aceite-afiliacao/${afiliado.id}?token=${token}`;

    return `*TERMO DE AFILIAÇÃO — UNIÃO CONDOMINIAL* 🏢✨

Olá, *${sindico}*!

Abaixo está o link oficial com a proposta e o *Termo de Afiliação* para o *${nomeCond}*:

📋 *Resumo da Afiliação:*
• *Condomínio:* ${nomeCond}
• *Mensalidade:* R$ ${valorNum}/mês
• *Dia do Vencimento:* Todo dia ${diaVenc}
• *Benefícios:* Descontos de até 50% em serviços condominiais essenciais (limpeza de reservatórios, caixas d'água, jardinagem, portões, CFTV, alarmes) e compras conjuntas.

🔗 *Clique no link abaixo para ler e aceitar o termo:*
${link}

⚠️ _Atenção: Este link é individual, seguro e *válido para uma única confirmação (uso único)*. Ao confirmar, o contrato é ativado instantaneamente e as 12 parcelas mensais são programadas no financeiro._

Qualquer dúvida, estamos à inteira disposição!
*Equipe União Condominial*`;
  };

  const handleSendWhatsApp = async () => {
    if (!modalAfiliado) return;
    if (!targetPhone.trim()) {
      showFeedback("error", "Por favor, informe o número de WhatsApp/Telefone para envio.");
      return;
    }

    const cleanPhone = formatWhatsAppNumber(targetPhone);
    if (cleanPhone.length < 10) {
      showFeedback("error", "Número de WhatsApp inválido. Digite DDD + número (ex: 62 99999-9999).");
      return;
    }

    const nowIso = new Date().toISOString();
    const token = generatedToken || generateUniqueToken();
    setGeneratedToken(token);

    try {
      await updateDoc(doc(db, "afiliados_uc", modalAfiliado.id), {
        tokenAceite: token,
        tokenAceiteUsado: false,
        dataEmissaoTermo: nowIso,
        telefone: targetPhone.trim(),
        ultimoCanalEnvio: "whatsapp",
        updatedAt: nowIso,
      });
    } catch (dbErr: any) {
      console.warn("Aviso ao atualizar documento no Firestore:", dbErr);
    }

    const message = buildWhatsAppMessage(modalAfiliado, token);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");

    setSendResult({
      success: true,
      channel: "whatsapp",
      message: `WhatsApp aberto com sucesso para o número ${targetPhone}! A mensagem formatada com link de aceite único está pronta para envio.`
    });
    showFeedback("success", `WhatsApp aberto com sucesso com link de aceite de uso único para ${targetPhone}!`);
  };

  const handleCopyWhatsAppText = async () => {
    if (!modalAfiliado) return;
    const token = generatedToken || generateUniqueToken();
    setGeneratedToken(token);

    const nowIso = new Date().toISOString();
    try {
      await updateDoc(doc(db, "afiliados_uc", modalAfiliado.id), {
        tokenAceite: token,
        tokenAceiteUsado: false,
        dataEmissaoTermo: nowIso,
        telefone: targetPhone.trim(),
        ultimoCanalEnvio: "whatsapp",
        updatedAt: nowIso,
      });
    } catch (dbErr) {
      console.warn("Aviso:", dbErr);
    }

    const message = buildWhatsAppMessage(modalAfiliado, token);
    try {
      await navigator.clipboard.writeText(message);
      setCopiedWhatsApp(true);
      showFeedback("success", "Mensagem com link de uso único copiada para a área de transferência!");
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    } catch (err) {
      showFeedback("error", "Não foi possível copiar automaticamente para a área de transferência.");
    }
  };

  const handleApprove = async (afiliado: any) => {
    try {
      setFeedback({ type: "success", message: "Processando ativação e validação financeira da afiliação..." });

      // 0. Validação de Integridade Financeira antes de qualquer persistência
      const validacaoPrevia = validarAfiliacaoAntesDePersistir(afiliado);
      if (!validacaoPrevia.isValid) {
        showFeedback("error", `Bloqueio de Integridade Financeira: ${validacaoPrevia.erros.join(" | ")}`);
        return;
      }

      const nowIso = new Date().toISOString();

      // 1. Atualizar status para Ativo
      await updateDoc(doc(db, "afiliados_uc", afiliado.id), {
        status: "Ativo",
        dataAtivacao: nowIso,
        afiliado: true,
        valorTotalContrato: validacaoPrevia.valorTotalAfiliacao,
        updatedAt: nowIso
      });

      const updatedAfiliado = {
        ...afiliado,
        status: "Ativo",
        dataAtivacao: nowIso,
        valorTotalContrato: validacaoPrevia.valorTotalAfiliacao
      };

      // 2. Sincroniza e cria as 12 mensalidades no Contas a Receber com Titular = Nome do Condomínio
      const syncResult = await syncAfiliacaoContasReceber(updatedAfiliado, {
        actorName: "Administrador / Comercial",
        origemAcao: "Ativação Manual Comercial"
      });

      // 3. Obter email do cliente e enviar confirmação
      let userEmail = afiliado.email || afiliado.clienteEmail || afiliado.userEmail;
      if (!userEmail) {
        const targetUid = afiliado.userId || afiliado.id;
        if (targetUid) {
          const userSnap = await getDoc(doc(db, "users", targetUid));
          if (userSnap.exists()) {
            userEmail = userSnap.data().email;
          }
        }
      }

      if (userEmail && userEmail.includes("@")) {
        const diaVenc = Number(afiliado.diaVencimento) || 10;
        const htmlBoleto = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px;">
          <h2 style="color: #0071e3; margin-bottom: 6px;">Sua Afiliação foi Ativada com Sucesso!</h2>
          <p>Olá <strong>${afiliado.nomeSindico || "Síndico(a)"}</strong>,</p>
          <p>Informamos que o condomínio <strong>${afiliado.nomeCondominio}</strong> agora é oficialmente um Afiliado à União Condominial.</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0f172a;">Detalhes da Cobrança</h3>
            <p><strong>Titular do Documento:</strong> ${afiliado.nomeCondominio}</p>
            <p><strong>Descrição:</strong> Taxa de Afiliação a U.C. (12 Parcelas)</p>
            <p><strong>Valor Mensal:</strong> R$ ${Number(afiliado.valorMensalidade || 0).toFixed(2).replace('.', ',')}</p>
            <p><strong>Dia de Vencimento:</strong> Todo dia ${diaVenc} do mês</p>
          </div>
          <p>Agradecemos a parceria!</p>
          <p>Atenciosamente,<br><strong>Equipe União Condominial</strong></p>
        </div>
        `;

        await sendEmailWithLog({
          to: userEmail,
          subject: "Confirmação de Afiliação - União Condominial",
          html: htmlBoleto
        }, "BOLETO_AFILIACAO");
      }

      showFeedback(
        "success",
        `Afiliação ativada com sucesso! 12 parcelas sincronizadas no Contas a Receber (Titular: ${afiliado.nomeCondominio}) - ${syncResult.criadas} criadas, ${syncResult.atualizadas} atualizadas.`
      );
    } catch (err: any) {
      showFeedback("error", "Erro ao aprovar afiliação: " + err.message);
    }
  };

  // Sincronização manual sob demanda
  const handleManualSync = async (afiliado: any) => {
    setSyncingId(afiliado.id);
    try {
      const result = await syncAfiliacaoContasReceber(afiliado, {
        actorName: "Administrador / Comercial",
        origemAcao: "Sincronização Manual de Parcelas"
      });

      showFeedback(
        "success",
        `Contas a Receber sincronizado com sucesso para ${afiliado.nomeCondominio}! (${result.criadas} novas parcelas criadas, ${result.atualizadas} atualizadas, ${result.mantidas} já quitadas mantidas).`
      );

      if (viewAfiliado?.id === afiliado.id) {
        const updated = await getContasReceberAfiliado(afiliado.id, afiliado.nomeCondominio);
        setViewParcelas(updated);
      }
    } catch (err: any) {
      showFeedback("error", "Erro ao sincronizar parcelas: " + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  // Abertura do modal de edição
  const openEditModal = (afiliado: any) => {
    setEditAfiliado({
      ...afiliado,
      nomeCondominio: afiliado.nomeCondominio || "",
      diaVencimento: Number(afiliado.diaVencimento) || 10,
      valorMensalidade: Number(afiliado.valorMensalidade) || 0,
      unidadesHabitacionais: afiliado.unidadesHabitacionais || "",
      nomeSindico: afiliado.nomeSindico || "",
      telefone: afiliado.telefone || "",
      email: afiliado.email || afiliado.clienteEmail || "",
      cnpj: afiliado.cnpj || "",
      status: afiliado.status || "Ativo",
    });
  };

  // Salvamento das alterações do afiliado com re-sincronização de valores/datas
  const handleSaveEditAfiliado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAfiliado?.id) return;

    setSavingEdit(true);
    try {
      const isCancelled = editAfiliado.status === "Cancelado";
      const nowIso = new Date().toISOString();
      const payload: any = {
        nomeCondominio: (editAfiliado.nomeCondominio || "").trim(),
        diaVencimento: Number(editAfiliado.diaVencimento) || 10,
        valorMensalidade: Number(editAfiliado.valorMensalidade) || 0,
        unidadesHabitacionais: Number(editAfiliado.unidadesHabitacionais) || 0,
        nomeSindico: (editAfiliado.nomeSindico || "").trim(),
        telefone: (editAfiliado.telefone || "").trim(),
        email: (editAfiliado.email || "").trim(),
        cnpj: (editAfiliado.cnpj || "").trim(),
        status: editAfiliado.status || "Ativo",
        updatedAt: nowIso
      };

      if (!isCancelled) {
        // Validação de Integridade Financeira antes de persistir
        const validacao = validarAfiliacaoAntesDePersistir({
          id: editAfiliado.id,
          ...payload
        });
        if (!validacao.isValid) {
          showFeedback("error", `Bloqueio de Integridade Financeira: ${validacao.erros.join(" | ")}`);
          setSavingEdit(false);
          return;
        }
        payload.valorTotalContrato = validacao.valorTotalAfiliacao;
      }

      if (isCancelled) {
        payload.dataCancelamento = editAfiliado.dataCancelamento || nowIso;
        payload.canceladoPor = "Painel Comercial";
      }

      // 1. Atualiza no doc do afiliado
      await updateDoc(doc(db, "afiliados_uc", editAfiliado.id), payload);

      if (isCancelled) {
        // Se cancelado: aplica a regra de manter apenas faturas com <=15 dias e cancelar automaticamente as >15 dias
        const cancelResult = await processarCancelamentoAfiliacaoFinanceiro(editAfiliado.id, {
          dataCancelamento: payload.dataCancelamento,
          actorName: "Painel Comercial",
          nomeCondominio: payload.nomeCondominio,
          email: payload.email,
          motivo: "Status alterado para Cancelado no Controle de Afiliados"
        });

        showFeedback(
          "success",
          `Afiliação cancelada! Os registros de contas a receber pendentes (${cancelResult.canceladasAutomaticamente} parcelas) tiveram seu status alterado para 'Cancelado', não fazendo mais parte do contas a receber.`
        );
      } else {
        // 2. Sincroniza/Atualiza as 12 parcelas no contas a receber (altera vencimento/valor das parcelas abertas sem criar duplicatas)
        const syncResult = await syncAfiliacaoContasReceber(
          { id: editAfiliado.id, ...payload },
          { actorName: "Administrador / Comercial", origemAcao: "Edição de Vencimento/Valores" }
        );

        showFeedback(
          "success",
          `Afiliação de ${payload.nomeCondominio} atualizada! Contas a Receber sincronizado (${syncResult.atualizadas} parcelas atualizadas com o novo vencimento/valor, ${syncResult.criadas} criadas, ${syncResult.mantidas} pagas mantidas).`
        );
      }

      setEditAfiliado(null);
    } catch (err: any) {
      showFeedback("error", "Erro ao salvar alterações da afiliação: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Cálculos consolidados para controle pelo Centro de Custo "Rec. Afiliação Mensal"
  const stats = React.useMemo(() => {
    let emDiaCount = 0;
    let atrasadosCount = 0;
    let canceladosCount = 0;
    let pendentesCount = 0;
    let valorTotalMensalidade = 0;
    let valorTotalInadimplente = 0;

    afiliados.forEach((af) => {
      const st = getAffiliateStatus(af);
      const fin = getAfiliadoFinancialSummary(af);
      const val = Number(af.valorMensalidade) || 0;

      if (st === "Em Dia") {
        emDiaCount++;
        valorTotalMensalidade += val;
      } else if (st === "Atrasado") {
        atrasadosCount++;
        valorTotalInadimplente += fin.valorTotalAtrasado;
      } else if (st === "Cancelado") {
        canceladosCount++;
      } else {
        pendentesCount++;
      }
    });

    return {
      total: afiliados.length,
      emDiaCount,
      atrasadosCount,
      canceladosCount,
      pendentesCount,
      valorTotalMensalidade,
      valorTotalInadimplente,
    };
  }, [afiliados, users, contasReceber]);

  const filtered = afiliados.filter(a => {
    const statusComputado = getAffiliateStatus(a);
    if (statusTab === "em_dia" && statusComputado !== "Em Dia") return false;
    if (statusTab === "atrasados" && statusComputado !== "Atrasado") return false;
    if (statusTab === "cancelados" && statusComputado !== "Cancelado") return false;
    if (statusTab === "pendentes" && statusComputado !== "Pendente Aceite de Termo" && statusComputado !== "Pendente") return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      a.nomeCondominio?.toLowerCase().includes(term) ||
      a.nomeSindico?.toLowerCase().includes(term) ||
      a.cnpj?.toLowerCase().includes(term) ||
      a.email?.toLowerCase().includes(term) ||
      a.clienteEmail?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Controle de Afiliados</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold">
              <Layers size={13} />
              Centro de Custo: {CENTRO_CUSTO_AFILIACAO}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão integrada de mensalidades, controle de adimplência (em dia, atrasados e cancelados por data/horário) e sincronização contábil.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-semibold shadow-sm animate-fadeIn ${
          feedback.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={18} className="shrink-0 text-green-600" /> : <AlertCircle size={18} className="shrink-0 text-red-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Cards de Métricas e Filtros Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total */}
        <button
          type="button"
          onClick={() => setStatusTab("todos")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === "todos"
              ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Todos</span>
            <Building2 size={18} className={statusTab === "todos" ? "text-sky-300" : "text-slate-400"} />
          </div>
          <div className="text-2xl font-black mt-2">{stats.total}</div>
          <div className="text-xs mt-1 opacity-80">Afiliados cadastrados</div>
        </button>

        {/* Em Dia */}
        <button
          type="button"
          onClick={() => setStatusTab("em_dia")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === "em_dia"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-600/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusTab === "em_dia" ? "text-emerald-100" : "text-emerald-700"}`}>Em Dia</span>
            <CheckCircle size={18} className={statusTab === "em_dia" ? "text-emerald-200" : "text-emerald-500"} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusTab === "em_dia" ? "text-white" : "text-emerald-700"}`}>{stats.emDiaCount}</div>
          <div className={`text-xs mt-1 font-semibold ${statusTab === "em_dia" ? "text-emerald-100" : "text-emerald-600"}`}>
            {formatCurrency(stats.valorTotalMensalidade)}/mês
          </div>
        </button>

        {/* Atrasados */}
        <button
          type="button"
          onClick={() => setStatusTab("atrasados")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === "atrasados"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-rose-300 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusTab === "atrasados" ? "text-rose-100" : "text-rose-700"}`}>Atrasados</span>
            <AlertTriangle size={18} className={statusTab === "atrasados" ? "text-rose-200" : "text-rose-500"} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusTab === "atrasados" ? "text-white" : "text-rose-700"}`}>{stats.atrasadosCount}</div>
          <div className={`text-xs mt-1 font-semibold ${statusTab === "atrasados" ? "text-rose-100" : "text-rose-600"}`}>
            {stats.valorTotalInadimplente > 0 ? `Débito: ${formatCurrency(stats.valorTotalInadimplente)}` : "Sem débitos"}
          </div>
        </button>

        {/* Cancelados */}
        <button
          type="button"
          onClick={() => setStatusTab("cancelados")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === "cancelados"
              ? "bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-600/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-amber-300 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusTab === "cancelados" ? "text-amber-100" : "text-amber-700"}`}>Cancelados</span>
            <XCircle size={18} className={statusTab === "cancelados" ? "text-amber-200" : "text-amber-500"} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusTab === "cancelados" ? "text-white" : "text-amber-700"}`}>{stats.canceladosCount}</div>
          <div className={`text-xs mt-1 ${statusTab === "cancelados" ? "text-amber-100" : "text-slate-500"}`}>Auditados com data e hora</div>
        </button>

        {/* Pendentes */}
        <button
          type="button"
          onClick={() => setStatusTab("pendentes")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusTab === "pendentes"
              ? "bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-600/20"
              : "bg-white text-slate-700 border-slate-200 hover:border-sky-300 shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${statusTab === "pendentes" ? "text-sky-100" : "text-sky-700"}`}>Pendentes</span>
            <Clock size={18} className={statusTab === "pendentes" ? "text-sky-200" : "text-sky-500"} />
          </div>
          <div className={`text-2xl font-black mt-2 ${statusTab === "pendentes" ? "text-white" : "text-sky-700"}`}>{stats.pendentesCount}</div>
          <div className={`text-xs mt-1 ${statusTab === "pendentes" ? "text-sky-100" : "text-slate-500"}`}>Aguardando aceite</div>
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por condomínio, síndico, CNPJ ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <span className="text-xs font-medium text-slate-500">Exibindo {filtered.length} de {afiliados.length}</span>
        </div>
      </div>

      {/* Lista de Afiliados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Condomínio (Titular) / Síndico</th>
                <th className="px-6 py-4">Contato / E-mail</th>
                <th className="px-6 py-4">Unidades / Mensalidade</th>
                <th className="px-6 py-4">Vencimento Escolhido</th>
                <th className="px-6 py-4">Situação Financeira</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Carregando afiliados...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">Nenhum afiliado encontrado no filtro selecionado.</td>
                </tr>
              ) : (
                filtered.map((afiliado) => {
                  const statusComputado = getAffiliateStatus(afiliado);
                  const fin = getAfiliadoFinancialSummary(afiliado);
                  const isSyncing = syncingId === afiliado.id;
                  const cancelDateFormatted = formatCancellationDateTime(afiliado);

                  return (
                  <tr key={afiliado.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 size={16} className="text-sky-600 shrink-0" />
                        <span>{afiliado.nomeCondominio}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{afiliado.nomeSindico} {afiliado.cnpj ? `• CNPJ: ${afiliado.cnpj}` : ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{afiliado.email || afiliado.clienteEmail || "Sem e-mail informado"}</div>
                      <div className="text-xs text-slate-400">{afiliado.telefone || "Sem telefone"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{afiliado.unidadesHabitacionais || 0} unidades</div>
                      <div className="text-xs text-emerald-600 font-bold">
                        {formatCurrency(afiliado.valorMensalidade)}/mês
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">Dia {afiliado.diaVencimento || 10}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {afiliado.dataAtivacao ? `Ativado em ${new Date(afiliado.dataAtivacao).toLocaleDateString("pt-BR")}` : "Pendente"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {statusComputado === "Em Dia" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={12} className="text-emerald-600" />
                            Em Dia ({fin.pagasCount} pagas / {fin.abertasCount} a vencer)
                          </span>
                        )}

                        {statusComputado === "Atrasado" && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={12} className="text-rose-600" />
                              Atrasado ({fin.atrasadasCount} {fin.atrasadasCount === 1 ? "parcela" : "parcelas"})
                            </span>
                            <span className="text-[11px] text-rose-600 font-semibold pl-1">
                              Débito: {formatCurrency(fin.valorTotalAtrasado)}
                            </span>
                          </div>
                        )}

                        {statusComputado === "Cancelado" && (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle size={12} className="text-rose-600" />
                              Cancelado
                            </span>
                            <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 bg-rose-50/80 px-2 py-0.5 rounded-md border border-rose-100">
                              <Clock size={11} className="shrink-0 text-rose-500" />
                              <span>{cancelDateFormatted ? `Em ${cancelDateFormatted}` : "Cancelado no painel de usuários"}</span>
                            </div>
                          </div>
                        )}

                        {statusComputado !== "Em Dia" && statusComputado !== "Atrasado" && statusComputado !== "Cancelado" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} className="text-amber-600" />
                            {statusComputado}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setViewAfiliado(afiliado)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          title="Ver Detalhes e 12 Mensalidades"
                        >
                          <Eye size={13} />
                          <span>Ver</span>
                        </button>
                        
                        <button
                          onClick={() => openEditModal(afiliado)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          title="Alterar Vencimento / Valores e Sincronizar"
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => handleManualSync(afiliado)}
                          disabled={isSyncing}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          title="Sincronizar 12 parcelas no Contas a Receber"
                        >
                          <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                          <span>Sincronizar</span>
                        </button>

                        <button
                          onClick={() => openResendModal(afiliado)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-100 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                          title="Reenviar Termo de Afiliação"
                        >
                          <Mail size={13} />
                          <span>Termo</span>
                        </button>

                        {statusComputado !== "Em Dia" && statusComputado !== "Atrasado" && (
                          <button
                            onClick={() => handleApprove(afiliado)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
                            title="Ativar Afiliação e Gerar 12 Mensalidades"
                          >
                            <Check size={13} />
                            <span>Ativar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Reenvio do Termo (E-mail e WhatsApp com link de uso único) */}
      {modalAfiliado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5 text-[#0071e3]">
                <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-[#0071e3] border border-sky-100">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Reenviar Termo de Afiliação</h3>
                  <p className="text-xs text-slate-500">
                    {modalAfiliado.nomeCondominio} • Vencimento Dia {modalAfiliado.diaVencimento || 10}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalAfiliado(null);
                  setSendResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              
              {/* Feedback em Tela: Confirmação de Envio com Sucesso ou Falha */}
              {sendResult && (
                <div className={`p-4 rounded-2xl border transition-all animate-in fade-in ${
                  sendResult.success 
                    ? "bg-emerald-50/90 border-emerald-200 text-emerald-950" 
                    : "bg-rose-50/90 border-rose-200 text-rose-950"
                }`}>
                  <div className="flex items-start gap-3">
                    {sendResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-sm">
                        {sendResult.success 
                          ? (sendResult.channel === "email" ? "E-mail enviado com sucesso!" : "WhatsApp pronto para envio!") 
                          : "Não foi possível enviar por e-mail"}
                      </p>
                      <p className="text-xs leading-relaxed">
                        {sendResult.message || sendResult.error}
                      </p>
                      {!sendResult.success && (
                        <p className="text-xs font-semibold text-rose-700 pt-1">
                          💡 Dica: Utilize a opção de Envio via WhatsApp logo abaixo para disponibilizar o link de aceite único ao síndico.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CANAL 1: Envio por E-mail */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={15} className="text-[#0071e3]" />
                    Opção 1: Enviar por E-mail (HostGator SMTP)
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    smtpStatus.ready 
                      ? "bg-emerald-100 text-emerald-800" 
                      : smtpStatus.validating 
                      ? "bg-sky-100 text-sky-800" 
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {smtpStatus.validating 
                      ? "Verificando..." 
                      : smtpStatus.ready 
                      ? "SMTP Pronto" 
                      : "Handshake Pendente"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="email"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      placeholder="exemplo@condominio.com.br"
                      className="w-full pl-3.5 pr-28 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <button
                      onClick={handleConfirmResend}
                      disabled={sending || !targetEmail.trim()}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-[#0071e3] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {sending ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Enviar E-mail</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    O e-mail contém o contrato completo e o botão com o link de aceite único válido uma só vez.
                  </p>
                </div>
              </div>

              {/* CANAL 2: Envio via WhatsApp */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle size={16} className="text-emerald-600" />
                    Opção 2: Enviar via WhatsApp (Link de Uso Único)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">
                    WhatsApp Direto
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Número de WhatsApp do Destinatário
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone size={14} />
                      </div>
                      <input
                        type="text"
                        value={targetPhone}
                        onChange={(e) => setTargetPhone(e.target.value)}
                        placeholder="(62) 99999-9999"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Prévia da Mensagem */}
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 text-xs text-slate-600 space-y-1.5 max-h-36 overflow-y-auto font-mono">
                    <p className="text-slate-400 font-sans text-[10px] font-bold uppercase tracking-wider">
                      Prévia da mensagem que será enviada:
                    </p>
                    <p className="whitespace-pre-line text-[11px] text-slate-700 leading-relaxed font-sans">
                      {buildWhatsAppMessage(modalAfiliado, generatedToken || "tok_exemplo")}
                    </p>
                  </div>

                  {/* Ações do WhatsApp */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs sm:text-sm cursor-pointer"
                    >
                      <MessageCircle size={16} />
                      <span>Abrir no WhatsApp</span>
                      <ExternalLink size={13} className="opacity-80" />
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyWhatsAppText}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-semibold transition-all text-xs cursor-pointer"
                      title="Copiar mensagem e link para a área de transferência"
                    >
                      {copiedWhatsApp ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiar Mensagem</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informações de Segurança de Uso Único */}
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
                <Lock size={15} className="text-sky-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Segurança & Uso Único:</strong> O link de aceite gerado para este condomínio é exclusivo e expira automaticamente após o primeiro aceite. Ao confirmar, as 12 parcelas são integradas no Contas a Receber.
                </p>
              </div>

              {/* Botão de Fechar */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setModalAfiliado(null);
                    setSendResult(null);
                  }}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-xs cursor-pointer"
                >
                  Fechar Janela
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição (Alteração de Vencimento / Valores) */}
      {editAfiliado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-2 text-amber-600">
                <Edit2 size={22} />
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Alterar Dados do Contrato</h3>
                  <p className="text-xs text-slate-500">Recalcula e sincroniza as 12 parcelas no Contas a Receber</p>
                </div>
              </div>
              <button
                onClick={() => setEditAfiliado(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditAfiliado} className="overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome do Condomínio (Titular do Documento) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editAfiliado.nomeCondominio}
                  onChange={(e) => setEditAfiliado({ ...editAfiliado, nomeCondominio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dia de Vencimento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editAfiliado.diaVencimento}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, diaVencimento: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-slate-800"
                  >
                    {[5, 10, 15, 20, 25, 28, 30].map(dia => (
                      <option key={dia} value={dia}>Dia {dia} de cada mês</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Valor Mensalidade (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editAfiliado.valorMensalidade}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, valorMensalidade: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    CNPJ do Condomínio
                  </label>
                  <input
                    type="text"
                    value={editAfiliado.cnpj}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, cnpj: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Unidades Habitacionais
                  </label>
                  <input
                    type="number"
                    value={editAfiliado.unidadesHabitacionais}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, unidadesHabitacionais: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Síndico / Responsável
                  </label>
                  <input
                    type="text"
                    value={editAfiliado.nomeSindico}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, nomeSindico: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={editAfiliado.telefone}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, telefone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    E-mail do Condomínio / Síndico
                  </label>
                  <input
                    type="email"
                    value={editAfiliado.email}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Status da Afiliação
                  </label>
                  <select
                    value={editAfiliado.status}
                    onChange={(e) => setEditAfiliado({ ...editAfiliado, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Live Preview de Integridade Financeira */}
              {(() => {
                const valPreview = validarIntegridadeFinanceiraAfiliacao({
                  nomeCondominio: editAfiliado.nomeCondominio,
                  diaVencimento: editAfiliado.diaVencimento,
                  valorMensalidade: editAfiliado.valorMensalidade,
                  unidadesHabitacionais: editAfiliado.unidadesHabitacionais
                });
                return (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    valPreview.isValid
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {valPreview.isValid ? (
                          <CheckCircle size={15} className="text-emerald-600" />
                        ) : (
                          <AlertTriangle size={15} className="text-rose-600" />
                        )}
                        Integridade Financeira (Soma das Parcelas x Total)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${
                        valPreview.isValid ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"
                      }`}>
                        {valPreview.isValid ? "Consistente (100%)" : "Inconsistente"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 font-medium text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Mensalidade:</span>
                        <strong className="text-slate-900">{formatCurrency(valPreview.valorMensalidade)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">12 Parcelas:</span>
                        <strong className="text-slate-900">{formatCurrency(valPreview.somaParcelas)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Total Anual:</span>
                        <strong className="text-slate-900">{formatCurrency(valPreview.valorTotalAfiliacao)}</strong>
                      </div>
                    </div>

                    {!valPreview.isValid && (
                      <div className="text-rose-700 text-[11px] font-semibold pt-1 border-t border-rose-200 mt-1">
                        {valPreview.erros.join(" • ")}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-700" />
                  Validação Antiduplicidade Ativa
                </p>
                <p>
                  Ao salvar, os registros em aberto no Contas a Receber serão ajustados para o novo vencimento (Dia {editAfiliado.diaVencimento}) e novo valor (R$ {Number(editAfiliado.valorMensalidade || 0).toFixed(2)}), com titular <strong>{editAfiliado.nomeCondominio || 'Condomínio'}</strong>, preservando parcelas já quitadas.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditAfiliado(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Salvar e Sincronizar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Visualização (Ver Detalhes e 12 Parcelas) */}
      {viewAfiliado && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Ficha & 12 Parcelas do Afiliado</h3>
                  <p className="text-xs text-slate-500">{viewAfiliado.nomeCondominio}</p>
                </div>
              </div>
              <button
                onClick={() => setViewAfiliado(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-6 flex-1 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Atual</label>
                  <div className="font-semibold text-slate-900">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        getAffiliateStatus(viewAfiliado) === "Em Dia" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        getAffiliateStatus(viewAfiliado) === "Cancelado" ? "bg-rose-50 text-rose-700 border border-rose-200 font-bold" :
                        getAffiliateStatus(viewAfiliado) === "Atrasado" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        getAffiliateStatus(viewAfiliado) === "Inativo" ? "bg-slate-100 text-slate-700 border border-slate-300" :
                        "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                      {getAffiliateStatus(viewAfiliado) === "Em Dia" ? <CheckCircle size={12} /> :
                       getAffiliateStatus(viewAfiliado) === "Cancelado" ? <XCircle size={12} className="text-rose-600" /> :
                       getAffiliateStatus(viewAfiliado) === "Atrasado" ? <AlertTriangle size={12} className="text-rose-600" /> :
                       <Clock size={12} />}
                      {getAffiliateStatus(viewAfiliado)}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {getAffiliateStatus(viewAfiliado) === "Cancelado" ? "Data e Horário do Cancelamento" : "Data de Ativação"}
                  </label>
                  <div className="font-semibold text-slate-900">
                    {getAffiliateStatus(viewAfiliado) === "Cancelado" ? (
                      <div className="text-rose-600 font-bold flex items-center gap-1 text-sm">
                        <Clock size={14} className="text-rose-500" />
                        <span>{formatCancellationDateTime(viewAfiliado) || "Cancelado"}</span>
                      </div>
                    ) : (
                      viewAfiliado.dataAtivacao ? new Date(viewAfiliado.dataAtivacao).toLocaleDateString("pt-BR") : "Pendente"
                    )}
                  </div>
                </div>
              </div>

              {getAffiliateStatus(viewAfiliado) === "Cancelado" && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-900 font-medium animate-fadeIn">
                  <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-rose-800">Afiliação Cancelada no Painel de Controle de Usuários</div>
                    <div className="text-rose-700 mt-0.5">
                      {formatCancellationDateTime(viewAfiliado) ? (
                        <>Cancelamento registrado em <strong>{formatCancellationDateTime(viewAfiliado)}</strong>.</>
                      ) : (
                        "O status desta conta foi alterado para Cancelado no sistema."
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informações Contratuais */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-sm">
                  <h4 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 mb-2 text-xs uppercase">Dados do Condomínio</h4>
                  <div>
                    <span className="text-xs text-slate-500 block">Titular:</span>
                    <span className="font-bold text-slate-900">{viewAfiliado.nomeCondominio || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">CNPJ:</span>
                    <span className="font-medium text-slate-800">{viewAfiliado.cnpj || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Síndico:</span>
                    <span className="font-medium text-slate-800">{viewAfiliado.nomeSindico || "Não informado"}</span>
                  </div>
                </div>

                <div className="bg-sky-50 rounded-xl p-4 border border-sky-100 space-y-2 text-sm">
                  <h4 className="font-bold text-sky-900 border-b border-sky-200 pb-1.5 mb-2 text-xs uppercase">Condições da Afiliação</h4>
                  <div>
                    <span className="text-xs text-sky-700 block">Valor Mensal:</span>
                    <span className="font-bold text-emerald-700 text-base">{formatCurrency(viewAfiliado.valorMensalidade)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-sky-700 block">Vencimento Escolhido:</span>
                    <span className="font-bold text-sky-950">Dia {viewAfiliado.diaVencimento || "10"} de cada mês</span>
                  </div>
                  <div>
                    <span className="text-xs text-sky-700 block">Centro de Custo Financeiro:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded text-xs mt-0.5">
                      <Layers size={12} />
                      {CENTRO_CUSTO_AFILIACAO}
                    </span>
                  </div>
                </div>
              </div>

              {/* Auditoria de Integridade Financeira (Soma das Parcelas x Total da Afiliação) */}
              {(() => {
                const totalEsperado = (Number(viewAfiliado.valorMensalidade) || 0) * 12;
                const somaRegistrada = viewParcelas.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
                const diferenca = Math.abs(somaRegistrada - totalEsperado);
                const isConsistente = viewParcelas.length === 12 && diferenca < 0.05;

                return (
                  <div className={`rounded-xl p-4 border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs ${
                    isConsistente
                      ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                      : "bg-amber-50 border-amber-200 text-amber-950"
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isConsistente ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {isConsistente ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
                      </div>
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          <span>Integridade Financeira Auditada</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isConsistente ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800"
                          }`}>
                            {isConsistente ? "100% Consistente" : "Requer Atenção"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Soma das 12 Parcelas vs. Valor Total do Contrato Anual
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/70 px-3 py-2 rounded-lg border border-slate-200/60 shrink-0">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Soma Parcelas</span>
                        <strong className="text-xs text-slate-900 font-black">{formatCurrency(somaRegistrada)}</strong>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Total Contrato</span>
                        <strong className="text-xs text-slate-900 font-black">{formatCurrency(totalEsperado)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tabela das 12 Parcelas no Contas a Receber */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100/70 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck size={16} className="text-sky-600" />
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      12 Parcelas no Contas a Receber ({viewParcelas.length}/12 registradas)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleManualSync(viewAfiliado)}
                    disabled={syncingId === viewAfiliado.id}
                    className="flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={12} className={syncingId === viewAfiliado.id ? "animate-spin" : ""} />
                    <span>Sincronizar Agora</span>
                  </button>
                </div>

                {loadingParcelas ? (
                  <div className="p-6 text-center text-slate-400 text-sm">Carregando parcelas do financeiro...</div>
                ) : viewParcelas.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Nenhuma parcela localizada no contas a receber para este condomínio.
                    <button
                      onClick={() => handleManualSync(viewAfiliado)}
                      className="mt-2 block mx-auto text-xs font-bold text-sky-600 hover:underline"
                    >
                      Clique aqui para gerar as 12 parcelas agora
                    </button>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Parc.</th>
                          <th className="px-3 py-2">Titular</th>
                          <th className="px-3 py-2">Vencimento</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewParcelas.map((parc, idx) => (
                          <tr key={parc.id || idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-700">
                              {parc.numeroParcela || idx + 1}/12
                            </td>
                            <td className="px-3 py-2 text-slate-900 font-medium truncate max-w-[160px]">
                              {parc.titular || parc.clienteNome || viewAfiliado.nomeCondominio}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {parc.vencimento ? new Date(parc.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                            </td>
                            <td className="px-3 py-2 font-bold text-emerald-700">
                              {formatCurrency(parc.valor)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                parc.status === "Recebido" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                parc.status === "Cancelado" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                                parc.status === "Atrasado" || parc.status === "Vencido" ? "bg-red-100 text-red-800 border border-red-200" :
                                "bg-sky-100 text-sky-800 border border-sky-200"
                              }`}>
                                {parc.status === "Cancelado" ? "Cancelado (>15d)" : (parc.status || "Aberto")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => {
                  const target = viewAfiliado;
                  setViewAfiliado(null);
                  openEditModal(target);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                <Edit2 size={15} />
                <span>Alterar Vencimento / Valores</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewAfiliado(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={() => handleImprimirAfiliado(viewAfiliado)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-md transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Ficha</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
