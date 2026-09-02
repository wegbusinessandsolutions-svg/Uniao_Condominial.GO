/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Clock,
  CalendarCheck,
  Calendar,
  Navigation,
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  History,
} from "lucide-react";
import {
  STANDARD_OS_STEPS,
  getEffectiveOSStatus,
  normalizeOSStatus,
  buildInitialStatusHistoryFromLegacy,
  ServiceStatusEvent,
} from "../../lib/serviceStatusWorkflow";
import { formatDateTimeBR } from "../../lib/dateUtils";

interface ServiceTrackingTimelineProps {
  order: any;
  compact?: boolean;
  showAllLogsInitially?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export default function ServiceTrackingTimeline({
  order,
  compact = false,
  showAllLogsInitially = false,
  defaultExpanded = false,
  className = "",
}: ServiceTrackingTimelineProps) {
  const [showHistoryLogs, setShowHistoryLogs] = useState(defaultExpanded || showAllLogsInitially);

  if (!order) return null;

  const currentStatus = getEffectiveOSStatus(order);
  const isCancelled = currentStatus === "Cancelada pelo Cliente" || currentStatus === "Cancelado";

  // Build full history list (using historicoStatus or fallback to legacy fields)
  const historyLogs: ServiceStatusEvent[] = Array.isArray(order.historicoStatus) && order.historicoStatus.length > 0
    ? order.historicoStatus
    : buildInitialStatusHistoryFromLegacy(order);

  // Map each standard step to find if there is a matching log entry
  const stepIcons = [
    <Clock size={16} key="1" />,
    <CalendarCheck size={16} key="2" />,
    <Calendar size={16} key="3" />,
    <Navigation size={16} key="4" />,
    <Wrench size={16} key="5" />,
    <CheckCircle2 size={16} key="6" />,
  ];

  // Helper to determine step status
  const getStepState = (stepIndex: number, stepKey: string) => {
    if (isCancelled) {
      return { isCompleted: false, isCurrent: false, isPending: true };
    }

    const statusOrder = [
      "Confirmação de Data",
      "Data confirmada",
      "Dia de Execução Serviço",
      "Técnico a caminho",
      "Em execução",
      "Serviço Concluído",
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1) {
      return { isCompleted: stepIndex === 0, isCurrent: stepIndex === 0, isPending: stepIndex > 0 };
    }

    const isCompleted = stepIndex < currentIndex || currentStatus === "Serviço Concluído";
    const isCurrent = stepIndex === currentIndex && currentStatus !== "Serviço Concluído";
    const isPending = stepIndex > currentIndex;

    return { isCompleted, isCurrent, isPending };
  };

  // Find most recent log entry matching step
  const getStepLog = (stepKey: string) => {
    const normKey = normalizeOSStatus(stepKey);
    // Find latest matching log entry
    for (let i = historyLogs.length - 1; i >= 0; i--) {
      if (normalizeOSStatus(historyLogs[i].status) === normKey) {
        return historyLogs[i];
      }
    }
    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Title and Current Status */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <History size={14} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Linha de Acompanhamento do Serviço
          </span>
        </div>

        {order.statusAtualizadoEm && (
          <span className="text-[11px] text-slate-500 font-medium">
            Última atualização: {formatDateTimeBR(order.statusAtualizadoEm)}
          </span>
        )}
      </div>

      {/* If Cancelled notice */}
      {isCancelled && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
          <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Ordem de Serviço Cancelada</span>
            <p className="text-rose-700">{order.motivoCancelamento || "Cancelamento registrado no sistema."}</p>
            {order.canceladoEm && (
              <span className="text-[10px] text-rose-600 block">
                Data e horário do cancelamento: {formatDateTimeBR(order.canceladoEm)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Linear Stepper Cards / Progression */}
      {!isCancelled && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full min-w-0">
          {STANDARD_OS_STEPS.map((step, idx) => {
            const { isCompleted, isCurrent, isPending } = getStepState(idx, step.key);
            const stepLog = getStepLog(step.key);

            return (
              <div
                key={step.key}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex flex-col justify-between min-w-0 overflow-hidden ${
                  isCompleted
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : isCurrent
                    ? "bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/30 text-blue-950 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <div className="min-w-0">
                  {/* Step Header with Icon and Number */}
                  <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-blue-600 text-white animate-pulse"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </span>

                    <span
                      className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md truncate ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : isCurrent
                          ? "bg-blue-100 text-blue-800"
                          : "text-slate-400"
                      }`}
                    >
                      {isCompleted ? "Concluído" : isCurrent ? "Em Andamento" : "Aguardando"}
                    </span>
                  </div>

                  {/* Title */}
                  <h4
                    className={`text-xs font-bold leading-tight break-words ${
                      isCompleted ? "text-emerald-950" : isCurrent ? "text-blue-950" : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </h4>
                </div>

                {/* Recorded Timestamp */}
                <div className="pt-2 mt-2 border-t border-slate-200/60 text-[10px] min-w-0">
                  {stepLog ? (
                    <span className="font-semibold block text-slate-700 truncate">
                      {formatDateTimeBR(stepLog.dataHora)}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic block truncate">Pendente</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Chronological Audit Trail (Acrescentada na Linha de Acompanhamento) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowHistoryLogs(!showHistoryLogs)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors"
          >
            <History size={14} className="text-blue-600" />
            <span>Histórico Detalhado de Registros ({historyLogs.length} eventos)</span>
            {showHistoryLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <span className="text-[11px] text-slate-400">Registrado com data e horário oficial</span>
        </div>

        {showHistoryLogs && (
          <div className="pt-2 border-t border-slate-100 divide-y divide-slate-100">
            {historyLogs.map((log, lIdx) => (
              <div key={lIdx} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">{log.status}</span>
                      {log.autor && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <User size={10} /> {log.autor}
                        </span>
                      )}
                    </div>
                    {log.descricao && (
                      <p className="text-slate-600 text-xs mt-0.5">{log.descricao}</p>
                    )}
                  </div>
                </div>

                <div className="sm:text-right shrink-0 pl-4 sm:pl-0">
                  <span className="font-mono font-semibold text-slate-700 text-[11px] bg-slate-50 border border-slate-200 px-2 py-1 rounded-md">
                    {formatDateTimeBR(log.dataHora)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { ServiceTrackingTimeline };
