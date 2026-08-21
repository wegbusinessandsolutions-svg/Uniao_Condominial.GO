import React, { useState } from "react";
import { Send, MessageSquare, Phone, Mail, MapPin } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { toast } from "react-hot-toast";

export default function Contato() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipoPessoa: "Fisica",
    documento: "",
    nome: "",
    telefone: "",
    email: "",
    mensagem: ""
  });

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    
    if (formData.tipoPessoa === "Fisica") {
      if (value.length > 11) value = value.slice(0, 11);
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      if (value.length > 14) value = value.slice(0, 14);
      value = value.replace(/^(\d{2})(\d)/, "$1.$2");
      value = value.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      value = value.replace(/\.(\d{3})(\d)/, ".$1/$2");
      value = value.replace(/(\d{4})(\d)/, "$1-$2");
    }
    setFormData({ ...formData, documento: value });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 9) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setFormData({ ...formData, telefone: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, "contatos_site"), {
        ...formData,
        createdAt: new Date(),
        status: "Pendente"
      });
      
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
      setFormData({
        tipoPessoa: "Fisica",
        documento: "",
        nome: "",
        telefone: "",
        email: "",
        mensagem: ""
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Ocorreu um erro ao enviar sua mensagem. Tente novamente ou use o WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const whatsappNumber = "55629999250523"; // Adjust to the correct pure number
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=Ol%C3%A1%2C+gostaria+de+falar+com+a+Uni%C3%A3o+Condominial.`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
          Fale com a União Condominial
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Tem alguma dúvida, sugestão ou deseja solicitar um orçamento? 
          Preencha o formulário abaixo ou fale com a gente direto no WhatsApp!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="bg-brand-dark rounded-[2rem] p-8 text-white shadow-lg">
            <h3 className="text-2xl font-bold mb-6 text-blue-200">Atendimento Direto</h3>
            
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 bg-[#25D366] hover:bg-[#1ebd5a] transition-colors p-4 rounded-xl mb-8 group"
            >
              <div className="bg-white/20 p-3 rounded-lg group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-emerald-50 font-medium">WhatsApp</p>
                <p className="font-bold text-lg">(62) 99925-0523</p>
              </div>
            </a>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-3 rounded-lg shrink-0">
                  <Mail className="w-6 h-6 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm text-slate-100 font-medium">E-mail</p>
                  <a href="mailto:sac@uniaocondominial.com.br" className="font-bold text-slate-200 hover:text-blue-200 transition-colors">
                    sac@uniaocondominial.com.br
                  </a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="bg-white/10 p-3 rounded-lg shrink-0">
                  <MapPin className="w-6 h-6 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm text-slate-100 font-medium">Endereço</p>
                  <p className="font-bold leading-relaxed text-slate-200">
                    Rua 4, n. 515, Edif. Parthenon Center<br />
                    Sala 1414 - Setor Central<br />
                    Goiânia - GO
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2rem] p-6 sm:p-10 border border-slate-200/80 shadow-sm h-full">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Envie sua Mensagem</h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Tipo de Contato <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.tipoPessoa}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        tipoPessoa: e.target.value,
                        documento: "" // reset doc when changing type
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all"
                  >
                    <option value="Fisica">Pessoa Física</option>
                    <option value="Juridica">Pessoa Jurídica (Condomínio/Empresa)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    {formData.tipoPessoa === "Fisica" ? "CPF" : "CNPJ"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.documento}
                    onChange={handleDocumentChange}
                    placeholder={formData.tipoPessoa === "Fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">Isso nos ajuda a localizar seu cadastro.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    {formData.tipoPessoa === "Fisica" ? "Nome Completo" : "Razão Social / Nome do Condomínio"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Telefone / WhatsApp para retorno <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    value={formData.telefone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-900 mb-2">
                    Mensagem <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.mensagem}
                    onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                    placeholder="Como podemos te ajudar hoje?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-light focus:border-brand-light transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-dark hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex items-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {loading ? (
                    "Enviando..."
                  ) : (
                    <>
                      <Send size={18} />
                      Enviar Mensagem
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
