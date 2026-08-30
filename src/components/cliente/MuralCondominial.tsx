import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { 
  MessageSquarePlus, 
  Megaphone, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  X, 
  HelpCircle, 
  MessageCircle, 
  Send, 
  Building2, 
  User, 
  Sparkles,
  Share2,
  Edit3,
  CheckCircle2
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { isAdminRole } from "../../lib/permissions";

export interface Notice {
  id: string;
  condominio: string;
  bairro: string;
  tipo?: "comunicado" | "duvida";
  titulo: string;
  texto: string;
  status: "em_revisao" | "publicado" | "rejeitado";
  createdAt: any;
  updatedAt?: any;
  userId?: string;
  respostasCount?: number;
}

export interface NoticeAnswer {
  id: string;
  noticeId: string;
  userId: string;
  autorNome: string;
  condominio: string;
  bairro: string;
  texto: string;
  createdAt: any;
}

function formatNoticeDate(timestamp: any): string {
  if (!timestamp) return "";
  let date: Date;
  if (typeof timestamp?.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp?.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year}   ${hours}:${minutes}`;
}

export default function MuralCondominial() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "comunicado" | "duvida" | "meus">("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalType, setInitialModalType] = useState<"comunicado" | "duvida">("comunicado");
  const [loading, setLoading] = useState(true);
  
  // Notice creation form state
  const [formData, setFormData] = useState({
    tipo: "comunicado" as "comunicado" | "duvida",
    titulo: "",
    texto: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Edit notice state
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    tipo: "comunicado" as "comunicado" | "duvida",
    titulo: "",
    texto: ""
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Selected Notice for viewing answers / replying
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [answers, setAnswers] = useState<NoticeAnswer[]>([]);
  const [answersCounts, setAnswersCounts] = useState<Record<string, number>>({});
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [newAnswerText, setNewAnswerText] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);

  // Check if current user is author of notice or an administrator
  const canEditNotice = (notice?: Notice | null): boolean => {
    if (!notice || !profile) return false;
    const isAdmin = isAdminRole(profile.role) || profile.email === "wegbusinessandsolutions@gmail.com";
    const isAuthor = !!notice.userId && (notice.userId === profile.uid || notice.userId === (profile as any).id);
    return isAdmin || isAuthor;
  };

  useEffect(() => {
    // Fetch published notices
    const qPub = query(
      collection(db, "muralNotices"),
      where("status", "==", "publicado"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePub = onSnapshot(qPub, (snapshot) => {
      const pubNotices: Notice[] = [];
      snapshot.forEach((docSnap) => {
        pubNotices.push({ id: docSnap.id, ...docSnap.data() } as Notice);
      });

      // If user is logged in, also fetch user's own notices (including em_revisao/rejeitado)
      if (profile?.uid) {
        const qMine = query(
          collection(db, "muralNotices"),
          where("userId", "==", profile.uid)
        );
        onSnapshot(qMine, (mySnap) => {
          const myNotices: Notice[] = [];
          mySnap.forEach((d) => {
            myNotices.push({ id: d.id, ...d.data() } as Notice);
          });

          const map = new Map<string, Notice>();
          pubNotices.forEach(n => map.set(n.id, n));
          myNotices.forEach(n => map.set(n.id, n));

          const allList = Array.from(map.values()).sort((a, b) => {
            const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
          });
          setNotices(allList);
          setLoading(false);
        }, (err) => {
          console.warn("Error fetching user notices:", err);
          setNotices(pubNotices);
          setLoading(false);
        });
      } else {
        setNotices(pubNotices);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching notices:", error);
      setLoading(false);
    });

    return () => unsubscribePub();
  }, [profile?.uid]);

  // Listen to answers counts for published notices
  useEffect(() => {
    if (notices.length === 0) return;

    const unsubs: (() => void)[] = [];

    notices.forEach((notice) => {
      const answersQuery = query(
        collection(db, "muralNotices", notice.id, "respostas")
      );
      const unsub = onSnapshot(answersQuery, (snap) => {
        setAnswersCounts((prev) => ({
          ...prev,
          [notice.id]: snap.size
        }));
      }, (err) => {
        console.warn("Error listening to answers count for notice:", notice.id, err);
      });
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [notices]);

  // Listen to real-time answers when a notice is selected
  useEffect(() => {
    if (!selectedNotice) {
      setAnswers([]);
      setNewAnswerText("");
      return;
    }

    setLoadingAnswers(true);
    const q = query(
      collection(db, "muralNotices", selectedNotice.id, "respostas"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: NoticeAnswer[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as NoticeAnswer);
      });
      setAnswers(list);
      setLoadingAnswers(false);
    }, (error) => {
      console.error("Error fetching answers:", error);
      setLoadingAnswers(false);
    });

    return () => unsubscribe();
  }, [selectedNotice?.id]);

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const noticeType = notice.tipo || "comunicado";
      if (filterType === "meus") {
        if (!profile?.uid || notice.userId !== profile.uid) {
          return false;
        }
      } else if (filterType !== "todos" && noticeType !== filterType) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const tituloMatch = notice.titulo?.toLowerCase().includes(term);
      const textoMatch = notice.texto?.toLowerCase().includes(term);
      const condMatch = notice.condominio?.toLowerCase().includes(term);
      const bairroMatch = notice.bairro?.toLowerCase().includes(term);
      const typeMatch = noticeType === "duvida" 
        ? "dúvida duvida pergunta questao".includes(term)
        : "comunicado informativo aviso".includes(term);
      return tituloMatch || textoMatch || condMatch || bairroMatch || typeMatch;
    });
  }, [notices, searchTerm, filterType, profile?.uid]);

  const countsByType = useMemo(() => {
    const total = notices.length;
    const comunicados = notices.filter(n => (n.tipo || "comunicado") === "comunicado").length;
    const duvidas = notices.filter(n => n.tipo === "duvida").length;
    const meus = profile?.uid ? notices.filter(n => n.userId === profile.uid).length : 0;
    return { total, comunicados, duvidas, meus };
  }, [notices, profile?.uid]);

  const handleOpenModal = (tipo: "comunicado" | "duvida" = "comunicado") => {
    setFormData({
      tipo,
      titulo: "",
      texto: ""
    });
    setInitialModalType(tipo);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (notice: Notice) => {
    if (!canEditNotice(notice)) {
      addToast("Apenas o autor do comunicado e o administrador podem alterá-lo.", "error");
      return;
    }
    setEditingNotice(notice);
    setEditFormData({
      tipo: notice.tipo || "comunicado",
      titulo: notice.titulo || "",
      texto: notice.texto || ""
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotice) return;
    
    if (!canEditNotice(editingNotice)) {
      addToast("Você não tem permissão para alterar este comunicado.", "error");
      return;
    }

    if (!editFormData.titulo.trim() || !editFormData.texto.trim()) {
      addToast("Preencha todos os campos.", "error");
      return;
    }

    if (editFormData.titulo.length > 200) {
      addToast("O título deve ter no máximo 200 caracteres.", "error");
      return;
    }

    if (editFormData.texto.length > 800) {
      addToast("O texto deve ter no máximo 800 caracteres.", "error");
      return;
    }

    setSubmittingEdit(true);
    try {
      const noticeRef = doc(db, "muralNotices", editingNotice.id);
      await updateDoc(noticeRef, {
        tipo: editFormData.tipo || "comunicado",
        titulo: editFormData.titulo.trim(),
        texto: editFormData.texto.trim(),
        updatedAt: serverTimestamp()
      });

      addToast("Comunicado alterado com sucesso!", "success");
      setIsEditModalOpen(false);

      if (selectedNotice && selectedNotice.id === editingNotice.id) {
        setSelectedNotice((prev) => prev ? {
          ...prev,
          tipo: editFormData.tipo,
          titulo: editFormData.titulo.trim(),
          texto: editFormData.texto.trim()
        } : null);
      }
      setEditingNotice(null);
    } catch (error) {
      console.error("Error updating notice: ", error);
      addToast("Erro ao alterar comunicado. Tente novamente.", "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleSubmitNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const condominio = profile?.displayName || "";
    const bairro = profile?.bairro || "";

    if (!condominio || !bairro || !formData.titulo || !formData.texto) {
      addToast("Preencha todos os campos.", "error");
      return;
    }
    
    if (formData.titulo.length > 200) {
      addToast("O título deve ter no máximo 200 caracteres.", "error");
      return;
    }
    
    if (formData.texto.length > 800) {
      addToast("O texto deve ter no máximo 800 caracteres.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "muralNotices"), {
        userId: profile?.uid || "",
        condominio,
        bairro,
        tipo: formData.tipo || "comunicado",
        titulo: formData.titulo.trim(),
        texto: formData.texto.trim(),
        status: "em_revisao",
        createdAt: serverTimestamp()
      });
      
      const successMsg = formData.tipo === "duvida"
        ? "Dúvida enviada! Ela estará disponível no mural após a revisão da nossa equipe administrativa."
        : "Comunicado enviado! Ele estará disponível após revisão da nossa equipe administrativa.";
      
      addToast(successMsg, "success");
      setIsModalOpen(false);
      setFormData({
        tipo: "comunicado",
        titulo: "",
        texto: ""
      });
    } catch (error) {
      console.error("Error adding document: ", error);
      addToast("Erro ao enviar. Tente novamente.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNotice) return;
    if (!newAnswerText.trim()) {
      addToast("Digite uma resposta antes de enviar.", "error");
      return;
    }

    const condominio = profile?.displayName || "Síndico Afiliado";
    const bairro = profile?.bairro || "";
    const autorNome = profile?.nomeCompleto || profile?.displayName || "Síndico Afiliado";

    setSubmittingAnswer(true);
    try {
      await addDoc(collection(db, "muralNotices", selectedNotice.id, "respostas"), {
        noticeId: selectedNotice.id,
        userId: profile?.uid || "",
        autorNome,
        condominio,
        bairro,
        texto: newAnswerText.trim(),
        createdAt: serverTimestamp()
      });

      setNewAnswerText("");
      addToast("Sua resposta foi enviada com sucesso!", "success");
    } catch (error) {
      console.error("Error sending answer:", error);
      addToast("Erro ao enviar a resposta. Tente novamente.", "error");
    } finally {
      setSubmittingAnswer(false);
    }
  };

  return (
    <div id="mural" className="bg-white rounded-3xl p-6 sm:p-8 shadow-md relative">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-normal text-slate-900 flex items-center gap-2">
            <Megaphone className="text-brand-dark w-6 h-6 shrink-0" />
            <span>Informativo Condomínios - Goiânia</span>
          </h2>
          <p className="text-slate-600 text-sm mt-2 leading-relaxed font-normal">
            Espaço colaborativo exclusivo para Afiliados da União Condominial.<span className="text-emerald-600 font-medium">GO</span>. Compartilhe comunicados, recomendações ou publique suas <span className="text-slate-800 font-medium">dúvidas</span> para que outros síndicos e gestores possam responder e contribuir.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleOpenModal("duvida")}
            className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-medium py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <HelpCircle size={17} />
            <span>Tirar Dúvida / Perguntar</span>
          </button>
          <button
            onClick={() => handleOpenModal("comunicado")}
            className="flex-1 sm:flex-none bg-brand-dark hover:bg-brand-dark/90 active:scale-95 text-white font-medium py-2.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <MessageSquarePlus size={17} />
            <span>Incluir Comunicado</span>
          </button>
        </div>
      </div>

      {/* Tabs / Filter by Type & Search Bar */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="inline-flex p-1.5 bg-slate-100/90 rounded-2xl gap-1 text-xs font-medium shadow-2xs">
            <button
              onClick={() => setFilterType("todos")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "todos"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Todos</span>
              <span className="px-2 py-0.5 bg-slate-200/80 rounded-full text-[11px]">
                {countsByType.total}
              </span>
            </button>
            <button
              onClick={() => setFilterType("duvida")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "duvida"
                  ? "bg-amber-500 text-white shadow-sm font-medium"
                  : "text-slate-600 hover:text-amber-700"
              }`}
            >
              <HelpCircle size={14} />
              <span>Dúvidas & Perguntas</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                filterType === "duvida" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800"
              }`}>
                {countsByType.duvidas}
              </span>
            </button>
            <button
              onClick={() => setFilterType("comunicado")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === "comunicado"
                  ? "bg-brand-dark text-white shadow-sm font-medium"
                  : "text-slate-600 hover:text-brand-dark"
              }`}
            >
              <Megaphone size={14} />
              <span>Comunicados</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                filterType === "comunicado" ? "bg-brand-dark/80 text-white" : "bg-slate-200/80 text-slate-700"
              }`}>
                {countsByType.comunicados}
              </span>
            </button>
            {profile?.uid && (
              <button
                onClick={() => setFilterType("meus")}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterType === "meus"
                    ? "bg-emerald-600 text-white shadow-sm font-medium"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                <User size={14} />
                <span>Minhas Publicações</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                  filterType === "meus" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {countsByType.meus}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, conteúdo, condomínio, setor ou tipo..."
            className="w-full pl-11 pr-10 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-2xl text-sm text-slate-800 placeholder-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-brand-dark/20 shadow-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              title="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {searchTerm && (
          <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-normal">
            <span>
              {filteredNotices.length === 1
                ? "1 item encontrado"
                : `${filteredNotices.length} itens encontrados`}
            </span>
            <button
              onClick={() => setSearchTerm("")}
              className="text-brand-dark hover:underline font-medium"
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>

      {/* Main Board Grid */}
      <div className="bg-slate-50/70 rounded-3xl p-6 sm:p-8 shadow-inner min-h-[300px]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="h-56 bg-white/80 rounded-2xl animate-pulse shadow-sm"></div>
            <div className="h-56 bg-white/80 rounded-2xl animate-pulse shadow-sm"></div>
            <div className="h-56 bg-white/80 rounded-2xl animate-pulse shadow-sm"></div>
          </div>
        ) : filteredNotices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4">
            {filteredNotices.map((notice, index) => {
              const isDuvida = notice.tipo === "duvida";
              const answersCount = answersCounts[notice.id] || 0;
              const hasEditPermission = canEditNotice(notice);

              return (
                <div 
                  key={notice.id} 
                  className={`bg-white p-6 rounded-2xl shadow-md relative flex flex-col justify-between transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:z-10 ${
                    index % 3 === 0 ? '-rotate-1' : index % 3 === 1 ? 'rotate-1' : 'rotate-0'
                  }`}
                >
                  {/* Percevejo (Pin) */}
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-md z-10 flex items-center justify-center ${
                    isDuvida 
                      ? "bg-gradient-to-br from-amber-400 to-amber-600" 
                      : "bg-gradient-to-br from-[#0071e3] to-brand-dark"
                  }`}>
                    <div className="absolute top-[3px] left-[3px] w-1.5 h-1.5 rounded-full bg-white/70"></div>
                  </div>
                  
                  <div>
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-3 mt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-lg uppercase tracking-wider line-clamp-1 shadow-2xs" title={notice.condominio}>
                          {notice.condominio}
                        </span>
                        {notice.status === "em_revisao" && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                            <Clock size={11} />
                            <span>Em Revisão</span>
                          </span>
                        )}
                        {notice.status === "rejeitado" && (
                          <span className="bg-red-100 text-red-800 text-[11px] font-medium px-2 py-0.5 rounded-lg shadow-2xs">
                            Rejeitado
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {isDuvida ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs">
                            <HelpCircle size={13} className="text-amber-600" />
                            <span>Dúvida</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs">
                            <Megaphone size={13} className="text-blue-600" />
                            <span>Comunicado</span>
                          </span>
                        )}

                        {/* Edit Button - Visible ONLY to the creator of the notice and administrators */}
                        {hasEditPermission && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(notice);
                            }}
                            title="Alterar este comunicado"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            <Edit3 size={12} className="text-amber-700" />
                            <span>Alterar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-medium text-slate-900 text-lg sm:text-xl mb-2 leading-snug">
                      {notice.titulo}
                    </h3>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed line-clamp-6 font-normal">
                      {notice.texto}
                    </p>
                  </div>
                  
                  {/* Bottom Footer & Interaction */}
                  <div className="mt-5 pt-3 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px] font-medium font-mono">
                        {formatNoticeDate(notice.createdAt)}
                        {notice.updatedAt && (
                          <span className="ml-1 text-[10px] text-amber-600 font-normal italic">(editado)</span>
                        )}
                      </span>
                      <span className="text-slate-400 text-[11px] font-medium italic">
                        {notice.bairro}
                      </span>
                    </div>

                    {/* Action to View Answers & Reply */}
                    <button
                      type="button"
                      onClick={() => setSelectedNotice(notice)}
                      className={`w-full py-2.5 px-3.5 rounded-2xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md ${
                        isDuvida
                          ? "bg-amber-50/90 hover:bg-amber-100 text-amber-900"
                          : "bg-slate-100 hover:bg-slate-200/80 text-slate-700"
                      }`}
                    >
                      <MessageCircle size={15} className={isDuvida ? "text-amber-600" : "text-slate-500"} />
                      <span>
                        {answersCount === 0 
                          ? (isDuvida ? "Responder a esta dúvida" : "Comentar / Responder")
                          : `${answersCount} ${answersCount === 1 ? 'resposta' : 'respostas'} • Ver e responder`}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchTerm || filterType !== "todos" ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-white text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              <Search size={28} />
            </div>
            <h3 className="text-slate-800 font-medium text-lg mb-1">Nenhum resultado encontrado</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-4 font-normal">
              Não encontramos nenhuma publicação correspondente aos filtros aplicados.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => { setSearchTerm(""); setFilterType("todos"); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-dark text-white rounded-xl text-xs font-medium hover:bg-brand-dark/90 transition-all shadow-sm cursor-pointer"
              >
                <X size={14} />
                Limpar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-white text-brand-dark/60 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm shadow-md">
              <Megaphone size={32} />
            </div>
            <h3 className="text-slate-800 font-medium text-lg mb-2">Nenhuma publicação no momento</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto font-normal mb-5">
              Seja o primeiro a publicar um comunicado ou tirar uma dúvida com a comunidade de síndicos.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => handleOpenModal("duvida")}
                className="bg-amber-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-amber-600 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <HelpCircle size={15} />
                <span>Fazer uma Pergunta</span>
              </button>
              <button
                onClick={() => handleOpenModal("comunicado")}
                className="bg-brand-dark text-white text-xs font-medium px-4 py-2.5 rounded-xl hover:bg-brand-dark/90 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquarePlus size={15} />
                <span>Incluir Comunicado</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: NEW NOTICE / DOUBT CREATION */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-xl font-normal text-slate-800 flex items-center gap-2">
                {formData.tipo === "duvida" ? (
                  <>
                    <HelpCircle className="text-amber-600 w-6 h-6" />
                    <span>Publicar Dúvida / Pergunta para Síndicos</span>
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="text-brand-dark w-6 h-6" />
                    <span>Incluir Comunicado no Mural</span>
                  </>
                )}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 text-lg font-medium cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Type Selector (Comunicado vs Dúvida) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
                  Tipo da Publicação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tipo: "duvida" })}
                    className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                      formData.tipo === "duvida"
                        ? "bg-amber-50 shadow-md ring-2 ring-amber-500/30"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      formData.tipo === "duvida" ? "bg-amber-500 text-white" : "bg-white text-slate-500 shadow-2xs"
                    }`}>
                      <HelpCircle size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Dúvida / Pergunta</div>
                      <div className="text-xs text-slate-500 leading-tight mt-0.5 font-normal">
                        Para outros síndicos responderem e trocarem experiências.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tipo: "comunicado" })}
                    className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                      formData.tipo === "comunicado"
                        ? "bg-brand-light/10 shadow-md ring-2 ring-brand-dark/30"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      formData.tipo === "comunicado" ? "bg-brand-dark text-white" : "bg-white text-slate-500 shadow-2xs"
                    }`}>
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Comunicado</div>
                      <div className="text-xs text-slate-500 leading-tight mt-0.5 font-normal">
                        Informação geral, aviso ou recomendação de serviço.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Informative Alert */}
              <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed font-normal">
                  As publicações passam por uma breve revisão gramatical e ortográfica da equipe administrativa. Assim que aprovadas, ficarão visíveis para todos os síndicos afiliados.
                </p>
              </div>

              <form id="noticeForm" onSubmit={handleSubmitNotice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                      Nome do Condomínio
                    </label>
                    <input
                      type="text"
                      disabled
                      value={profile?.displayName || ""}
                      className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed text-xs font-normal shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                      Setor / Bairro
                    </label>
                    <input
                      type="text"
                      disabled
                      value={profile?.bairro || ""}
                      className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed text-xs font-normal shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex justify-between text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                    <span>{formData.tipo === "duvida" ? "Título da Dúvida" : "Título do Comunicado"}</span>
                    <span className={formData.titulo.length > 200 ? "text-red-500 font-normal" : "text-slate-400 font-normal"}>
                      {formData.titulo.length}/200
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={formData.titulo}
                    onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 text-sm shadow-xs font-normal"
                    placeholder={
                      formData.tipo === "duvida" 
                        ? "Ex: Recomendação de fornecedor para recarga de extintores" 
                        : "Ex: Nova melhoria implementada nas áreas comuns"
                    }
                  />
                </div>

                <div>
                  <label className="flex justify-between text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                    <span>{formData.tipo === "duvida" ? "Detalhes da Dúvida / Pergunta" : "Texto do Informativo"}</span>
                    <span className={formData.texto.length > 800 ? "text-red-500 font-normal" : "text-slate-400 font-normal"}>
                      {formData.texto.length}/800
                    </span>
                  </label>
                  <textarea
                    required
                    maxLength={800}
                    rows={5}
                    value={formData.texto}
                    onChange={(e) => setFormData({...formData, texto: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-dark/20 text-sm resize-none shadow-xs font-normal"
                    placeholder={
                      formData.tipo === "duvida"
                        ? "Descreva sua dúvida detalhadamente para que outros síndicos com experiência no assunto possam orientar e responder..."
                        : "Descreva a informação relevante, aquisição de bens ou prestação de serviço..."
                    }
                  />
                </div>
              </form>
            </div>
            
            {/* Modal Footer */}
            <div className="p-5 flex justify-end gap-3 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-2xl transition-colors cursor-pointer"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="noticeForm"
                disabled={submitting}
                className={`px-6 py-2.5 text-white text-sm font-medium rounded-2xl transition-all flex items-center gap-2 disabled:opacity-70 shadow-md cursor-pointer ${
                  formData.tipo === "duvida" 
                    ? "bg-amber-500 hover:bg-amber-600" 
                    : "bg-brand-dark hover:bg-brand-dark/90"
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Enviar para Revisão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW DETAILS & RESPOND TO QUESTION / NOTICE */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-6 flex justify-between items-center bg-slate-50/80">
              <div className="flex items-center gap-2.5 flex-wrap">
                {selectedNotice.tipo === "duvida" ? (
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-medium px-3.5 py-1.5 rounded-full shadow-2xs">
                    <HelpCircle size={15} className="text-amber-600" />
                    <span>Dúvida de Síndico</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 text-xs font-medium px-3.5 py-1.5 rounded-full shadow-2xs">
                    <Megaphone size={15} className="text-blue-600" />
                    <span>Comunicado</span>
                  </span>
                )}
                <span className="text-xs font-normal text-slate-500">
                  {answers.length} {answers.length === 1 ? "resposta" : "respostas"}
                </span>

                {canEditNotice(selectedNotice) && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(selectedNotice)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer ml-1"
                    title="Alterar este comunicado"
                  >
                    <Edit3 size={13} className="text-amber-700" />
                    <span>Alterar Comunicado</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedNotice(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-xl hover:bg-slate-200/60 font-medium text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Original Question/Notice Box */}
              <div className="bg-slate-50/90 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 bg-white px-3 py-1 rounded-xl shadow-xs">
                      {selectedNotice.condominio}
                    </span>
                    <span className="text-slate-500 font-normal">{selectedNotice.bairro}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {formatNoticeDate(selectedNotice.createdAt)}
                  </span>
                </div>

                <h3 className="text-xl font-medium text-slate-900 leading-snug">
                  {selectedNotice.titulo}
                </h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-normal">
                  {selectedNotice.texto}
                </p>
              </div>

              {/* Answers Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2">
                  <h4 className="text-base font-medium text-slate-800 flex items-center gap-2">
                    <MessageCircle size={18} className="text-brand-dark" />
                    <span>Respostas e Orientações dos Síndicos</span>
                  </h4>
                  <span className="text-xs text-slate-500 font-normal">
                    {answers.length} {answers.length === 1 ? "contribuição" : "contribuições"}
                  </span>
                </div>

                {loadingAnswers ? (
                  <div className="space-y-3 py-4">
                    <div className="h-20 bg-slate-100 rounded-2xl animate-pulse shadow-sm"></div>
                    <div className="h-20 bg-slate-100 rounded-2xl animate-pulse shadow-sm"></div>
                  </div>
                ) : answers.length > 0 ? (
                  <div className="space-y-3">
                    {answers.map((answer) => (
                      <div
                        key={answer.id}
                        className="bg-white rounded-3xl p-5 shadow-sm space-y-2 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand-light/20 text-brand-dark font-medium flex items-center justify-center text-xs shadow-2xs">
                              {answer.condominio ? answer.condominio.charAt(0).toUpperCase() : "S"}
                            </div>
                            <div>
                              <span className="font-medium text-slate-900 block leading-tight text-sm">
                                {answer.condominio || "Síndico Afiliado"}
                              </span>
                              {answer.bairro && (
                                <span className="text-[11px] text-slate-500 font-normal">{answer.bairro}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatNoticeDate(answer.createdAt)}
                          </span>
                        </div>

                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed pl-10 font-normal">
                          {answer.texto}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50/50 rounded-3xl p-6 shadow-2xs">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-2xs">
                      <HelpCircle size={24} />
                    </div>
                    <h5 className="font-medium text-slate-800 text-sm">Nenhuma resposta ainda</h5>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-normal">
                      Seja o primeiro síndico a responder e compartilhar sua experiência com o colega!
                    </p>
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <div className="bg-slate-50/80 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-normal text-slate-700 flex items-center gap-1.5">
                    <Send size={14} className="text-brand-dark" />
                    <span>Responder como:</span> <span className="font-medium text-slate-900">{profile?.displayName || "Síndico Afiliado"}</span>
                  </span>
                  <span className={newAnswerText.length > 800 ? "text-red-500 font-normal" : "text-slate-400 font-normal"}>
                    {newAnswerText.length}/800
                  </span>
                </div>

                <form onSubmit={handleSendAnswer} className="space-y-3">
                  <textarea
                    required
                    maxLength={800}
                    rows={3}
                    value={newAnswerText}
                    onChange={(e) => setNewAnswerText(e.target.value)}
                    placeholder="Escreva sua resposta, conselho, indicação de fornecedor ou esclarecimento..."
                    className="w-full p-3.5 bg-white rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 resize-none shadow-xs font-normal"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingAnswer || !newAnswerText.trim()}
                      className="bg-brand-dark hover:bg-brand-dark/90 active:scale-95 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {submittingAnswer ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          <span>Enviando resposta...</span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Publicar Resposta</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-slate-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-5 py-2.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer shadow-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT NOTICE (Only available to creator and admin) */}
      {isEditModalOpen && editingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-6 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-xl font-normal text-slate-800 flex items-center gap-2">
                <Edit3 className="text-amber-600 w-6 h-6" />
                <span>Alterar Publicação no Mural</span>
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingNotice(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 text-lg font-medium cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Type Selector (Comunicado vs Dúvida) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-2">
                  Tipo da Publicação
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, tipo: "duvida" })}
                    className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                      editFormData.tipo === "duvida"
                        ? "bg-amber-50 shadow-md ring-2 ring-amber-500/30"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      editFormData.tipo === "duvida" ? "bg-amber-500 text-white" : "bg-white text-slate-500 shadow-2xs"
                    }`}>
                      <HelpCircle size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Dúvida / Pergunta</div>
                      <div className="text-xs text-slate-500 leading-tight mt-0.5 font-normal">
                        Para outros síndicos responderem e trocarem experiências.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, tipo: "comunicado" })}
                    className={`p-4 rounded-2xl text-left transition-all cursor-pointer flex items-start gap-3 shadow-xs ${
                      editFormData.tipo === "comunicado"
                        ? "bg-brand-light/10 shadow-md ring-2 ring-brand-dark/30"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      editFormData.tipo === "comunicado" ? "bg-brand-dark text-white" : "bg-white text-slate-500 shadow-2xs"
                    }`}>
                      <Megaphone size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">Comunicado</div>
                      <div className="text-xs text-slate-500 leading-tight mt-0.5 font-normal">
                        Informação geral, aviso ou recomendação de serviço.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <form id="editNoticeForm" onSubmit={handleUpdateNotice} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                      Condomínio
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingNotice.condominio || ""}
                      className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed text-xs font-normal shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                      Setor / Bairro
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingNotice.bairro || ""}
                      className="w-full px-3.5 py-2.5 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed text-xs font-normal shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex justify-between text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                    <span>{editFormData.tipo === "duvida" ? "Título da Dúvida" : "Título do Comunicado"}</span>
                    <span className={editFormData.titulo.length > 200 ? "text-red-500 font-normal" : "text-slate-400 font-normal"}>
                      {editFormData.titulo.length}/200
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={editFormData.titulo}
                    onChange={(e) => setEditFormData({...editFormData, titulo: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm shadow-xs font-normal"
                    placeholder="Título da publicação"
                  />
                </div>

                <div>
                  <label className="flex justify-between text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                    <span>{editFormData.tipo === "duvida" ? "Detalhes da Dúvida / Pergunta" : "Texto do Informativo"}</span>
                    <span className={editFormData.texto.length > 800 ? "text-red-500 font-normal" : "text-slate-400 font-normal"}>
                      {editFormData.texto.length}/800
                    </span>
                  </label>
                  <textarea
                    required
                    maxLength={800}
                    rows={5}
                    value={editFormData.texto}
                    onChange={(e) => setEditFormData({...editFormData, texto: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-sm resize-none shadow-xs font-normal"
                    placeholder="Descreva as alterações no conteúdo..."
                  />
                </div>
              </form>
            </div>
            
            {/* Modal Footer */}
            <div className="p-5 flex justify-end gap-3 bg-slate-50/70">
              <button
                type="button"
                onClick={() => { setIsEditModalOpen(false); setEditingNotice(null); }}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-2xl transition-colors cursor-pointer"
                disabled={submittingEdit}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="editNoticeForm"
                disabled={submittingEdit}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-2xl transition-all flex items-center gap-2 disabled:opacity-70 shadow-md cursor-pointer"
              >
                {submittingEdit ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    <span>Salvar Alterações</span>
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

