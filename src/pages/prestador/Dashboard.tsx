/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Building,
  User,
  Phone,
  Camera,
  Layers,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Wifi,
  WifiOff,
  RefreshCw,
  Navigation,
  FileText,
  FileDown,
  Check,
  AlertTriangle,
  Play,
  Send,
  Printer,
  Sparkles,
  Search,
  Filter,
  Eye,
  Lock,
  PenTool,
  CalendarDays,
  X,
  Edit3,
  Save,
} from "lucide-react";
import { exportOrdemServicoPdf } from "../../lib/pdfExport";
import {
  RoutineServiceOrder,
  ServiceExecutionStep,
  ServicePhoto,
  ServiceSignature,
  getExecutionStepInfo,
  computeOrderInternalMetrics,
} from "../../types/serviceExecution";
import { getOrderEditTimeRemaining } from "../../lib/serviceExecutionUtils";
import {
  cacheOrderInIndexedDB,
  getCachedOrdersFromIndexedDB,
  getPendingSyncPhotosCount,
  syncPendingServicePhotos,
} from "../../lib/servicePhotoOfflineStorage";
import PhotoUploadStep from "../../components/servicos/PhotoUploadStep";
import SignaturePadModal from "../../components/servicos/SignaturePadModal";
import SignatureCanvasField from "../../components/servicos/SignatureCanvasField";
import ServiceReportModal from "../../components/servicos/ServiceReportModal";
import { logAction } from "../../lib/audit";
import { formatDateBR, formatDateTimeBR } from "../../lib/dateUtils";
import {
  normalizeOSStatus,
  getEffectiveOSStatus,
  appendStatusHistory,
  getOSStatusVisualInfo,
  STANDARD_OS_STEPS,
  isOSPendingInitialConfirmation,
  isTodayOrPast,
} from "../../lib/serviceStatusWorkflow";
import ServiceTrackingTimeline from "../../components/servicos/ServiceTrackingTimeline";

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

