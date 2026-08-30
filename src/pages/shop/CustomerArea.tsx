import React from "react";
import { useAuth } from "../../context/AuthContext";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "../../lib/firebase";
import SignupForm from "./SignupForm";
import { CompanyLogo } from "../../components/ui/CompanyLogo";
import { getDefaultDashboardForRole, isStaffRole } from "../../lib/permissions";
import { Lightbulb } from "lucide-react";

export default function CustomerArea() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const queryParams = new URLSearchParams(location.search);
  const isSugestaoFlow = queryParams.get("redirect") === "sugestao" || queryParams.get("sugestao") === "true" || sessionStorage.getItem("openSuggestion") === "true" || localStorage.getItem("openSuggestion") === "true";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLogin, setIsLogin] = React.useState(() => {
    const isSignup = queryParams.get("signup") === "true" || location.state?.signup === true;
    return !isSignup;
  });
  const [isForgotPassword, setIsForgotPassword] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    const currentParams = new URLSearchParams(location.search);
    const isSignupUrl = currentParams.get("signup") === "true" || location.state?.signup === true;
    setIsLogin(!isSignupUrl);
    if (!isSignupUrl) {
      setIsForgotPassword(false);
    }
  }, [location.search, location.state]);

  const auth = getAuth();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      alert("Por favor, informe seu email para recuperar a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-email") {
        alert("Não encontramos uma conta com este email ou o email é inválido.");
      } else {
        alert("Ocorreu um erro ao tentar enviar o email de recuperação.");
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified && userCred.user.email !== "wegbusinessandsolutions@gmail.com") {
          const { db } = await initFirebase();
          const { doc, getDoc } = await import("firebase/firestore");
          const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
          const userData = userDoc.data();
          if (!userData || !userData.emailConfirmadoAdmin) {
            await auth.signOut();
            setAuthError("Você deve confirmar o seu cadastro através do e-mail que fora enviado para que possa utilizar o aplicativo.");
            return;
          }
        }
        
        sessionStorage.setItem('ask_geolocation_now', 'true');
        
        return;
      }
    } catch (error: any) {
      if (error && (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found" || error.code === "auth/invalid-email")) {
        console.warn("Auth warning:", error.message || error.code || error);
      } else {
        console.error(error);
      }
      if (error.code === "auth/operation-not-allowed") {
        setAuthError("Erro: Autenticação por Email e Senha está desativada no seu Firebase. Por favor, acesse o Console do Firebase e ative-a na aba Authentication > Sign-in method.");
      } else if (error.code === "auth/too-many-requests") {
        setAuthError("Muitas tentativas de login. O acesso foi bloqueado temporariamente por segurança para proteger sua conta. Por favor, aguarde alguns minutos antes de tentar novamente.");
      } else {
        setAuthError("Falha na autenticação: Verifique os dados digitados.");
      }
    }
  };

  if (profile) {
    if (isStaffRole(profile.role)) {
      const targetDashboard = getDefaultDashboardForRole(profile.role);
      return <Navigate to={targetDashboard} replace />;
    }
    if (isSugestaoFlow) {
      return <Navigate to="/cliente?sugestao=true" replace />;
    }
    return <Navigate to="/cliente" replace />;
  }

  if (!isLogin) {
    return <SignupForm onGoToLogin={() => setIsLogin(true)} />;
  }

  if (isForgotPassword) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
             <CompanyLogo className="w-[45%] max-w-[45%] h-auto object-contain mx-auto" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center w-full">Recuperar Senha</h1>
          <p className="text-[16.1px] text-slate-500 text-center w-full mx-auto">
            Informe seu email para receber um link de redefinição.
          </p>
        </div>

        <form
          onSubmit={handleForgotPassword}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4"
        >
          {resetSent ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm mb-4 text-center">
              Email de recuperação enviado! Verifique sua caixa de entrada (e pasta de spam) para redefinir sua senha.
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
                required
              />
            </div>
          )}

          {!resetSent && (
            <button
              type="submit"
              className="w-full bg-brand-dark text-white font-bold py-3.5 rounded-lg hover:bg-brand-primary transition shadow-md"
            >
              Enviar Email
            </button>
          )}
        </form>
        <div className="text-center mt-6 text-[16.1px]">
          <button
            onClick={() => {
              setIsForgotPassword(false);
              setResetSent(false);
              navigate("/minha-conta");
            }}
            className="font-semibold text-brand-dark hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
           <CompanyLogo className="w-[45%] max-w-[45%] h-auto object-contain mx-auto" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center w-full">Entrar</h1>
        <p className="text-[16.1px] text-slate-500 text-center w-full mx-auto">Acesse sua Área do Cliente.</p>
      </div>

      {isSugestaoFlow && (
        <div className="mb-5 bg-sky-50 border border-sky-200/90 rounded-2xl p-4 flex items-start gap-3 text-sky-950 text-xs sm:text-sm">
          <div className="p-2 bg-sky-100 text-[#0071e3] rounded-xl shrink-0">
            <Lightbulb size={18} />
          </div>
          <div>
            <span className="font-bold text-sky-900 block mb-0.5">Envio de Sugestão</span>
            <span>Identifique-se ou cadastre-se para prosseguir. Após o login, você retornará automaticamente para o formulário de sugestão.</span>
          </div>
        </div>
      )}
      
      <form
        onSubmit={handleAuth}
        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4"
      >
        {authError && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm mb-4">
            {authError}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
            required
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <button
              type="button"
              onClick={() => setIsForgotPassword(true)}
              className="text-sm font-semibold text-brand-dark hover:underline"
            >
              Esqueci a senha
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-light"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-brand-dark text-white font-bold py-3.5 rounded-lg hover:bg-brand-primary transition shadow-md"
        >
          Entrar
        </button>
      </form>
      <div className="text-center mt-6 text-[16.1px]">
        <span className="text-slate-500 mr-2">Não tem uma conta?</span>
        <button
          onClick={() => navigate("/minha-conta?signup=true")}
          className="font-semibold text-brand-dark hover:underline"
        >
          Cadastre-se
        </button>
      </div>
    </div>
  );
}
