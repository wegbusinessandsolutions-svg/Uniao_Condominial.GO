import React from "react";
import { 
  Building, Target, Users, Wrench, ShieldCheck, MapPin, Briefcase, 
  Clock, CheckCircle2, Droplets, TrendingDown, Store, Star
} from "lucide-react";

export default function Sobre() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12">
      
      {/* Hero Header */}
      <div className="bg-[#003b5c] rounded-[2rem] p-8 sm:p-12 text-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
            A união que transforma a gestão condominial na Grande Goiânia
          </h1>
          <p className="text-sky-100 text-lg sm:text-xl max-w-3xl mx-auto mt-6 leading-relaxed">
            Descubra como a força coletiva está gerando economia, qualidade e eficiência para os condomínios da nossa região.
          </p>
        </div>
      </div>

      {/* Quem Somos - Combinação do existente com o Livreto */}
      <section className="bg-white rounded-[2rem] p-6 sm:p-10 md:p-12 border border-slate-200/80 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          <div className="flex-1 space-y-5 text-slate-600 text-base sm:text-lg leading-relaxed text-justify">
            <div className="inline-flex items-center gap-2 bg-sky-50 text-[#0071e3] px-3.5 py-1.5 rounded-full text-sm font-bold tracking-wider uppercase mb-2 border border-blue-100">
              <Users size={16} />
              <span>Quem Somos</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight text-left leading-tight">
              Criada por quem vive, todos os dias, a rotina de um condomínio.
            </h2>
            
            <p>
              A <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span> nasceu da experiência prática de seu fundador — consultor de empresas e síndico profissional em atividade em Goiânia, Goiás.
            </p>
            <p>
              Ele conhece de perto, no dia a dia, os entraves enfrentados por síndicos e administradores na capital: cotações demoradas, prestadores de serviço descomprometidos, os famosos "quebra-galhos" e, ainda, os custos que variam de forma desigual conforme a localização e o padrão do condomínio.
            </p>
            <p>
              Foi para resolver justamente esses problemas que nasceu a União Condominial: uma empresa que caminha lado a lado com síndicos e administradores, oferecendo produtos de limpeza e conservação de qualidade comprovada e preço justo — tudo isso aliado a um modelo inovador de prestação de serviços em comum, com agendamento facilitado e valores até <strong>50% mais baixos</strong> que os praticados no mercado, onde todos se unem em busca do mesmo objetivo: economia, qualidade e tranquilidade para o seu condomínio.
            </p>
            <p className="font-bold text-[#0071e3] text-lg pt-2 text-left">
              É a força coletiva da classe condominial que faz a diferença.
            </p>
          </div>
          
          <div className="flex-1 w-full max-w-full relative">
            <div className="w-full max-w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-slate-100 bg-slate-100 flex items-center justify-center">
              <img 
                 src="/img_end_page.png" 
                 alt="União Condominial.GO"
                className="w-full max-w-full h-auto sm:h-full object-contain sm:object-cover block"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-[#0071e3]/20 rounded-full blur-2xl -z-10"></div>
            <div className="absolute -top-4 -left-4 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col items-center text-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-sky-100 text-[#0071e3] rounded-2xl flex items-center justify-center">
            <Briefcase size={32} />
          </div>
          <h3 className="text-4xl font-black text-slate-900">10+</h3>
          <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">Serviços Condominiais Rotineiros</p>
        </div>
        
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col items-center text-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingDown size={32} />
          </div>
          <h3 className="text-4xl font-black text-slate-900">-50%</h3>
          <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">Mais Barato que o Mercado Local</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm flex flex-col items-center text-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
            <Store size={32} />
          </div>
          <h3 className="text-4xl font-black text-slate-900">100%</h3>
          <p className="text-slate-600 font-bold uppercase tracking-wider text-sm">Produtos de Empresas Goianas</p>
        </div>
      </section>

      {/* Nossa Missão */}
      <section className="bg-[#003b5c] rounded-[2rem] p-8 sm:p-12 border border-[#002f4b] shadow-xl text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Target size={200} className="text-white" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#002f4b] text-sky-400 px-4 py-2 rounded-full text-sm font-bold tracking-wider uppercase border border-slate-700">
            <Target size={16} />
            <span>Nossa Missão</span>
          </div>
          <p className="text-xl sm:text-2xl md:text-3xl font-medium text-white leading-relaxed">
            "Unir os condomínios da Grande Goiânia para conquistar juntos, condições realmente vantajosas; Desonerando o orçamento condominial e devolvendo a síndicos e administradores tempo para o que realmente importa."
          </p>
        </div>
      </section>

      {/* O Que Oferecemos */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">O Que Oferecemos</h2>
          <div className="w-16 h-1.5 bg-[#0071e3] rounded-full mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Box 1 */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-blue-50 text-[#0071e3] rounded-2xl flex items-center justify-center mb-6">
              <Droplets size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-4 uppercase">Produtos de Limpeza e Conservação</h3>
            <p className="text-slate-600 leading-relaxed mb-6 flex-1">
              Parcerias com grandes empresas goianas de fornecimento, garantindo qualidade comprovada, valorizando quem produz em Goiás.
            </p>
            <div className="pt-6 border-t border-slate-100 flex items-center gap-2 text-sm font-bold text-[#0071e3]">
              <ShieldCheck size={18} /> Qualidade Comprovada
            </div>
          </div>

          {/* Box 2 */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-6">
              <Clock size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-4 uppercase">Serviços Condominiais Rotineiros</h3>
            <p className="text-slate-600 leading-relaxed mb-6">
              Equipe própria para atender, com dia e hora marcada, as demandas rotineiras, sem imprevistos e sem "quebra-galho".
            </p>
            <div className="flex flex-wrap gap-2 mt-auto mb-6">
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Limpeza de Reservatórios</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Caixas de Gordura</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">CFTV e Alarmes</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Portões Eletrônicos</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Cercas Elétricas</span>
            </div>
            <div className="pt-6 mt-auto border-t border-slate-100 flex items-center gap-2 text-sm font-bold text-sky-600">
              <Clock size={18} /> Equipe Própria e Agendada
            </div>
          </div>

          {/* Box 3 */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
              <Wrench size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-4 uppercase">Parcerias Especializadas</h3>
            <p className="text-slate-600 leading-relaxed mb-6 flex-1">
              Para serviços que exigem certificação própria, contamos com parceiros comprometidos com a União Condominial, que praticam valores diferenciados sem abrir mão da qualidade.
            </p>
            <div className="flex flex-wrap gap-2 mt-auto mb-6">
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Extintores</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Dedetização</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Vidros Temperados</span>
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg">Motobombas</span>
            </div>
            <div className="pt-6 mt-auto border-t border-slate-100 flex items-center gap-2 text-sm font-bold text-indigo-600">
              <Star size={18} /> Parceiros Especializados
            </div>
          </div>
        </div>
      </section>

      {/* Faça Parte */}
      <section className="bg-gradient-to-br from-sky-50 to-white rounded-[2rem] p-8 sm:p-12 md:p-16 border border-sky-100 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="flex-1 space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                Traga o seu condomínio para a União.
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                A União Condominial foi criada para você síndico ou administrador que busca economia, eficiência e tranquilidade na gestão do dia a dia. Quanto mais condomínios se unem, maiores são as vantagens conquistadas para todos.
              </p>
            </div>
            
            <ul className="space-y-4">
              {[
                "Economia de até 50% em serviços rotineiros",
                "Equipe agendada, sem \"quebra-galhos\"",
                "Produtos de Limpeza e conservação com qualidade, preço justo e que valoriza o nosso estado.",
                "Clube de Benefícios para os condôminos",
                "Compartilhamento de informações da categoria em nosso mural Público."
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-1 w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-slate-700 font-medium leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="w-full lg:w-[450px]">
            <div className="bg-[#003b5c] rounded-3xl p-8 shadow-2xl border border-[#002f4b] text-white space-y-6">
              <div className="flex items-center gap-4 border-b border-[#002f4b] pb-6">
                <div className="w-14 h-14 bg-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center shrink-0">
                  <Building size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Faça Parte!</h3>
                  <p className="text-slate-400 text-sm leading-tight mt-1">
                    Fale com um de nossos representantes e conheça sem compromisso todas as vantagens de afiliar o seu condomínio à União Condominial.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 text-slate-300">
                  <MapPin size={18} className="text-slate-500 shrink-0" />
                  <span>Rua 4, Nº 515, Sala 1414<br/>Parthenon Center, Setor Central<br/>Goiânia - GO</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
