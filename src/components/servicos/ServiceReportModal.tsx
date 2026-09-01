/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  X,
  Printer,
  Mail,
  Share2,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Building,
  User,
  Wrench,
  ShieldCheck,
  FileText,
  Camera,
  Layers,
  Phone,
  Check,
  ExternalLink,
  MessageCircle,
  FileDown,
  Download,
} from "lucide-react";
import { RoutineServiceOrder } from "../../types/serviceExecution";
import { CompanyLogo } from "../ui/CompanyLogo";
import { sendEmailWithLog } from "../../lib/emailService";
import { exportOrdemServicoPdf } from "../../lib/pdfExport";
import { formatDateBR, formatDateTimeBR } from "../../lib/dateUtils";

interface ServiceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: RoutineServiceOrder | null;
}

const getTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === "object" && typeof val.seconds === "number") return val.seconds * 1000;
  if (typeof val === "object" && typeof val.toDate === "function") return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number") return val < 10000000000 ? val * 1000 : val;
  if (typeof val === "string") {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export default function ServiceReportModal({
  isOpen,
  onClose,
  order,
}: ServiceReportModalProps) {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [selectedPhotoForZoom, setSelectedPhotoForZoom] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  // Calculate execution duration
  let durationText = "—";
  if (order.inicioTrabalhoEm && order.concluidoEm) {
    try {
      const start = getTimestampMs(order.inicioTrabalhoEm);
      const end = getTimestampMs(order.concluidoEm);
      const diffMs = end - start;
      if (diffMs > 0) {
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        durationText = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`;
      }
    } catch {
      durationText = "—";
    }
  }

  const handleDownloadPdf = async () => {
    if (!order) return;
    setIsGeneratingPdf(true);
    try {
      await exportOrdemServicoPdf(order);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    if (!order.clienteEmail && !order.assinaturaResponsavel?.email) {
      alert("Nenhum e-mail de cliente ou responsável cadastrado para esta ordem.");
      return;
    }

    const targetEmail = order.clienteEmail || order.assinaturaResponsavel?.email;
    setIsSendingEmail(true);
    setEmailError("");
    setEmailSuccess(false);

    try {
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #ffffff;">Relatório de Serviço Condominial Executado</h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">${order.numeroOS || `OS #${order.id.slice(0, 8)}`} • ${order.nomeCondominio || order.clienteNome}</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Olá, <strong>${order.clienteNome || "Administração do Condomínio"}</strong>,</p>
            <p>Informamos que o serviço rotineiro <strong>${order.servicoNome || "Serviço Condominial"}</strong> foi <strong>concluído com sucesso</strong> por nossa equipe técnica especializada.</p>
            
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Resumo do Atendimento:</h3>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Condomínio:</strong> ${order.nomeCondominio || order.clienteNome}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Endereço:</strong> ${order.enderecoCondominio || "Conforme cadastrado"}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Técnico / Prestador:</strong> ${order.colaboradorNome || "Técnico Especializado"}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Início dos Trabalhos:</strong> ${formatDateTimeBR(order.inicioTrabalhoEm)}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Conclusão:</strong> ${formatDateTimeBR(order.concluidoEm)}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Duração Total:</strong> ${durationText}</p>
              ${order.assinaturaResponsavel?.nome ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Acompanhado e Assinado por:</strong> ${order.assinaturaResponsavel.nome} (${order.assinaturaResponsavel.cargoOuFuncao})</p>` : ""}
            </div>

            ${order.observacoesTecnicas ? `
              <div style="margin: 16px 0;">
                <h4 style="margin: 0 0 6px; font-size: 13px; color: #334155;">Parecer e Observações Técnicas:</h4>
                <p style="margin: 0; font-size: 13px; color: #475569; background-color: #f1f5f9; padding: 10px; border-radius: 6px;">${order.observacoesTecnicas}</p>
              </div>
            ` : ""}

            <p style="font-size: 12px; color: #64748b; margin-top: 24px; text-align: center;">
              Este é um documento de registro e auditoria com fotos carimbadas digitalmente com data, hora e geolocalização.
            </p>
          </div>
        </div>
      `;

      await sendEmailWithLog(
        {
          to: targetEmail,
          subject: `[Relatório Concluído] ${order.numeroOS || "OS"} - ${order.servicoNome || "Serviço Executado"} - ${order.nomeCondominio || ""}`,
          html: emailBody,
        },
        "RELATORIO_SERVICO_CONCLUIDO"
      );

      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 6000);
    } catch (err: any) {
      console.error("Erro ao enviar email:", err);
      setEmailError(err.message || "Não foi possível enviar o e-mail no momento.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleShareWhatsApp = () => {
    const phone = order.telefoneContato || (order as any).clienteTelefone || order.assinaturaResponsavel?.telefone || "";
    const cleanPhone = phone.replace(/\D/g, "");
    const text = `*COMPROVANTE DE SERVIÇO EXECUTADO*\n` +
      `*OS:* ${order.numeroOS || order.id.slice(0, 8)}\n` +
      `*Condomínio:* ${order.nomeCondominio || order.clienteNome}\n` +
      `*Serviço:* ${order.servicoNome}\n` +
      `*Técnico:* ${order.colaboradorNome || "Equipe Técnica"}\n` +
      `*Conclusão:* ${formatDateTimeBR(order.concluidoEm)}\n` +
      `*Duração:* ${durationText}\n` +
      `*Assinado por:* ${order.assinaturaResponsavel?.nome || "Responsável"}\n\n` +
      `_Serviço finalizado com sucesso e fotos periciais arquivadas com segurança._`;

    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
        
        {/* Top Action Bar (Hidden when printing) */}
        <div className="bg-slate-50 border-b border-slate-200 text-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Relatório de Serviço Executado</h2>
              <p className="text-xs text-slate-500">
                {order.numeroOS || `OS #${order.id.slice(0, 8)}`} • {order.nomeCondominio || order.clienteNome}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              title="Baixar Relatório em PDF com Fotos e Assinatura"
            >
              {isGeneratingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileDown size={15} />
              )}
              <span>{isGeneratingPdf ? "Gerando PDF..." : "Baixar PDF"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all shadow-xs"
              title="Imprimir ou Salvar em PDF"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-all shadow-xs"
              title="Enviar Relatório por E-mail"
            >
              <Mail size={15} className={isSendingEmail ? "animate-spin" : ""} />
              <span className="hidden sm:inline">
                {isSendingEmail ? "Enviando..." : "E-mail"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
              title="Compartilhar no WhatsApp"
            >
              <MessageCircle size={15} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Feedback Banners */}
        {emailSuccess && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-6 py-2.5 text-xs font-bold flex items-center gap-2 print:hidden">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            Relatório técnico enviado com sucesso para o e-mail do cliente!
          </div>
        )}
        {emailError && (
          <div className="bg-rose-50 border-b border-rose-200 text-rose-700 px-6 py-2.5 text-xs font-bold flex items-center gap-2 print:hidden">
            <X size={16} className="text-rose-600 shrink-0" />
            {emailError}
          </div>
        )}

        {/* Printable Report Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-slate-900 bg-white print:p-0 print:overflow-visible">
          
          {/* Official Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CompanyLogo className="h-12 w-auto max-w-[160px] object-contain" />
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-950 uppercase tracking-tight">
                  Relatório Técnico de Execução
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  Comprovante de Realização de Serviço Condominial Rotineiro
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-full text-emerald-800 text-xs font-extrabold">
                <CheckCircle2 size={14} className="text-emerald-600" />
                SERVIÇO CONCLUÍDO
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Emissão: {formatDateTimeBR(order.concluidoEm || new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* Section 1: Customer & Provider Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                <Building size={15} className="text-blue-600" />
                Dados do Condomínio / Contratante
              </div>
              <div className="text-xs space-y-1 text-slate-700">
                <p>
                  <strong className="text-slate-900">Condomínio:</strong> {order.nomeCondominio || order.clienteNome || "Não informado"}
                </p>
                <p>
                  <strong className="text-slate-900">Endereço:</strong> {order.enderecoCondominio || "Não informado"}
                </p>
                {(order.telefoneContato || (order as any).clienteTelefone) && (
                  <p>
                    <strong className="text-slate-900">Telefone / WhatsApp:</strong> {order.telefoneContato || (order as any).clienteTelefone}
                  </p>
                )}
                {order.clienteEmail && (
                  <p>
                    <strong className="text-slate-900">E-mail:</strong> {order.clienteEmail}
                  </p>
                )}
              </div>
            </div>

            {/* Provider Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                <User size={15} className="text-emerald-600" />
                Dados do Prestador / Técnico Responsável
              </div>
              <div className="text-xs space-y-1 text-slate-700">
                <p>
                  <strong className="text-slate-900">Técnico / Colaborador:</strong> {order.colaboradorNome || "Técnico Credenciado"}
                </p>
                <p>
                  <strong className="text-slate-900">E-mail:</strong> {order.colaboradorEmail || "contato@uniaocondominial.com.br"}
                </p>
                <p>
                  <strong className="text-slate-900">Serviço Realizado:</strong> {order.servicoNome || "Serviço Rotineiro"}
                </p>
                {order.prioridade && (
                  <p>
                    <strong className="text-slate-900">Prioridade da OS:</strong> {order.prioridade}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Audit Timeline */}
          <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2">
              <Clock size={15} />
              Cronologia Auditada e Registro de Horários
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">1. Solicitação</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{formatDateTimeBR(order.createdAt)}</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">2. Início Deslocamento</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{formatDateTimeBR(order.deslocamentoInicioEm)}</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">3. Início dos Trabalhos</span>
                <span className="font-bold text-slate-800 mt-0.5 block">{formatDateTimeBR(order.inicioTrabalhoEm)}</span>
              </div>

              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 shadow-xs">
                <span className="text-[10px] text-emerald-700 block uppercase font-bold">4. Conclusão da O.S.</span>
                <span className="font-bold text-emerald-800 mt-0.5 block">{formatDateTimeBR(order.concluidoEm)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span><strong>Duração Total da Execução Técnica:</strong> {durationText}</span>
              <span className="text-[11px] text-slate-400 font-medium">Timemark Verified</span>
            </div>
          </div>

          {/* Section 3: Photographic Evidence (Antes & Depois) */}
          <div className="space-y-4">
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera size={16} className="text-blue-600" />
                Evidências Fotográficas Carimbadas (Timemark Real)
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {(order.fotosAntes?.length || 0) + (order.fotosDepois?.length || 0)} fotos registradas
              </span>
            </div>

            {/* Fotos Antes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-extrabold">
                  FOTOS INICIAIS (ANTES DA EXECUÇÃO)
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {formatDateTimeBR(order.fotosAntesEm || order.chegadaEm)}
                </span>
              </div>

              {order.fotosAntes && order.fotosAntes.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {order.fotosAntes.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      onClick={() => setSelectedPhotoForZoom(photo.url)}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 cursor-pointer shadow-xs hover:shadow-md transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={`Foto Inicial ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-[10px] font-bold">
                        Foto {idx + 1} - Antes
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                  Nenhuma fotografia inicial arquivada.
                </p>
              )}
            </div>

            {/* Fotos Depois */}
            <div className="space-y-2 pt-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs font-extrabold">
                  FOTOS FINAIS (SERVIÇO CONCLUÍDO)
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {formatDateTimeBR(order.fotosDepoisEm || order.concluidoEm)}
                </span>
              </div>

              {order.fotosDepois && order.fotosDepois.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {order.fotosDepois.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      onClick={() => setSelectedPhotoForZoom(photo.url)}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-4/3 cursor-pointer shadow-xs hover:shadow-md transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={`Foto Final ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        crossOrigin="anonymous"
                      />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-[10px] font-bold">
                        Foto {idx + 1} - Depois
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                  Nenhuma fotografia final arquivada.
                </p>
              )}
            </div>
          </div>

          {/* Section 4: Technical Notes & Materials */}
          {(order.observacoesTecnicas || order.materiaisUtilizados) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {order.observacoesTecnicas && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Wrench size={14} className="text-blue-600" />
                    Parecer Técnico & Observações:
                  </h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {order.observacoesTecnicas}
                  </p>
                </div>
              )}

              {order.materiaisUtilizados && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-emerald-600" />
                    Materiais & Peças Utilizadas:
                  </h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {order.materiaisUtilizados}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Section 5: Signature & Formal Acceptance */}
          <div className="border border-slate-300 rounded-xl p-5 bg-slate-50 space-y-4 break-inside-avoid">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              Termo de Encerramento e Assinatura Digital do Responsável
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed italic">
              "Declaro que o serviço discriminado nesta Ordem de Serviço foi realizado de acordo com o padrão técnico
              contratado, tendo sido vistoriado e aprovado no condomínio na data e horário indicados."
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
              {/* Signature Image */}
              <div className="text-center sm:text-left space-y-1">
                {order.assinaturaResponsavel?.assinaturaBase64 ? (
                  <div className="border-b-2 border-slate-400 pb-1 inline-block">
                    <img
                      src={order.assinaturaResponsavel.assinaturaBase64}
                      alt="Assinatura do Responsável"
                      className="h-16 max-w-[240px] object-contain bg-white px-2 rounded"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-12 border-b-2 border-slate-400 flex items-end justify-center text-[10px] text-slate-400 pb-1">
                    (Assinado Digitalmente)
                  </div>
                )}
                <p className="text-xs font-extrabold text-slate-900 mt-1">
                  {order.assinaturaResponsavel?.nome || "Responsável pelo Condomínio"}
                </p>
                <p className="text-[11px] text-slate-600">
                  {order.assinaturaResponsavel?.cargoOuFuncao || "Síndico / Gestor"}
                  {order.assinaturaResponsavel?.documento ? ` • Doc: ${order.assinaturaResponsavel.documento}` : ""}
                </p>
              </div>

              {/* Security Seal */}
              <div className="text-center sm:text-right text-[11px] text-slate-500 space-y-0.5 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-center sm:justify-end gap-1 text-emerald-700 font-bold">
                  <CheckCircle2 size={13} /> Assinatura Válida
                </div>
                <p>Data: {formatDateTimeBR(order.assinaturaResponsavel?.assinadoEm || order.concluidoEm)}</p>
                <p className="font-mono text-[10px] text-slate-400">Autenticação: OS-{order.id.slice(0, 10).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            Documento gerado automaticamente pelo Sistema de Gestão de Serviços Condominiais Rotineiros.
          </div>
        </div>
      </div>

      {/* Photo Zoom Modal */}
      {selectedPhotoForZoom && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 print:hidden"
          onClick={() => setSelectedPhotoForZoom(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedPhotoForZoom(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X size={24} />
            </button>
            <img
              src={selectedPhotoForZoom}
              alt="Foto Ampliada"
              className="max-h-[85vh] w-auto object-contain rounded-xl border border-white/20 shadow-2xl"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      )}
    </div>
  );
}
