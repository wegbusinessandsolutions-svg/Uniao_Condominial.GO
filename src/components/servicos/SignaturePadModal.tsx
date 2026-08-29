/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from "react";
import { X, CheckCircle2, RotateCcw, PenTool, ShieldCheck, UserCheck, Phone, Mail, FileCheck } from "lucide-react";
import { ServiceSignature } from "../../types/serviceExecution";

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSignature: (signature: ServiceSignature) => Promise<void> | void;
  condominioNome?: string;
  servicoNome?: string;
  numeroOS?: string;
  isSubmitting?: boolean;
}

export default function SignaturePadModal({
  isOpen,
  onClose,
  onConfirmSignature,
  condominioNome = "Condomínio",
  servicoNome = "Serviço Condominial",
  numeroOS = "OS-000",
  isSubmitting = false,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [nome, setNome] = useState("");
  const [cargoOuFuncao, setCargoOuFuncao] = useState<ServiceSignature["cargoOuFuncao"]>("Síndico(a)");
  const [cargoPersonalizado, setCargoPersonalizado] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [termoAceito, setTermoAceito] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Setup canvas
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Adjust canvas resolution for retina displays
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);

      // Canvas background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Line style
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      setHasDrawn(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
    setErrorMessage("");
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    setErrorMessage("");
  };

  const handleConfirm = async () => {
    if (!nome.trim()) {
      setErrorMessage("Por favor, informe o nome do responsável que está acompanhando.");
      return;
    }
    if (!documento.trim()) {
      setErrorMessage("Por favor, informe o CPF ou RG do responsável.");
      return;
    }
    if (!hasDrawn || !canvasRef.current) {
      setErrorMessage("Por favor, colete a assinatura digital na área demarcada.");
      return;
    }
    if (!termoAceito) {
      setErrorMessage("É obrigatório dar ciência no termo de conclusão do serviço.");
      return;
    }

    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas.toDataURL("image/png");

    const signatureData: ServiceSignature = {
      nome: nome.trim(),
      cargoOuFuncao: cargoOuFuncao,
      cargoPersonalizado: cargoOuFuncao === "Outro" ? cargoPersonalizado.trim() : undefined,
      documento: documento.trim(),
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      assinaturaBase64,
      assinadoEm: new Date().toISOString(),
      termoCienciaAceito: true,
    };

    await onConfirmSignature(signatureData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
              <PenTool size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Assinatura do Responsável</h2>
              <p className="text-xs text-slate-300">
                {condominioNome} • {numeroOS}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
            <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <p>
              Ao concluir a execução do serviço <strong>{servicoNome}</strong>, colete os dados e a assinatura do
              síndico, zelador ou responsável pelo acompanhamento no condomínio para validar o encerramento da O.S.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl animate-shake">
              {errorMessage}
            </div>
          )}

          {/* Dados do Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Completo do Responsável *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Carlos Alberto da Silva"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Função / Cargo no Condomínio *
              </label>
              <select
                value={cargoOuFuncao}
                onChange={(e) => setCargoOuFuncao(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="Síndico(a)">Síndico(a)</option>
                <option value="Subsíndico(a)">Subsíndico(a)</option>
                <option value="Zelador(a)">Zelador(a)</option>
                <option value="Gerente Predial">Gerente Predial</option>
                <option value="Membro do Conselho">Membro do Conselho</option>
                <option value="Morador Autorizado">Morador Autorizado</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {cargoOuFuncao === "Outro" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Especifique a Função *
                </label>
                <input
                  type="text"
                  value={cargoPersonalizado}
                  onChange={(e) => setCargoPersonalizado(e.target.value)}
                  placeholder="Ex: Porteiro Líder / Engenheiro Fiscal"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Documento (CPF ou RG) *
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Telefone / WhatsApp (Opcional)
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Canvas da Assinatura Digital */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <PenTool size={14} className="text-blue-600" />
                Assinatura Digital no Touch / Mouse *
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-rose-50 transition-colors"
              >
                <RotateCcw size={12} /> Limpar Traço
              </button>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl overflow-hidden bg-white shadow-inner touch-none">
              <canvas
                ref={canvasRef}
                className="w-full h-44 cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
                  <PenTool size={24} className="mb-1 opacity-50" />
                  <span className="text-xs font-medium">Assine com o dedo na tela ou com o mouse</span>
                  <div className="w-48 h-0.5 bg-slate-200 mt-6 border-b border-dashed border-slate-300" />
                </div>
              )}
            </div>
          </div>

          {/* Termo de Ciência e Aceite */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
            <input
              type="checkbox"
              id="termoCiencia"
              checked={termoAceito}
              onChange={(e) => setTermoAceito(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="termoCiencia" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
              <strong>Termo de Encerramento e Ciência:</strong> Declaro para os devidos fins que o serviço rotineiro
              contratado foi executado no condomínio nesta data e hora, tendo sido acompanhado e vistoriado
              satisfatoriamente.
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md flex items-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Gravando Assinatura...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Confirmar Assinatura & Concluir O.S.
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
