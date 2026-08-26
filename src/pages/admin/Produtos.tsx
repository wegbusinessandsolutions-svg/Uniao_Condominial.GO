import React, { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import {
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Pencil,
  X,
  Printer,
  Image as ImageIcon,
  AlertTriangle
} from "lucide-react";
import { initFirebase } from "../../lib/firebase";
import { logAction } from "../../lib/audit";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { useFranqueada } from "../../context/FranqueadaContext";

interface Produto {
  id?: string;
  // Básico
  nome?: string;
  sku?: string;
  ean?: string;
  marca?: string;
  categoria?: string; // Mantendo para compatibilidade
  categorias?: string[];
  descricaoCurta?: string;
  descricaoLonga?: string;
  ativo?: boolean;
  // Preços
  custoUltimo?: string;
  precoVenda?: string;
  precoMinimo?: string;
  minVendaPercent?: string;
  precoBronze?: string;
  precoPrata?: string;
  precoOuro?: string;
  precoDiamante?: string;
  // Estoque
  qtdAtual?: string;
  estoqueMinimo?: string;
  localizacao?: string;
  unidade?: string; // UN/KG/L
  peso?: string;
  // Mídia
  imagemPrincipal?: string;
  galeria?: string[];
  // Fiscal
  ncm?: string;
  cest?: string;
  cfop?: string;
  origem?: string;
  unidadeTributavel?: string;
  fatorConversaoTributavel?: string;
  eanTributavel?: string;
  gtinEmbalagem?: string;
  cnpjFabricante?: string;
  // ICMS
  cstIcms?: string;
  csosn?: string;
  aliquotaIcms?: string;
  aliquotaIcmsSt?: string;
  // IPI/PIS/COFINS
  cstIpi?: string;
  aliquotaIpi?: string;
  codBeneficioFiscal?: string;
  cstPis?: string;
  aliquotaPis?: string;
  cstCofins?: string;
  aliquotaCofins?: string;
  valorAproxTributos?: string;
  // Others fiscal
  pesoBruto?: string;
  pesoLiquido?: string;
  codigoAnp?: string;
  escalaRelevante?: string; // S/N
  informacoesAdicionais?: string;
  [key: string]: any;
}

const ImageUploadLabel: React.FC<{
  label?: string;
  imageUrl?: string;
  onUpload: (base64: string) => void;
  isUploading: boolean;
  setUploading: (val: boolean) => void;
}> = ({ label = "Enviar", imageUrl, onUpload, isUploading, setUploading }) => {
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // max width/height

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

        const base64String = canvas.toDataURL("image/webp", 0.7);
        onUpload(base64String);
        setUploading(false);
      };
      img.onerror = () => {
        alert("Erro ao processar a imagem.");
        setUploading(false);
      }
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao ler o arquivo.");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 relative min-h-[140px]">
       {imageUrl ? (
          <img src={imageUrl} alt="Upload preview" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
       ) : (
          <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
       )}
       
       <label className={`cursor-pointer bg-white px-4 py-2 border border-slate-200 rounded-lg shadow-sm text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 z-10 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isUploading ? "Enviando..." : (
             <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {label}
             </>
          )}
          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
       </label>
       {imageUrl && (
         <button 
            type="button"
            onClick={() => onUpload("")} 
            className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200 z-10 shadow-sm"
         >
            <X className="w-4 h-4" />
         </button>
       )}
    </div>
  )
}


export default function Produtos() {
  const { filterByFranqueada, injectFranqueada, canModify, isFranqueada } = useFranqueada();
  const [data, setData] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Produto>({});
  const [originalData, setOriginalData] = useState<Produto | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"Basico" | "Precos" | "Estoque" | "Midia" | "Fiscal">("Basico");
  
  // Img upload states
  const [uploadingImgPrincipal, setUploadingImgPrincipal] = useState(false);
  const [uploadingGaleria, setUploadingGaleria] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { db } = await initFirebase();
      const querySnapshot = await getDocs(collection(db, "produtos"));
      const items: Produto[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setData(items);

      // Buscar categorias
      const catSnap = await getDocs(collection(db, "categorias_produtos"));
      const catList = catSnap.docs.map((d: any) => d.data().nome).filter(Boolean);
      // Se não houver categorias cadastradas, usa as padrão
      if (catList.length === 0) {
        setCategoriasDisponiveis(["Limpeza Geral", "Equipamentos", "Descartáveis", "Kits Essenciais", "Acessórios", "Diversos"]);
      } else {
        setCategoriasDisponiveis(catList);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item?: Produto) => {
    setActiveTab("Basico");
    if (item) {
      if (!canModify(item)) {
        alert("Acesso Restrito: Você só pode editar produtos da sua própria franquia.");
        return;
      }
      setEditingId(item.id || null);
      let categorias = item.categorias || [];
      if (categorias.length === 0 && item.categoria) {
         categorias = [item.categoria];
      }
      const initialForm = { ...item, galeria: item.galeria || [], categorias };
      setFormData(initialForm);
      setOriginalData(JSON.parse(JSON.stringify(initialForm)));
    } else {
      setEditingId(null);
      setFormData(injectFranqueada({ ativo: true, galeria: [], categorias: [] } as Produto));
      setOriginalData(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({});
    setOriginalData(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as any;
    const val = type === "checkbox" ? e.target.checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || uploadingImgPrincipal || uploadingGaleria) return;

    if (!formData.nome) {
      alert("O nome do produto é obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const { db } = await initFirebase();
      const rawData = { ...formData };

      // Clean undefined
      Object.keys(rawData).forEach(key => (rawData as any)[key] === undefined && delete (rawData as any)[key]);
      const dataToSave = injectFranqueada(rawData);

      if (editingId) {
        const oldDoc = data.find(p => p.id === editingId);
        if (oldDoc && !canModify(oldDoc)) {
          alert("Acesso Restrito: Permissão negada para alterar produto de outra franquia.");
          setIsSaving(false);
          return;
        }
        await updateDoc(doc(db, "produtos", editingId), dataToSave);
        await logAction(
          `Edição de produto: ${dataToSave.nome}`,
          "Estoque",
          { productId: editingId, productName: dataToSave.nome },
          originalData,
          dataToSave
        );
      } else {
        const docRef = await addDoc(collection(db, "produtos"), dataToSave);
        await logAction(
          `Criação de produto: ${dataToSave.nome}`,
          "Estoque",
          { productId: docRef.id, productName: dataToSave.nome },
          null,
          dataToSave
        );
      }
      handleCloseModal();
      await fetchData();
    } catch (error) {
      console.error("Error saving doc:", error);
      alert("Erro ao salvar dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { db } = await initFirebase();
      const productToDelete = data.find(p => p.id === id);
      if (productToDelete && !canModify(productToDelete)) {
        alert("Acesso Restrito: Você só pode excluir produtos da sua própria franquia.");
        return;
      }
      const productName = productToDelete?.nome || id;

      await deleteDoc(doc(db, "produtos", id));

      // LOG ACTION
      await logAction(
        `Exclusão de produto: ${productName}`,
        "Comercial",
        { productId: id, productName },
        productToDelete || null,
        null
      );

      await fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredData = filterByFranqueada(data).filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cadastro de Produto/mercadoria</h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#0071e3] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0071e3]/90 transition shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-[#0B1A3A] outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-16">Mídia</th>
                <th className="p-4 font-semibold">SKU</th>
                <th className="p-4 font-semibold">Nome</th>
                <th className="p-4 font-semibold">Categoria</th>
                <th className="p-4 font-semibold text-right">Preço Venda</th>
                <th className="p-4 font-semibold text-right">Estoque</th>
                <th className="p-4 font-semibold text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    <td className="p-4">
                      <div className="w-10 h-10 bg-slate-100 rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-16" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-48" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-24" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-16 ml-auto" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-12 ml-auto" />
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-slate-100 rounded w-16 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      {item.imagemPrincipal ? (
                        <img src={item.imagemPrincipal} alt="" className="w-10 h-10 object-cover rounded bg-slate-100 border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                           <ImageIcon className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-500">{item.sku || "—"}</td>
                    <td className="p-4 text-sm font-medium text-slate-900">{item.nome}</td>
                    <td className="p-4 text-sm text-slate-500">
                      {item.categorias?.length ? item.categorias.join(", ") : (item.categoria || "—")}
                    </td>
                    <td className="p-4 text-sm font-semibold text-slate-900 text-right">
                       {item.precoVenda ? `R$ ${Number(item.precoVenda).toFixed(2)}` : "—"}
                    </td>
                    <td className="p-4 text-sm text-right">
                      {(() => {
                        const qtd = Number(item.qtdAtual) || 0;
                        const isBaixo = qtd < 5;
                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            {isBaixo && (
                              <span 
                                title={`Atenção: Apenas ${qtd} unidade(s) disponível(is)! Quantidade inferior a 5 unidades.`}
                                className="inline-flex items-center text-amber-600 bg-amber-50 border border-amber-300 rounded-full p-1 shadow-2xs"
                              >
                                <AlertTriangle size={13} className="animate-pulse" />
                              </span>
                            )}
                            <span className={`font-semibold ${isBaixo ? "text-amber-800 font-bold" : "text-slate-700"}`}>
                              {item.qtdAtual || "0"}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => window.print()}
                          className="text-slate-400 hover:text-blue-900 transition-colors"
                          title="Imprimir"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => {}}
                          className="text-slate-400 hover:text-sky-600 transition-colors"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => item.id && setItemToDelete(item.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto pt-10">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl flex flex-col my-auto max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? "Editar Produto" : "Novo Produto"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-fit mb-6 overflow-x-auto">
                  {(["Basico", "Precos", "Estoque", "Midia", "Fiscal"] as const).map(tab => (
                     <button
                        key={tab}
                        type="button"
                        className={`px-6 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${activeTab === tab ? "bg-white text-[#0B1A3A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        onClick={() => setActiveTab(tab)}
                     >
                        {tab === "Basico" ? "Básico" : tab === "Precos" ? "Preços" : tab === "Midia" ? "Mídia" : tab}
                     </button>
                  ))}
                </div>

                <form id="productForm" onSubmit={handleSave} className="space-y-6">
                   {activeTab === "Basico" && (
                      <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1">Nome *</label>
                            <input required type="text" name="nome" value={formData.nome || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">SKU</label>
                               <input type="text" name="sku" value={formData.sku || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">EAN</label>
                               <input type="text" name="ean" value={formData.ean || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Marca</label>
                               <input type="text" name="marca" value={formData.marca || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-900 mb-2">Categorias</label>
                            <div className="flex flex-wrap gap-2">
                               {categoriasDisponiveis.map(cat => {
                                  const isSelected = (formData.categorias || []).includes(cat);
                                  return (
                                     <button
                                        key={cat}
                                        type="button"
                                        onClick={() => {
                                           const current = formData.categorias || [];
                                           if (current.includes(cat)) {
                                              setFormData(prev => ({...prev, categorias: current.filter(c => c !== cat)}));
                                           } else {
                                              setFormData(prev => ({...prev, categorias: [...current, cat]}));
                                           }
                                        }}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${isSelected ? 'bg-[#0B1A3A] text-white border border-[#0B1A3A]' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                     >
                                        {cat}
                                     </button>
                                  )
                               })}
                            </div>
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1">Descrição curta</label>
                            <input type="text" name="descricaoCurta" value={formData.descricaoCurta || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                         </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-900 mb-1">Descrição longa</label>
                            <textarea name="descricaoLonga" rows={4} value={formData.descricaoLonga || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm resize-none"></textarea>
                         </div>
                         
                         <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50 p-4 rounded-lg">
                           <div className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" name="ativo" checked={formData.ativo ?? true} onChange={handleChange} className="sr-only peer" />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
                              <span className="ml-3 text-sm font-medium text-slate-900">Ativo (visível no catálogo)</span>
                           </div>
                         </div>
                      </div>
                   )}

                   {activeTab === "Precos" && (
                      <div className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Custo último</label>
                               <input type="number" step="0.01" name="custoUltimo" value={formData.custoUltimo || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Preço venda *</label>
                               <input required type="number" step="0.01" name="precoVenda" value={formData.precoVenda || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm font-bold" />
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Preço mínimo</label>
                               <input type="number" step="0.01" name="precoMinimo" value={formData.precoMinimo || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">% Mínima de venda</label>
                               <input type="number" step="0.01" name="minVendaPercent" value={formData.minVendaPercent || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                         </div>
                         
                         <div className="pt-4 pb-2 border-b border-slate-100">
                            <h3 className="font-bold text-[#0B1A3A]">Preços por Nível do Cliente</h3>
                         </div>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-[#cd7f32]/5 border border-[#cd7f32]/30 rounded-xl p-3 shadow-xs">
                               <label className="block text-sm font-bold text-[#cd7f32] mb-1.5">Bronze</label>
                               <input type="number" step="0.01" name="precoBronze" value={formData.precoBronze || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-[#cd7f32]/20 outline-none focus:ring-2 focus:ring-[#cd7f32]/40 text-sm bg-white text-slate-800" />
                            </div>
                            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 shadow-xs">
                               <label className="block text-sm font-bold text-[#8a8a93] mb-1.5">Prata</label>
                               <input type="number" step="0.01" name="precoPrata" value={formData.precoPrata || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#8a8a93]/40 text-sm bg-white text-slate-800" />
                            </div>
                            <div className="bg-amber-50/50 border border-[#dbb83e]/30 rounded-xl p-3 shadow-xs">
                               <label className="block text-sm font-bold text-[#dbb83e] mb-1.5">Ouro</label>
                               <input type="number" step="0.01" name="precoOuro" value={formData.precoOuro || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-[#dbb83e]/20 outline-none focus:ring-2 focus:ring-[#dbb83e]/40 text-sm bg-white text-slate-800" />
                            </div>
                            <div className="bg-cyan-50/50 border border-[#2a8cad]/30 rounded-xl p-3 shadow-xs">
                               <label className="block text-sm font-bold text-[#2a8cad] mb-1.5">Diamante</label>
                               <input type="number" step="0.01" name="precoDiamante" value={formData.precoDiamante || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-[#2a8cad]/20 outline-none focus:ring-2 focus:ring-[#2a8cad]/40 text-sm bg-white text-slate-800" />
                            </div>
                         </div>
                      </div>
                   )}

                   {activeTab === "Estoque" && (
                      <div className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Qtd atual *</label>
                               <input required type="number" name="qtdAtual" value={formData.qtdAtual || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Estoque mínimo</label>
                               <input type="number" name="estoqueMinimo" value={formData.estoqueMinimo || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Localização</label>
                               <input type="text" name="localizacao" value={formData.localizacao || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="col-span-2">
                               <label className="block text-sm font-bold text-slate-900 mb-1">Unidade (UN/KG/L)</label>
                               <input type="text" name="unidade" value={formData.unidade || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                            <div className="col-span-1">
                               <label className="block text-sm font-bold text-slate-900 mb-1">Peso (kg)</label>
                               <input type="number" step="0.001" name="peso" value={formData.peso || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                            </div>
                         </div>
                      </div>
                   )}

                   {activeTab === "Midia" && (
                      <div className="space-y-6">
                         <div>
                            <label className="block text-sm font-bold text-slate-900 mb-2">Imagem principal</label>
                            <div className="w-48">
                               <ImageUploadLabel 
                                  label="Enviar" 
                                  imageUrl={formData.imagemPrincipal} 
                                  isUploading={uploadingImgPrincipal} 
                                  setUploading={setUploadingImgPrincipal}
                                  onUpload={(b64) => setFormData(prev => ({...prev, imagemPrincipal: b64}))} 
                               />
                            </div>
                         </div>
                         
                         <div>
                            <div className="flex justify-between items-center mb-2">
                               <label className="block text-sm font-bold text-slate-900">Galeria (até 3 imagens)</label>
                               <span className="text-xs text-slate-500 font-medium">{(formData.galeria || []).length}/3</span>
                            </div>
                            <div className="flex gap-4 flex-wrap">
                               {(formData.galeria || []).map((img, index) => (
                                  <div key={index} className="w-40 relative">
                                     <ImageUploadLabel 
                                        label="Alterar" 
                                        imageUrl={img} 
                                        isUploading={false}
                                        setUploading={() => {}}
                                        onUpload={(b64) => {
                                           const newGaleria = [...(formData.galeria || [])];
                                           if (b64) {
                                              newGaleria[index] = b64;
                                           } else {
                                              newGaleria.splice(index, 1);
                                           }
                                           setFormData(prev => ({...prev, galeria: newGaleria}));
                                        }} 
                                     />
                                  </div>
                               ))}
                               
                               {(formData.galeria || []).length < 3 && (
                                  <div className="w-40">
                                     <ImageUploadLabel 
                                        label="Adicionar" 
                                        isUploading={uploadingGaleria} 
                                        setUploading={setUploadingGaleria}
                                        onUpload={(b64) => {
                                           if(b64) {
                                             setFormData(prev => ({...prev, galeria: [...(prev.galeria || []), b64]}));
                                           }
                                        }} 
                                     />
                                  </div>
                               )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2">JPG, PNG ou WebP. Auto-compressão aplicada.</p>
                         </div>
                      </div>
                   )}

                   {activeTab === "Fiscal" && (
                      <div className="space-y-6">
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-sm text-slate-500 mb-4">Campos para emissão de NF-e conforme layout SEFAZ.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">NCM</label>
                                  <input type="text" name="ncm" placeholder="00000000" value={formData.ncm || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">CEST</label>
                                  <input type="text" name="cest" placeholder="0000000" value={formData.cest || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">CFOP</label>
                                  <input type="text" name="cfop" placeholder="5102" value={formData.cfop || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Origem (0-8)</label>
                                  <input type="text" name="origem" value={formData.origem || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Unidade tributável</label>
                                  <input type="text" name="unidadeTributavel" value={formData.unidadeTributavel || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Fator conversão tributável</label>
                                  <input type="text" name="fatorConversaoTributavel" value={formData.fatorConversaoTributavel || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">EAN tributável</label>
                                  <input type="text" name="eanTributavel" value={formData.eanTributavel || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">GTIN embalagem</label>
                                  <input type="text" name="gtinEmbalagem" value={formData.gtinEmbalagem || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">CNPJ fabricante</label>
                                  <input type="text" name="cnpjFabricante" value={formData.cnpjFabricante || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                            </div>
                            
                            {/* ICMS block */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
                               <h4 className="text-sm font-bold text-[#0B1A3A] mb-3">ICMS</h4>
                               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">CST ICMS (Reg. Normal)</label>
                                     <input type="text" name="cstIcms" value={formData.cstIcms || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">CSOSN (Simples)</label>
                                     <input type="text" name="csosn" value={formData.csosn || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Alíquota ICMS %</label>
                                     <input type="text" name="aliquotaIcms" value={formData.aliquotaIcms || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Alíquota ICMS-ST %</label>
                                     <input type="text" name="aliquotaIcmsSt" value={formData.aliquotaIcmsSt || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                               </div>
                            </div>
                            
                            {/* IPI/PIS/COFINS block */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
                               <h4 className="text-sm font-bold text-[#0B1A3A] mb-3">IPI / PIS / COFINS</h4>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">CST IPI</label>
                                     <input type="text" name="cstIpi" value={formData.cstIpi || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Alíquota IPI %</label>
                                     <input type="text" name="aliquotaIpi" value={formData.aliquotaIpi || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Cód. Benefício Fiscal</label>
                                     <input type="text" name="codBeneficioFiscal" value={formData.codBeneficioFiscal || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">CST PIS</label>
                                     <input type="text" name="cstPis" value={formData.cstPis || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Alíquota PIS %</label>
                                     <input type="text" name="aliquotaPis" value={formData.aliquotaPis || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">CST COFINS</label>
                                     <input type="text" name="cstCofins" value={formData.cstCofins || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Alíquota COFINS %</label>
                                     <input type="text" name="aliquotaCofins" value={formData.aliquotaCofins || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-bold text-slate-700 mb-1">Valor aprox. tributos R$</label>
                                     <input type="text" name="valorAproxTributos" value={formData.valorAproxTributos || ""} onChange={handleChange} className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                                  </div>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Peso bruto (kg)</label>
                                  <input type="text" name="pesoBruto" value={formData.pesoBruto || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Peso líquido (kg)</label>
                                  <input type="text" name="pesoLiquido" value={formData.pesoLiquido || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Código ANP</label>
                                  <input type="text" name="codigoAnp" value={formData.codigoAnp || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                               <div>
                                  <label className="block text-sm font-bold text-slate-900 mb-1">Escala relevante (S/N)</label>
                                  <input type="text" name="escalaRelevante" value={formData.escalaRelevante || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm" />
                               </div>
                            </div>

                            <div>
                               <label className="block text-sm font-bold text-slate-900 mb-1">Informações adicionais (NF-e)</label>
                               <textarea name="informacoesAdicionais" rows={3} value={formData.informacoesAdicionais || ""} onChange={handleChange} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-[#0B1A3A] text-sm resize-none"></textarea>
                            </div>
                         </div>
                      </div>
                   )}
                </form>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
               <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-white transition bg-slate-50"
               >
                  Cancelar
               </button>
               <button
                  onClick={handleSave}
                  disabled={isSaving || uploadingImgPrincipal || uploadingGaleria}
                  className="bg-[#2563eb] text-white px-8 py-2 rounded-xl font-bold hover:bg-[#1d4ed8] transition shadow-md disabled:bg-slate-400 flex items-center justify-center gap-2"
               >
                  {isSaving ? "Salvando..." : "Salvar"}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
