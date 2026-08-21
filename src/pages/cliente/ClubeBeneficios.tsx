import React, { useEffect, useState } from "react";
import { Heart, MapPin, Phone, Mail, Globe, QrCode, ExternalLink, Tag, ShieldCheck, Sparkles, Printer, CreditCard } from "lucide-react";
import { collection, getDocs, doc, updateDoc, increment, query, limit } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import OptimizedImage from "../../components/ui/OptimizedImage";
import { exportBeneficiosPdf } from "../../lib/pdfExport";
import { useAuth } from "../../context/AuthContext";

interface Beneficio {
  id: string;
  nome?: string;
  descricao?: string;
  regras?: string;
  imagem?: string;
  tipo?: string;
  valor?: number | string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  website?: string;
  qrcode?: string;
  status?: string;
  clicks?: number;
}

export default function ClubeBeneficios() {
  const { user, profile } = useAuth();
  const [beneficios, setBeneficios] = useState<Beneficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [empresaNome, setEmpresaNome] = useState<string>("");

  const userName = profile?.displayName || user?.displayName || (user?.email ? user.email.split("@")[0].toUpperCase() : "CONDÔMINO TITULAR");
  const userCpf = profile?.cpf || profile?.documento || profile?.cpfCnpj || "";
  const condominioName = profile?.nome || profile?.razaoSocial || profile?.displayName || user?.displayName || profile?.condominio || profile?.empresa || empresaNome || "CONDOMÍNIO";
  const condominioCnpj = profile?.cnpj || profile?.cpfCnpj || profile?.cpf || "";
  const cardSuffix = user?.uid ? `${user.uid.slice(0, 4).toUpperCase()} ${user.uid.slice(4, 8).toUpperCase()}` : "344D 4CA4";

  const handleRegisterClick = async (id: string) => {
    if (!id) return;
    try {
      const { db } = await initFirebase();
      const ref = doc(db, "clube_beneficios", id);
      await updateDoc(ref, {
        clicks: increment(1),
      });
      setBeneficios((prev) =>
        prev.map((b) => (b.id === id ? { ...b, clicks: (b.clicks || 0) + 1 } : b))
      );
    } catch (err) {
      console.error("Erro ao registrar clique do parceiro:", err);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { db } = await initFirebase();

        // Fetch empresa / condominio default info if available
        try {
          const qEmpresa = query(collection(db, "config_empresa"), limit(1));
          const snapEmpresa = await getDocs(qEmpresa);
          if (!snapEmpresa.empty) {
            const empData = snapEmpresa.docs[0].data();
            if (empData.nomeFantasia || empData.razaoSocial) {
              setEmpresaNome((empData.nomeFantasia || empData.razaoSocial).toUpperCase());
            }
          }
        } catch (e) {
          console.error("Erro ao buscar dados da empresa:", e);
        }

        // Fetch clube de beneficios
        const querySnapshot = await getDocs(collection(db, "clube_beneficios"));
        const beneficiosData = querySnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as Beneficio))
          .filter((item) => !item.status || item.status.toLowerCase() !== "inativo");
        
        setBeneficios(beneficiosData);
      } catch (err) {
        console.error("Erro ao buscar benefícios:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Container Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-sky-50/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm border border-sky-500">
              <Heart className="w-6 h-6 fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">Clube de Benefícios</h1>
                <span className="bg-sky-100 text-sky-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-sky-200">
                  Exclusivo Moradores
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                  Cortesia Exclusiva
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Parcerias credenciadas com descontos e vantagens especiais para condôminos e moradores.
              </p>
            </div>
          </div>

          {beneficios.length > 0 && (
            <div className="flex flex-col gap-2 items-start md:items-end">
              <button
                onClick={async () => {
                  setIsExporting(true);
                  await exportBeneficiosPdf(beneficios, "Clube de Benefícios", {
                    userName,
                    userCpf,
                    condominioName,
                    condominioCnpj,
                    cardSuffix,
                  });
                  setIsExporting(false);
                }}
                disabled={isExporting}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 border border-emerald-700"
                title="Gerar PDF com a relação de benefícios para os condôminos"
              >
                <Printer size={16} />
                {isExporting ? "Gerando Relatório PDF..." : "Imprimir Relação Completa (PDF)"}
              </button>
              <p className="text-[10px] text-slate-500 max-w-[220px] text-left md:text-right leading-tight">
                Envie o arquivo Pdf ao Grupo de Moradores do seu Condomínio, o benefício é para todos.
              </p>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-6 md:p-8 space-y-8">
          {loading ? (
            <div className="text-center py-16 text-slate-500 space-y-3">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-medium">Carregando parceiros e benefícios do condomínio...</p>
            </div>
          ) : beneficios.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 space-y-3">
              <Sparkles className="w-10 h-10 text-sky-500 mx-auto opacity-60" />
              <h3 className="text-slate-800 font-bold text-base">Nenhum benefício disponível no momento</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Em breve novas empresas parceiras e vantagens exclusivas serão cadastradas para o seu condomínio.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {beneficios.map((item, index) => {
                const fullAddress = [
                  item.endereco && `${item.endereco}${item.numero ? `, nº ${item.numero}` : ""}`,
                  item.complemento,
                  item.cidade && item.estado ? `${item.cidade} - ${item.estado}` : item.cidade || item.estado,
                  item.cep && `CEP: ${item.cep}`,
                ]
                  .filter(Boolean)
                  .join(" • ");

                const qrTarget = (item.qrcode || item.website || "").trim();
                const targetUrl = qrTarget.startsWith("http") ? qrTarget : `https://${qrTarget}`;

                let badgeLabel = "VANTAGEM EXCLUSIVA";
                if (item.tipo === "Desconto (%)" && item.valor) {
                  badgeLabel = `${item.valor}% DE DESCONTO`;
                } else if (item.tipo === "Desconto (R$)" && item.valor) {
                  badgeLabel = `R$ ${item.valor} DE DESCONTO`;
                } else if (item.tipo) {
                  badgeLabel = item.tipo.toUpperCase();
                }

                const mainImgSrc = item.imagem || item.imagemUrl || item.logo || item.foto || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=400&q=80";

                return (
                  <div
                    key={item.id || index}
                    className="border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all bg-white relative flex flex-col h-full group"
                  >
                    {/* Tarja do Benefício / Desconto */}
                    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                      <span className="text-[10px] font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-lg uppercase tracking-wide flex items-center gap-1.5">
                        <Tag size={12} className="text-sky-600" />
                        {badgeLabel}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        PARCEIRO #{index + 1}
                      </span>
                    </div>

                    {/* Nome da Empresa com a Imagem Principal Padronizada na Frente */}
                    <div className="flex items-center gap-3.5 mb-4 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border border-slate-200 shadow-sm flex items-center justify-center p-1">
                        <OptimizedImage
                          src={mainImgSrc}
                          alt={item.nome || "Empresa Parceira"}
                          objectFit="contain"
                          className="max-w-full max-h-full rounded"
                          fallbackType="generic"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-0.5">
                          EMPRESA PARCEIRA
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate">
                          {item.nome || "Benefício Especial"}
                        </h3>
                      </div>
                    </div>

                    {/* Descrição */}
                    {item.descricao && (
                      <p className="text-xs text-slate-600 mb-4 flex-1 whitespace-pre-line leading-relaxed text-justify">
                        {item.descricao}
                      </p>
                    )}

                    {/* Bloco de Contato da Empresa */}
                    {(fullAddress || item.telefone || item.email || item.website) && (
                      <div className="mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs text-slate-600">
                        <div className="font-extrabold text-sky-800 text-[10px] uppercase tracking-wider pb-1 border-b border-slate-200/80 flex items-center justify-between">
                          <span>📞 CONTATO COM A EMPRESA</span>
                          <ShieldCheck size={13} className="text-emerald-600" />
                        </div>
                        {fullAddress && (
                          <div className="flex items-start gap-2 pt-0.5">
                            <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="leading-tight">{fullAddress}</span>
                          </div>
                        )}
                        {item.telefone && (
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-slate-400 shrink-0" />
                            <a href={`tel:${item.telefone}`} className="hover:underline hover:text-sky-600 font-medium">
                              {item.telefone}
                            </a>
                          </div>
                        )}
                        {item.email && (
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-slate-400 shrink-0" />
                            <a href={`mailto:${item.email}`} className="hover:underline hover:text-sky-600 font-medium truncate">
                              {item.email}
                            </a>
                          </div>
                        )}
                        {item.website && (
                          <div className="flex items-center gap-2">
                            <Globe size={14} className="text-slate-400 shrink-0" />
                            <a
                              href={item.website.startsWith("http") ? item.website : `https://${item.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => handleRegisterClick(item.id)}
                              className="hover:underline text-sky-600 font-medium truncate"
                            >
                              {item.website}
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Exibição do QR Code Rápido do Celular */}
                    {qrTarget && (
                      <div className="mb-4 p-3 bg-sky-50/70 rounded-xl border border-sky-100 flex items-center gap-3">
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleRegisterClick(item.id)}
                          title="Clique para acessar a oferta do parceiro"
                          className="shrink-0"
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                              targetUrl
                            )}`}
                            alt="QR Code do Parceiro"
                            className="w-16 h-16 rounded-lg border border-sky-200 bg-white p-1 shadow-xs hover:scale-105 transition-transform cursor-pointer"
                            crossOrigin="anonymous"
                          />
                        </a>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-extrabold uppercase text-sky-800 tracking-wider block">
                            📱 ACESSO NO CELULAR (QR CODE)
                          </span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5 leading-snug">
                            Escaneie para acessar o benefício
                          </span>
                          <a
                            href={targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleRegisterClick(item.id)}
                            className="text-[11px] text-sky-600 hover:underline font-semibold inline-flex items-center gap-1 mt-1 truncate max-w-full"
                          >
                            <span>Abrir link oficial</span>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Regras e Termos */}
                    {item.regras && (
                      <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 mb-4 text-[11px] text-amber-900 leading-relaxed">
                        <span className="font-extrabold text-[10px] uppercase text-amber-800 tracking-wide block mb-1">
                          ⚠️ REGRAS & TERMOS DE USO
                        </span>
                        {item.regras}
                      </div>
                    )}

                    {/* Rodapé do Card */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      {qrTarget ? (
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleRegisterClick(item.id)}
                          className="inline-flex items-center gap-2 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs border border-sky-800"
                        >
                          <span>RESGATAR BENEFÍCIO</span>
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                          <ShieldCheck size={14} className="text-sky-600" />
                          BENEFÍCIO CREDENCIADO
                        </span>
                      )}

                      {item.clicks ? (
                        <span
                          className="text-[11px] text-slate-500 font-semibold flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg"
                          title="Acessos registrados"
                        >
                          <QrCode size={13} className="text-sky-600" />
                          {item.clicks} {item.clicks === 1 ? "acesso" : "acessos"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
