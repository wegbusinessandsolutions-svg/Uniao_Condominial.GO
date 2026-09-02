/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  PenTool,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  FileCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Keyboard,
} from "lucide-react";
import { ServiceSignature } from "../../types/serviceExecution";

export interface SignatureCanvasFieldProps {
  initialNome?: string;
  initialCargo?: ServiceSignature["cargoOuFuncao"];
  initialDocumento?: string;
  initialTelefone?: string;
  initialEmail?: string;
  condominioNome?: string;
  servicoNome?: string;
  numeroOS?: string;
  isSubmitting?: boolean;
  onConfirmSignature: (signature: ServiceSignature) => Promise<void> | void;
  onCancel?: () => void;
  inline?: boolean;
}

export default function SignatureCanvasField({
  initialNome = "",
  initialCargo = "Síndico(a)",
  initialDocumento = "",
  initialTelefone = "",
  initialEmail = "",
  condominioNome = "Condomínio",
  servicoNome = "Serviço Condominial",
  numeroOS = "OS-000",
  isSubmitting = false,
  onConfirmSignature,
  onCancel,
  inline = false,
}: SignatureCanvasFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const [nome, setNome] = useState(initialNome);
  const [cargoOuFuncao, setCargoOuFuncao] = useState<ServiceSignature["cargoOuFuncao"]>(initialCargo);
  const [cargoPersonalizado, setCargoPersonalizado] = useState("");
  const [documento, setDocumento] = useState(initialDocumento);
  const [telefone, setTelefone] = useState(initialTelefone);
  const [email, setEmail] = useState(initialEmail);
  const [termoAceito, setTermoAceito] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [inkColor, setInkColor] = useState<"#0f172a" | "#1d4ed8" | "#047857">("#0f172a");

  // Redraw / resize canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = container.clientWidth || 400;
    const height = 180;

    const dpr = window.devicePixelRatio || 2;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    setHasDrawn(false);
  }, [inkColor]);

  useEffect(() => {
    initCanvas();
    const handleResize = () => {
      // Re-init canvas on container resize
      initCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
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
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const dismissKeyboard = () => {
    if (typeof document !== "undefined") {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && typeof activeEl.blur === "function") {
        activeEl.blur();
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    dismissKeyboard();
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasDrawn(true);
    setErrorMessage("");
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
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

  const handleSubmit = async () => {
    dismissKeyboard();
    if (!nome.trim()) {
      setErrorMessage("Por favor, preencha o nome do responsável pelo acompanhamento.");
      return;
    }
    if (!documento.trim()) {
      setErrorMessage("Por favor, informe o CPF ou RG do responsável.");
      return;
    }
    if (!hasDrawn || !canvasRef.current) {
      setErrorMessage("Por favor, colete a assinatura digital do responsável no quadro abaixo.");
      return;
    }
    if (!termoAceito) {
      setTermoAceito(true);
    }

    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas.toDataURL("image/png");

    const signatureData: ServiceSignature = {
      nome: nome.trim(),
      cargoOuFuncao,
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
    <div className={`space-y-6 ${inline ? "text-slate-100" : "text-slate-800"}`}>
      {/* Banner Informativo */}
      <div
        className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
          inline
            ? "bg-indigo-950/60 border-indigo-500/40 text-indigo-200"
            : "bg-indigo-50 border-indigo-200 text-indigo-900"
        }`}
      >
        <ShieldCheck size={20} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-sm font-bold mb-0.5">
            Validação de Encerramento e Entrega Técnica
          </strong>
          O responsável pelo condomínio ({condominioNome}) deve conferir os dados e assinar digitalmente
          abaixo para atestar a entrega do serviço <strong>{servicoNome}</strong> ({numeroOS}).
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2 animate-shake">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Dados do Signatário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={`block text-xs font-bold mb-1.5 ${inline ? "text-slate-300" : "text-slate-700"}`}>
            Nome Completo do Responsável *
          </label>
          <div className="relative">
            <UserCheck
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Alberto da Silva"
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-slate-700">
            Função / Vínculo no Condomínio *
          </label>
          <select
            value={cargoOuFuncao}
            onChange={(e) => setCargoOuFuncao(e.target.value as any)}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
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
            <label className="block text-xs font-bold mb-1.5 text-slate-700">
              Especifique o Cargo / Vínculo *
            </label>
            <input
              type="text"
              value={cargoPersonalizado}
              onChange={(e) => setCargoPersonalizado(e.target.value)}
              placeholder="Ex: Supervisor Operacional / Engenheiro Civil"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold mb-1.5 text-slate-700">
            Documento de Identificação (CPF ou RG) *
          </label>
          <div className="relative">
            <FileCheck
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="000.000.000-00 ou RG"
              className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1.5 text-slate-700">
            Telefone / WhatsApp (Opcional)
          </label>
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(00) 00000-0000"
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* ÁREA DO CANVAS DA ASSINATURA */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold flex items-center gap-1.5 text-slate-800">
              <PenTool size={15} className="text-indigo-600" />
              Campo de Assinatura Digital no Touch / Caneta *
            </label>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
              Touch Screen
            </span>
          </div>

          {/* Atalho para Ocultar Teclado Virtual no Celular/Tablet */}
          <button
            type="button"
            onClick={dismissKeyboard}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer"
            title="Ocultar teclado virtual para assinar com conforto"
          >
            <Keyboard size={14} className="text-slate-500" />
            <span>Ocultar teclado</span>
          </button>
        </div>

        {/* Quadro do Canvas com touch-action: none e auto-dismiss do teclado ao tocar */}
        <div
          ref={containerRef}
          onPointerDown={dismissKeyboard}
          onTouchStart={dismissKeyboard}
          className="relative rounded-2xl overflow-hidden border-2 border-dashed border-indigo-300 bg-white shadow-inner select-none"
          style={{ touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-[180px] cursor-crosshair block bg-white"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-2">
                <PenTool size={20} className="animate-pulse" />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Assine aqui com o dedo ou caneta stylus
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                Espaço reservado para rubrica digital do responsável
              </span>
              <div className="w-64 max-w-full h-0.5 bg-slate-200 mt-4 border-b border-dashed border-slate-300" />
            </div>
          )}
        </div>

        {/* Barra de Controles Imediatos: Concluído e Limpar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Seletor de cores da tinta */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setInkColor("#0f172a")}
              title="Tinta Preta"
              className={`w-4 h-4 rounded-full bg-slate-900 border ${
                inkColor === "#0f172a" ? "ring-2 ring-indigo-500 scale-110" : "opacity-60"
              }`}
            />
            <button
              type="button"
              onClick={() => setInkColor("#1d4ed8")}
              title="Tinta Azul"
              className={`w-4 h-4 rounded-full bg-blue-600 border ${
                inkColor === "#1d4ed8" ? "ring-2 ring-indigo-500 scale-110" : "opacity-60"
              }`}
            />
            <button
              type="button"
              onClick={() => setInkColor("#047857")}
              title="Tinta Verde"
              className={`w-4 h-4 rounded-full bg-emerald-600 border ${
                inkColor === "#047857" ? "ring-2 ring-indigo-500 scale-110" : "opacity-60"
              }`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw size={14} />
              <span>Limpar</span>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !hasDrawn}
              className="text-xs font-bold text-white flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Concluído</span>
            </button>
          </div>
        </div>
      </div>

      {/* Termo de Ciência e Aceite Legal */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 flex items-start gap-3">
        <input
          type="checkbox"
          id="termoCienciaCheck"
          checked={termoAceito}
          onChange={(e) => setTermoAceito(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="termoCienciaCheck" className="text-xs leading-relaxed cursor-pointer select-none">
          <strong className="text-slate-900">
            Termo de Encerramento e Ciência:
          </strong>{" "}
          Declaro para os devidos fins legais que acompanhei a execução do serviço rotineiro prestado pela União Condominial
          nesta data, atestando a conclusão satisfatória dos trabalhos e a veracidade das informações registradas.
        </label>
      </div>

      {/* Botões de Ação */}
      <div className="pt-3 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-3 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all"
          >
            Voltar
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Gravando Assinatura e Concluindo O.S....</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} />
              <span>Confirmar Assinatura & Concluir Ordem de Serviço</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
