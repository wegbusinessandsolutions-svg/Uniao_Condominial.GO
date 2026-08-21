import React, { useState, useEffect } from "react";
import { X, Upload, CheckCircle, AlertCircle, Building2, MapPin, Phone, Mail, Globe, QrCode, Tag, FileText, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { z } from "zod";

export const beneficioSchema = z.object({
  nome: z.string().min(2, "O nome da empresa ou benefício é obrigatório (mínimo 2 caracteres)."),
  tipo: z.string().min(1, "Selecione o tipo de benefício."),
  valor: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
  descricao: z.string().optional(),
  regras: z.string().optional(),
  status: z.string().default("Ativo"),
  telefone: z.string().optional(),
  email: z.string().refine((val) => !val || z.string().email().safeParse(val).success, {
    message: "Informe um e-mail com formato válido.",
  }).optional(),
  website: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  mapaLink: z.string().optional(),
  imagem: z.string().optional(),
  qrcode: z.string().optional(),
});

export type BeneficioFormData = z.infer<typeof beneficioSchema>;

interface FormularioBeneficioModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: any | null;
  onSave: (data: any) => Promise<void>;
  isSaving?: boolean;
}

export default function FormularioBeneficioModal({
  isOpen,
  onClose,
  editingItem,
  onSave,
  isSaving = false,
}: FormularioBeneficioModalProps) {
  const [formData, setFormData] = useState<Partial<BeneficioFormData>>({
    nome: "",
    tipo: "Desconto (%)",
    valor: "",
    descricao: "",
    regras: "",
    status: "Ativo",
    telefone: "",
    email: "",
    website: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    mapaLink: "",
    imagem: "",
    qrcode: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        nome: editingItem.nome || "",
        tipo: editingItem.tipo || "Desconto (%)",
        valor: editingItem.valor !== undefined ? editingItem.valor : "",
        descricao: editingItem.descricao || "",
        regras: editingItem.regras || "",
        status: editingItem.status || "Ativo",
        telefone: editingItem.telefone || "",
        email: editingItem.email || "",
        website: editingItem.website || "",
        endereco: editingItem.endereco || "",
        numero: editingItem.numero || "",
        complemento: editingItem.complemento || "",
        bairro: editingItem.bairro || "",
        cidade: editingItem.cidade || "",
        estado: editingItem.estado || "",
        cep: editingItem.cep || "",
        mapaLink: editingItem.mapaLink || "",
        imagem: editingItem.imagem || "",
        qrcode: editingItem.qrcode || "",
      });
    } else {
      setFormData({
        nome: "",
        tipo: "Desconto (%)",
        valor: "",
        descricao: "",
        regras: "",
        status: "Ativo",
        telefone: "",
        email: "",
        website: "",
        endereco: "",
        numero: "",
        complemento: "",
        cidade: "",
        estado: "",
        cep: "",
        imagem: "",
        qrcode: "",
      });
    }
    setErrors({});
  }, [editingItem, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof BeneficioFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleImageUpload = (file: File) => {
    if (!file) return;
    setIsUploadingImage(true);

    const reader = new FileReader();
    reader.onload = (e) => {
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

        const base64String = canvas.toDataURL("image/webp", 0.75);
        handleChange("imagem", base64String);
        setIsUploadingImage(false);
      };
      img.onerror = () => {
        alert("Erro ao processar imagem.");
        setIsUploadingImage(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      alert("Erro ao carregar o arquivo.");
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUploadingImage) {
      alert("Aguarde o carregamento da imagem finalizar.");
      return;
    }

    // Zod Validation
    const result = beneficioSchema.safeParse(formData);

    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0];
        if (path) {
          formattedErrors[path.toString()] = issue.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }

    try {
      await onSave(result.data);
      onClose();
    } catch (err) {
      console.error("Erro ao salvar benefício:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex justify-between items-center bg-gradient-to-r from-slate-50 via-white to-sky-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs border border-sky-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {editingItem ? "Editar Benefício Credenciado" : "Novo Benefício Credenciado"}
              </h2>
              <p className="text-xs text-slate-500">
                Preencha as informações do parceiro e oferta para exibição no Clube de Benefícios.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-6 overflow-y-auto space-y-6">
          <form id="beneficio-form" onSubmit={handleSubmit} className="space-y-6">
            {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS DA OFERTA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <Tag className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  1. Informações Básicas da Oferta
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Nome do Benefício/Empresa */}
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Empresa / Benefício <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Farmácia São Paulo, Restaurante Sabor..."
                    value={formData.nome || ""}
                    onChange={(e) => handleChange("nome", e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none transition-all ${
                      errors.nome
                        ? "border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/20"
                        : "border-slate-200 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                    }`}
                  />
                  {errors.nome && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} /> {errors.nome}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status || "Ativo"}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-medium text-slate-800"
                  >
                    <option value="Ativo">Ativo (Visível aos moradores)</option>
                    <option value="Inativo">Inativo (Oculto)</option>
                  </select>
                </div>

                {/* Tipo de Vantagem */}
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Vantagem <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipo || "Desconto (%)"}
                    onChange={(e) => handleChange("tipo", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 font-medium text-slate-800"
                  >
                    <option value="Desconto (%)">Desconto em Porcentagem (%)</option>
                    <option value="Desconto (R$)">Desconto em Valor Fixo (R$)</option>
                    <option value="Vantagem Especial">Vantagem Especial</option>
                    <option value="Brinde Exclusivo">Brinde Exclusivo</option>
                  </select>
                </div>

                {/* Valor */}
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Valor da Vantagem <span className="text-slate-400 font-normal">(Ex: 15 para 15% ou 50 para R$50)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 15, 20.00, Isenção de taxa..."
                    value={formData.valor !== undefined && formData.valor !== null ? formData.valor : ""}
                    onChange={(e) => handleChange("valor", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Descrição */}
                <div className="sm:col-span-12">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Descrição Detalhada do Benefício
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Descreva detalhadamente qual desconto o morador recebe e em quais serviços/produtos..."
                    value={formData.descricao || ""}
                    onChange={(e) => handleChange("descricao", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 resize-y"
                  />
                </div>

                {/* Regras e Condições */}
                <div className="sm:col-span-12">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Regras e Termos de Uso <span className="text-slate-400 font-normal">(Restrições, datas, documentos exigidos)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Válido mediante apresentação do cartão do condômino. Não cumulativo com outras promoções."
                    value={formData.regras || ""}
                    onChange={(e) => handleChange("regras", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: DADOS DE CONTATO E LOCALIZAÇÃO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <MapPin className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  2. Contato e Endereço da Empresa
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Telefone */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone || ""}
                    onChange={(e) => handleChange("telefone", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Email */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" /> E-mail de Contato
                  </label>
                  <input
                    type="email"
                    placeholder="contato@empresa.com"
                    value={formData.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none transition-all ${
                      errors.email
                        ? "border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-50/20"
                        : "border-slate-200 focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle size={12} /> {errors.email}
                    </p>
                  )}
                </div>

                {/* Website */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe size={12} className="text-slate-400" /> Website / Instagram
                  </label>
                  <input
                    type="text"
                    placeholder="www.empresa.com.br"
                    value={formData.website || ""}
                    onChange={(e) => handleChange("website", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Logradouro / Endereço */}
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rua / Avenida (Endereço)
                  </label>
                  <input
                    type="text"
                    placeholder="Av. Paulista, Rua das Flores..."
                    value={formData.endereco || ""}
                    onChange={(e) => handleChange("endereco", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Número e Complemento */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    placeholder="1000"
                    value={formData.numero || ""}
                    onChange={(e) => handleChange("numero", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Compl.</label>
                  <input
                    type="text"
                    placeholder="Sala 12"
                    value={formData.complemento || ""}
                    onChange={(e) => handleChange("complemento", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                {/* Bairro, Cidade, Estado, CEP */}
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bairro/Setor</label>
                  <input
                    type="text"
                    placeholder="Centro"
                    value={formData.bairro || ""}
                    onChange={(e) => handleChange("bairro", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="São Paulo"
                    value={formData.cidade || ""}
                    onChange={(e) => handleChange("cidade", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF)</label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={formData.estado || ""}
                    onChange={(e) => handleChange("estado", e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 uppercase"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={formData.cep || ""}
                    onChange={(e) => handleChange("cep", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                </div>
                
                <div className="sm:col-span-12">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin size={13} className="text-emerald-600" /> Link do Mapa (Ajuste manual de localização)
                  </label>
                  <input
                    type="text"
                    placeholder="https://maps.app.goo.gl/..."
                    value={formData.mapaLink || ""}
                    onChange={(e) => handleChange("mapaLink", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se preenchido, o QR Code de localização usará este link exato em vez de buscar o endereço digitado acima.
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: MÍDIA E QR CODE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  3. Logotipo / Imagem e Link do QR Code
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Imagem Upload */}
                <div className="sm:col-span-7 space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Logotipo / Foto do Parceiro
                  </label>
                  <div className="flex items-center gap-3">
                    {formData.imagem ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                        <img
                          src={formData.imagem}
                          alt="Preview"
                          className="w-full h-full object-contain p-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleChange("imagem", "")}
                          className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl-md hover:bg-red-700"
                          title="Remover Imagem"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200">
                        <Upload size={14} />
                        <span>{isUploadingImage ? "Processando..." : "Selecionar Imagem"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                          }}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Formatos aceitos: JPG, PNG, WEBP (Otimizado automaticamente).
                      </p>
                    </div>
                  </div>
                </div>

                {/* QR Code / Link Direto */}
                <div className="sm:col-span-5 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <QrCode size={13} className="text-sky-600" /> Link do QR Code no Celular
                  </label>
                  <input
                    type="text"
                    placeholder="https://sualoja.com/cupom-condominio"
                    value={formData.qrcode || ""}
                    onChange={(e) => handleChange("qrcode", e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    URL para a qual o QR Code gerado no guia PDF redirecionará o morador.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="beneficio-form"
            disabled={isSaving || isUploadingImage}
            className="px-5 py-2 text-xs font-extrabold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer border border-sky-800"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Salvando Benefício...</span>
              </>
            ) : (
              <>
                <CheckCircle size={15} />
                <span>Salvar Benefício</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
