import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  RefreshCw, 
  Calendar, 
  FileCheck, 
  DollarSign, 
  ShieldCheck, 
  Lock, 
  Phone, 
  User, 
  FileText, 
  ArrowRight,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { syncAfiliacaoContasReceber, SyncAfiliacaoResult, validarAfiliacaoAntesDePersistir } from "../services/afiliacaoFinanceiroService";

export default function AceiteAfiliacao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [afiliado, setAfiliado] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [justAccepted, setJustAccepted] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAfiliacaoResult | null>(null);

  useEffect(() => {
    const fetchAfiliado = async () => {
      if (!id) {
        setError("ID da afiliação não fornecido.");
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "afiliados_uc", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("Proposta de afiliação não encontrada.");
          setLoading(false);
          return;
        }

        const data = { id: docSnap.id, ...(docSnap.data() as any) };
        setAfiliado(data);

        // Verifica token de uso único na URL
        const searchParams = new URLSearchParams(window.location.search);
        const urlToken = searchParams.get("token");

        // Se já está ativo ou o token já foi consumido
        if (data.status === "Ativo" || data.tokenAceiteUsado === true || data.termoAceito === true) {
          setAlreadyAccepted(true);
        } else if (data.tokenAceite && urlToken && urlToken !== data.tokenAceite) {
          // Se um novo token foi gerado posteriormente
          setTokenInvalid(true);
        }
      } catch (err: any) {
        setError("Erro ao carregar dados da afiliação: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAfiliado();
  }, [id]);

  const handleAceitar = async () => {
    if (!afiliado) return;
    setProcessing(true);
    setError(null);

    try {
      // 0. Validação prévia de integridade financeira antes de qualquer escrita no Firestore
      const validacaoPrevia = validarAfiliacaoAntesDePersistir(afiliado);
      if (!validacaoPrevia.isValid) {
        throw new Error(`Inconsistência financeira impeditiva: ${validacaoPrevia.erros.join("; ")}`);
      }

      const nowIso = new Date().toISOString();

      // 1. Atualiza status da afiliação para Ativo e invalida o token de uso único
      await updateDoc(doc(db, "afiliados_uc", afiliado.id), {
        status: "Ativo",
        afiliado: true,
        termoAceito: true,
        tokenAceiteUsado: true,
        dataAceiteTermo: nowIso,
        dataAtivacao: nowIso,
        valorTotalContrato: validacaoPrevia.valorTotalAfiliacao,
        canalConfirmacao: "link_web",
        updatedAt: nowIso
      });

      const updatedAfiliado = {
        ...afiliado,
        status: "Ativo",
        termoAceito: true,
        tokenAceiteUsado: true,
        dataAtivacao: nowIso,
        dataAceiteTermo: nowIso,
      };

      // 2. Sincroniza/Inclui automaticamente as 12 parcelas no Contas a Receber com Titular = Nome do Condomínio
      const result = await syncAfiliacaoContasReceber(updatedAfiliado, {
        actorName: afiliado.nomeSindico || "Cliente / Aceite de Termo",
        origemAcao: "Aceite de Termo de Afiliação (Web Link Uso Único)"
      });

      setSyncResult(result);

      // 3. Notificação para o sistema / comercial / administração
      try {
        await addDoc(collection(db, "notifications"), {
          type: "system",
          title: "🎉 Afiliação Aceita - 12 Mensalidades Geradas",
          message: `O condomínio ${afiliado.nomeCondominio} aceitou o termo via link de uso único. 12 parcelas sincronizadas no Contas a Receber (Titular: ${afiliado.nomeCondominio}, Vencimento: Dia ${afiliado.diaVencimento}).`,
          read: false,
          priority: "high",
          targetAudience: "admin",
          createdAt: nowIso
        });
      } catch (notifErr) {
        console.warn("Aviso ao gerar notificação:", notifErr);
      }

      setJustAccepted(true);
    } catch (err: any) {
      setError("Falha ao aceitar afiliação: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Carregando dados da proposta de afiliação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col items-center justify-center p-4 sm:p-6 py-10">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80">
        
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-[#0071e3] to-sky-700 p-8 text-white flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-1">União Condominial</h1>
          <p className="text-sky-100 text-sm font-medium">Termo de Aceite de Afiliação Condominial</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-semibold text-sky-100 backdrop-blur-xs">
            <ShieldCheck size={14} className="text-amber-300" />
            <span>Link Seguro • Validade de Uso Único</span>
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-6">
          
          {/* Mensagem de Erro Geral */}
          {error && (
            <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl flex items-start gap-3 border border-rose-200 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold text-sm">Atenção</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* CASO 1: Acabou de Aceitar Nesta Sessão */}
          {justAccepted ? (
            <div className="text-center space-y-6 py-4 animate-in fade-in">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block mb-2">
                  Aceite Confirmado com Sucesso
                </span>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Afiliação Ativada com Sucesso!</h2>
                <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
                  O Condomínio <strong>{afiliado?.nomeCondominio}</strong> agora é oficialmente um Afiliado à <strong>União Condominial</strong>.
                </p>
              </div>

              {/* Box de Confirmação Financeira */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 text-left max-w-xl mx-auto space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>12 Mensalidades Sincronizadas no Contas a Receber</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-emerald-950 bg-white/80 p-4 rounded-xl border border-emerald-100">
                  <div>
                    <span className="text-slate-500 block font-medium">Titular do Contrato:</span>
                    <span className="font-bold text-slate-900">{afiliado?.nomeCondominio}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Síndico / Responsável:</span>
                    <span className="font-bold text-slate-900">{afiliado?.nomeSindico || "Cadastrado"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Vencimento Escolhido:</span>
                    <span className="font-bold text-slate-900">Dia {afiliado?.diaVencimento} de cada mês</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-medium">Valor da Mensalidade:</span>
                    <span className="font-extrabold text-emerald-700">R$ {Number(afiliado?.valorMensalidade || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-800 pt-1">
                  <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                  <span>Este link de aceite único foi finalizado e os descontos de até 50% em serviços já estão liberados.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => navigate("/")}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 bg-[#0071e3] text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md text-sm cursor-pointer"
                >
                  Ir para a Página Inicial
                </button>
                <button
                  onClick={() => navigate("/cliente/dashboard")}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors text-sm cursor-pointer"
                >
                  Acessar Área do Cliente
                </button>
              </div>
            </div>
          ) : alreadyAccepted ? (
            /* CASO 2: Termo Já Foi Aceito Anteriormente (Link de Uso Único Expirado/Finalizado) */
            <div className="text-center space-y-6 py-6 animate-in fade-in">
              <div className="w-16 h-16 bg-blue-50 text-[#0071e3] rounded-2xl flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                  Afiliação Ativa & Confirmada
                </span>
                <h2 className="text-2xl font-bold text-slate-900">Termo de Afiliação Já Aceito</h2>
                <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
                  O Termo de Afiliação referente ao <strong>{afiliado?.nomeCondominio}</strong> já foi aceito e ativado anteriormente. 
                  Por motivos de segurança contratual, este link de confirmação é de <strong>uso único</strong> e já foi concluído.
                </p>
              </div>

              {/* Informações do Contrato */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left max-w-lg mx-auto space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Dados do Contrato</span>
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Ativo</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Condomínio:</span>
                    <span className="font-bold text-slate-800">{afiliado?.nomeCondominio}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Síndico/Responsável:</span>
                    <span className="font-bold text-slate-800">{afiliado?.nomeSindico || "Não informado"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Mensalidade:</span>
                    <span className="font-bold text-emerald-700">R$ {Number(afiliado?.valorMensalidade || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Vencimento:</span>
                    <span className="font-bold text-slate-800">Dia {afiliado?.diaVencimento}</span>
                  </div>
                  {afiliado?.dataAceiteTermo && (
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 text-slate-500">
                      Aceite registrado em {new Date(afiliado.dataAceiteTermo).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-3 bg-[#0071e3] hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm cursor-pointer"
                >
                  Ir para a Página Inicial
                </button>
              </div>
            </div>
          ) : tokenInvalid ? (
            /* CASO 3: Token Substituído por Reenvio Mais Recente */
            <div className="text-center space-y-6 py-6 animate-in fade-in">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block">
                  Link Expirado
                </span>
                <h2 className="text-xl font-bold text-slate-900">Link Substituído por Versão Mais Recente</h2>
                <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
                  Uma nova via do Termo de Afiliação foi reenviada recentemente para o condomínio <strong>{afiliado?.nomeCondominio}</strong>. 
                  Por favor, utilize o <strong>link mais recente</strong> que você recebeu por e-mail ou WhatsApp para realizar o aceite com segurança.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate("/")}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                >
                  Voltar ao Início
                </button>
              </div>
            </div>
          ) : afiliado ? (
            /* CASO 4: Aceite Pendente Válido */
            <div className="space-y-6 animate-in fade-in">
              
              {/* Resumo da Proposta */}
              <div>
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-[#0071e3]" />
                  Resumo da Proposta de Afiliação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Condomínio (Contratante)</p>
                    <p className="font-bold text-slate-900">{afiliado.nomeCondominio}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{afiliado.cnpj ? `CNPJ: ${afiliado.cnpj}` : "CNPJ não informado"}</p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Síndico / Responsável</p>
                    <p className="font-bold text-slate-900">{afiliado.nomeSindico || "Não informado"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{afiliado.telefone ? `Tel: ${afiliado.telefone}` : ""}</p>
                  </div>
                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                    <p className="text-xs text-emerald-800 font-medium mb-0.5">Valor da Mensalidade</p>
                    <p className="font-extrabold text-emerald-700 text-lg">
                      R$ {Number(afiliado.valorMensalidade || 0).toFixed(2).replace('.', ',')} <span className="text-xs font-normal text-emerald-800">/ mês</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">Dia de Vencimento</p>
                    <p className="font-bold text-slate-900 text-base">Todo dia {afiliado.diaVencimento || "10"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">12 parcelas mensais</p>
                  </div>
                </div>
              </div>

              {/* Cláusulas do Termo de Afiliação */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs text-slate-700 space-y-3 max-h-64 overflow-y-auto leading-relaxed">
                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center border-b border-slate-200 pb-2">
                  Termo de Afiliação à União Condominial
                </h4>
                
                <p>
                  <strong>CLÁUSULA 1ª — DO OBJETO:</strong> O presente instrumento tem por finalidade formalizar a afiliação do CONTRATANTE à União Condominial — Produtos de Limpeza e Conservação, concedendo acesso permanente à tabela com até <strong>50% (cinquenta por cento) de desconto</strong> sobre os valores praticados no mercado para serviços condominiais rotineiros, compras conjuntas e suporte técnico.
                </p>

                <p>
                  <strong>CLÁUSULA 2ª — DA VIGÊNCIA:</strong> O contrato vigorará pelo período de 12 (doze) meses a contar da confirmação do aceite eletrônico, renovando-se automaticamente por iguais períodos sucessivos salvo manifestação expressa em contrário.
                </p>

                <p>
                  <strong>CLÁUSULA 3ª — DOS SERVIÇOS INCLUSOS COM DESCONTO DE ATÉ 50%:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li>Limpeza de Reservatório de Água Inferior e Superior;</li>
                  <li>Limpeza e Desobstrução de Caixas de Gordura;</li>
                  <li>Serviços Especializados de Jardinagem e Paisagismo;</li>
                  <li>Manutenção de Portas, Portões Eletrônicos e Automatizadores;</li>
                  <li>Manutenção em Cercas Elétricas, Sensores e Cerca Concertina;</li>
                  <li>Manutenção de Portaria, Porteiros Eletrônicos e CFTV (Câmeras);</li>
                  <li>Manutenção Preventiva e Corretiva em Sistemas de Alarme;</li>
                  <li>Serviços de Pintura, Reformas e Pequenos Reparos Civis.</li>
                </ul>

                <p>
                  <strong>CLÁUSULA 4ª — DO FATURAMENTO:</strong> O pagamento será efetuado mensalmente no valor fixado na proposta, com vencimento programado para todo dia {afiliado.diaVencimento || "10"}, emitido sob titularidade direta do condomínio contratante.
                </p>
              </div>

              {/* Consentimento e Declaração */}
              <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
                <p className="text-sky-950 text-xs font-medium leading-relaxed">
                  Ao clicar no botão abaixo, declaro que sou o representante legal ou autorizado do condomínio, li e concordo integralmente com os termos contratuais acima, e autorizo a ativação da afiliação e a programação das 12 mensalidades.
                </p>
              </div>

              {/* Botão de Aceite */}
              <button
                onClick={handleAceitar}
                disabled={processing}
                className="w-full py-4 bg-[#0071e3] hover:bg-blue-700 text-white rounded-2xl font-bold text-base sm:text-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-70 flex justify-center items-center gap-3 cursor-pointer"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processando e Ativando Afiliação...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-6 h-6 text-emerald-300" />
                    <span>Aceitar e Confirmar Afiliação</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                🔒 Link válido para uma única confirmação (Uso Único). Ao confirmar, as mensalidades são integradas automaticamente no sistema financeiro.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