export default function PrestadorDashboard() {
  const { profile } = useAuth();
  const [ordens, setOrdens] = useState<RoutineServiceOrder[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Active executing order
  const [activeOrder, setActiveOrder] = useState<RoutineServiceOrder | null>(null);

  // Wizard state for the active order
  const [localFotosAntes, setLocalFotosAntes] = useState<ServicePhoto[]>([]);
  const [localFotosDepois, setLocalFotosDepois] = useState<ServicePhoto[]>([]);
  const [observacoesTecnicas, setObservacoesTecnicas] = useState<string>("");
  const [materiaisUtilizados, setMateriaisUtilizados] = useState<string>("");

  // Modals
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [selectedOrderForReport, setSelectedOrderForReport] = useState<RoutineServiceOrder | null>(null);
  const [showSuccessCompletionModal, setShowSuccessCompletionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Date Confirmation & Adjustment Modal
  const [selectedOrderForDateModal, setSelectedOrderForDateModal] = useState<RoutineServiceOrder | null>(null);
  const [modalTargetDate, setModalTargetDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [modalTargetTurno, setModalTargetTurno] = useState<string>("Manhã");
  const [modalObservations, setModalObservations] = useState<string>("");

  // Filter & Search states
  const [filterTab, setFilterTab] = useState<
    "todas" | "hoje" | "pendencias_anteriores" | "novas" | "deslocamento" | "execucao" | "concluidas"
  >("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);

  // Offline and Sync Status
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingPhotosCount, setPendingPhotosCount] = useState<number>(0);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");

  // Realtime Live Timer for active service
  const [elapsedTimer, setElapsedTimer] = useState<string>("00:00:00");

  const checkPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncPhotosCount();
      setPendingPhotosCount(count);
    } catch {
      // ignore
    }
  }, []);

  const handleSyncAllPending = useCallback(async () => {
    if (!isOnline || isSyncingAll) return;
    setIsSyncingAll(true);
    setSyncStatusMsg("Sincronizando fotos armazenadas offline...");
    try {
      const synced = await syncPendingServicePhotos();
      if (synced.success > 0) {
        setSyncStatusMsg(`Sincronização concluída: ${synced.success} fotos enviadas com sucesso.`);
      }
    } catch (e: any) {
      console.warn("Falha na sincronização:", e);
    } finally {
      setIsSyncingAll(false);
      checkPendingCount();
      setTimeout(() => setSyncStatusMsg(""), 4000);
    }
  }, [isOnline, isSyncingAll, checkPendingCount]);

  useEffect(() => {
    checkPendingCount();
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncAllPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [checkPendingCount, handleSyncAllPending]);

  // Live Timer
  useEffect(() => {
    if (!activeOrder?.inicioTrabalhoEm || activeOrder.concluidoEm) {
      setElapsedTimer("00:00:00");
      return;
    }

    const interval = setInterval(() => {
      try {
        const start = getTimestampMs(activeOrder.inicioTrabalhoEm);
        if (!start) return;
        const now = Date.now();
        const diff = Math.max(0, now - start);

        const secs = Math.floor((diff / 1000) % 60);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        const hrs = Math.floor(diff / (1000 * 60 * 60));

        setElapsedTimer(
          `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
        );
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrder?.inicioTrabalhoEm, activeOrder?.concluidoEm]);

  // Fetch collaborators and service orders
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Empregados / Prestadores
      const empSnap = await getDocs(collection(db, "empregados"));
      const empList: any[] = [];
      empSnap.docs.forEach((d) => {
        empList.push({ id: d.id, ...d.data() });
      });

      // Also get users with staff role
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

      // Auto-select logged-in user
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
          etapaExecucao:
            data.etapaExecucao || (data.status === "Serviço Concluído" ? "concluido" : "atribuido"),
        } as RoutineServiceOrder;
      });

      setOrdens(osList);
      await Promise.all(osList.map((o) => cacheOrderInIndexedDB(o)));

      // If active order was open, refresh
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
      console.warn("Erro ao buscar Firestore, tentando IndexedDB:", err);
      try {
        const cached = await getCachedOrdersFromIndexedDB();
        if (cached.length > 0) setOrdens(cached);
      } catch (cacheErr) {
        console.error("Cache IndexedDB indisponível:", cacheErr);
      }
    } finally {
      setLoading(false);
      checkPendingCount();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime subscription to ordens_servico updates
  useEffect(() => {
    const q = query(collection(db, "ordens_servico"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: RoutineServiceOrder[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            fotosAntes: Array.isArray(data.fotosAntes) ? data.fotosAntes : [],
            fotosDepois: Array.isArray(data.fotosDepois) ? data.fotosDepois : [],
            etapaExecucao:
              data.etapaExecucao || (data.status === "Serviço Concluído" ? "concluido" : "atribuido"),
          } as RoutineServiceOrder;
        });
        setOrdens(list);
      },
      (error) => {
        console.warn("Snapshot subscription offline / warning:", error);
      }
    );

    return () => unsub();
  }, []);

  // Filter orders for selected collaborator
  const myOrders = useMemo(() => {
    if (!selectedColaboradorId) return ordens;
    const currentEmp = colaboradores.find((c) => c.id === selectedColaboradorId);
    return ordens.filter(
      (o) =>
        o.colaboradorId === selectedColaboradorId ||
        (currentEmp?.email && o.colaboradorEmail === currentEmp.email) ||
        (!o.colaboradorId && o.status !== "Cancelada pelo Cliente" && o.status !== "Cancelado")
    );
  }, [ordens, selectedColaboradorId, colaboradores]);

  // Tab & Search filtered orders
  const filteredOrders = useMemo(() => {
    let result = myOrders;

    // Filter Tab
    const todayStr = new Date().toISOString().substring(0, 10);

    if (filterTab === "hoje") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        const d = (o.dataConfirmada || o.dataAgendada || "") as string;
        const dNorm = d.includes("T") ? d.substring(0, 10) : d;
        return (
          dNorm === todayStr &&
          eff !== "Serviço Concluído" &&
          eff !== "Cancelada pelo Cliente" &&
          eff !== "Cancelado"
        );
      });
    } else if (filterTab === "pendencias_anteriores") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        const d = (o.dataConfirmada || o.dataAgendada || "") as string;
        const dNorm = d.includes("T") ? d.substring(0, 10) : d;
        return (
          dNorm !== "" &&
          dNorm < todayStr &&
          eff !== "Serviço Concluído" &&
          eff !== "Cancelada pelo Cliente" &&
          eff !== "Cancelado"
        );
      });
    } else if (filterTab === "novas") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        return ["Confirmação de Data", "Data confirmada", "Dia de Execução Serviço"].includes(eff) ||
          !o.etapaExecucao ||
          ["pendente_atribuicao", "atribuido", "recebido"].includes(o.etapaExecucao);
      });
    } else if (filterTab === "deslocamento") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        return eff === "Técnico a caminho" || o.etapaExecucao === "deslocamento";
      });
    } else if (filterTab === "execucao") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        return (eff === "Em execução" || ["fotos_antes", "em_execucao", "fotos_depois", "aguardando_assinatura"].includes(o.etapaExecucao)) && eff !== "Serviço Concluído";
      });
    } else if (filterTab === "concluidas") {
      result = result.filter((o) => {
        const eff = getEffectiveOSStatus(o);
        return eff === "Serviço Concluído" || o.etapaExecucao === "concluido";
      });
    }

    // Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          (o.nomeCondominio && o.nomeCondominio.toLowerCase().includes(term)) ||
          (o.clienteNome && o.clienteNome.toLowerCase().includes(term)) ||
          (o.servicoNome && o.servicoNome.toLowerCase().includes(term)) ||
          (o.numeroOS && o.numeroOS.toLowerCase().includes(term)) ||
          (o.enderecoCondominio && o.enderecoCondominio.toLowerCase().includes(term))
      );
    }

    return result;
  }, [myOrders, filterTab, searchTerm]);

  // Find if an order is currently active/in-progress
  const inProgressOrder = useMemo(() => {
    return (
      myOrders.find((o) => {
        const eff = getEffectiveOSStatus(o);
        return (
          eff !== "Serviço Concluído" &&
          eff !== "Cancelada pelo Cliente" &&
          eff !== "Cancelado" &&
          (eff === "Técnico a caminho" || eff === "Em execução" || (o.etapaExecucao && !["concluido", "cancelado"].includes(o.etapaExecucao)))
        );
      }) || null
    );
  }, [myOrders]);

  // Counts for KPI pills
  const kpiCounts = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const hoje = myOrders.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      const d = (o.dataConfirmada || o.dataAgendada || "") as string;
      const dNorm = d.includes("T") ? d.substring(0, 10) : d;
      return (
        dNorm === todayStr &&
        eff !== "Serviço Concluído" &&
        eff !== "Cancelada pelo Cliente" &&
        eff !== "Cancelado"
      );
    }).length;

    const pendenciasAnteriores = myOrders.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      const d = (o.dataConfirmada || o.dataAgendada || "") as string;
      const dNorm = d.includes("T") ? d.substring(0, 10) : d;
      return (
        dNorm !== "" &&
        dNorm < todayStr &&
        eff !== "Serviço Concluído" &&
        eff !== "Cancelada pelo Cliente" &&
        eff !== "Cancelado"
      );
    }).length;

    const novas = myOrders.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      return ["Confirmação de Data", "Data confirmada", "Dia de Execução Serviço"].includes(eff) && !["Técnico a caminho", "Em execução", "Serviço Concluído", "Cancelado"].includes(eff);
    }).length;
    const emAndamento = myOrders.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      return eff === "Técnico a caminho" || eff === "Em execução" || (o.etapaExecucao && ["deslocamento", "fotos_antes", "em_execucao", "fotos_depois", "aguardando_assinatura"].includes(o.etapaExecucao) && eff !== "Serviço Concluído");
    }).length;
    const concluidas = myOrders.filter((o) => {
      const eff = getEffectiveOSStatus(o);
      return eff === "Serviço Concluído" || o.etapaExecucao === "concluido";
    }).length;

    return { total: myOrders.length, hoje, pendenciasAnteriores, novas, emAndamento, concluidas };
  }, [myOrders]);

  // Handler to Confirm or Adjust Service Execution Date
  const handleConfirmarOuAjustarData = async (
    orderId: string,
    targetDate: string,
    targetTurno?: string,
    observacoes?: string
  ) => {
    const currentOrder = ordens.find((o) => o.id === orderId) || activeOrder;
    if (!currentOrder) return;
    const nowIso = new Date().toISOString();
    const isToday = isTodayOrPast(targetDate);
    const nextStatus = isToday ? "Dia de Execução Serviço" : "Data confirmada";

    const updates: Partial<RoutineServiceOrder> = {
      dataAgendada: targetDate,
      dataConfirmada: targetDate,
      turnoAgendado: (targetTurno as any) || currentOrder.turnoAgendado || "Manhã",
      dataConfirmadaEm: nowIso,
      agendamentoAtualizadoEm: nowIso,
      agendamentoConfirmadoPor: profile?.displayName || "Colaborador Técnico",
      etapaExecucao: isToday ? "recebido" : "atribuido",
      status: nextStatus,
      ...(observacoes ? { observacoesAgendamento: observacoes } : {}),
    };

    const desc = `Data ${isToday ? "confirmada para hoje" : `confirmada para ${formatDateBR(targetDate)}`}${targetTurno ? ` (${targetTurno})` : ""}${observacoes ? ` - Obs: ${observacoes}` : ""}.`;

    await updateOrderInDb(orderId, updates, desc);
    setSelectedOrderForDateModal(null);
  };

  // Open order to execute
  const handleOpenOrder = (order: RoutineServiceOrder) => {
    if (inProgressOrder && inProgressOrder.id !== order.id && order.etapaExecucao !== "concluido") {
      alert(
        "Atenção: Você já possui um serviço em andamento. Conclua o atendimento ativo antes de iniciar outro."
      );
      setActiveOrder(inProgressOrder);
      return;
    }

    const nowIso = new Date().toISOString();
    const preparedOrder: RoutineServiceOrder = {
      ...order,
      recebidoEm: order.recebidoEm || order.designadoEm || nowIso,
    };

    setActiveOrder(preparedOrder);
    setLocalFotosAntes(order.fotosAntes || []);
    setLocalFotosDepois(order.fotosDepois || []);
    setObservacoesTecnicas(order.observacoesTecnicas || "");
    setMateriaisUtilizados(order.materiaisUtilizados || "");
    setShowSuccessCompletionModal(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Helper to persist order changes
  const updateOrderInDb = async (orderId: string, rawUpdates: Partial<RoutineServiceOrder>, auditDesc?: string) => {
    setIsSubmitting(true);
    try {
      const currentOrder = ordens.find((o) => o.id === orderId) || activeOrder || {};
      const technicianName = profile?.displayName || profile?.email || (currentOrder as any).colaboradorNome || "Técnico";

      // If status is being updated, append audit trail via appendStatusHistory
      let updatesWithHistory: any = { ...rawUpdates };
      if (rawUpdates.status && rawUpdates.status !== (currentOrder as any).status) {
        updatesWithHistory = appendStatusHistory(
          currentOrder,
          rawUpdates.status,
          auditDesc || `Status atualizado para "${rawUpdates.status}" pelo técnico`,
          technicianName,
          rawUpdates
        );
      }

      const combined: RoutineServiceOrder = {
        ...(currentOrder as RoutineServiceOrder),
        ...updatesWithHistory,
        id: orderId,
        updatedAt: new Date().toISOString(),
      };

      const metrics = computeOrderInternalMetrics(combined);
      combined.metricasInternas = metrics;

      // Optimistic update
      setActiveOrder(combined);
      setOrdens((prev) => prev.map((o) => (o.id === orderId ? combined : o)));

      // Always save to IndexedDB
      await cacheOrderInIndexedDB(combined);

      // Firestore if online
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const docRef = doc(db, "ordens_servico", orderId);
          await updateDoc(docRef, {
            ...updatesWithHistory,
            metricasInternas: metrics,
            updatedAt: new Date().toISOString(),
          });

          await logAction(
            `Prestador OS #${orderId.slice(0, 6)}: etapa ${rawUpdates.etapaExecucao || rawUpdates.status}`,
            "Comercial",
            { orderId, updates: updatesWithHistory }
          );
        } catch (dbErr) {
          console.warn("Atualização Firestore falhou, mantida em IndexedDB:", dbErr);
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar ordem:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Marco: Receber e Iniciar Deslocamento ("Técnico a caminho")
  const handleIniciarDeslocamento = async () => {
    if (!activeOrder) return;
    const nowIso = new Date().toISOString();
    const currentEmp = colaboradores.find((c) => c.id === selectedColaboradorId);

    const updates: Partial<RoutineServiceOrder> = {
      colaboradorId: selectedColaboradorId,
      colaboradorNome:
        currentEmp?.nome || activeOrder.colaboradorNome || profile?.displayName || "Técnico",
      colaboradorEmail: currentEmp?.email || activeOrder.colaboradorEmail || profile?.email || "",
      recebidoEm: activeOrder.recebidoEm || nowIso,
      aceitoEm: activeOrder.aceitoEm || nowIso,
      deslocamentoInicioEm: nowIso,
      etapaExecucao: "deslocamento",
      status: "Técnico a caminho",
    };

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Técnico a caminho - Deslocamento iniciado até o condomínio"
    );
  };

  // Navigation Links for GPS
  const handleOpenGPS = (app: "google" | "waze") => {
    if (!activeOrder?.enderecoCondominio) return;
    const encoded = encodeURIComponent(activeOrder.enderecoCondominio);
    if (app === "google") {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
    } else {
      window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, "_blank");
    }
  };

  // 2. Marco: Chegada no Local e Aceite de Início ("Em execução")
  const handleConfirmarChegada = async () => {
    if (!activeOrder) return;
    const nowIso = new Date().toISOString();

    let localizacao: any = undefined;
    if ("geolocation" in navigator) {
      try {
        const pos: any = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 5000,
            enableHighAccuracy: true,
          })
        );
        localizacao = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisaoMetros: pos.coords.accuracy,
        };
      } catch (e) {
        console.log("Geolocalização não concedida:", e);
      }
    }

    const updates: Partial<RoutineServiceOrder> = {
      chegadaEm: nowIso,
      chegadaLocalizacao: localizacao,
      etapaExecucao: "fotos_antes",
      status: "Em execução",
    };

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Em execução - Técnico chegou ao condomínio e iniciou atendimento"
    );
  };

  // 3. Marco: Confirmar Fotos Iniciais (Antes) e Iniciar Trabalho Físico
  const handleConfirmarFotosAntes = async () => {
    if (!activeOrder) return;
    if (localFotosAntes.length < 4) {
      alert("É obrigatório tirar 4 fotos do estado inicial do local antes de iniciar.");
      return;
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<RoutineServiceOrder> = {
      fotosAntes: localFotosAntes,
      fotosAntesEm: nowIso,
      inicioTrabalhoEm: activeOrder.inicioTrabalhoEm || nowIso,
      etapaExecucao: "em_execucao",
      status: "Em execução",
    };

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Em execução - Fotos iniciais registradas e execução dos serviços em andamento"
    );
  };

  // 4. Marco: Finalizar Trabalho Físico e Ir para Fotos Finais
  const handleFinalizarTrabalhoFisico = async () => {
    if (!activeOrder) return;

    const updates: Partial<RoutineServiceOrder> = {
      observacoesTecnicas: observacoesTecnicas.trim(),
      materiaisUtilizados: materiaisUtilizados.trim(),
      etapaExecucao: "fotos_depois",
      status: "Em execução",
    };

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Em execução - Trabalho físico concluído, registrando fotos finais"
    );
  };

  // 5. Marco: Confirmar Fotos Finais (Depois)
  const handleConfirmarFotosDepois = async () => {
    if (!activeOrder) return;
    if (localFotosDepois.length < 4) {
      alert("É obrigatório tirar 4 fotos comprobatórias da conclusão do serviço.");
      return;
    }

    const nowIso = new Date().toISOString();
    const updates: Partial<RoutineServiceOrder> = {
      fotosDepois: localFotosDepois,
      fotosDepoisEm: nowIso,
      etapaExecucao: "aguardando_assinatura",
      status: "Em execução",
    };

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Em execução - Fotos finais registradas, aguardando assinatura do responsável"
    );
    setIsSignatureModalOpen(true);
  };

  // 6. Marco: Coleta da Assinatura Digital e Conclusão ("Serviço Concluído")
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

    await updateOrderInDb(
      activeOrder.id,
      updates,
      "Serviço Concluído - Finalizado com fotos antes/depois e assinatura do responsável"
    );
    setIsSignatureModalOpen(false);
    setShowSuccessCompletionModal(true);
  };

  const handleDirectDownloadPdf = async (order: RoutineServiceOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingPdfId(order.id);
      await exportOrdemServicoPdf(order);
    } catch (err) {
      console.error("Erro ao gerar PDF da O.S.:", err);
      alert("Não foi possível gerar o PDF da Ordem de Serviço no momento. Tente abrir o relatório para visualizar.");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Wrench size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Painel do Prestador
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase border border-blue-200">
                Campo
              </span>
            </h1>
            <p className="text-xs text-slate-500">Serviços Condominiais Rotineiros</p>
          </div>
        </div>

        {/* Network & Collaborator Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
              !isOnline
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : "bg-emerald-50 text-emerald-800 border-emerald-300"
            }`}
          >
            {!isOnline ? <WifiOff size={13} className="text-amber-700" /> : <Wifi size={13} className="text-emerald-700" />}
            <span className="hidden sm:inline">{!isOnline ? "Offline" : "Online"}</span>
          </div>

          {colaboradores.length > 0 && (
            <select
              value={selectedColaboradorId}
              onChange={(e) => {
                setSelectedColaboradorId(e.target.value);
                setActiveOrder(null);
              }}
              className="bg-white border border-slate-300 text-xs font-bold text-slate-700 rounded-lg px-2.5 py-1 outline-none max-w-[150px] truncate shadow-xs focus:ring-2 focus:ring-blue-500"
            >
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome || c.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {/* Sync Notification Banner */}
      {syncStatusMsg && (
        <div className="p-3 bg-blue-50 border-b border-blue-200 text-blue-900 text-xs font-medium flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-blue-600" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* ACTIVE SERVICE WIZARD VIEW */}
        {activeOrder ? (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Active Order Card Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
                      {activeOrder.numeroOS || `OS #${activeOrder.id.slice(0, 8)}`}
                    </span>
                    {(() => {
                      const eff = getEffectiveOSStatus(activeOrder);
                      const visual = getOSStatusVisualInfo(eff);
                      return (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${visual.badgeBg} ${visual.badgeText}`}>
                          {eff}
                        </span>
                      );
                    })()}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {activeOrder.nomeCondominio || activeOrder.clienteNome || "Condomínio"}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
                    <Wrench size={14} className="text-blue-600 shrink-0" />
                    <strong>Serviço:</strong> {activeOrder.servicoNome || "Serviço Rotineiro"}
                  </p>
                </div>

                {/* Return to list button */}
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors"
                >
                  Voltar para Lista
                </button>
              </div>

              {/* Service Tracking Timeline in Active Order */}
              <div className="pt-1">
                <ServiceTrackingTimeline order={activeOrder} defaultExpanded={false} />
              </div>

              {/* Condomínio Address & Direct GPS Buttons */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <span>{activeOrder.enderecoCondominio || "Endereço cadastrado no sistema"}</span>
                  </div>
                  {activeOrder.clienteTelefone && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone size={13} className="text-emerald-600" />
                      <span>Contato Síndico / Portaria: {activeOrder.clienteTelefone}</span>
                    </div>
                  )}
                </div>

                {/* GPS Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenGPS("google")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Navigation size={14} /> Google Maps
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenGPS("waze")}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Navigation size={14} /> Waze
                  </button>
                </div>
              </div>

              {/* Progress Steps Visual Indicator */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
                {[
                  { step: "deslocamento", label: "1. Deslocamento", icon: Navigation },
                  { step: "fotos_antes", label: "2. Chegada & Fotos Antes", icon: Camera },
                  { step: "em_execucao", label: "3. Execução", icon: Wrench },
                  { step: "fotos_depois", label: "4. Fotos Depois", icon: Camera },
                  { step: "aguardando_assinatura", label: "5. Assinatura", icon: ShieldCheck },
                  { step: "concluido", label: "6. Concluído", icon: CheckCircle2 },
                ].map((s, idx) => {
                  const isCurrent = activeOrder.etapaExecucao === s.step;
                  const isDone =
                    (s.step === "deslocamento" && activeOrder.deslocamentoInicioEm) ||
                    (s.step === "fotos_antes" && activeOrder.fotosAntesEm) ||
                    (s.step === "em_execucao" && activeOrder.inicioTrabalhoEm && activeOrder.etapaExecucao !== "em_execucao") ||
                    (s.step === "fotos_depois" && activeOrder.fotosDepoisEm) ||
                    (s.step === "aguardando_assinatura" && activeOrder.concluidoEm) ||
                    (s.step === "concluido" && activeOrder.concluidoEm);

                  return (
                    <div
                      key={s.step}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isCurrent
                          ? "bg-blue-600 border-blue-600 text-white font-bold ring-2 ring-blue-300 shadow-xs"
                          : isDone
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-medium"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      <s.icon size={15} className={`mx-auto mb-1 ${isCurrent ? "text-white" : isDone ? "text-emerald-600" : "text-slate-400"}`} />
                      <span className="text-[10px] block leading-tight">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 1: AJUSTAR / CONFIRMAR DATA & DESLOCAMENTO */}
            {(!activeOrder.etapaExecucao ||
              activeOrder.etapaExecucao === "pendente_atribuicao" ||
              activeOrder.etapaExecucao === "atribuido" ||
              activeOrder.etapaExecucao === "recebido") && (
              <div className="space-y-4">
                {/* CALENDAR DATE CONFIRMATION & ADJUSTMENT CARD */}
                <div className="bg-white border border-blue-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-blue-800 font-bold text-base">
                      <CalendarDays size={20} className="text-blue-600 shrink-0" />
                      <span>Data de Execução do Serviço</span>
                    </div>
                    {(() => {
                      const eff = getEffectiveOSStatus(activeOrder);
                      const isPending = isOSPendingInitialConfirmation(eff);
                      return (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            isPending
                              ? "bg-amber-50 text-amber-900 border-amber-300 animate-pulse"
                              : "bg-emerald-50 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          {isPending ? "⚠️ Confirmação de Data Pendente" : "✓ Data Confirmada na Escala"}
                        </span>
                      );
                    })()}
                  </div>

                  <p className="text-xs text-slate-600">
                    Ajuste ou confirme a data e turno em que a equipe técnica executará o serviço no condomínio. Toda alteração registra dia, horário e histórico de acompanhamento.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Data de Execução
                      </label>
                      <input
                        type="date"
                        defaultValue={
                          (activeOrder.dataConfirmada || activeOrder.dataAgendada || "").substring(0, 10) ||
                          new Date().toISOString().substring(0, 10)
                        }
                        id="activeOrderTargetDateInput"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Turno de Atendimento
                      </label>
                      <select
                        defaultValue={activeOrder.turnoAgendado || "Manhã"}
                        id="activeOrderTargetTurnoSelect"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                      >
                        <option value="Manhã">Manhã (08h às 12h)</option>
                        <option value="Tarde">Tarde (13h às 17h)</option>
                        <option value="Noite">Noite (18h às 22h)</option>
                        <option value="Integral">Horário Comercial / Integral</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const dateEl = document.getElementById("activeOrderTargetDateInput") as HTMLInputElement;
                          const turnoEl = document.getElementById("activeOrderTargetTurnoSelect") as HTMLSelectElement;
                          const targetDate = dateEl?.value || new Date().toISOString().substring(0, 10);
                          const targetTurno = turnoEl?.value || "Manhã";
                          handleConfirmarOuAjustarData(activeOrder.id, targetDate, targetTurno, "Confirmado pelo prestador no painel");
                        }}
                        disabled={isSubmitting}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Check size={14} /> Salvar & Confirmar Data
                      </button>
                    </div>
                  </div>
                </div>

                {/* READY FOR DISPLACEMENT (TÉCNICO A CAMINHO) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto">
                    <Navigation size={32} />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Iniciar Deslocamento até o Local</h3>
                    <p className="text-xs text-slate-500">
                      Ao clicar abaixo, o status é alterado para <strong>"Técnico a caminho"</strong> com registro de data/hora na linha de acompanhamento e o condomínio é notificado.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleIniciarDeslocamento}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 mx-auto transition-all"
                    >
                      <Navigation size={18} /> Iniciar Deslocamento / Técnico a Caminho
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: A CAMINHO -> CONFIRMAR CHEGADA NO CONDOMÍNIO */}
            {activeOrder.etapaExecucao === "deslocamento" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                  <MapPin size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Você está em deslocamento</h3>
                  <p className="text-xs text-slate-500">
                    Saída registrada às {formatDateTimeBR(activeOrder.deslocamentoInicioEm)}. Ao chegar na portaria do condomínio, clique abaixo para dar o aceite de início.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenGPS("google")}
                    className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-200"
                  >
                    <Navigation size={16} /> Abrir Rota GPS
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmarChegada}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 size={18} /> Confirmar Chegada no Local
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: FOTOS INICIAIS (ANTES) COM CARIMBO TIMEMARK REAL */}
            {activeOrder.etapaExecucao === "fotos_antes" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                    <Camera size={18} />
                    Etapa Obrigatória: Fotografias Iniciais (Antes do Serviço)
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Tire as <strong>4 fotos nítidas</strong> do local do serviço. Cada foto receberá automaticamente o carimbo pericial <strong>Timemark Foto 100% Real</strong> com o nome do condomínio, endereço, data e horário exato gravados na imagem.
                  </p>
                </div>

                <PhotoUploadStep
                  fase="antes"
                  photos={localFotosAntes}
                  onChangePhotos={setLocalFotosAntes}
                  onAutoSave={(photos) => {
                    if (activeOrder) {
                      updateOrderInDb(activeOrder.id, { fotosAntes: photos }, null, true);
                    }
                  }}
                  orderId={activeOrder.id}
                  nomeCondominio={activeOrder.nomeCondominio || activeOrder.clienteNome || "Condomínio Residencial"}
                  enderecoCompleto={activeOrder.enderecoCondominio || ""}
                  title="Fotos do Estado Inicial (Antes)"
                  description="Comprovam a situação em que o condomínio se encontrava antes do início dos trabalhos técnicos."
                />

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    {localFotosAntes.length}/4 fotos mínimas capturadas
                  </span>

                  <button
                    type="button"
                    onClick={handleConfirmarFotosAntes}
                    disabled={localFotosAntes.length < 4 || isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Play size={18} /> Aceitar Início & Começar Execução
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: EM EXECUÇÃO (TRABALHO TÉCNICO & ANOTAÇÕES) */}
            {activeOrder.etapaExecucao === "em_execucao" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                
                {/* Live Timer Banner */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-center sm:text-left">
                  <div>
                    <span className="text-xs text-blue-800 font-bold uppercase tracking-wider block">
                      Serviço em Andamento no Local
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Iniciado às {formatDateTimeBR(activeOrder.inicioTrabalhoEm)}
                    </p>
                  </div>

                  <div className="bg-white px-4 py-2 rounded-xl border border-blue-200 shadow-xs flex items-center justify-center gap-2 mx-auto sm:mx-0">
                    <Clock size={16} className="text-blue-600 animate-spin" />
                    <span className="font-mono text-lg font-extrabold text-blue-700">
                      {elapsedTimer}
                    </span>
                  </div>
                </div>

                {/* Technical Notes & Materials Forms */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Observações Técnicas e Procedimentos Realizados
                    </label>
                    <textarea
                      rows={3}
                      value={observacoesTecnicas}
                      onChange={(e) => setObservacoesTecnicas(e.target.value)}
                      placeholder="Descreva as ações técnicas executadas, pontos inspecionados, ajustes efetuados e observações relevantes..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Peças / Materiais / Insumos Utilizados (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={materiaisUtilizados}
                      onChange={(e) => setMateriaisUtilizados(e.target.value)}
                      placeholder="Ex: 2x Lâmpadas LED Tubular 18W, 1x Disjuntor Bipolar 20A, Fita isolante 3M..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleFinalizarTrabalhoFisico}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <Camera size={18} /> Concluir Trabalho & Anexar Fotos Finais <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: FOTOS FINAIS (DEPOIS) COM CARIMBO TIMEMARK REAL */}
            {activeOrder.etapaExecucao === "fotos_depois" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                    <Camera size={18} />
                    Etapa Obrigatória: Fotografias Finais (Serviço Concluído)
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Anexe as <strong>4 fotos comprobatórias</strong> do serviço pronto e limpo. Elas também recebem o carimbo indelével <strong>Timemark Foto 100% Real</strong> com data, horário e nome do condomínio.
                  </p>
                </div>

                <PhotoUploadStep
                  fase="depois"
                  photos={localFotosDepois}
                  onChangePhotos={setLocalFotosDepois}
                  onAutoSave={(photos) => {
                    if (activeOrder) {
                      updateOrderInDb(activeOrder.id, { fotosDepois: photos }, null, true);
                    }
                  }}
                  orderId={activeOrder.id}
                  nomeCondominio={activeOrder.nomeCondominio || activeOrder.clienteNome || "Condomínio Residencial"}
                  enderecoCompleto={activeOrder.enderecoCondominio || ""}
                  title="Fotos Finais (Depois da Execução)"
                  description="Comprovam a entrega do serviço com qualidade e o término das atividades no local."
                />

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    {localFotosDepois.length}/4 fotos finais capturadas
                  </span>

                  <button
                    type="button"
                    onClick={handleConfirmarFotosDepois}
                    disabled={localFotosDepois.length < 4 || isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldCheck size={18} /> Confirmar Fotos & Coletar Assinatura
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: AGUARDANDO ASSINATURA */}
            {activeOrder.etapaExecucao === "aguardando_assinatura" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                      <ShieldCheck size={18} />
                      Etapa Final: Coleta de Assinatura Digital do Responsável
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Passe o dispositivo para o síndico ou encarregado assinar diretamente no quadro abaixo utilizando o dedo ou caneta stylus.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all self-start sm:self-auto"
                  >
                    <PenTool size={13} />
                    Modo Tela Cheia
                  </button>
                </div>

                <SignatureCanvasField
                  initialNome={activeOrder.nomeResponsavelLocal || activeOrder.clienteNome || ""}
                  initialTelefone={activeOrder.telefoneContato || ""}
                  initialEmail={activeOrder.clienteEmail || ""}
                  condominioNome={activeOrder.nomeCondominio || activeOrder.clienteNome || "Condomínio"}
                  servicoNome={activeOrder.servicoNome || "Serviço Condominial"}
                  numeroOS={activeOrder.numeroOS || `OS #${activeOrder.id.slice(0, 8)}`}
                  isSubmitting={isSubmitting}
                  onConfirmSignature={handleSalvarAssinatura}
                  onCancel={() => {
                    updateOrderInDb(activeOrder.id, {
                      etapaExecucao: "fotos_depois",
                      status: "Trabalho Concluído - Vistoria Final",
                    });
                  }}
                  inline={true}
                />
              </div>
            )}

            {/* STEP 7: CONCLUÍDO (VER RELATÓRIO) */}
            {activeOrder.etapaExecucao === "concluido" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">Ordem de Serviço Concluída!</h3>
                  <p className="text-xs text-slate-500">
                    Finalizada com sucesso em {formatDateTimeBR(activeOrder.concluidoEm)}. O relatório técnico com as fotos carimbadas e a assinatura já está disponível.
                  </p>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => handleDirectDownloadPdf(activeOrder, e)}
                    disabled={downloadingPdfId === activeOrder.id}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
                  >
                    {downloadingPdfId === activeOrder.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileDown size={16} />
                    )}
                    <span>{downloadingPdfId === activeOrder.id ? "Gerando PDF..." : "Baixar Relatório PDF"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedOrderForReport(activeOrder)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
                  >
                    <FileText size={16} /> Ver / Emitir Relatório Completo
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveOrder(null)}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200"
                  >
                    Voltar para Fila de Ordens
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ORDERS LIST / OVERVIEW VIEW */
          <div className="space-y-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total de Ordens
                </span>
                <span className="text-2xl font-black text-slate-900">{kpiCounts.total}</span>
              </div>

              <div className="bg-white border border-blue-200 rounded-2xl p-4 space-y-1 shadow-sm">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                  Aguardando / Novas
                </span>
                <span className="text-2xl font-black text-blue-600">{kpiCounts.novas}</span>
              </div>

              <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-1 shadow-sm">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                  Em Andamento
                </span>
                <span className="text-2xl font-black text-amber-600">{kpiCounts.emAndamento}</span>
              </div>

              <div className="bg-white border border-emerald-200 rounded-2xl p-4 space-y-1 shadow-sm">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                  Concluídas
                </span>
                <span className="text-2xl font-black text-emerald-600">{kpiCounts.concluidas}</span>
              </div>
            </div>

            {/* In Progress Active Order Highlighting Card */}
            {inProgressOrder && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-blue-700 text-[10px] font-extrabold uppercase shadow-xs">
                      Em Execução Agora
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-100">
                      {inProgressOrder.numeroOS || `OS #${inProgressOrder.id.slice(0, 8)}`}
                    </span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${getExecutionStepInfo(inProgressOrder.etapaExecucao).badgeBg} ${getExecutionStepInfo(inProgressOrder.etapaExecucao).badgeText}`}>
                    {getExecutionStepInfo(inProgressOrder.etapaExecucao).label}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-extrabold text-white">
                    {inProgressOrder.nomeCondominio || inProgressOrder.clienteNome}
                  </h3>
                  <p className="text-xs text-blue-100">
                    {inProgressOrder.servicoNome} • {inProgressOrder.enderecoCondominio}
                  </p>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenOrder(inProgressOrder)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition-all"
                  >
                    Continuar Execução Deste Serviço <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Filter Tabs & Search Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: "todas", label: `Todas (${kpiCounts.total})` },
                    { id: "hoje", label: `Hoje (${kpiCounts.hoje})`, highlight: kpiCounts.hoje > 0 },
                    { id: "pendencias_anteriores", label: `Pendências Anteriores (${kpiCounts.pendenciasAnteriores})`, alert: kpiCounts.pendenciasAnteriores > 0 },
                    { id: "novas", label: `Aguardando Data (${kpiCounts.novas})` },
                    { id: "deslocamento", label: "A Caminho" },
                    { id: "execucao", label: `Em Execução (${kpiCounts.emAndamento})` },
                    { id: "concluidas", label: `Concluídas (${kpiCounts.concluidas})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                        filterTab === tab.id
                          ? "bg-blue-600 text-white shadow-xs"
                          : (tab as any).alert
                          ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                          : (tab as any).highlight
                          ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                          : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar condomínio, OS..."
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 rounded-xl pl-9 pr-3 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Orders List Items */}
              {loading ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                  Carregando ordens de serviço...
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={36} className="text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-600 text-sm">Nenhuma ordem de serviço nesta categoria.</p>
                  <p className="text-xs text-slate-400">As novas solicitações atribuídas a você aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredOrders.map((order, idx) => {
                    const isOrderInProgress = inProgressOrder?.id === order.id;
                    const isCompleted = order.etapaExecucao === "concluido" || order.status === "Serviço Concluído";
                    const isLocked = inProgressOrder && inProgressOrder.id !== order.id && !isCompleted;

                    const eff = getEffectiveOSStatus(order);
                    const visual = getOSStatusVisualInfo(eff);
                    const isTimelineExpanded = expandedTimelineId === order.id;

                    return (
                      <div
                        key={order.id}
                        className={`p-4 sm:p-5 transition-colors flex flex-col gap-3 ${
                          isOrderInProgress
                            ? "bg-blue-50/70 border-l-4 border-blue-600"
                            : isLocked
                            ? "opacity-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {order.numeroOS || `OS #${order.id.slice(0, 8)}`}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${visual.badgeBg} ${visual.badgeText}`}
                              >
                                {eff}
                              </span>
                              {order.prioridade === "Urgente" && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  Urgente
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-slate-900 text-base">
                              {order.nomeCondominio || order.clienteNome || "Condomínio"}
                            </h4>

                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Wrench size={13} className="text-slate-400" />
                              {order.servicoNome || "Serviço Rotineiro"} • {order.enderecoCondominio || "Endereço cadastrado"}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                              <span>Agendado: {formatDateBR(order.dataAgendada || (order.createdAt as string))}</span>
                              {order.turnoAgendado && <span>Turno: {order.turnoAgendado}</span>}
                              {(order.fotosAntes?.length || 0) > 0 && (
                                <span className="text-blue-600 font-medium">
                                  📷 {order.fotosAntes?.length} fotos antes
                                </span>
                              )}
                              {(order.fotosDepois?.length || 0) > 0 && (
                                <span className="text-emerald-600 font-medium">
                                  ✓ {order.fotosDepois?.length} fotos depois
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForDateModal(order);
                                  setModalTargetDate(
                                    (order.dataConfirmada || order.dataAgendada || "").substring(0, 10) ||
                                      new Date().toISOString().substring(0, 10)
                                  );
                                  setModalTargetTurno(order.turnoAgendado || "Manhã");
                                  setModalObservations(order.observacoesAgendamento || "");
                                }}
                                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-amber-200"
                                title="Ajustar ou Confirmar Data no Calendário"
                              >
                                <CalendarDays size={14} className="text-amber-600" />
                                <span>Ajustar Data</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setExpandedTimelineId(isTimelineExpanded ? null : order.id)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-200"
                              title="Ver Linha do Tempo e Histórico"
                            >
                              <Clock size={14} className="text-blue-600" />
                              <span>{isTimelineExpanded ? "Ocultar Histórico" : "Histórico"}</span>
                            </button>

                            {isCompleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleDirectDownloadPdf(order, e)}
                                  disabled={downloadingPdfId === order.id}
                                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                                  title="Baixar Relatório em PDF"
                                >
                                  {downloadingPdfId === order.id ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <FileDown size={14} />
                                  )}
                                  <span className="hidden sm:inline">
                                    {downloadingPdfId === order.id ? "Gerando..." : "Baixar PDF"}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForReport(order)}
                                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-200"
                                >
                                  <FileText size={14} /> Ver Relatório
                                </button>
                              </>
                            )}

                            {isLocked ? (
                              <div className="flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-400 text-xs rounded-xl border border-slate-200">
                                <Lock size={12} /> Em espera
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenOrder(order)}
                                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all ${
                                  isCompleted
                                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                                    : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                {isCompleted ? "Revisar O.S." : "Executar Serviço"}{" "}
                                <ChevronRight size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Timeline */}
                        {isTimelineExpanded && (
                          <div className="pt-2 border-t border-slate-100">
                            <ServiceTrackingTimeline order={order} defaultExpanded={true} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Signature Pad Modal */}
      <SignaturePadModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onConfirmSignature={handleSalvarAssinatura}
        condominioNome={activeOrder?.nomeCondominio || activeOrder?.clienteNome}
        servicoNome={activeOrder?.servicoNome}
        numeroOS={activeOrder?.numeroOS || `OS #${activeOrder?.id.slice(0, 8)}`}
        isSubmitting={isSubmitting}
      />

      {/* Technical Report View & Print/Share Modal */}
      {selectedOrderForReport && (
        <ServiceReportModal
          isOpen={!!selectedOrderForReport}
          onClose={() => setSelectedOrderForReport(null)}
          order={selectedOrderForReport}
        />
      )}

      {/* Completion Success Modal */}
      {showSuccessCompletionModal && activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900">Serviço Concluído com Sucesso!</h3>
              <p className="text-xs text-slate-500">
                A data e o horário de encerramento ({formatDateTimeBR(activeOrder.concluidoEm)}) foram gravados e o relatório com as fotos carimbadas foi gerado.
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={async (e) => {
                  await handleDirectDownloadPdf(activeOrder, e);
                }}
                disabled={downloadingPdfId === activeOrder.id}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                {downloadingPdfId === activeOrder.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileDown size={16} />
                )}
                <span>{downloadingPdfId === activeOrder.id ? "Gerando Relatório PDF..." : "Baixar Relatório em PDF"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessCompletionModal(false);
                  setSelectedOrderForReport(activeOrder);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={16} /> Visualizar / Enviar Relatório ao Cliente
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSuccessCompletionModal(false);
                  setActiveOrder(null);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200"
              >
                Voltar ao Painel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Date Confirmation & Adjustment Modal */}
      {selectedOrderForDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <CalendarDays size={20} className="text-blue-600" />
                <span>Ajustar / Confirmar Data no Calendário</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForDateModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-xs font-mono font-bold text-blue-700">
                {selectedOrderForDateModal.numeroOS || `OS #${selectedOrderForDateModal.id.slice(0, 8)}`}
              </span>
              <h4 className="font-bold text-slate-900 text-sm">
                {selectedOrderForDateModal.nomeCondominio || selectedOrderForDateModal.clienteNome}
              </h4>
              <p className="text-xs text-slate-500">
                {selectedOrderForDateModal.servicoNome} • Status atual: {getEffectiveOSStatus(selectedOrderForDateModal)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data de Execução Agendada
                </label>
                <input
                  type="date"
                  value={modalTargetDate}
                  onChange={(e) => setModalTargetDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setModalTargetDate(new Date().toISOString().substring(0, 10))}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md transition-colors"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      setModalTargetDate(d.toISOString().substring(0, 10));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-md transition-colors"
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setModalTargetDate(d.toISOString().substring(0, 10));
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-md transition-colors"
                  >
                    +7 dias
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Turno
                </label>
                <select
                  value={modalTargetTurno}
                  onChange={(e) => setModalTargetTurno(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Manhã">Manhã (08h às 12h)</option>
                  <option value="Tarde">Tarde (13h às 17h)</option>
                  <option value="Noite">Noite (18h às 22h)</option>
                  <option value="Integral">Horário Comercial / Integral</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações do Agendamento (opcional)
                </label>
                <input
                  type="text"
                  value={modalObservations}
                  onChange={(e) => setModalObservations(e.target.value)}
                  placeholder="Ex: Confirmado com o síndico por telefone..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedOrderForDateModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  handleConfirmarOuAjustarData(
                    selectedOrderForDateModal.id,
                    modalTargetDate,
                    modalTargetTurno,
                    modalObservations
                  )
                }
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 transition-all"
              >
                <Check size={14} /> Salvar & Confirmar Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
