import React from "react";

export default function Sobre() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Hero Header */}
      <div className="bg-brand-dark rounded-[2rem] p-6 sm:p-10 mb-8 text-white text-center shadow-sm">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white !text-white tracking-tight" style={{ color: "#ffffff" }}>
          A união que transforma a gestão condominial na Grande Goiânia
        </h1>
        <p className="text-sky-100 text-base sm:text-lg max-w-3xl mx-auto mt-3">
          Descubra como a força coletiva está gerando economia, qualidade e eficiência para os condomínios da nossa região.
        </p>
      </div>

      <section className="bg-white rounded-[2rem] p-6 sm:p-10 md:p-12 border border-slate-200/80 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          <div className="flex-1 space-y-4 text-slate-600 text-base sm:text-lg md:text-xl leading-relaxed text-justify">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-6 text-left">
              Quem Somos & Nossa Proposta
            </h2>
            <p>
              A <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span> – Produtos de Limpeza e Conservação nasceu de uma ideia simples e poderosa: quando os condomínios se unem, ganham força de negociação, melhores preços e mais qualidade — algo que sozinhos dificilmente conseguiriam.
            </p>
            <p>
              Somos a primeira empresa privada do Brasil a transformar essa união em resultado real, conectando condomínios a produtos e prestadores de serviço comprometidos com preço justo e excelência.
            </p>
            <p>
              É a força coletiva da classe condominial que faz a diferença. Quanto mais condomínios se unem, mais forte fica essa rede — e mais fácil se torna o dia a dia de síndicos e administradores da região. Dependemos da adesão de cada condomínio para que sejamos fortes e consigamos os melhores benefícios para todos!
            </p>
            <p className="font-bold text-[#0071e3] text-lg sm:text-xl pt-2 text-left">
              <span className="notranslate" translate="no">União Condominial.<span className="text-emerald-600 font-bold">GO</span></span>. A união que gera economia, qualidade e eficiência.
            </p>
          </div>
          <div className="flex-1 w-full relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border border-slate-100">
              <img 
                src="/img_end_page.png" 
                alt="União Condominial.GO"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 bg-brand-light/20 rounded-full blur-2xl -z-10"></div>
            <div className="absolute -top-4 -left-4 h-32 w-32 bg-blue-500/10 rounded-full blur-2xl -z-10"></div>
          </div>
        </div>
      </section>
    </div>
  );
}
