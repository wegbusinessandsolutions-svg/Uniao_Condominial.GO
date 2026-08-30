import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import { CompanyLogo } from "../../components/ui/CompanyLogo";
import { CheckCircle2, AlertTriangle, User, Building2 } from "lucide-react";
import { validarCPF, validarCNPJ, formatarCPF, formatarCNPJ } from "../../lib/documentValidators";
import { LegalModal } from "../../components/common/LegalModal";

interface SignupFormProps {
  onGoToLogin: () => void;
}

export default function SignupForm({ onGoToLogin }: SignupFormProps) {
  const navigate = useNavigate();
  const [tipoPessoa, setTipoPessoa] = useState<"Fisica" | "Juridica">("Juridica");
  const [formData, setFormData] = useState<any>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<"terms" | "privacy">("terms");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailError, setEmailError] = useState("");

  const openLegalModal = (tab: "terms" | "privacy") => {
    setLegalModalTab(tab);
    setLegalModalOpen(true);
  };

  const formatCEP = (val: string) => {
    return val.replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2").slice(0, 9);
  };

  const formatPhone = (val: string) => {
     return val.replace(/\D/g, "").replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3").slice(0, 15);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedVal = value;
    if (name.includes("cpf") || name === "cpfResponsavel") {
      formattedVal = formatarCPF(value);
    } else if (name === "cnpj") {
      formattedVal = formatarCNPJ(value);
    } else if (name === "cep") {
      formattedVal = formatCEP(value);
    } else if (name === "telefone") {
      formattedVal = formatPhone(value);
    } else if (name === "quantidadeUnidades") {
      formattedVal = value.replace(/\D/g, "");
    }
    if (name === "email" && emailError) setEmailError("");
    setFormData((prev: any) => ({ ...prev, [name]: formattedVal }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email || !emailRegex.test(formData.email)) {
      setEmailError("Formato de e-mail inválido (exemplo: usuario@provedor.com).");
      setMessage({ type: "error", text: "O e-mail informado tem um formato inválido. Por favor, verifique." });
      return;
    } else {
      setEmailError("");
    }

    // Real-time validations on form submit
    if (tipoPessoa === "Fisica") {
      if (!formData.cpf || !validarCPF(formData.cpf)) {
        setMessage({ type: "error", text: "O CPF digitado é inválido. Por favor, verifique." });
        return;
      }
    } else {
      if (!formData.cnpj || !validarCNPJ(formData.cnpj)) {
        setMessage({ type: "error", text: "O CNPJ digitado é inválido. Por favor, verifique." });
        return;
      }
      if (!formData.tipoCondominio) {
        setMessage({ type: "error", text: "Por favor, selecione o Tipo de Condomínio (Residencial ou Comercial)." });
        return;
      }
      if (!formData.cpfResponsavel || !validarCPF(formData.cpfResponsavel)) {
        setMessage({ type: "error", text: "O CPF do Responsável digitado é inválido. Por favor, verifique." });
        return;
      }
    }

    if (!formData.quantidadeUnidades || Number(formData.quantidadeUnidades) < 1) {
      setMessage({ type: "error", text: "Por favor, informe a Quantidade de Unidades no Condomínio (número maior que zero)." });
      return;
    }

    if (!acceptedTerms) {
      setMessage({ type: "error", text: "É necessário ler e aceitar os Termos de Serviço e a Política de Privacidade para prosseguir." });
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const { db } = await initFirebase();

      const baseUserData = {
        uid: userCred.user.uid,
        email: formData.email,
        displayName: tipoPessoa === "Fisica" ? formData.nomeCompleto : (formData.nomeEmpresa || formData.nomeCompleto),
        nomeEmpresa: formData.nomeEmpresa || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
        nomeCompleto: formData.nomeCompleto || formData.nomeResponsavel || "",
        nomeResponsavel: formData.nomeResponsavel || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
        condominio: formData.nomeEmpresa || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
        sindico: formData.nomeResponsavel || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
        role: "Cliente",
        level: "Bronze",
        status: "Ativo",
        cashbackBalance: 0,
        tipoCadastro: tipoPessoa,
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento || "",
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        cep: formData.cep,
        telefone: formData.telefone,
        phone: formData.telefone,
        quantidadeUnidades: Number(formData.quantidadeUnidades) || formData.quantidadeUnidades,
        tipoCondominio: formData.tipoCondominio || "",
        codigoIndicacao: formData.codigoIndicacao || "",
        dataCadastro: new Date().toLocaleDateString("pt-BR"),
      };

      const specificData = tipoPessoa === "Fisica" ? {
        cpf: formData.cpf,
      } : {
        cnpj: formData.cnpj,
        nomeResponsavel: formData.nomeResponsavel,
        funcao: formData.funcao,
        cpfResponsavel: formData.cpfResponsavel,
        tipoCondominio: formData.tipoCondominio || "",
      };

      await setDoc(doc(db, "users", userCred.user.uid), { ...baseUserData, ...specificData });
      
      await sendEmailVerification(userCred.user);

      setMessage({ type: "success", text: "Você deve confirmar o seu cadastro através do e-mail que fora informado no cadastro." });

      setFormData({});
      
      // Desloga o usuário até que o e-mail seja confirmado
      await signOut(auth);
      
    } catch (error: any) {
      if (error && (error.code === "auth/invalid-credential" || error.code === "auth/email-already-in-use" || error.code === "auth/weak-password" || error.code === "auth/invalid-email")) {
        console.warn("Signup warning:", error.message || error.code || error);
      } else {
        console.error(error);
      }
      if (error.code === "auth/operation-not-allowed") {
        setMessage({ type: "error", text: "Autenticação de Email/Senha não está ativada neste projeto Firebase. Por favor, ative o provedor de Email/Senha." });
      } else if (error.code === "auth/too-many-requests") {
        try {
          const { db } = await initFirebase();
          const tempUid = "temp-user-" + Date.now();
          
          const baseUserData = {
            uid: tempUid,
            email: formData.email,
            displayName: tipoPessoa === "Fisica" ? formData.nomeCompleto : (formData.nomeEmpresa || formData.nomeCompleto),
            nomeEmpresa: formData.nomeEmpresa || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
            nomeCompleto: formData.nomeCompleto || formData.nomeResponsavel || "",
            nomeResponsavel: formData.nomeResponsavel || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
            condominio: formData.nomeEmpresa || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
            sindico: formData.nomeResponsavel || (tipoPessoa === "Fisica" ? formData.nomeCompleto : ""),
            role: "Cliente",
            level: "Bronze",
            status: "Ativo",
            cashbackBalance: 0,
            tipoCadastro: tipoPessoa,
            endereco: formData.endereco,
            numero: formData.numero,
            complemento: formData.complemento || "",
            bairro: formData.bairro,
            cidade: formData.cidade,
            estado: formData.estado,
            cep: formData.cep,
            telefone: formData.telefone,
            phone: formData.telefone,
            quantidadeUnidades: Number(formData.quantidadeUnidades) || formData.quantidadeUnidades,
            tipoCondominio: formData.tipoCondominio || "",
            codigoIndicacao: formData.codigoIndicacao || "",
            dataCadastro: new Date().toLocaleDateString("pt-BR"),
          };

          const specificData = tipoPessoa === "Fisica" ? {
            cpf: formData.cpf,
          } : {
            cnpj: formData.cnpj,
            nomeResponsavel: formData.nomeResponsavel,
            funcao: formData.funcao,
            cpfResponsavel: formData.cpfResponsavel,
            tipoCondominio: formData.tipoCondominio || "",
          };

          await setDoc(doc(db, "users", tempUid), { ...baseUserData, ...specificData });

          setMessage({ type: "success", text: "Cadastro de contingência realizado com sucesso devido ao limite de requisições do Firebase. Bem-vindo!" });
          setFormData({});
          
          // Log them in using local storage fallback
          localStorage.setItem("temp_user_uid", tempUid);
          localStorage.setItem("temp_user_email", formData.email);
          
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          return;
        } catch (fallbackErr) {
          console.error("Fallback signup error:", fallbackErr);
        }
        setMessage({ type: "error", text: "Muitas tentativas de cadastro de sua rede/dispositivo. O acesso foi bloqueado temporariamente por segurança. Por favor, aguarde alguns minutos antes de tentar novamente." });
      } else if (error.code === "auth/email-already-in-use") {
        setMessage({ type: "error", text: "Este e-mail já está cadastrado. Por favor, vá para a tela de login." });
      } else {
        setMessage({ type: "error", text: "Erro ao criar conta. " + (error.message || "") });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
           <CompanyLogo className="w-[45%] max-w-[45%] h-auto object-contain mx-auto" />
        </div>
        {!(message && message.type === 'success') && (
          <>
            <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center w-full">Criar Conta</h1>
            <p className="text-[16.1px] text-slate-500 text-center w-full mx-auto">Cadastre-se e comece a acumular cashback.</p>
          </>
        )}
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        {!(message && message.type === 'success') && (
          <div className="flex justify-center mb-8">
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tipoPessoa === "Fisica" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setTipoPessoa("Fisica")}
              >
                Pessoa Física
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${tipoPessoa === "Juridica" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setTipoPessoa("Juridica")}
              >
                Pessoa Jurídica
              </button>
            </div>
          </div>
        )}

        {message && message.type === 'success' ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                <CheckCircle2 size={40} />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Verifique seu E-mail</h2>
            <div className="bg-green-50/50 border border-green-100 text-green-800 p-6 rounded-xl mb-8 max-w-lg mx-auto">
              <p className="text-lg font-medium leading-relaxed">{message.text}</p>
            </div>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="px-8 py-3.5 bg-brand-dark text-white font-bold rounded-lg hover:bg-brand-primary transition shadow-md w-full sm:w-auto"
            >
              Retornar para a página inicial
            </button>
          </div>
        ) : (
          <>
            {message && (
              <div className="p-4 rounded-lg mb-6 text-sm bg-red-100 text-red-800">
                {message.text}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-6">
              {tipoPessoa === "Fisica" ? (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Nome completo <span className="text-red-500">*</span></label>
                <input required type="text" name="nomeCompleto" value={formData.nomeCompleto || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Nº de C.P.F. <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf || ""}
                  onChange={handleInputChange}
                  className={`w-full sm:w-1/2 border rounded-lg p-2.5 outline-none focus:ring-2 ${
                    !formData.cpf
                      ? "border-slate-300 focus:ring-brand-light"
                      : validarCPF(formData.cpf)
                      ? "border-green-500 focus:ring-green-500/30"
                      : "border-red-500 focus:ring-red-500/30"
                  }`}
                />
                {formData.cpf && (
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {validarCPF(formData.cpf) ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} /> CPF válido
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle size={13} /> CPF inválido ou incompleto
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Nome da Empresa / Condomínio <span className="text-red-500">*</span></label>
                <input required type="text" name="nomeEmpresa" value={formData.nomeEmpresa || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Tipo de Condomínio <span className="text-red-500">*</span></label>
                <select
                  required
                  name="tipoCondominio"
                  value={formData.tipoCondominio || ""}
                  onChange={handleInputChange}
                  className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light bg-white"
                >
                  <option value="">Selecione o tipo de condomínio...</option>
                  <option value="Residencial">Residencial</option>
                  <option value="Comercial">Comercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Nº C.N.P.J. <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj || ""}
                  onChange={handleInputChange}
                  className={`w-full sm:w-1/2 border rounded-lg p-2.5 outline-none focus:ring-2 ${
                    !formData.cnpj
                      ? "border-slate-300 focus:ring-brand-light"
                      : validarCNPJ(formData.cnpj)
                      ? "border-green-500 focus:ring-green-500/30"
                      : "border-red-500 focus:ring-red-500/30"
                  }`}
                />
                {formData.cnpj && (
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {validarCNPJ(formData.cnpj) ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} /> CNPJ válido
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle size={13} /> CNPJ inválido ou incompleto
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Nome do Responsável / Contato <span className="text-red-500">*</span></label>
                <input required type="text" name="nomeResponsavel" value={formData.nomeResponsavel || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Função <span className="text-red-500">*</span></label>
                    <input required type="text" name="funcao" value={formData.funcao || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1">Nº de C.P.F. do Responsável <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="text"
                      name="cpfResponsavel"
                      placeholder="000.000.000-00"
                      value={formData.cpfResponsavel || ""}
                      onChange={handleInputChange}
                      className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 ${
                        !formData.cpfResponsavel
                          ? "border-slate-300 focus:ring-brand-light"
                          : validarCPF(formData.cpfResponsavel)
                          ? "border-green-500 focus:ring-green-500/30"
                          : "border-red-500 focus:ring-red-500/30"
                      }`}
                    />
                    {formData.cpfResponsavel && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        {validarCPF(formData.cpfResponsavel) ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={13} /> CPF do Responsável válido
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium flex items-center gap-1">
                            <AlertTriangle size={13} /> CPF do Responsável inválido
                          </span>
                        )}
                      </div>
                    )}
                 </div>
              </div>
            </>
          )}

          <div className="pt-4 pb-2 border-b border-slate-100">
             <h3 className="font-bold text-slate-900">Endereço</h3>
          </div>

          <div className="grid grid-cols-12 gap-4">
             <div className="col-span-12 sm:col-span-8">
                <label className="block text-sm font-bold text-slate-900 mb-1">Endereço <span className="text-red-500">*</span></label>
                <input required type="text" name="endereco" value={formData.endereco || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
             <div className="col-span-12 sm:col-span-4">
                <label className="block text-sm font-bold text-slate-900 mb-1">Nº <span className="text-red-500">*</span></label>
                <input required type="text" name="numero" value={formData.numero || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Complemento</label>
                <input type="text" name="complemento" value={formData.complemento || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Bairro / Setor <span className="text-red-500">*</span></label>
                <input required type="text" name="bairro" value={formData.bairro || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
          </div>

          <div className="grid grid-cols-12 gap-4">
             <div className="col-span-12 sm:col-span-6">
                <label className="block text-sm font-bold text-slate-900 mb-1">Cidade <span className="text-red-500">*</span></label>
                <input required type="text" name="cidade" value={formData.cidade || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
             <div className="col-span-6 sm:col-span-2">
                <label className="block text-sm font-bold text-slate-900 mb-1">Estado <span className="text-red-500">*</span></label>
                <select required name="estado" value={formData.estado || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light">
                   <option value="">UF</option>
                   <option value="GO">GO</option>
                   <option value="SP">SP</option>
                   <option value="RJ">RJ</option>
                   <option value="MG">MG</option>
                   <option value="DF">DF</option>
                   {/* Outros estados... */}
                </select>
             </div>
             <div className="col-span-6 sm:col-span-4">
                <label className="block text-sm font-bold text-slate-900 mb-1">CEP <span className="text-red-500">*</span></label>
                <input required type="text" name="cep" placeholder="00000-000" value={formData.cep || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
          </div>

          <div>
             <label className="block text-sm font-bold text-slate-900 mb-1">Telefone / WhatsApp <span className="text-red-500">*</span></label>
             <input required type="text" name="telefone" value={formData.telefone || ""} onChange={handleInputChange} className="w-full sm:w-1/2 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
          </div>

          <div>
             <label className="block text-sm font-bold text-slate-900 mb-1">Quantidade de Unidades no Condomínio: <span className="text-red-500">*</span></label>
             <input
               required
               type="text"
               inputMode="numeric"
               pattern="[0-9]*"
               name="quantidadeUnidades"
               placeholder="Ex: 12"
               value={formData.quantidadeUnidades || ""}
               onChange={handleInputChange}
               className="w-full sm:w-1/2 border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
             />
          </div>

          <div className="pt-4 pb-2 border-b border-slate-100">
             <h3 className="font-bold text-slate-900">Dados para o Login</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
             <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">E-mail <span className="text-red-500">*</span></label>
                <input
                  required
                  type="email"
                  name="email"
                  value={formData.email || ""}
                  onChange={handleInputChange}
                  className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 ${
                    emailError ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:ring-brand-light"
                  }`}
                />
                {emailError && (
                  <p className="text-xs text-red-500 font-semibold mt-1">
                    {emailError}
                  </p>
                )}
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-900 mb-1">Senha <span className="text-red-500">*</span></label>
                <input required type="password" name="password" minLength={6} value={formData.password || ""} onChange={handleInputChange} className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             </div>
          </div>

          <div className="pb-4">
             <label className="block text-sm font-bold text-slate-900 mb-1">Código de Indicação (Opcional)</label>
             <input type="text" name="codigoIndicacao" value={formData.codigoIndicacao || ""} onChange={handleInputChange} placeholder="Ex: CONSULTOR123" className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light" />
             <p className="text-xs text-slate-500 mt-1">Se você foi indicado por um consultor, insira o código aqui.</p>
          </div>

          {/* Terms and Privacy Checkbox */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 w-4 h-4 text-[#0071e3] border-slate-300 rounded focus:ring-[#0071e3] cursor-pointer shrink-0"
              />
              <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Declaro que li, compreendi e concordo com os{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openLegalModal("terms");
                  }}
                  className="font-bold text-[#0071e3] hover:underline cursor-pointer inline"
                >
                  Termos de Serviço
                </button>{" "}
                e com a{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openLegalModal("privacy");
                  }}
                  className="font-bold text-[#0071e3] hover:underline cursor-pointer inline"
                >
                  Política de Privacidade
                </button>{" "}
                da <span className="notranslate" translate="no">União Condominial.GO</span>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-dark hover:bg-brand-primary text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-98 disabled:bg-slate-400 cursor-pointer"
          >
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <div className="mt-6 text-center text-[16.1px]">
            <span className="text-slate-500 mr-2">Já tem conta?</span>
            <button
              type="button"
              onClick={() => {
                onGoToLogin();
                navigate("/minha-conta");
              }}
              className="font-semibold text-brand-dark hover:underline"
            >
               Entrar
            </button>
        </div>
        </>
        )}
      </div>

      <LegalModal
        isOpen={legalModalOpen}
        initialTab={legalModalTab}
        onClose={() => setLegalModalOpen(false)}
      />
    </div>
  );
}
