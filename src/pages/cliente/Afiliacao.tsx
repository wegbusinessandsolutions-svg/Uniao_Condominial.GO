import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Building2, Check, CheckCircle, HeartHandshake, AlertTriangle, AlertCircle, X, Receipt, ChevronDown, ChevronUp, FileText, Barcode, Printer } from "lucide-react";
import { doc, setDoc, serverTimestamp, collection, onSnapshot, query, where } from "firebase/firestore";
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
            className={`p-1.5 rounded-lg transition-colors ${
              cancelFeedback.type === "success" ? "hover:bg-emerald-100" : "hover:bg-rose-100"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-[#0071e3] rounded-lg">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Afiliado - União Condominial</h2>
              <p className="text-sm text-slate-500">Gerencie sua afiliação e benefícios exclusivos</p>
            </div>
          </div>
          
          <div className="mt-8">
            {(!afiliadoStatus || afiliadoStatus === "Cancelado" || queroAfiliar) && (
              <div className="py-6 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setQueroAfiliar(!queroAfiliar)}>
                  <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${queroAfiliar ? "bg-[#0071e3] border-[#0071e3]" : "bg-white border-slate-300 group-hover:border-[#0071e3]"}`}>
                    {queroAfiliar && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-semibold text-slate-800 text-[15px] select-none">Quero tornar meu condomínio Afiliado para obter vantagens exclusivas.</span>
                </label>

                {queroAfiliar && (
                  <div className="mt-5 p-5 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      Assinando o plano corporativo <strong>União Condominial</strong>, seu condomínio terá acesso a <strong className="text-slate-800">descontos de até 50%</strong> em serviços como limpeza de caixas d'água, manutenção de portões, CFTV, alarme e jardinagem. Além disso, a cada ano renovado, uma nova tabela de benefícios e cashback pode ser liberada.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Unidades do Condomínio</label>
                        <input
                          type="number"
                          placeholder="Qtd. de apartamentos/casas"
                          value={unidades}
                          onChange={(e) => setUnidades(e.target.value ? Number(e.target.value) : "")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-all"
                        />
                      </div>
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-center">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Valor da Mensalidade</label>
                        {Number(unidades) > 0 ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-[#0071e3]">
                              R$ {calcValorMensalidade().toFixed(2).replace(".", ",")}
                            </span>
                            <span className="text-sm font-semibold text-slate-500">/mês</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 font-medium italic">Informe a quantidade</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs mb-5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Melhor dia para Vencimento</label>
                      <div className="flex flex-wrap gap-2">
                        {[5, 10, 15, 20, 25, 30].map(dia => (
                          <label key={dia} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all ${diaVencimento === dia ? 'border-[#0071e3] bg-blue-50 text-[#0071e3] font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
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
                        className="w-full bg-[#0071e3] hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                      >
                        {loadingAfil ? "Processando..." : "Aceitar e Assinar Termo de Afiliação"}
                      </button>
                      <p className="text-xs text-slate-500 text-center mt-3">
                        Ao dar o aceite, o Termo de Afiliação à União Condominial será gerado e enviado para o e-mail cadastrado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {afiliadoStatus && afiliadoStatus !== "Cancelado" && (
              <div className="py-6 border-t border-slate-100">
                <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#0071e3] shadow-sm">
                    <Building2 size={32} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">
                    Seu condomínio é um Afiliado a União Condominial desde: <span className="text-[#0071e3] font-black">{getFormattedDataAfiliacao()}</span>
                  </h3>
                  
                  <div className="text-slate-800 text-sm font-medium">
                    Status atual: <span className="font-bold text-emerald-600">Ativo</span>.{" "}
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(true)}
                      className="text-red-600 underline font-semibold hover:text-red-800 transition-colors ml-1 cursor-pointer"
                    >
                      Cancelar Afiliação
                    </button>
                  </div>

                  {afiliadoStatus === "Pendente de Aceite por E-mail" && (
                    <p className="text-sm text-slate-500 bg-white p-3 rounded-lg mt-2 shadow-xs border border-slate-100">
                      Acesse seu e-mail e responda "DE ACORDO" ao termo enviado para concluir sua afiliação.
                    </p>
                  )}
                </div>
              </div>
            )}

            {afiliadoStatus === "Cancelado" && !queroAfiliar && (
              <div className="py-6 border-t border-slate-100 space-y-4">
                <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-rose-100">
                    <Building2 size={32} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">
                    Seu condomínio é um Afiliado a União Condominial desde: <span className="text-slate-700 font-black">{getFormattedDataAfiliacao()}</span>
                  </h3>
                  <div className="text-slate-800 text-sm">
                    Status atual: <span className="font-bold text-red-600">Cancelado</span>.
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg mt-1 leading-relaxed">
                    Sua afiliação encontra-se cancelada. Os descontos de até 50% em serviços condominiais rotineiros e os benefícios exclusivos aos condôminos foram suspensos.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQueroAfiliar(true)}
                    className="mt-3 inline-flex items-center gap-2 bg-[#0071e3] hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <HeartHandshake className="w-5 h-5" />
                    Afiliar-se Novamente
                  </button>
                </div>
              </div>
            )}
            
            {(afiliadoStatus === "Cancelado" || (afiliadoStatus && afiliadoStatus !== "Cancelado")) && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Situação da Afiliação</h4>
                      <p className="text-xs text-slate-500">Status do cadastro e histórico de mensalidades</p>
                    </div>
                  </div>
                  
                  {afiliadoStatus === "Cancelado" && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <CheckCircle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        Afiliação Desativada
                      </p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Sua afiliação encontra-se cancelada e não há cobranças ativas. Para reativar seu plano e recuperar os descontos e vantagens, clique em <strong>Afiliar-se Novamente</strong>.
                      </p>
                    </div>
                  </div>
                  )}

                  {faturasAfil.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowFaturasList(!showFaturasList)}
                        className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-[#0071e3] transition-colors py-1 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-slate-400" />
                          Histórico de Parcelas da Afiliação ({faturasAfil.length} registradas)
                        </span>
                        {showFaturasList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {showFaturasList && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2">Parc.</th>
                                <th className="px-3 py-2">Vencimento</th>
                                <th className="px-3 py-2">Valor</th>
                                <th className="px-3 py-2">Situação</th>
                                <th className="px-3 py-2 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
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
                                  <tr key={parc.id || idx} className={`hover:bg-slate-50 ${isCancelado ? "opacity-60 bg-slate-50/50" : ""}`}>
                                    <td className="px-3 py-2 font-bold text-slate-700">
                                      {parc.numeroParcela || idx + 1}/12
                                    </td>
                                    <td className="px-3 py-2 font-medium text-slate-800">
                                      {parc.vencimento ? new Date(parc.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-slate-900">
                                      R$ {Number(parc.valor || 0).toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        isPago ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                        isCancelado ? "bg-slate-200 text-slate-700 border border-slate-300 line-through" :
                                        "bg-amber-100 text-amber-800 border border-amber-200"
                                      }`}>
                                        {isPago ? "Pago" : isCancelado ? "Cancelado (>15d)" : "Aberto (<=15d)"}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center flex items-center justify-center gap-2">
                                      {!isPago && !isCancelado && (
                                        <button
                                          onClick={() => alert("Boleto enviado para o e-mail cadastrado.")}
                                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0071e3] hover:bg-blue-50 transition-colors"
                                          title="Re-emitir Boleto"
                                        >
                                          <Barcode className="w-4 h-4" />
                                        </button>
                                      )}
                                      
                                      {isPago ? (
                                        nfeDisponivel ? (
                                          <button
                                            onClick={() => alert("Gerando arquivo PDF da Nota Fiscal...")}
                                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                            title="Imprimir NF-e"
                                          >
                                            <Printer className="w-4 h-4" />
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => alert("A Nota Fiscal estará disponível para impressão 24h após a baixa bancária.")}
                                            className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Cancelar Afiliação</h3>
                <p className="text-xs text-slate-500">Confirmação de desfiliação do condomínio</p>
              </div>
            </div>
            
            <div className="space-y-4 text-sm text-slate-600 mb-6">
              <p className="text-sm leading-relaxed text-slate-700">
                Tem certeza de que deseja cancelar a afiliação do condomínio <strong>{afiliadoData?.nomeCondominio || user?.nome}</strong>?
              </p>
              
              <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl text-rose-950 space-y-2">
                <p className="font-bold text-xs uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  Impacto do Cancelamento
                </p>
                <p className="text-xs leading-relaxed text-rose-900">
                  O cancelamento é <strong>imediato</strong>. Seu condomínio perderá o acesso aos descontos de até <strong>50%</strong> em todos os serviços condominiais rotineiros e às vantagens exclusivas do Clube de Benefícios para síndicos e moradores.
                </p>
              </div>
              
              <p className="text-xs text-slate-500">
                Caso decida retornar no futuro, você poderá reativar sua afiliação a qualquer momento.
              </p>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={canceling}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {canceling ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
