import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Building2,
  MapPin,
  FileText,
  Users,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Globe,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Truck,
  Wallet,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Coins,
  BarChart3,
  PieChart as LucidePieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { initFirebase } from "../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { validarCPF, validarCNPJ, formatarCPF, formatarCNPJ } from "../../lib/documentValidators";
import { useFranqueada } from "../../context/FranqueadaContext";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export interface FranqueadaUnitData {
  id?: string;
  codigoUnidade: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  logoUrl?: string;
  telefone: string;
  email: string;
  site?: string;

  // Franquia e Parâmetros Contratuais
  statusFranquia?: "Ativa" | "Em Implantação" | "Suspensa" | "Inativa" | string;
  dataInicio?: string;
  responsavelUnidade?: string;
  taxaFranquia?: string;
  royalties?: string;
  fundoPropaganda?: string;

  // Endereço
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;

  // Fiscal
  regimeTributario?: string;
  certificadoDigital?: string;

  // Sócios
  resp1Nome?: string;
  resp1Cpf?: string;
  resp1Part?: string;
  resp1Funcao?: string;
  resp1Tel?: string;

  resp2Nome?: string;
  resp2Cpf?: string;
  resp2Part?: string;
  resp2Funcao?: string;
  resp2Tel?: string;

  resp3Nome?: string;
  resp3Cpf?: string;
  resp3Part?: string;
  resp3Funcao?: string;
  resp3Tel?: string;

  resp4Nome?: string;
  resp4Cpf?: string;
  resp4Part?: string;
  resp4Funcao?: string;
  resp4Tel?: string;

  createdAt?: string;
  updatedAt?: string;

  // Métricas Calculadas
  faturamentoTotal?: number;
  royaltiesEstimados?: number;
  fundoPropagandaEstimado?: number;
  totalPedidos?: number;
}

const emptyFormData: FranqueadaUnitData = {
  codigoUnidade: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  logoUrl: "",
  telefone: "",
  email: "",
  site: "",

  statusFranquia: "Ativa",
  dataInicio: new Date().toISOString().split("T")[0],
  responsavelUnidade: "",
  taxaFranquia: "30000",
  royalties: "5",
  fundoPropaganda: "2",

  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "GO",

  regimeTributario: "Simples Nacional",
  certificadoDigital: "",

  resp1Nome: "",
  resp1Cpf: "",
  resp1Part: "",
  resp1Funcao: "",
  resp1Tel: "",

  resp2Nome: "",
  resp2Cpf: "",
  resp2Part: "",
  resp2Funcao: "",
  resp2Tel: "",

  resp3Nome: "",
  resp3Cpf: "",
  resp3Part: "",
  resp3Funcao: "",
  resp3Tel: "",

  resp4Nome: "",
  resp4Cpf: "",
  resp4Part: "",
  resp4Funcao: "",
  resp4Tel: "",
};

