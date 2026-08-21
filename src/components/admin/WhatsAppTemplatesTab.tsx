import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Save, MessageSquare, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";
import { motion } from "motion/react";

const DEFAULT_TEMPLATES = {
  template1: `Olá, {pronome} *{sindico}*! Aqui é a *{repNome}*, da União Condominial.

Foi um prazer conversar com você hoje e agradeço muito pela atenção e pelo tempo que nos dedicou.

Como conversamos, a União Condominial foi criada para unir os condomínios da Grande Goiânia, proporcionando acesso a produtos de limpeza e conservação de qualidade, serviços agendados com 50% de desconto, parceiros especializados e condições mais vantajosas para o condomínio.

Estou deixando o convite para que o *{cond}* também faça parte dessa união.

Quando tiver um tempinho, será um prazer continuar nossa conversa e apresentar todos os benefícios.

O seu condomínio não precisa ficar de fora dessa oportunidade.

Um grande abraço,

*{repNome}*
{repTel}
União Condominial
www.uniaocondominial.com.br`,

  template2: `Olá, {pronome} *{sindico}*! Aqui é a *{repNome}*, da União Condominial.

Quero agradecer novamente pela atenção e pelo excelente atendimento que recebi hoje.

E, principalmente, parabenizá-lo(a) pela decisão de incluir o *{cond}* na União Condominial! 👏

Tenho certeza de que essa parceria trará boas oportunidades, economia e mais tranquilidade para a gestão do condomínio.

Agora fazemos parte da mesma união, trabalhando para buscar qualidade, preços justos e soluções que realmente façam diferença no dia a dia do condomínio.

Seja muito bem-vindo(a) à União Condominial!

Conte conosco.

*{repNome}*
{repTel}
União Condominial
www.uniaocondominial.com.br`,

  template3: `Olá, {pronome} *{sindico}*! Meu nome é *{repNome}*, da União Condominial.

Estive no *{cond}* no dia {dataV}, às {horaV}, porém não consegui encontrá-lo(a) pessoalmente.

Deixei na recepção, com *{contato}*, um livreto explicativo sobre a União Condominial, que apresenta nossa proposta, serviços, benefícios e as vantagens de fazer parte dessa união.

Quando tiver um tempinho, peço que faça uma leitura com carinho. Tenho certeza de que encontrará oportunidades interessantes para o *{cond}*.

Assim que possível, gostaria de marcar um horário para apresentar tudo pessoalmente e explicar como podemos ajudar o condomínio.

O *{cond}* não pode perder essa oportunidade.

Fico à disposição.

*{repNome}*
{repTel}
União Condominial
www.uniaocondominial.com.br`
};

export default function WhatsAppTemplatesTab() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success"|"error", text: string} | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const docRef = doc(db, "config", "whatsapp_templates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().templates) {
        setTemplates({
          ...DEFAULT_TEMPLATES, // in case some are missing
          ...docSnap.data().templates
        });
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, "config", "whatsapp_templates"), {
        templates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setMessage({ type: "success", text: "Modelos salvos com sucesso!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving templates:", error);
      setMessage({ type: "error", text: "Erro ao salvar os modelos." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Carregando modelos...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare size={18} className="text-emerald-500" />
            Modelos de Mensagens (WhatsApp)
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Edite os modelos de mensagens utilizados nas Visitas ao Cliente. Utilize as variáveis abaixo para que o sistema injete os dados reais automaticamente no momento do envio.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm disabled:opacity-70 whitespace-nowrap"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
        <h4 className="text-[11px] font-bold text-slate-700 uppercase mb-3">Variáveis Disponíveis</h4>
        <div className="flex flex-wrap gap-2">
          {["{pronome}", "{sindico}", "{repNome}", "{repTel}", "{cond}", "{contato}", "{dataV}", "{horaV}"].map(tag => (
            <code key={tag} className="bg-white border border-slate-300 px-2 py-1 rounded text-[11px] font-bold text-slate-600 shadow-sm">{tag}</code>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
            Recebeu, mas não se afiliou
          </label>
          <textarea
            value={templates.template1}
            onChange={(e) => setTemplates({...templates, template1: e.target.value})}
            rows={10}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none text-slate-700 resize-y font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
            Recebeu e afiliou
          </label>
          <textarea
            value={templates.template2}
            onChange={(e) => setTemplates({...templates, template2: e.target.value})}
            rows={10}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none text-slate-700 resize-y font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
            Não encontrou o Síndico
          </label>
          <textarea
            value={templates.template3}
            onChange={(e) => setTemplates({...templates, template3: e.target.value})}
            rows={10}
            className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none text-slate-700 resize-y font-mono"
          />
        </div>
      </div>
    </div>
  );
}
