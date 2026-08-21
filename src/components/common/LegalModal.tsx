import React, { useState, useEffect } from "react";
import { X, ShieldCheck, FileText, CheckCircle2, Building, Scale, Lock, ExternalLink, Printer } from "lucide-react";

export type LegalModalType = "terms" | "privacy" | null;

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: "terms" | "privacy";
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = "terms",
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0071e3] text-white flex items-center justify-center font-bold shadow-md shrink-0">
              {activeTab === "terms" ? <FileText size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                {activeTab === "terms" ? "Termos de Serviço e Uso da Plataforma" : "Política de Privacidade e Proteção de Dados"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                União Condominial.<span className="text-emerald-400 font-bold">GO</span> • Atualizado em Agosto de 2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold"
              title="Imprimir documento"
            >
              <Printer size={16} />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1.5 border-b border-slate-200 gap-1 sm:gap-2 px-4 sm:px-6">
          <button
            onClick={() => setActiveTab("terms")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === "terms"
                ? "bg-white text-[#0071e3] shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Scale size={16} />
            <span>Termos de Serviço</span>
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              activeTab === "privacy"
                ? "bg-white text-[#0071e3] shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Lock size={16} />
            <span>Política de Privacidade (LGPD)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 text-slate-700 text-sm sm:text-base leading-relaxed space-y-6">
          {activeTab === "terms" ? (
            <div className="space-y-6 text-justify">
              <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 sm:p-5 text-slate-800 text-sm">
                <p className="font-semibold text-[#0071e3] mb-1">Bem-vindo(a) à <span className="notranslate" translate="no">União Condominial.GO</span></p>
                <p className="text-xs sm:text-sm text-slate-700">
                  Estes Termos e Condições Gerais de Uso regem o acesso e a utilização da plataforma e dos serviços disponibilizados pela <span className="notranslate" translate="no">União Condominial.GO</span> a condomínios residenciais, comerciais, síndicos, administradoras e profissionais parceiros na Região Metropolitana de Goiânia.
                </p>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">1</span>
                  Do Objeto e Finalidade da Plataforma
                </h3>
                <p>
                  A <strong><span className="notranslate" translate="no">União Condominial.GO</span></strong> atua como ecossistema integrado para gestão de compras de produtos de limpeza e conservação em escala, contratação de serviços condominiais essenciais e rotineiros com valores reduzidos, programa de fidelidade com cashback e clube de benefícios com parceiros homologados.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">2</span>
                  Do Cadastro, Níveis de Cliente e Credenciais
                </h3>
                <p>
                  2.1. O cadastro na plataforma pode ser efetuado por pessoas jurídicas (Condomínios Edilícios, Associações e Administradoras) ou por pessoas físicas devidamente autorizadas (Síndicos, Subsíndicos, Conselheiros e Gestores Prediais).
                </p>
                <p>
                  2.2. O cliente se compromete a fornecer informações verídicas, completas e atualizadas. As credenciais de acesso (e-mail e senha) são de uso pessoal e intransferível, sendo de exclusiva responsabilidade do usuário a guarda e o sigilo de seus dados de autenticação.
                </p>
                <p>
                  2.3. Os preços praticados na plataforma são personalizados conforme o nível de relacionamento do condomínio (Bronze, Prata, Ouro e Diamante), calculados com base no histórico de movimentação e consumo coletivo.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">3</span>
                  Das Compras, Preços e Políticas de Entrega
                </h3>
                <p>
                  3.1. Todos os pedidos de mercadorias estão sujeitos à confirmação de disponibilidade de estoque e validação cadastral.
                </p>
                <p>
                  3.2. As entregas abrangem a Região Metropolitana de Goiânia (Goiânia, Aparecida de Goiânia, Senador Canedo e Trindade), respeitando as condições de frete grátis para compras que atinjam o valor mínimo estabelecido pela plataforma (atualmente acima de R$ 300,00 para a capital).
                </p>
                <p>
                  3.3. É dever do condomínio disponibilizar responsável no local para o recebimento e conferência das mercadorias no ato da entrega.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">4</span>
                  Dos Serviços Condominiais Rotineiros e Ordens de Serviço (OS)
                </h3>
                <p>
                  4.1. Os serviços condominiais rotineiros (limpeza de caixas de gordura, reservatórios de água, manutenção de portões, interfonia, bombas e circuitos de segurança) são prestados por equipe qualificada e parceiros credenciados.
                </p>
                <p>
                  4.2. A formalização do atendimento ocorre mediante abertura de Ordem de Serviço (OS) na plataforma, com indicação de data de preferência e vistoria técnica prévia quando necessária.
                </p>
                <p>
                  4.3. <strong>Regras de Cancelamento e Exclusão:</strong> O cancelamento ou exclusão direta da Ordem de Serviço pelo cliente é garantido em até 24 (vinte e quatro) horas após a solicitação inicial, desde que a execução técnica ainda não tenha sido iniciada. Eventual saldo de cashback utilizado no pedido cancelado é automaticamente estornado para a conta do usuário.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">5</span>
                  Do Programa de Cashback
                </h3>
                <p>
                  5.1. As compras realizadas na plataforma geram créditos em percentual de cashback, acumulados na carteira virtual do usuário.
                </p>
                <p>
                  5.2. Os créditos de cashback são destinados exclusivamente ao abatimento no pagamento de novas compras de produtos e serviços dentro da própria plataforma da <span className="notranslate" translate="no">União Condominial.GO</span>, não sendo convertíveis em dinheiro líquido transferível para terceiros.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">6</span>
                  Do Foro e Legislação Aplicável
                </h3>
                <p>
                  Estes Termos são regidos pelas leis vigentes da República Federativa do Brasil e pelo Código de Defesa do Consumidor. Fica eleito o Foro da Comarca de Goiânia, Estado de Goiás, para dirimir eventuais litígios oriundos deste instrumento.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-justify">
              <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-4 sm:p-5 text-slate-800 text-sm">
                <p className="font-semibold text-emerald-800 mb-1">Compromisso com a Privacidade e Conformidade com a LGPD</p>
                <p className="text-xs sm:text-sm text-slate-700">
                  A <span className="notranslate" translate="no">União Condominial.GO</span> valoriza a sua privacidade e atua em estrita observância à Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 - LGPD).
                </p>
              </div>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">1</span>
                  Controladora dos Dados Pessoais
                </h3>
                <p>
                  A <strong><span className="notranslate" translate="no">União Condominial.GO</span></strong>, com sede na Rua 4, nº 515, Edif. Parthenon Center, Sala 1414, Setor Central, Goiânia - GO, atua como Controladora dos dados pessoais coletados no âmbito de sua plataforma digital.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">2</span>
                  Dados Coletados e Forma de Coleta
                </h3>
                <p>
                  Coletamos apenas as informações estritamente necessárias para a prestação de nossos serviços e cumprimento de obrigações legais e fiscais:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm">
                  <li><strong>Dados Cadastrais do Condomínio / Empresa:</strong> Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual (se houver), endereço completo de faturamento e entrega;</li>
                  <li><strong>Dados do Responsável / Síndico:</strong> Nome completo, CPF, e-mail, telefone/WhatsApp de contato e função/cargo no condomínio;</li>
                  <li><strong>Dados Transacionais:</strong> Histórico de pedidos, comprovantes de entrega, ordens de serviços abertas, extratos de acúmulo e uso de cashback;</li>
                  <li><strong>Dados de Acesso Técnico:</strong> Endereço IP, registros de data/hora de login e autenticação segura via Firebase Authentication.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">3</span>
                  Finalidades do Tratamento de Dados
                </h3>
                <p>Os dados tratados destinam-se exclusivamente às seguintes finalidades:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm">
                  <li>Processar, faturar e entregar produtos de limpeza e conservação adquiridos no site;</li>
                  <li>Agendar, executar e registrar vistorias e manutenções prediais solicitadas;</li>
                  <li>Gerenciar o saldo de cashback e ofertas personalizadas ao nível do condomínio;</li>
                  <li>Emissão de notas fiscais, faturas comerciais e cumprimento de normas tributárias;</li>
                  <li>Comunicação sobre o andamento de entregas e avisos importantes de segurança.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">4</span>
                  Compartilhamento Seguro de Informações
                </h3>
                <p>
                  A <span className="notranslate" translate="no">União Condominial.GO</span> <strong>não comercializa nem compartilha dados pessoais com terceiros para fins publicitários não autorizados</strong>. O compartilhamento ocorre única e exclusivamente com:
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm">
                  <li>Transportadores e motoristas responsáveis pela entrega das mercadorias no condomínio;</li>
                  <li>Técnicos e prestadores homologados para a execução das Ordens de Serviço contratadas;</li>
                  <li>Instituições bancárias e gateways de pagamento para liquidação de cobranças;</li>
                  <li>Autoridades fiscais e judiciais, mediante obrigação legal ou ordem expressa.</li>
                </ul>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">5</span>
                  Segurança, Armazenamento e Direitos dos Titulares (Art. 18 da LGPD)
                </h3>
                <p>
                  5.1. Todos os dados são transmitidos com criptografia SSL/TLS e armazenados em servidores protegidos do Google Cloud Platform (Firebase), com rígido controle de permissões por regras de segurança.
                </p>
                <p>
                  5.2. O titular dos dados possui o direito de solicitar a confirmação da existência de tratamento, o acesso aos dados, a correção de dados incompletos ou inexatos, e a eliminação de dados desnecessários, ressalvada a guarda obrigatória por prazos legais fiscais.
                </p>
              </section>

              <section className="space-y-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 text-left">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-xs font-black">6</span>
                  Canal de Atendimento e Encarregado (DPO)
                </h3>
                <p>
                  Para quaisquer dúvidas, solicitações de retificação ou exercício dos direitos previstos na LGPD, entre em contato com nosso setor de privacidade:
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm space-y-1 font-medium">
                  <p><strong>E-mail:</strong> sac@uniaocondominial.com.br</p>
                  <p><strong>Telefone / WhatsApp:</strong> (62) 99925-0523</p>
                  <p><strong>Endereço:</strong> Rua 4, n. 515, Edif. Parthenon Center Sala 1414 - Setor Central, Goiânia - GO</p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Documento oficial de uso e privacidade da plataforma.</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-[#0071e3] hover:bg-[#005bb5] text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer active:scale-98"
          >
            Li e Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