const COLORS = ["#0f172a", "#0284c7", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function Franqueadora() {
  const { refreshFranqueadas, setSelectedUnidade } = useFranqueada();
  const navigate = useNavigate();

  const [franqueadas, setFranqueadas] = useState<FranqueadaUnitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [printingItem, setPrintingItem] = useState<FranqueadaUnitData | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FranqueadaUnitData>(emptyFormData);
  const [activeModalTab, setActiveModalTab] = useState<
    "Básico" | "Franquia" | "Endereço" | "Fiscal" | "Sócios"
  >("Básico");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");

  // Modal Gerar Fatura de Royalties
  const [isRoyaltyModalOpen, setIsRoyaltyModalOpen] = useState(false);
  const [selectedFrqForRoyalty, setSelectedFrqForRoyalty] = useState<FranqueadaUnitData | null>(null);
  const [royaltyForm, setRoyaltyForm] = useState({
    competencia: new Date().toISOString().slice(0, 7), // YYYY-MM
    valorFaturamento: 0,
    aliquotaRoyalty: 5,
    valorRoyalty: 0,
    aliquotaFundoPropaganda: 2,
    valorFundoPropaganda: 0,
    dataVencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    observacoes: "",
  });

  // Modal Guia de Arquitetura
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Métricas Consolidadas da Rede
  const [redeMetrics, setRedeMetrics] = useState({
    totalFranqueadas: 0,
    franqueadasAtivas: 0,
    faturamentoGlobal: 0,
    royaltiesGlobal: 0,
    fundoPropagandaGlobal: 0,
    totalPedidosGlobal: 0,
    ticketMedioRede: 0,
  });

  const [monthlyChartData, setMonthlyChartData] = useState<any[]>([]);
  const [distributionChartData, setDistributionChartData] = useState<any[]>([]);

  useEffect(() => {
    const handleAfterPrint = () => setPrintingItem(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handlePrint = (item: FranqueadaUnitData) => {
    flushSync(() => {
      setPrintingItem(item);
    });
    window.print();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/webp", 0.8);
        setFormData((prev) => ({ ...prev, logoUrl: base64String }));
        setIsUploadingLogo(false);
      };
      img.onerror = () => {
        toast.error("Erro ao processar imagem.");
        setIsUploadingLogo(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      toast.error("Erro ao ler arquivo.");
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  // Carrega e consolida dados de Franqueadas e Vendas
  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();

      // 1. Carregar Empresas / Franqueadas de config_empresa e config_franqueadora
      const itemsMap = new Map<string, FranqueadaUnitData>();

      // config_empresa
      try {
        const empSnap = await getDocs(collection(db, "config_empresa"));
        empSnap.forEach((d) => {
          const data = d.data();
          const codigo = data.codigoUnidade || `FRQ-${itemsMap.size + 1}`.padStart(7, "0");
          itemsMap.set(d.id, {
            id: d.id,
            codigoUnidade: codigo,
            razaoSocial: data.razaoSocial || "Empresa Franqueada",
            nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
            cnpj: data.cnpj || "",
            inscricaoEstadual: data.inscricaoEstadual || "",
            inscricaoMunicipal: data.inscricaoMunicipal || "",
            logoUrl: data.logoUrl || "",
            telefone: data.telefone || "",
            email: data.email || "",
            site: data.site || "",
            statusFranquia: data.statusFranquia || "Ativa",
            dataInicio: data.dataInicio || "",
            responsavelUnidade: data.responsavelUnidade || data.resp1Nome || "",
            taxaFranquia: data.taxaFranquia || "30000",
            royalties: data.royalties || "5",
            fundoPropaganda: data.fundoPropaganda || "2",
            cep: data.cep || "",
            rua: data.rua || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || "",
            cidade: data.cidade || "",
            uf: data.uf || "GO",
            regimeTributario: data.regimeTributario || "Simples Nacional",
            resp1Nome: data.resp1Nome || "",
            resp1Cpf: data.resp1Cpf || "",
            resp1Funcao: data.resp1Funcao || "",
            resp1Tel: data.resp1Tel || "",
            faturamentoTotal: 0,
            royaltiesEstimados: 0,
            fundoPropagandaEstimado: 0,
            totalPedidos: 0,
            createdAt: data.createdAt || "",
            updatedAt: data.updatedAt || "",
          });
        });
      } catch (e) {
        console.warn("Erro ao buscar config_empresa:", e);
      }

      // config_franqueadora (legado)
      try {
        const frqSnap = await getDocs(collection(db, "config_franqueadora"));
        frqSnap.forEach((d) => {
          if (!itemsMap.has(d.id)) {
            const data = d.data();
            const codigo = data.numeroFranqueada || data.codigoUnidade || `FRQ-${itemsMap.size + 1}`.padStart(7, "0");
            itemsMap.set(d.id, {
              id: d.id,
              codigoUnidade: codigo,
              razaoSocial: data.razaoSocial || "Franqueada",
              nomeFantasia: data.nomeFantasia || data.razaoSocial || "Franqueada",
              cnpj: data.cnpj || "",
              telefone: data.telefone || "",
              email: data.email || "",
              statusFranquia: "Ativa",
              royalties: data.royalties || "5",
              fundoPropaganda: data.fundoPropaganda || "2",
              cep: data.cep || "",
              rua: data.rua || "",
              numero: data.numero || "",
              bairro: data.bairro || "",
              cidade: data.cidade || "",
              uf: data.uf || "GO",
              faturamentoTotal: 0,
              royaltiesEstimados: 0,
              fundoPropagandaEstimado: 0,
              totalPedidos: 0,
            });
          }
        });
      } catch (e) {
        console.warn("Erro ao buscar config_franqueadora:", e);
      }

      const franqueadasList = Array.from(itemsMap.values());

      // 2. Carregar Pedidos de Venda para calcular o Faturamento e Royalties
      const ordersSnap = await getDocs(collection(db, "pedidos_venda"));
      let globalFaturamento = 0;
      let globalPedidos = 0;
      const currentYear = new Date().getFullYear();
      const monthlyTotals = Array(12).fill(0);

      // Mapeia pedidos por franqueada
      ordersSnap.forEach((d) => {
        const order = d.data();
        if (order.status !== "cancelado" && order.status !== "Cancelado") {
          globalPedidos++;
          const cand =
            order.totais?.totalPedido ||
            order.totalPedido ||
            order.valorTotal ||
            order.valor_total ||
            order.totalGeral ||
            order.total ||
            0;

          let val = 0;
          if (typeof cand === "number") val = cand;
          else if (typeof cand === "string")
            val = parseFloat(cand.replace(/[^0-9,-]+/g, "").replace(",", ".")) || 0;

          if (!isNaN(val) && val > 0) {
            globalFaturamento += val;

            // Agrupamento mensal do ano atual
            const orderDateStr = order.createdAt || order.dataPedido || "";
            if (orderDateStr) {
              const dt = new Date(orderDateStr);
              if (dt.getFullYear() === currentYear) {
                monthlyTotals[dt.getMonth()] += val;
              }
            }

            // Distribuir para a Franqueada correspondente
            const orderFrqCode = order.codigoUnidade || order.franqueadaId;
            let matched = false;

            if (orderFrqCode) {
              for (const frq of franqueadasList) {
                if (frq.codigoUnidade === orderFrqCode || frq.id === orderFrqCode) {
                  frq.faturamentoTotal = (frq.faturamentoTotal || 0) + val;
                  frq.totalPedidos = (frq.totalPedidos || 0) + 1;
                  matched = true;
                  break;
                }
              }
            }

            // Se não especificado em pedido legado, divide ou atribui à primeira/matriz
            if (!matched && franqueadasList.length > 0) {
              franqueadasList[0].faturamentoTotal = (franqueadasList[0].faturamentoTotal || 0) + val;
              franqueadasList[0].totalPedidos = (franqueadasList[0].totalPedidos || 0) + 1;
            }
          }
        }
      });

      // 3. Calcular Royalties e Fundo de Propaganda para cada Franqueada
      let totalRoyaltiesGlobal = 0;
      let totalFundoGlobal = 0;

      franqueadasList.forEach((frq) => {
        const fat = frq.faturamentoTotal || 0;
        const royPct = parseFloat(String(frq.royalties || "5").replace(",", ".")) || 5;
        const fndPct = parseFloat(String(frq.fundoPropaganda || "2").replace(",", ".")) || 2;

        frq.royaltiesEstimados = fat * (royPct / 100);
        frq.fundoPropagandaEstimado = fat * (fndPct / 100);

        totalRoyaltiesGlobal += frq.royaltiesEstimados;
        totalFundoGlobal += frq.fundoPropagandaEstimado;
      });

      setFranqueadas(franqueadasList);

      const ativas = franqueadasList.filter((f) => f.statusFranquia !== "Inativa" && f.statusFranquia !== "Suspensa").length;
      setRedeMetrics({
        totalFranqueadas: franqueadasList.length,
        franqueadasAtivas: ativas,
        faturamentoGlobal: globalFaturamento,
        royaltiesGlobal: totalRoyaltiesGlobal,
        fundoPropagandaGlobal: totalFundoGlobal,
        totalPedidosGlobal: globalPedidos,
        ticketMedioRede: globalPedidos > 0 ? globalFaturamento / globalPedidos : 0,
      });

      // Monta dados do gráfico mensal
      const avgRoyaltyPct = franqueadasList.length > 0
        ? franqueadasList.reduce((acc, curr) => acc + (parseFloat(String(curr.royalties || 5).replace(",", ".")) || 5), 0) / franqueadasList.length / 100
        : 0.05;

      const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const chartData = months.map((m, idx) => ({
        name: m,
        faturamento: monthlyTotals[idx],
        royalties: monthlyTotals[idx] * avgRoyaltyPct,
      }));
      setMonthlyChartData(chartData);

      // Monta dados de distribuição de faturamento por franqueada
      const distData = franqueadasList
        .filter((f) => (f.faturamentoTotal || 0) > 0)
        .map((f) => ({
          name: f.codigoUnidade ? `${f.codigoUnidade} - ${f.nomeFantasia || f.razaoSocial}` : f.nomeFantasia,
          value: f.faturamentoTotal || 0,
        }));
      setDistributionChartData(distData.length > 0 ? distData : [{ name: "Rede Geral", value: globalFaturamento || 1 }]);
    } catch (error) {
      console.error("Erro ao carregar dados do Franqueador:", error);
      toast.error("Erro ao carregar dados da rede franqueadora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Form Handlers
  const handleOpenModal = (item?: FranqueadaUnitData) => {
    setEmailError("");
    if (item) {
      setEditingId(item.id || null);
      setFormData(item);
    } else {
      setEditingId(null);
      setFormData({
        ...emptyFormData,
        codigoUnidade: `FRQ-${String(franqueadas.length + 1).padStart(3, "0")}`,
      });
    }
    setActiveModalTab("Básico");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(emptyFormData);
    setEmailError("");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    let { name, value } = e.target;
    if (name === "email" && emailError) {
      setEmailError("");
    }
    if (name === "cnpj") {
      value = formatarCNPJ(value);
    } else if (name.startsWith("resp") && name.endsWith("Cpf")) {
      value = formatarCPF(value);
    } else if (name === "cep") {
      value = value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2").slice(0, 9);
    } else if (name === "telefone" || (name.startsWith("resp") && name.endsWith("Tel"))) {
      value = value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.razaoSocial || !formData.cnpj) {
      toast.error("Por favor, preencha a Razão Social e o CNPJ.");
      setActiveModalTab("Básico");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      setEmailError("Formato de e-mail inválido.");
      setActiveModalTab("Básico");
      return;
    }

    if (formData.cnpj) {
      const cleanCnpj = formData.cnpj.replace(/\D/g, "");
      if (cleanCnpj.length > 0 && !validarCNPJ(cleanCnpj)) {
        toast.error("O CNPJ informado é inválido.");
        setActiveModalTab("Básico");
        return;
      }
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const payload = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };

      if (editingId) {
        await updateDoc(doc(db, "config_empresa", editingId), payload);
        // Também atualiza em config_franqueadora se existir
        try {
          await updateDoc(doc(db, "config_franqueadora", editingId), payload);
        } catch (e) {}
        toast.success("Empresa franqueada atualizada com sucesso!");
      } else {
        const newDocRef = await addDoc(collection(db, "config_empresa"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        // Salva backup espelho em config_franqueadora
        try {
          await addDoc(collection(db, "config_franqueadora"), {
            ...payload,
            id: newDocRef.id,
            createdAt: new Date().toISOString(),
          });
        } catch (e) {}
        toast.success("Nova empresa franqueada cadastrada na rede!");
      }

      await refreshFranqueadas();
      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error("Erro ao salvar franqueada:", error);
      toast.error("Erro ao salvar dados da franqueada.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      await deleteDoc(doc(db, "config_empresa", id));
      try {
        await deleteDoc(doc(db, "config_franqueadora", id));
      } catch (e) {}
      toast.success("Franqueada excluída.");
      await refreshFranqueadas();
      await fetchData();
    } catch (error) {
      console.error("Erro ao excluir doc:", error);
      toast.error("Erro ao excluir franqueada.");
    }
  };

  // Abrir Modal de Lançamento de Royalties
  const handleOpenRoyaltyInvoice = (frq: FranqueadaUnitData) => {
    const fat = frq.faturamentoTotal || 0;
    const royRate = parseFloat(String(frq.royalties || "5").replace(",", ".")) || 5;
    const fndRate = parseFloat(String(frq.fundoPropaganda || "2").replace(",", ".")) || 2;
    const royVal = fat * (royRate / 100);
    const fndVal = fat * (fndRate / 100);

    setSelectedFrqForRoyalty(frq);
    setRoyaltyForm({
      competencia: new Date().toISOString().slice(0, 7),
      valorFaturamento: fat,
      aliquotaRoyalty: royRate,
      valorRoyalty: royVal,
      aliquotaFundoPropaganda: fndRate,
      valorFundoPropaganda: fndVal,
      dataVencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      observacoes: `Cobrança de Royalties (${royRate}%) e Fundo de Propaganda (${fndRate}%) referente ao faturamento da unidade ${frq.codigoUnidade}.`,
    });
    setIsRoyaltyModalOpen(true);
  };

  // Salvar Fatura de Royalties no Financeiro (contas_receber)
  const handleSaveRoyaltyInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFrqForRoyalty) return;

    const valorTotalCobrar = Number(royaltyForm.valorRoyalty || 0) + Number(royaltyForm.valorFundoPropaganda || 0);

    if (valorTotalCobrar <= 0) {
      toast.error("O valor total de royalties/fundo deve ser maior que zero.");
      return;
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();

      const invoicePayload = {
        descricao: `Royalties & Fundo Prop. (${royaltyForm.competencia}) - ${selectedFrqForRoyalty.codigoUnidade} ${selectedFrqForRoyalty.nomeFantasia || selectedFrqForRoyalty.razaoSocial}`,
        cliente: selectedFrqForRoyalty.razaoSocial,
        clienteNome: selectedFrqForRoyalty.nomeFantasia || selectedFrqForRoyalty.razaoSocial,
        clienteCnpj: selectedFrqForRoyalty.cnpj,
        franqueadaId: selectedFrqForRoyalty.id,
        codigoUnidade: selectedFrqForRoyalty.codigoUnidade,
        tipoDocumento: "Royalties Franquia",
        categoria: "Receita de Franquia",
        competencia: royaltyForm.competencia,
        valor: valorTotalCobrar,
        valorFaturamentoBase: royaltyForm.valorFaturamento,
        valorRoyalties: royaltyForm.valorRoyalty,
        valorFundoPropaganda: royaltyForm.valorFundoPropaganda,
        vencimento: royaltyForm.dataVencimento,
        dataEmissao: new Date().toISOString().split("T")[0],
        status: "Pendente",
        formaPagamento: "Boleto Bancário / PIX",
        observacoes: royaltyForm.observacoes,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "contas_receber"), invoicePayload);
      toast.success(
        `Cobrança de R$ ${valorTotalCobrar.toFixed(2)} lançada com sucesso no Contas a Receber da Matriz!`
      );
      setIsRoyaltyModalOpen(false);
    } catch (error) {
      console.error("Erro ao gerar fatura de royalties:", error);
      toast.error("Erro ao lançar fatura no Financeiro.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filtro da Tabela
  const filteredFranqueadas = franqueadas.filter((item) => {
    const matchSearch =
      item.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigoUnidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cnpj?.includes(searchTerm) ||
      item.cidade?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      statusFilter === "Todos" || item.statusFranquia === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Header da Central do Franqueador */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={13} />
                  Torre de Controle do Franqueador Master
                </span>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-mono">
                  {redeMetrics.totalFranqueadas} Unidades na Rede
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Gestão Consolidada de Franqueadas & Royalties
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
                Supervisão estratégica de faturamento da rede, apuração de royalties, acompanhamento operacional de filiais e controle de contratos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer hover:border-slate-600"
              >
                <Info size={15} className="text-sky-400" />
                Como Funciona o Controle?
              </button>

              <button
                type="button"
                onClick={() => handleOpenModal()}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95"
              >
                <Plus size={16} />
                Nova Empresa Franqueada
              </button>
            </div>
          </div>
        </div>

        {/* Cards de Indicadores Globais da Rede */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-blue-50 text-[#0071e3] rounded-2xl shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Unidades Franqueadas
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                {redeMetrics.totalFranqueadas}
              </p>
              <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                {redeMetrics.franqueadasAtivas} ativas na rede
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Faturamento Global
              </p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">
                R$ {redeMetrics.faturamentoGlobal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {redeMetrics.totalPedidosGlobal} pedidos faturados
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
              <Coins size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Royalties da Matriz
              </p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">
                R$ {redeMetrics.royaltiesGlobal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Média de 5% sobre vendas
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center gap-4">
            <div className="p-3.5 bg-purple-50 text-purple-600 rounded-2xl shrink-0">
              <Layers size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Fundo de Propaganda
              </p>
              <p className="text-2xl font-black text-purple-600 mt-0.5">
                R$ {redeMetrics.fundoPropagandaGlobal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Marketing Institucional
              </p>
            </div>
          </div>
        </div>

        {/* Gráficos de Royalties e Vendas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 size={18} className="text-brand-dark" />
                  Evolução Mensal de Faturamento e Royalties ({new Date().getFullYear()})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidado das vendas da rede e projeção de receita de royalties.
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} dy={10} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                    formatter={(value: number, name: string) => [
                      `R$ ${value.toFixed(2).replace(".", ",")}`,
                      name === "faturamento" ? "Vendas Totais da Rede" : "Royalties da Matriz",
                    ]}
                  />
                  <Bar dataKey="faturamento" name="faturamento" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="royalties" name="royalties" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-sky-600 rounded-xs" />
                Vendas da Rede
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-900 rounded-xs" />
                Royalties da Matriz
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1">
                <LucidePieChart size={18} className="text-emerald-600" />
                Distribuição de Vendas por Franquia
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Participação de cada unidade no faturamento total.
              </p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {distributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [`R$ ${val.toFixed(2).replace(".", ",")}`, "Vendas"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {franqueadas.slice(0, 4).map((f, i) => (
                <div key={f.id} className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate">{f.codigoUnidade} • {f.nomeFantasia}</span>
                  </span>
                  <span className="font-semibold text-slate-900 shrink-0">
                    R$ {(f.faturamentoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Franqueadas e Ações de Ligação */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-[#0071e3]" />
                Unidades Franqueadas Cadastradas ({filteredFranqueadas.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Clique nos botões de atalho para acessar a operação de cada unidade ou emitir faturas de royalties.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Buscar por código, nome, CNPJ ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] transition-all outline-none bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 outline-none"
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativa">Ativa</option>
                <option value="Em Implantação">Em Implantação</option>
                <option value="Suspensa">Suspensa</option>
                <option value="Inativa">Inativa</option>
              </select>

              <button
                type="button"
                onClick={() => fetchData()}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Unidade / Código</th>
                  <th className="px-5 py-3.5 font-semibold">Empresa / CNPJ</th>
                  <th className="px-5 py-3.5 font-semibold">Localização & Contato</th>
                  <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Taxas (Roy / Fnd)</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Vendas da Unidade</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Royalties Devidos</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Ações & Atalhos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredFranqueadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-3">
                        <Building2 size={36} className="mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-700">Nenhuma empresa franqueada cadastrada.</p>
                        <p className="text-xs text-slate-400">
                          Cadastre as unidades franqueadas com seus códigos e percentuais de royalties para iniciar o controle da rede.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenModal()}
                          className="px-4 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold inline-flex items-center gap-2"
                        >
                          <Plus size={14} />
                          Cadastrar Primeira Franqueada
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredFranqueadas.map((item) => {
                    const statusClass =
                      item.statusFranquia === "Ativa"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : item.statusFranquia === "Em Implantação"
                        ? "bg-sky-50 text-sky-700 border-sky-200"
                        : item.statusFranquia === "Suspensa"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-600 border-slate-200";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-800">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-xs">
                            {item.codigoUnidade || "FRQ-001"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{item.nomeFantasia || item.razaoSocial}</div>
                          <div className="text-xs text-slate-500">{item.cnpj || "Sem CNPJ"}</div>
                          {item.responsavelUnidade && (
                            <div className="text-[11px] text-slate-400 mt-0.5">Resp: {item.responsavelUnidade}</div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-600">
                          <div>{item.cidade ? `${item.cidade}/${item.uf}` : "—"}</div>
                          <div className="text-slate-400">{item.telefone || item.email || "—"}</div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusClass}`}>
                            {item.statusFranquia || "Ativa"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right text-xs font-medium">
                          <span className="text-amber-700 font-bold">{item.royalties || 5}%</span> Roy
                          <br />
                          <span className="text-purple-700 font-bold">{item.fundoPropaganda || 2}%</span> Fundo
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          R$ {(item.faturamentoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <div className="text-[11px] text-slate-400 font-normal">
                            {item.totalPedidos || 0} pedidos
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-bold text-amber-600">
                          R$ {(item.royaltiesEstimados || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Botão Selecionar como Filtro Ativo */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUnidade(item.codigoUnidade || item.id || "ALL");
                                toast.success(`Contexto alterado para ${item.codigoUnidade}!`);
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
                              title="Selecionar unidade para trabalhar nela"
                            >
                              <CheckCircle2 size={15} />
                            </button>

                            {/* Botão Gerar Cobrança de Royalties */}
                            <button
                              type="button"
                              onClick={() => handleOpenRoyaltyInvoice(item)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs transition-colors"
                              title="Lançar fatura de cobrança de Royalties no Financeiro da Matriz"
                            >
                              <Coins size={15} />
                            </button>

                            {/* Link Rápido para Comercial */}
                            <Link
                              to="/admin/comercial"
                              onClick={() => setSelectedUnidade(item.codigoUnidade || item.id || "ALL")}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#0071e3] rounded-lg text-xs transition-colors"
                              title="Abrir Painel Comercial desta unidade"
                            >
                              <ShoppingCart size={15} />
                            </Link>

                            {/* Link Rápido para Financeiro */}
                            <Link
                              to="/admin/financeiro/receber"
                              onClick={() => setSelectedUnidade(item.codigoUnidade || item.id || "ALL")}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs transition-colors"
                              title="Abrir Contas a Receber desta unidade"
                            >
                              <Wallet size={15} />
                            </Link>

                            {/* Imprimir */}
                            <button
                              type="button"
                              onClick={() => handlePrint(item)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                              title="Imprimir Ficha"
                            >
                              <Printer size={15} />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => handleOpenModal(item)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                              title="Editar Parâmetros da Franquia"
                            >
                              <Edit2 size={15} />
                            </button>

                            {/* Excluir */}
                            <button
                              type="button"
                              onClick={() => item.id && setItemToDelete(item.id)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              title="Excluir Franqueada"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Guia de Arquitetura Franqueador ↔ Franqueada */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Como Funciona o Controle Franqueador ↔ Franqueadas
                  </h3>
                  <p className="text-xs text-slate-300">
                    Entenda a estrutura hierárquica e a ligação entre os painéis administrativos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
              {/* Diagrama Visual */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-[#0071e3]" />
                  Estrutura de Controle e Fluxo de Dados
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-xs">
                    <span className="px-2 py-0.5 bg-slate-900 text-white rounded text-[10px] font-bold uppercase">
                      Nível 1 • Franqueador
                    </span>
                    <h5 className="font-bold text-slate-900 mt-2 text-sm">Central Franqueadora</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Painel <code>/admin/franqueadora</code>. Vê todas as franqueadas, faturamento global e calcula os royalties devidos à matriz.
                    </p>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold uppercase">
                      Nível 2 • Cadastro
                    </span>
                    <h5 className="font-bold text-slate-900 mt-2 text-sm">Empresa Franqueada</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Painel <code>/admin/empresa</code>. Registra o CNPJ da filial, código da unidade (ex: <code>FRQ-001</code>) e % de royalties.
                    </p>
                  </div>

                  <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold uppercase">
                      Nível 3 • Operação
                    </span>
                    <h5 className="font-bold text-slate-900 mt-2 text-sm">Comercial / Financeiro</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Operação local da unidade (pedidos, clientes, contas e entregas). Cada pedido fica marcado com o código da unidade.
                    </p>
                  </div>
                </div>
              </div>

              {/* Passos Práticos */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900">Passo a Passo para Operar Multi-Franquias:</h4>
                <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed text-slate-600">
                  <li>
                    <strong>Cadastrar as Franqueadas:</strong> Cadastre cada unidade com seu Código Único (ex: <code>FRQ-001</code>, <code>FRQ-002</code>) e defina a taxa de Royalties contratual (ex: <code>5%</code>).
                  </li>
                  <li>
                    <strong>Vincular Usuários:</strong> Ao cadastrar um gerente ou colaborador em <strong>Usuários</strong>, associe-o à sua respectiva Franqueada.
                  </li>
                  <li>
                    <strong>Alternar Contexto no Topo:</strong> Utilize o seletor no topo da tela (ao lado do perfil) para alternar entre a visão <strong>Rede Global (Franqueador Master)</strong> ou filtrar os dados de uma unidade específica.
                  </li>
                  <li>
                    <strong>Faturamento de Royalties:</strong> Na tabela de franqueadas, clique no ícone de <strong>Moedas (Royalties)</strong> para lançar a cobrança no Contas a Receber da Matriz automaticamente.
                  </li>
                </ol>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lançar Cobrança de Royalties no Financeiro */}
      {isRoyaltyModalOpen && selectedFrqForRoyalty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-500 text-white">
              <div className="flex items-center gap-3">
                <Coins size={22} />
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Gerar Fatura de Royalties da Franqueada
                  </h3>
                  <p className="text-xs text-amber-100">
                    Lançamento automático no Contas a Receber da Matriz
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoyaltyModalOpen(false)}
                className="text-amber-100 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoyaltyInvoice} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="text-slate-500">Unidade Franqueada:</p>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedFrqForRoyalty.codigoUnidade} • {selectedFrqForRoyalty.nomeFantasia || selectedFrqForRoyalty.razaoSocial}
                </p>
                <p className="text-slate-500 text-[11px]">CNPJ: {selectedFrqForRoyalty.cnpj}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mês de Competência:</label>
                  <input
                    type="month"
                    value={royaltyForm.competencia}
                    onChange={(e) => setRoyaltyForm((p) => ({ ...p, competencia: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Data de Vencimento:</label>
                  <input
                    type="date"
                    value={royaltyForm.dataVencimento}
                    onChange={(e) => setRoyaltyForm((p) => ({ ...p, dataVencimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Faturamento (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={royaltyForm.valorFaturamento}
                    onChange={(e) => {
                      const fat = parseFloat(e.target.value) || 0;
                      setRoyaltyForm((p) => ({
                        ...p,
                        valorFaturamento: fat,
                        valorRoyalty: fat * (p.aliquotaRoyalty / 100),
                        valorFundoPropaganda: fat * (p.aliquotaFundoPropaganda / 100),
                      }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Royalties ({royaltyForm.aliquotaRoyalty}%):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={royaltyForm.valorRoyalty}
                    onChange={(e) => setRoyaltyForm((p) => ({ ...p, valorRoyalty: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-amber-700"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fundo Propaganda ({royaltyForm.aliquotaFundoPropaganda}%):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={royaltyForm.valorFundoPropaganda}
                    onChange={(e) => setRoyaltyForm((p) => ({ ...p, valorFundoPropaganda: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-purple-700"
                  />
                </div>

                <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total a Cobrar:</span>
                  <span className="text-base font-black text-slate-900">
                    R$ {(Number(royaltyForm.valorRoyalty || 0) + Number(royaltyForm.valorFundoPropaganda || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações na Fatura:</label>
                <textarea
                  rows={2}
                  value={royaltyForm.observacoes}
                  onChange={(e) => setRoyaltyForm((p) => ({ ...p, observacoes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs resize-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoyaltyModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Save size={14} />
                  {isSaving ? "Lançando..." : "Confirmar Lançamento no Financeiro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cadastro / Edição da Franqueada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-900 text-white">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editingId ? "Editar Empresa Franqueada" : "Cadastrar Nova Empresa Franqueada"}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Parâmetros da unidade, percentual de royalties e dados jurídicos da filial.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-6 shrink-0 overflow-x-auto">
              {(["Básico", "Franquia", "Endereço", "Fiscal", "Sócios"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveModalTab(tab)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                    activeModalTab === tab
                      ? "border-brand-dark text-brand-dark bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab Básico */}
              {activeModalTab === "Básico" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Código da Unidade:
                      </label>
                      <input
                        type="text"
                        name="codigoUnidade"
                        placeholder="Ex: FRQ-001"
                        value={formData.codigoUnidade}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        CNPJ:
                      </label>
                      <input
                        type="text"
                        name="cnpj"
                        placeholder="00.000.000/0000-00"
                        value={formData.cnpj}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status da Franquia:
                      </label>
                      <select
                        name="statusFranquia"
                        value={formData.statusFranquia}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                      >
                        <option value="Ativa">Ativa</option>
                        <option value="Em Implantação">Em Implantação</option>
                        <option value="Suspensa">Suspensa</option>
                        <option value="Inativa">Inativa</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Razão Social:
                      </label>
                      <input
                        type="text"
                        name="razaoSocial"
                        placeholder="Ex: União Condominial Goiânia Ltda"
                        value={formData.razaoSocial}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome Fantasia:
                      </label>
                      <input
                        type="text"
                        name="nomeFantasia"
                        placeholder="Ex: Franquia Goiânia Sul"
                        value={formData.nomeFantasia}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Telefone / WhatsApp:
                      </label>
                      <input
                        type="text"
                        name="telefone"
                        placeholder="(00) 00000-0000"
                        value={formData.telefone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        E-mail de Contato:
                      </label>
                      <input
                        type="email"
                        name="email"
                        placeholder="franquia@empresa.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border rounded-lg text-xs ${
                          emailError ? "border-red-500" : "border-slate-300"
                        }`}
                      />
                      {emailError && <p className="text-[11px] text-red-500 mt-1">{emailError}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Responsável pela Unidade:
                      </label>
                      <input
                        type="text"
                        name="responsavelUnidade"
                        placeholder="Nome do Gestor/Franqueado"
                        value={formData.responsavelUnidade}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Parâmetros de Franquia */}
              {activeModalTab === "Franquia" && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                    <p className="font-bold">Parâmetros Contratuais de Royalties e Propaganda:</p>
                    <p className="mt-1">
                      Estes percentuais são utilizados para calcular automaticamente os valores devidos à Franqueadora Master a cada compra ou faturamento gerado por esta unidade.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Royalties (% sobre faturamento):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        name="royalties"
                        value={formData.royalties}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-amber-700"
                        placeholder="Ex: 5"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Fundo de Propaganda (%):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        name="fundoPropaganda"
                        value={formData.fundoPropaganda}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-purple-700"
                        placeholder="Ex: 2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Taxa Inicial de Franquia (R$):
                      </label>
                      <input
                        type="text"
                        name="taxaFranquia"
                        value={formData.taxaFranquia}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                        placeholder="Ex: 30000"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Data de Início da Operação:
                      </label>
                      <input
                        type="date"
                        name="dataInicio"
                        value={formData.dataInicio}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Endereço */}
              {activeModalTab === "Endereço" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CEP:</label>
                      <input
                        type="text"
                        name="cep"
                        placeholder="00000-000"
                        value={formData.cep}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Logradouro / Rua:</label>
                      <input
                        type="text"
                        name="rua"
                        value={formData.rua}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Número:</label>
                      <input
                        type="text"
                        name="numero"
                        value={formData.numero}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Bairro:</label>
                      <input
                        type="text"
                        name="bairro"
                        value={formData.bairro}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Cidade:</label>
                      <input
                        type="text"
                        name="cidade"
                        value={formData.cidade}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">UF / Estado:</label>
                      <input
                        type="text"
                        name="uf"
                        value={formData.uf}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Fiscal */}
              {activeModalTab === "Fiscal" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Inscrição Estadual:
                      </label>
                      <input
                        type="text"
                        name="inscricaoEstadual"
                        value={formData.inscricaoEstadual}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Inscrição Municipal:
                      </label>
                      <input
                        type="text"
                        name="inscricaoMunicipal"
                        value={formData.inscricaoMunicipal}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Regime Tributário:
                      </label>
                      <select
                        name="regimeTributario"
                        value={formData.regimeTributario}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="Simples Nacional">Simples Nacional</option>
                        <option value="Lucro Presumido">Lucro Presumido</option>
                        <option value="Lucro Real">Lucro Real</option>
                        <option value="MEI">MEI</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Sócios */}
              {activeModalTab === "Sócios" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="font-bold text-xs text-slate-800">Sócio Principal / Franqueado Operador:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Nome:</label>
                        <input
                          type="text"
                          name="resp1Nome"
                          value={formData.resp1Nome}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">CPF:</label>
                        <input
                          type="text"
                          name="resp1Cpf"
                          value={formData.resp1Cpf}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Telefone:</label>
                        <input
                          type="text"
                          name="resp1Tel"
                          value={formData.resp1Tel}
                          onChange={handleChange}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-brand-dark hover:bg-brand-dark/90 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Save size={14} />
                  {isSaving ? "Salvando..." : "Salvar Franqueada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
        title="Excluir Empresa Franqueada"
        message="Tem certeza que deseja remover esta empresa franqueada da rede? Esta ação removerá os parâmetros contratuais da unidade."
      />

      {/* Ficha para Impressão */}
      {printingItem && (
        <div className="hidden print:block p-8 bg-white text-black">
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-tight">Ficha Cadastral da Franqueada</h1>
              <p className="text-sm text-slate-600">Rede de Franquias União Condominial</p>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-lg">{printingItem.codigoUnidade}</span>
              <p className="text-xs text-slate-500">{new Date().toLocaleDateString("pt-BR")}</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 border p-4 rounded">
              <div>
                <strong>Razão Social:</strong> {printingItem.razaoSocial}
              </div>
              <div>
                <strong>Nome Fantasia:</strong> {printingItem.nomeFantasia}
              </div>
              <div>
                <strong>CNPJ:</strong> {printingItem.cnpj}
              </div>
              <div>
                <strong>Status da Franquia:</strong> {printingItem.statusFranquia}
              </div>
            </div>

            <div className="border p-4 rounded space-y-2">
              <h3 className="font-bold">Parâmetros de Royalties</h3>
              <p><strong>Royalties Contratuais:</strong> {printingItem.royalties}% sobre faturamento bruto</p>
              <p><strong>Fundo de Propaganda:</strong> {printingItem.fundoPropaganda}%</p>
              <p><strong>Faturamento Acumulado:</strong> R$ {(printingItem.faturamentoTotal || 0).toFixed(2)}</p>
              <p><strong>Royalties Devidos à Matriz:</strong> R$ {(printingItem.royaltiesEstimados || 0).toFixed(2)}</p>
            </div>

            <div className="border p-4 rounded space-y-1">
              <h3 className="font-bold">Localização</h3>
              <p>{printingItem.rua}, {printingItem.numero} - {printingItem.bairro}</p>
              <p>{printingItem.cidade}/{printingItem.uf} - CEP: {printingItem.cep}</p>
              <p>Telefone: {printingItem.telefone} | E-mail: {printingItem.email}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
