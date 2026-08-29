/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  PenTool,
  ArrowRight,
  Phone,
  Navigation,
  Sparkles,
  AlertTriangle,
  Building,
  User,
  Calendar,
  Check,
  ChevronRight,
  ShieldCheck,
  Play,
  RotateCw,
  FolderCheck,
  Layers,
  FileText,
  Wifi,
  WifiOff,
  HardDrive,
  RefreshCw,
  CloudUpload
} from "lucide-react";
import PhotoUploadStep from "../../components/servicos/PhotoUploadStep";
import SignaturePadModal from "../../components/servicos/SignaturePadModal";
import { RoutineServiceOrder, ServicePhoto, ServiceSignature } from "../../types/serviceExecution";
import { computeOrderInternalMetrics, formatDateTimeBR, getExecutionStepInfo } from "../../lib/serviceExecutionUtils";
import {
  cacheOrderInIndexedDB,
  getCachedOrdersFromIndexedDB,
  syncPendingServicePhotos,
  getAllPendingPhotosFromIndexedDB
} from "../../lib/servicePhotoOfflineStorage";
import { logAction } from "../../lib/audit";
import { Link } from "react-router-dom";

export default function ExecucaoServicos() {
  const { profile } = useAuth();

  const [ordens, setOrdens] = useState<RoutineServiceOrder[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeOrder, setActiveOrder] = useState<RoutineServiceOrder | null>(null);

  // Offline & Synchronization States
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingPhotosCount, setPendingPhotosCount] = useState<number>(0);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Modals & UI States
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [nextOrderSuggested, setNextOrderSuggested] = useState<RoutineServiceOrder | null>(null);
  const [showCompletedSuccessModal, setShowCompletedSuccessModal] = useState<boolean>(false);

  // Temporary local state while editing an order step
  const [localFotosAntes, setLocalFotosAntes] = useState<ServicePhoto[]>([]);
  const [localFotosDepois, setLocalFotosDepois] = useState<ServicePhoto[]>([]);
  const [observacoesTecnicas, setObservacoesTecnicas] = useState<string>("");
  const [materiaisUtilizados, setMateriaisUtilizados] = useState<string>("");

  // Check pending photos in IndexedDB
  const checkPendingCount = useCallback(async () => {
    try {
      const list = await getAllPendingPhotosFromIndexedDB();
      setPendingPhotosCount(list.length);
    } catch (e) {
      console.warn("Erro ao ler pendências IndexedDB:", e);
    }
  }, []);

  // Trigger sequential sync of all pending photos across all OS
  const handleSyncAllPending = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (isSyncingAll) return;

    setIsSyncingAll(true);
    setSyncStatusMsg("Sincronizando fotos pendentes em sequência...");
    try {
      const result = await syncPendingServicePhotos((curr, tot, msg) => {
        setSyncStatusMsg(`[${curr}/${tot}] ${msg}`);
      });
      if (result.total > 0) {
        setSyncStatusMsg(
          result.failed === 0
            ? `Sincronização sequencial concluída! ${result.success} foto(s) enviadas.`
            : `${result.success} enviada(s), ${result.failed} falha(s).`
        );
      }
      await checkPendingCount();
    } catch (err) {
      console.error("Erro na sincronização sequencial:", err);
      setSyncStatusMsg("Erro ao sincronizar. O sistema tentará novamente.");
    } finally {
      setIsSyncingAll(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  }, [isSyncingAll, checkPendingCount]);

  useEffect(() => {
    checkPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      handleSyncAllPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkPendingCount, handleSyncAllPending]);

  // Load colaboradores and routine service orders
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch colaboradores (empregados / prestadores)
      const empSnap = await getDocs(collection(db, "empregados"));
      const empList: any[] = [];
      empSnap.docs.forEach((d) => {
        const data = d.data();
        empList.push({ id: d.id, ...data });
      });

      // Also get users with staff roles if any
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.docs.forEach((d) => {
        const u = d.data();
        if (u.role && u.role !== "Cliente" && !empList.some((e) => e.email === u.email)) {
          empList.push({
            id: d.id,
            nome: u.displayName || u.nome || u.email,
            email: u.email,
            cargo: u.role,
            telefone: u.telefone || "",
          });
        }
      });

      setColaboradores(empList);

      // Auto-select logged-in user if they are a collaborator
      if (!selectedColaboradorId && profile?.email) {
        const found = empList.find((c) => c.email === profile.email || c.id === profile.uid);
        if (found) {
          setSelectedColaboradorId(found.id);
        } else if (empList.length > 0) {
          setSelectedColaboradorId(empList[0].id);
        }
      }

      // 2. Fetch service orders
      const q = query(collection(db, "ordens_servico"), orderBy("createdAt", "desc"));
      const osSnap = await getDocs(q);
      const osList: RoutineServiceOrder[] = osSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fotosAntes: Array.isArray(data.fotosAntes) ? data.fotosAntes : [],
          fotosDepois: Array.isArray(data.fotosDepois) ? data.fotosDepois : [],
          etapaExecucao: data.etapaExecucao || (data.status === "Serviço Concluído" ? "concluido" : "atribuido"),
        } as RoutineServiceOrder;
      });

      setOrdens(osList);

      // Cache all orders in IndexedDB for offline capability
      await Promise.all(osList.map((o) => cacheOrderInIndexedDB(o)));

      // If active order is currently open, refresh its data
      if (activeOrder) {
        const fresh = osList.find((o) => o.id === activeOrder.id);
        if (fresh) {
          setActiveOrder(fresh);
          setLocalFotosAntes(fresh.fotosAntes || []);
          setLocalFotosDepois(fresh.fotosDepois || []);
          setObservacoesTecnicas(fresh.observacoesTecnicas || "");
          setMateriaisUtilizados(fresh.materiaisUtilizados || "");
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar do Firestore, consultando cache IndexedDB:", err);
      try {
        const cached = await getCachedOrdersFromIndexedDB();
        if (cached.length > 0) {
          setOrdens(cached);
        }
      } catch (cacheErr) {
        console.error("Erro ao ler ordens do cache local:", cacheErr);
      }
    } finally {
      setLoading(false);
      checkPendingCount();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter orders assigned to the currently selected collaborator
  const colaboradorOrders = useMemo(() => {
    if (!selectedColaboradorId) return ordens;
    const currentEmp = colaboradores.find((c) => c.id === selectedColaboradorId);
    return ordens.filter(
      (o) =>
        o.colaboradorId === selectedColaboradorId ||
        (currentEmp?.email && o.colaboradorEmail === currentEmp.email) ||
        (!o.colaboradorId && o.status !== "Cancelada pelo Cliente" && o.status !== "Cancelado")
    );
  }, [ordens, selectedColaboradorId, colaboradores]);

  // Split into: Active/In Progress, Next Scheduled Queue, Completed
  const inProgressOrder = useMemo(() => {
    return (
      colaboradorOrders.find(
        (o) =>
          o.etapaExecucao &&
          !["concluido", "cancelado"].includes(o.etapaExecucao) &&
          o.status !== "Serviço Concluído" &&
          o.status !== "Cancelada pelo Cliente" &&
          o.status !== "Cancelado"
      ) || null
    );
  }, [colaboradorOrders]);

  const upcomingQueue = useMemo(() => {
    return colaboradorOrders.filter(
      (o) =>
        o.status !== "Serviço Concluído" &&
        o.status !== "Cancelada pelo Cliente" &&
        o.status !== "Cancelado" &&
        o.id !== inProgressOrder?.id &&
        o.etapaExecucao !== "concluido"
    );
  }, [colaboradorOrders, inProgressOrder]);

  const completedToday = useMemo(() => {
    return colaboradorOrders.filter(
      (o) => o.status === "Serviço Concluído" || o.etapaExecucao === "concluido"
    );
  }, [colaboradorOrders]);

  // Open a specific service order in the execution wizard
  const handleSelectOrderToExecute = (order: RoutineServiceOrder) => {
    // If another order is already in progress and user tries to open a different one, block it
    if (inProgressOrder && inProgressOrder.id !== order.id && order.etapaExecucao !== "concluido") {
      alert("Atenção: Você possui um serviço em andamento. Conclua o atendimento atual antes de iniciar o próximo.");
      setActiveOrder(inProgressOrder);
      return;
    }

    const nowIso = new Date().toISOString();
    // Silently mark received timestamp if not set
    const preparedOrder: RoutineServiceOrder = {
      ...order,
      recebidoEm: order.recebidoEm || order.designadoEm || nowIso,
    };

    setActiveOrder(preparedOrder);
    setLocalFotosAntes(order.fotosAntes || []);
    setLocalFotosDepois(order.fotosDepois || []);
    setObservacoesTecnicas(order.observacoesTecnicas || "");
    setMateriaisUtilizados(order.materiaisUtilizados || "");
    setShowCompletedSuccessModal(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Helper to persist order changes and log internal timestamps silently
  const updateOrderInDb = async (orderId: string, updates: Partial<RoutineServiceOrder>) => {
    setIsSubmitting(true);
    try {
      const currentOrder = ordens.find((o) => o.id === orderId) || activeOrder || {};
      const combined: RoutineServiceOrder = {
        ...(currentOrder as RoutineServiceOrder),
        ...updates,
        id: orderId,
        updatedAt: new Date().toISOString(),
      };

      // Compute internal monitoring SLA & duration metrics silently
      const metrics = computeOrderInternalMetrics(combined);
      combined.metricasInternas = metrics;

      // 1. Update React state immediately (optimistic UI)
      setActiveOrder(combined);
      setOrdens((prev) => prev.map((o) => (o.id === orderId ? combined : o)));

      // 2. Always persist into IndexedDB for offline resilience
      await cacheOrderInIndexedDB(combined);

      // 3. If online, update Firestore
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const docRef = doc(db, "ordens_servico", orderId);
          const finalPayload = {
            ...updates,
            metricasInternas: metrics,
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(docRef, finalPayload);

          // Audit log
          await logAction(
            `Execução de Serviço OS #${orderId.slice(0, 6)}: etapa ${updates.etapaExecucao || updates.status}`,
            "Comercial",
            { orderId, updates }
          );
        } catch (dbErr) {
          console.warn("Firestore update offline/failed, kept in IndexedDB:", dbErr);
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar ordem de serviço:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Marco: Recebimento -> 2. Marco: Aceite do Serviço e Início do Deslocamento
  const handleAceitarServico = async () => {
    if (!activeOrder) return;
    const nowIso = new Date().toISOString();
    const currentEmp = colaboradores.find((c) => c.id === selectedColaboradorId);

    const updates: Partial<RoutineServiceOrder> = {
      colaboradorId: selectedColaboradorId,
      colaboradorNome: currentEmp?.nome || activeOrder.colaboradorNome || profile?.displayName || "Técnico",
      colaboradorEmail: currentEmp?.email || activeOrder.colaboradorEmail || profile?.email || "",
      recebidoEm: activeOrder.recebidoEm || activeOrder.designadoEm || nowIso,
      aceitoEm: activeOrder.aceitoEm || nowIso,
      deslocamentoInicioEm: nowIso,
      etapaExecucao: "deslocamento",
      status: "Em Deslocamento",
    };

    await updateOrderInDb(activeOrder.id, updates);
  };

  // 2. Marco: Deslocamento -> 3. Marco: Chegada no Condomínio
  const handleChegadaLocal = async () => {
    if (!activeOrder) return;
    const nowIso = new Date().toISOString();

    let localizacao: any = undefined;
    if ("geolocation" in navigator) {
      try {
        const pos: any = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, enableHighAccuracy: true })
        );
        localizacao = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisaoMetros: pos.coords.accuracy,
        };
      } catch (geoErr) {
        console.log("Geolocalização não disponível ou negada:", geoErr);
      }
    }

    const updates: Partial<RoutineServiceOrder> = {
      chegadaEm: nowIso,
      chegadaLocalizacao: localizacao,
      etapaExecucao: "fotos_antes",
      status: "No Condomínio - Vistoria Inicial",
    };

    await updateOrderInDb(activeOrder.id, updates);
  };

  // 3. Marco: Fotos Antes -> 4. Marco: Início do Trabalho Técnico
  const handleConfirmarFotosAntes = async () => {
    if (!activeOrder) return;
    if (localFotosAntes.length < 3) {
      alert("É obrigatório tirar no mínimo 3 fotografias nítidas do local antes de iniciar o trabalho.");
      return;
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<RoutineServiceOrder> = {
      fotosAntes: localFotosAntes,
      fotosAntesEm: nowIso,
      inicioTrabalhoEm: activeOrder.inicioTrabalhoEm || nowIso,
      etapaExecucao: "em_execucao",
      status: "Em Execução",
    };

    await updateOrderInDb(activeOrder.id, updates);
  };

  // 4. Marco: Concluir Trabalho Físico e Ir para Fotos Finais
  const handleFinalizarTrabalhoFisico = async () => {
    if (!activeOrder) return;

    const updates: Partial<RoutineServiceOrder> = {
      observacoesTecnicas: observacoesTecnicas.trim(),
      materiaisUtilizados: materiaisUtilizados.trim(),
      etapaExecucao: "fotos_depois",
      status: "Trabalho Concluído - Vistoria Final",
    };

    await updateOrderInDb(activeOrder.id, updates);
  };

  // 4. Marco: Fotos Finais -> Coletar Assinatura Digital
  const handleConfirmarFotosDepois = async () => {
    if (!activeOrder) return;
    if (localFotosDepois.length < 3) {
      alert("É obrigatório tirar no mínimo 3 fotografias comprovando o serviço finalizado antes da assinatura.");
      return;
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<RoutineServiceOrder> = {
      fotosDepois: localFotosDepois,
      fotosDepoisEm: nowIso,
      etapaExecucao: "aguardando_assinatura",
      status: "Aguardando Assinatura",
    };

    await updateOrderInDb(activeOrder.id, updates);
    setIsSignatureModalOpen(true);
  };

  // 5. Marco: Assinatura Digital & Conclusão Definitiva da O.S.
  const handleSalvarAssinatura = async (signature: ServiceSignature) => {
    if (!activeOrder) return;
    const nowIso = new Date().toISOString();

    const updates: Partial<RoutineServiceOrder> = {
      assinaturaResponsavel: signature,
      assinaturaEm: nowIso,
      concluidoEm: nowIso,
      etapaExecucao: "concluido",
      status: "Serviço Concluído",
    };

    await updateOrderInDb(activeOrder.id, updates);
    setIsSignatureModalOpen(false);

    // Identify next scheduled service for this collaborator ONLY AFTER completing this one
    const remaining = colaboradorOrders.filter(
      (o) =>
        o.id !== activeOrder.id &&
        o.status !== "Serviço Concluído" &&
        o.status !== "Cancelada pelo Cliente" &&
        o.status !== "Cancelado" &&
        o.etapaExecucao !== "concluido"
    );

    if (remaining.length > 0) {
      setNextOrderSuggested(remaining[0]);
    } else {
      setNextOrderSuggested(null);
    }

    setShowCompletedSuccessModal(true);
  };

  // Start Next Suggested Service Order (Unlocks the next one)
  const handleStartNextOrder = (nextOrder: RoutineServiceOrder) => {
    setShowCompletedSuccessModal(false);
    handleSelectOrderToExecute(nextOrder);
  };

  const selectedColaborador = colaboradores.find((c) => c.id === selectedColaboradorId);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Colaborador Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Wrench size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard de Execução de Serviços
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Painel do colaborador em campo para realização e encerramento de serviços condominiais rotineiros.
              </p>
            </div>
          </div>
        </div>

        {/* Colaborador Selector & Network Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Offline/Online Status Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${
              !isOnline
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : pendingPhotosCount > 0
                ? "bg-blue-50 text-blue-900 border-blue-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-300"
            }`}
          >
            {!isOnline ? (
              <>
                <WifiOff size={15} className="text-amber-700" />
                <span>Modo Offline (Cache Ativo)</span>
              </>
            ) : (
              <>
                <Wifi size={15} className="text-emerald-700" />
                <span>Online {pendingPhotosCount > 0 ? `(${pendingPhotosCount} foto(s) pendentes)` : ""}</span>
              </>
            )}

            {isOnline && pendingPhotosCount > 0 && (
              <button
                type="button"
                onClick={handleSyncAllPending}
                disabled={isSyncingAll}
                className="ml-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded flex items-center gap-1 shadow-xs"
              >
                <RefreshCw size={10} className={isSyncingAll ? "animate-spin" : ""} />
                Sincronizar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <User size={18} className="text-slate-500 shrink-0 ml-1" />
            <div className="text-left">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Colaborador Responsável
              </label>
              <select
                value={selectedColaboradorId}
                onChange={(e) => {
                  setSelectedColaboradorId(e.target.value);
                  setActiveOrder(null);
                }}
                className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer pr-4"
              >
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome || c.email} ({c.cargo || "Técnico"})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Global Sync Status Banner if active */}
      {syncStatusMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium flex items-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Main Execution Wizard Area (If an Order is Active) */}
      {activeOrder ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Active Order Header Banner */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold">
                  {activeOrder.numeroOS || `OS #${activeOrder.id.slice(0, 8)}`}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    getExecutionStepInfo(activeOrder.etapaExecucao).badgeColor
                  }`}
                >
                  {getExecutionStepInfo(activeOrder.etapaExecucao).title}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Building size={20} className="text-blue-400" />
                {activeOrder.nomeCondominio || activeOrder.clienteNome || "Condomínio Solicitante"}
              </h2>
              <p className="text-xs text-slate-300 flex items-center gap-2">
                <Wrench size={14} className="text-slate-400" />
                <strong>Serviço:</strong> {activeOrder.servicoNome || "Serviço Rotineiro"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
              >
                Voltar à Fila de Serviços
              </button>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[620px] px-4 py-2">
              {[
                { id: "atribuido", label: "1. Aceite", icon: Clock },
                { id: "deslocamento", label: "2. Chegada", icon: Navigation },
                { id: "fotos_antes", label: "3. 3 Fotos Antes", icon: Camera },
                { id: "em_execucao", label: "4. Execução", icon: Wrench },
                { id: "fotos_depois", label: "5. 3 Fotos Depois", icon: Camera },
                { id: "aguardando_assinatura", label: "6. Assinatura", icon: PenTool },
                { id: "concluido", label: "7. Concluído", icon: CheckCircle2 },
              ].map((step, idx, arr) => {
                const currentStepNum = getExecutionStepInfo(activeOrder.etapaExecucao).stepNumber;
                const stepNum = idx + 1;
                const isPassed = currentStepNum > stepNum;
                const isCurrent = currentStepNum === stepNum;

                return (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isPassed
                            ? "bg-emerald-600 text-white shadow"
                            : isCurrent
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 shadow-md"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        {isPassed ? <Check size={16} /> : <step.icon size={16} />}
                      </div>
                      <span
                        className={`text-[11px] font-bold mt-1.5 whitespace-nowrap ${
                          isCurrent
                            ? "text-blue-700"
                            : isPassed
                            ? "text-emerald-700"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div
                        className={`flex-1 h-1 mx-2 rounded ${
                          isPassed ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Execution Step Body */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
            {/* ETAPA 1: RECEBIMENTO & ACEITE */}
            {activeOrder.etapaExecucao === "atribuido" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="text-blue-600" />
                    Etapa 1: Recebimento e Aceite da Ordem de Serviço
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Verifique os dados do condomínio e confirme o início do deslocamento.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Localização & Contato */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-600" /> Local de Atendimento
                    </h4>
                    <p className="text-sm font-bold text-slate-900">
                      {activeOrder.nomeCondominio || activeOrder.clienteNome}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activeOrder.enderecoCondominio || "Endereço cadastrado na O.S."},{" "}
                      {activeOrder.numeroCondominio || "S/N"} - {activeOrder.bairroCondominio || ""},{" "}
                      {activeOrder.cidadeCondominio || "RJ"}
                    </p>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${activeOrder.nomeCondominio || ""} ${activeOrder.enderecoCondominio || ""}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Navigation size={13} /> Abrir no Google Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?q=${encodeURIComponent(
                          `${activeOrder.nomeCondominio || ""} ${activeOrder.enderecoCondominio || ""}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <Navigation size={13} /> Abrir no Waze
                      </a>
                    </div>
                  </div>

                  {/* Escopo do Serviço */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench size={14} className="text-blue-600" /> Escopo do Serviço
                    </h4>
                    <p className="text-sm font-bold text-slate-900">
                      {activeOrder.servicoNome || "Serviço Condominial Rotineiro"}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {activeOrder.servicoDescricao ||
                        "Executar manutenção e vistoria técnica conforme protocolo operacional."}
                    </p>
                    {activeOrder.preRequisitos && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                        <strong>Pré-requisitos:</strong> {activeOrder.preRequisitos}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleAceitarServico}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Play size={18} /> Aceitar Serviço & Iniciar Deslocamento
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 2: EM DESLOCAMENTO -> CHEGADA NO CONDOMÍNIO */}
            {activeOrder.etapaExecucao === "deslocamento" && (
              <div className="space-y-6 text-center py-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-blue-50/50 animate-pulse">
                  <Navigation size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Você está a caminho do condomínio</h3>
                  <p className="text-xs text-slate-500">
                    Deslocamento iniciado às {formatDateTimeBR(activeOrder.deslocamentoInicioEm)}. Ao chegar na
                    portaria do <strong>{activeOrder.nomeCondominio}</strong>, clique no botão abaixo para
                    confirmar sua chegada e iniciar a vistoria.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-md mx-auto text-left text-xs space-y-1">
                  <p className="text-slate-500">
                    <strong>Endereço de Destino:</strong>
                  </p>
                  <p className="text-slate-800 font-semibold">
                    {activeOrder.enderecoCondominio} {activeOrder.numeroCondominio} - {activeOrder.bairroCondominio}
                  </p>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleChegadaLocal}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-102"
                  >
                    <MapPin size={18} /> Cheguei no Condomínio Solicitante
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: VISTORIA INICIAL & 3 FOTOS ANTES (OBRIGATÓRIO) */}
            {activeOrder.etapaExecucao === "fotos_antes" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Camera className="text-amber-600" />
                    Etapa 3: Vistoria Inicial & 3 Fotos ANTES da Execução
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    É obrigatório registrar no mínimo 3 fotografias nítidas do estado inicial antes de começar o
                    trabalho.
                  </p>
                </div>

                <PhotoUploadStep
                  fase="antes"
                  orderId={activeOrder.id}
                  photos={localFotosAntes}
                  onChangePhotos={setLocalFotosAntes}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    {localFotosAntes.length >= 3 ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={16} /> 3 Fotos obrigatórias registradas. Você pode prosseguir.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold flex items-center gap-1.5">
                        <AlertTriangle size={16} /> Faltam {3 - localFotosAntes.length} fotos antes de liberar o início
                        do trabalho.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmarFotosAntes}
                    disabled={localFotosAntes.length < 3 || isSubmitting}
                    className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Wrench size={18} /> Confirmar 3 Fotos & Iniciar Trabalho
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 4: EXECUÇÃO DO TRABALHO TÉCNICO */}
            {activeOrder.etapaExecucao === "em_execucao" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Wrench className="text-blue-600" />
                      Etapa 4: Trabalho Técnico em Execução
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Iniciado às {formatDateTimeBR(activeOrder.inicioTrabalhoEm)}. Realize o serviço com rigor técnico.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Em Execução Ativa
                  </div>
                </div>

                {/* Technical checklist / notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Observações Técnicas e Procedimentos Realizados
                    </label>
                    <textarea
                      rows={4}
                      value={observacoesTecnicas}
                      onChange={(e) => setObservacoesTecnicas(e.target.value)}
                      placeholder="Descreva o que foi inspecionado, regulado, reparado ou higienizado..."
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Peças / Materiais / Insumos Utilizados (se houver)
                    </label>
                    <textarea
                      rows={4}
                      value={materiaisUtilizados}
                      onChange={(e) => setMateriaisUtilizados(e.target.value)}
                      placeholder="Ex: 2x Abraçadeiras 3/4, 1L Lubrificante técnico, 1x Válvula..."
                      className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={handleFinalizarTrabalhoFisico}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Camera size={18} /> Trabalho Concluído - Ir para 3 Fotos Finais
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 5: VISTORIA FINAL & 3 FOTOS DEPOIS (OBRIGATÓRIO) */}
            {activeOrder.etapaExecucao === "fotos_depois" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Camera className="text-teal-600" />
                    Etapa 5: Vistoria Final & 3 Fotos APÓS a Conclusão
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    É obrigatório registrar no mínimo 3 fotografias nítidas comprovando o serviço finalizado e limpo.
                  </p>
                </div>

                <PhotoUploadStep
                  fase="depois"
                  orderId={activeOrder.id}
                  photos={localFotosDepois}
                  onChangePhotos={setLocalFotosDepois}
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    {localFotosDepois.length >= 3 ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={16} /> 3 Fotos finais anexadas. Pronto para colher a assinatura.
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold flex items-center gap-1.5">
                        <AlertTriangle size={16} /> Faltam {3 - localFotosDepois.length} fotos finais antes de liberar a
                        assinatura.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmarFotosDepois}
                    disabled={localFotosDepois.length < 3 || isSubmitting}
                    className="w-full sm:w-auto px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <PenTool size={18} /> Confirmar 3 Fotos & Coletar Assinatura
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 6: AGUARDANDO ASSINATURA */}
            {activeOrder.etapaExecucao === "aguardando_assinatura" && (
              <div className="space-y-6 text-center py-6">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
                  <PenTool size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Coletar Assinatura do Responsável</h3>
                  <p className="text-xs text-slate-500">
                    Chame o síndico, zelador ou responsável pelo acompanhamento no condomínio para assinar a conclusão
                    na tela do seu dispositivo.
                  </p>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <PenTool size={18} /> Abrir Tela de Assinatura Digital
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 7: CONCLUÍDO */}
            {activeOrder.etapaExecucao === "concluido" && (
              <div className="space-y-6 text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                  <CheckCircle2 size={36} />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-xl font-bold text-emerald-900">Ordem de Serviço Concluída com Sucesso!</h3>
                  <p className="text-xs text-slate-500">
                    Finalizada e assinada por <strong>{activeOrder.assinaturaResponsavel?.nome}</strong> (
                    {activeOrder.assinaturaResponsavel?.cargoOuFuncao}) em{" "}
                    {formatDateTimeBR(activeOrder.concluidoEm)}.
                  </p>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-all"
                  >
                    Voltar para Fila de Serviços
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Queue & Overview View */
        <div className="space-y-6">
          {/* Active / Current Service Card (if in progress) */}
          {inProgressOrder && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold border border-white/30">
                    Em Andamento Agora
                  </span>
                  <span className="text-xs text-blue-100 font-medium">
                    {inProgressOrder.numeroOS || `OS #${inProgressOrder.id.slice(0, 8)}`}
                  </span>
                </div>

                <span className="text-xs bg-white/10 px-3 py-1 rounded-lg border border-white/20 font-bold self-start sm:self-auto">
                  {getExecutionStepInfo(inProgressOrder.etapaExecucao).title}
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold">{inProgressOrder.nomeCondominio || inProgressOrder.clienteNome}</h2>
                <p className="text-xs text-blue-100">
                  {inProgressOrder.servicoNome} • {inProgressOrder.enderecoCondominio}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSelectOrderToExecute(inProgressOrder)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
                >
                  Continuar Execução Deste Serviço <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Queue of Routine Services */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Layers size={18} className="text-blue-600" />
                  Fila de Serviços Agendados do Colaborador
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lista de ordens de serviço programadas para execução sequencial.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold self-start sm:self-auto">
                {upcomingQueue.length} serviços na fila
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                Carregando fila de serviços...
              </div>
            ) : upcomingQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
                <p className="font-bold text-slate-800 text-sm">Nenhum serviço pendente na fila deste colaborador.</p>
                <p className="text-xs text-slate-400">Todos os serviços agendados foram finalizados com sucesso.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingQueue.map((order, index) => {
                  const isLockedByInProgress = !!inProgressOrder && inProgressOrder.id !== order.id;
                  const isFirstInQueue = index === 0 && !inProgressOrder;

                  return (
                    <div
                      key={order.id}
                      className={`p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isLockedByInProgress ? "bg-slate-50/50 opacity-75" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                            isFirstInQueue
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          #{index + 1}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-blue-600">
                              {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                getExecutionStepInfo(order.etapaExecucao).badgeColor
                              }`}
                            >
                              {getExecutionStepInfo(order.etapaExecucao).title}
                            </span>
                            {isFirstInQueue && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                Próximo da Rota
                              </span>
                            )}
                            {order.prioridade === "Urgente" && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                Urgente
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {order.nomeCondominio || order.clienteNome || "Condomínio"}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {order.servicoNome || "Serviço Rotineiro"} • {order.enderecoCondominio || "Endereço cadastrado"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isLockedByInProgress ? (
                          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-500 text-xs font-semibold rounded-xl border border-slate-200 cursor-not-allowed">
                            <Lock size={13} className="text-slate-400" />
                            Aguardando conclusão atual
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectOrderToExecute(order)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                          >
                            {isFirstInQueue ? "Iniciar Atendimento" : "Abrir Detalhes"} <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed Services History for Today */}
          {completedToday.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Serviços Concluídos Recentemente ({completedToday.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Histórico com 3 fotos antes, 3 fotos depois e assinatura do responsável.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {completedToday.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">
                          {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-600" /> Concluído & Assinado
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {order.nomeCondominio || order.clienteNome}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {order.servicoNome} • Assinado por {order.assinaturaResponsavel?.nome || "Responsável"} às{" "}
                        {formatDateTimeBR(order.concluidoEm)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectOrderToExecute(order)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors self-end sm:self-auto"
                    >
                      Ver Detalhes
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Signature Modal */}
      <SignaturePadModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onConfirmSignature={handleSalvarAssinatura}
        condominioNome={activeOrder?.nomeCondominio || activeOrder?.clienteNome}
        servicoNome={activeOrder?.servicoNome}
        numeroOS={activeOrder?.numeroOS || activeOrder?.id?.slice(0, 8)}
        isSubmitting={isSubmitting}
      />

      {/* Modal / Sugestão Imediata para Abrir a Próxima Ordem de Serviço */}
      {showCompletedSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col p-6 text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-900">Serviço Concluído com Sucesso!</h3>
              <p className="text-xs text-slate-500">
                A Ordem de Serviço foi encerrada com 3 fotos antes, 3 fotos depois e a assinatura digital do
                responsável gravadas.
              </p>
            </div>

            {nextOrderSuggested ? (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    Próximo Serviço Agendado na Sua Fila
                  </span>
                  <span className="px-2 py-0.5 bg-blue-200/60 text-blue-900 text-[10px] font-bold rounded">
                    {nextOrderSuggested.numeroOS || `OS #${nextOrderSuggested.id.slice(0, 8)}`}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {nextOrderSuggested.nomeCondominio || nextOrderSuggested.clienteNome}
                  </h4>
                  <p className="text-xs text-slate-600">
                    <strong>Serviço:</strong> {nextOrderSuggested.servicoNome}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <MapPin size={12} className="inline mr-1 text-slate-400" />
                    {nextOrderSuggested.enderecoCondominio || "Endereço agendado"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartNextOrder(nextOrderSuggested)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all hover:scale-101"
                >
                  <Play size={16} /> Iniciar Próximo Serviço Agora
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Parabéns! Todos os serviços agendados na sua fila foram concluídos com sucesso.
              </div>
            )}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowCompletedSuccessModal(false);
                  setActiveOrder(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition-colors"
              >
                Fechar e ver painel geral
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
