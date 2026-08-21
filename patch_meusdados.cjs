const fs = require('fs');

const content = `import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { User, Building2, Check, CheckCircle } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { sendEmail } from "../../lib/emailService";

export default function MeusDados() {
  const { profile, user } = useAuth();
  const [queroAfiliar, setQueroAfiliar] = useState(false);
  const [unidades, setUnidades] = useState<number | "">("");
  const [diaVencimento, setDiaVencimento] = useState<number | null>(null);
  const [afiliadoStatus, setAfiliadoStatus] = useState<string | null>(null);
  const [loadingAfil, setLoadingAfil] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      // Check if already affiliated
      const checkAfil = async () => {
        const d = await getDoc(doc(db, "afiliados_uc", user.uid));
        if (d.exists()) {
          setAfiliadoStatus(d.data().status || "Pendente de Aceite por E-mail");
        }
      };
      checkAfil();
    }
  }, [user]);

  const calcValorUnidade = (u: number) => {
    if (u <= 12) return 9.9;
    if (u <= 24) return 8.5;
    if (u <= 40) return 8.0;
    if (u <= 60) return 7.5;
    if (u <= 80) return 7.0;
    if (u <= 100) return 6.5;
    if (u <= 150) return 6.0;
    if (u <= 200) return 5.5;
    if (u <= 300) return 5.0;
    return 4.5;
  };

  const calcValorMensalidade = () => {
    if (!unidades) return 0;
    const u = Number(unidades);
    if (isNaN(u) || u < 1) return 0;
    return u * calcValorUnidade(u);
  };

  const handleAfiliar = async () => {
    if (!unidades || Number(unidades) < 1) {
      alert("Informe a quantidade de unidades habitacionais válida.");
      return;
    }
    if (!diaVencimento) {
      alert("Selecione o melhor dia para vencimento do boleto.");
      return;
    }
    setLoadingAfil(true);
    try {
      const data = {
        userId: user?.uid,
        nomeCondominio: profile?.displayName || "Não informado",
        cnpj: profile?.cnpj || profile?.cpfCnpj || "",
        nomeSindico: (profile as any)?.nomeResponsavel || "",
        telefone: profile?.telefone || profile?.phone || "",
        unidadesHabitacionais: Number(unidades),
        diaVencimento,
        valorMensalidade: calcValorMensalidade(),
        status: "Pendente de Aceite por E-mail",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "afiliados_uc", user!.uid), data);

      // Simulate sending email
      await sendEmail({
        to: profile?.email || "",
        subject: "Termo de Afiliação - União Condominial",
        body: \`
Olá \${profile?.displayName || "Cliente"},

Recebemos sua solicitação de afiliação à União Condominial.
Unidades: \${unidades}
Mensalidade: R$ \${calcValorMensalidade().toFixed(2).replace('.', ',')}
Vencimento: Dia \${diaVencimento}

Por favor, responda a este e-mail com "DE ACORDO" para confirmar sua afiliação e aceitar os termos do contrato enviado em anexo.

Atenciosamente,
União Condominial.
        \`
      });

      setAfiliadoStatus("Pendente de Aceite por E-mail");
      alert("Termo de afiliação enviado para o seu e-mail com sucesso! Verifique sua caixa de entrada.");
    } catch (err: any) {
      alert("Erro ao afiliar: " + err.message);
    } finally {
      setLoadingAfil(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0071e3] text-white flex items-center justify-center">
             <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Meus Dados</h1>
            <p className="text-sm text-slate-500">Confira e mantenha seus dados de cadastro atualizados.</p>
          </div>
        </div>
        <div className="p-6">
          <dl className="divide-y divide-slate-100">
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Tipo de cadastro</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.tipoCadastro || (profile?.cnpj ? "Pessoa Jurídica" : "Pessoa Física")}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">{(profile as any)?.tipoCadastro === "Fisica" || !profile?.cnpj ? "Nome Completo" : "Empresa / Condomínio"}</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.displayName || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">{(profile as any)?.tipoCadastro === "Fisica" || !profile?.cnpj ? "C.P.F." : "C.N.P.J."}</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.cnpj || profile?.cpf || profile?.cpfCnpj || profile?.documento || "Não informado"}</dd>
            </div>
            {((profile as any)?.tipoCadastro === "Juridica" || profile?.cnpj) && (
              <>
                <div className="py-4 flex justify-between items-center">
                  <dt className="text-sm font-medium text-slate-500">Responsável / Contato</dt>
                  <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.nomeResponsavel || "Não informado"}</dd>
                </div>
                <div className="py-4 flex justify-between items-center">
                  <dt className="text-sm font-medium text-slate-500">Função</dt>
                  <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.funcao || "Não informado"}</dd>
                </div>
              </>
            )}
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Telefone / Celular</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.telefone || profile?.phone || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Endereço</dt>
              <dd className="text-sm text-slate-900 font-medium text-right max-w-sm">
                {profile?.endereco ? \`\${profile.endereco}, nº \${profile.numero || 'S/N'}\${profile.complemento ? \` - \${profile.complemento}\` : ''}, \${profile.bairro || ''}, \${profile.cidade || ''}/\${profile.estado || ''}, CEP \${profile.cep || ''}\` : "Não informado"}
              </dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">E-mail</dt>
              <dd className="text-sm text-slate-900 font-medium">{profile?.email}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Data de cadastro</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.dataCadastro || "Não informado"}</dd>
            </div>
            <div className="py-4 flex justify-between items-center">
              <dt className="text-sm font-medium text-slate-500">Código de Indicação</dt>
              <dd className="text-sm text-slate-900 font-medium">{(profile as any)?.codigoIndicacao || "Sem Indicação"}</dd>
            </div>
            
            {/* New Affiliation Section */}
            {!afiliadoStatus && (
              <div className="py-6 border-t border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={\`w-6 h-6 rounded border flex items-center justify-center transition-colors \${queroAfiliar ? "bg-[#0071e3] border-[#0071e3]" : "bg-white border-slate-300 group-hover:border-[#0071e3]"}\`}>
                    {queroAfiliar && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="font-bold text-slate-900 text-lg">Quero Afiliar o Meu Condomínio à União Condominial</span>
                </label>

                {queroAfiliar && (
                  <div className="mt-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Informe a Quantidade de Unidades Habitacionais</label>
                      <div className="flex items-center gap-4 flex-wrap">
                        <input
                          type="number"
                          min="1"
                          value={unidades}
                          onChange={(e) => setUnidades(e.target.value ? Number(e.target.value) : "")}
                          className="w-32 px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none"
                          placeholder="Ex: 54"
                        />
                        {unidades && Number(unidades) > 0 && (
                          <div className="text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 font-medium">
                            Valor Mensal: <span className="font-bold text-lg">R$ {calcValorMensalidade().toFixed(2).replace('.', ',')}</span> <span className="text-sm text-emerald-600">(R$ {calcValorUnidade(Number(unidades)).toFixed(2).replace('.', ',')}/unidade)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto bg-white p-4 rounded-xl border border-slate-200">
                      <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 font-bold">Faixa</th>
                            <th className="px-4 py-2 font-bold">Unidades habitacionais</th>
                            <th className="px-4 py-2 font-bold text-right">Valor por unidade/mês</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr><td className="px-4 py-2 font-medium">Faixa 1</td><td className="px-4 py-2">Até 12 unidades</td><td className="px-4 py-2 text-right">R$ 9,90</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 2</td><td className="px-4 py-2">De 13 a 24 unidades</td><td className="px-4 py-2 text-right">R$ 8,50</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 3</td><td className="px-4 py-2">De 25 a 40 unidades</td><td className="px-4 py-2 text-right">R$ 8,00</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 4</td><td className="px-4 py-2">De 41 a 60 unidades</td><td className="px-4 py-2 text-right">R$ 7,50</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 5</td><td className="px-4 py-2">De 61 a 80 unidades</td><td className="px-4 py-2 text-right">R$ 7,00</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 6</td><td className="px-4 py-2">De 81 a 100 unidades</td><td className="px-4 py-2 text-right">R$ 6,50</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 7</td><td className="px-4 py-2">De 101 a 150 unidades</td><td className="px-4 py-2 text-right">R$ 6,00</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 8</td><td className="px-4 py-2">De 151 a 200 unidades</td><td className="px-4 py-2 text-right">R$ 5,50</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 9</td><td className="px-4 py-2">De 201 a 300 unidades</td><td className="px-4 py-2 text-right">R$ 5,00</td></tr>
                          <tr><td className="px-4 py-2 font-medium">Faixa 10</td><td className="px-4 py-2">Acima de 300 unidades</td><td className="px-4 py-2 text-right">R$ 4,50</td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3">Melhor dia para vencimento do Boleto:</label>
                      <div className="flex flex-wrap gap-3">
                        {[5, 10, 15, 20, 25].map(dia => (
                          <label key={dia} className={\`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all \${diaVencimento === dia ? 'border-[#0071e3] bg-blue-50 text-[#0071e3] font-bold' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}\`}>
                            <input type="radio" name="dia" value={dia} checked={diaVencimento === dia} onChange={() => setDiaVencimento(dia)} className="hidden" />
                            Dia {dia}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleAfiliar}
                        disabled={loadingAfil}
                        className="w-full bg-[#0071e3] hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingAfil ? "Processando..." : "Aceitar e Assinar Termo de Afiliação"}
                      </button>
                      <p className="text-xs text-slate-500 text-center mt-3">
                        Ao dar o aceite, o Termo de Afiliação à União Condominial será gerado e enviado para o e-mail cadastrado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {afiliadoStatus && (
               <div className="py-6 border-t border-slate-100">
                 <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#0071e3] shadow-sm">
                     <Building2 size={32} />
                   </div>
                   <h3 className="font-bold text-lg text-slate-900">Seu condomínio é um afiliado!</h3>
                   <p className="text-slate-600">Status atual: <span className="font-bold text-[#0071e3]">{afiliadoStatus}</span></p>
                   {afiliadoStatus === "Pendente de Aceite por E-mail" && (
                     <p className="text-sm text-slate-500 bg-white p-3 rounded-lg mt-2 shadow-xs border border-slate-100">
                       Acesse seu e-mail e responda "DE ACORDO" ao termo enviado para concluir sua afiliação.
                     </p>
                   )}
                 </div>
               </div>
            )}
          </dl>
        </div>
      </div>
      <div className="mt-6 bg-slate-50 p-4 rounded-xl text-center text-sm text-slate-500 border border-slate-200">
        Para alterar seus dados, fale com nosso atendimento em <a href="mailto:sac@uniaocondominial.com.br" className="font-semibold text-brand-dark">sac@uniaocondominial.com.br</a>.
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/cliente/MeusDados.tsx', content);
