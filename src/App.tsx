/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { FranqueadaProvider } from "./context/FranqueadaContext";
import { A2HSProvider } from "./context/A2HSContext";
import { A2HSPromptBanner } from "./components/common/A2HSPromptBanner";
import { A2HSInstallModal } from "./components/common/A2HSInstallModal";
import { GeolocationLoginPrompt } from "./components/common/GeolocationLoginPrompt";
import ShopLayout from "./components/layouts/ShopLayout";
import AdminLayout from "./components/layouts/AdminLayout";
import { AdminContentSkeleton } from "./components/ui/Skeleton";

import { QrCode } from "lucide-react";

// Shop Pages (Eagerly loaded for quick initial store landing)
import Home from "./pages/shop/Home";
import Sobre from "./pages/shop/Sobre";
import Contato from "./pages/shop/Contato";
import Catalog from "./pages/shop/Catalog";
import ProductDetail from "./pages/shop/ProductDetail";
import Cart from "./pages/shop/Cart";
import CustomerArea from "./pages/shop/CustomerArea";

// Lazy-Loaded Admin & Complex Dashboard Pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const Usuarios = lazy(() => import("./pages/admin/Usuarios"));
const GenericModulePage = lazy(() => import("./pages/admin/GenericModulePage"));
const ManutencaoDados = lazy(() => import("./pages/admin/ManutencaoDados"));
const AdminProdutos = lazy(() => import("./pages/admin/Produtos"));
const AcompanhamentoVenda = lazy(() => import("./pages/admin/AcompanhamentoVenda"));
const Relatorios = lazy(() => import("./pages/admin/relatorios"));
const IntegracaoPagamentos = lazy(() => import("./pages/admin/IntegracaoPagamentos"));
const ConfiguracaoFrete = lazy(() => import("./pages/admin/ConfiguracaoFrete"));
const ConfiguracaoNotificacoes = lazy(() => import("./pages/admin/ConfiguracaoNotificacoes"));
const MuralCondominialAdmin = lazy(() => import("./pages/admin/MuralCondominialAdmin"));
const DashboardClienteConfig = lazy(() => import("./pages/admin/DashboardClienteConfig"));
const DashboardFinanceiroConfig = lazy(() => import("./pages/admin/DashboardFinanceiroConfig"));
const DashboardComercialConfig = lazy(() => import("./pages/admin/DashboardComercialConfig"));
const DashboardComercialExternoConfig = lazy(() => import("./pages/admin/DashboardComercialExternoConfig"));
const DashboardEntregaMercadoriasConfig = lazy(() => import("./pages/admin/DashboardEntregaMercadoriasConfig"));
const DashboardExpedicaoConfig = lazy(() => import("./pages/admin/DashboardExpedicaoConfig"));

const Empregados = lazy(() => import("./pages/admin/Empregados"));
const Empresa = lazy(() => import("./pages/admin/Empresa"));
const Franqueadora = lazy(() => import("./pages/admin/Franqueadora"));
const PermissoesUsuario = lazy(() => import("./pages/admin/PermissoesUsuario"));
const BackupExport = lazy(() => import("./pages/admin/BackupExport"));

import CustomerLayout from "./components/layouts/CustomerLayout";
import CustomerDashboard from "./pages/cliente/Dashboard";
import MeusDados from "./pages/cliente/MeusDados";
import Afiliacao from "./pages/cliente/Afiliacao";
import MeusPedidos from "./pages/cliente/MeusPedidos";
import LocalEntrega from "./pages/cliente/LocalEntrega";
import ServicosEssenciais from "./pages/cliente/ServicosEssenciais";
import MinhasOrdensServico from "./pages/cliente/OrdensServico";
const ServicosEssenciaisAdmin = lazy(() => import("./pages/admin/ServicosEssenciais"));
const OrdensServicoAdmin = lazy(() => import("./pages/admin/OrdensServico"));

import MarcasParceiras from "./pages/cliente/MarcasParceiras";
import ClubeBeneficios from "./pages/cliente/ClubeBeneficios";
import CartaoVirtual from "./pages/cliente/CartaoVirtual";
import Cashback from "./pages/cliente/Cashback";
import CustomerSuporte from "./pages/cliente/Suporte";
const CashbackAdmin = lazy(() => import("./pages/admin/CashbackAdmin"));

const CashbackControle = lazy(() => import("./pages/financeiro/CashbackControle"));
const FinanceiroDashboard = lazy(() => import("./pages/financeiro/Dashboard"));

const Fornecedores = lazy(() => import("./pages/financeiro/Fornecedores"));
const ContasPagar = lazy(() => import("./pages/financeiro/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/financeiro/ContasReceber"));
const Bancos = lazy(() => import("./pages/financeiro/Bancos"));
const CentrosCusto = lazy(() => import("./pages/financeiro/CentrosCusto"));

const ComercialDashboard = lazy(() => import("./pages/comercial/Dashboard"));
const ComercialExternoDashboard = lazy(() => import("./pages/comercial/DashboardExterno"));
const ComercialClientes = lazy(() => import("./pages/comercial/Clientes"));
const ComercialVisitas = lazy(() => import("./pages/comercial/VisitasCliente"));
const ComercialComissoes = lazy(() => import("./pages/comercial/Comissoes"));
const ControleAfiliados = lazy(() => import("./pages/comercial/ControleAfiliados"));
const ComercialCodigosIndicacao = lazy(() => import("./pages/comercial/CodigosIndicacao"));
const ComercialCalculadora = lazy(() => import("./pages/comercial/CalculadoraPrecos"));
const ExpedicaoDashboard = lazy(() => import("./pages/expedicao/Dashboard"));
const Entregas = lazy(() => import("./pages/expedicao/Entregas"));
const ExpedicaoPedidosOnline = lazy(() => import("./pages/expedicao/PedidosOnline"));
const ExpedicaoEstoque = lazy(() => import("./pages/expedicao/Estoque"));
const LogisticaRoteirizacao = lazy(() => import("./pages/admin/LogisticaRoteirizacao"));
const EntregadorDashboard = lazy(() => import("./pages/entregador/Dashboard"));

const FinanceiroFaturamento = lazy(() => import("./pages/financeiro/Faturamento"));
import AceiteAfiliacao from "./pages/AceiteAfiliacao";
import ScrollToTopButton from "./components/ui/ScrollToTopButton";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <FranqueadaProvider>
            <CartProvider>
              <ThemeProvider>
                <A2HSProvider>
                <GeolocationLoginPrompt />
                <Routes>
          <Route path="/aceite-afiliacao/:id" element={<AceiteAfiliacao />} />
          {/* Shop Routes */}
          <Route path="/" element={<ShopLayout />}>
            <Route index element={<Home />} />
            <Route path="sobre" element={<Sobre />} />
            <Route path="contato" element={<Contato />} />
            <Route path="produtos" element={<Catalog />} />
            <Route path="produto/:id" element={<ProductDetail />} />
            <Route path="carrinho" element={<Cart />} />
            <Route path="minha-conta" element={<CustomerArea />} />
          </Route>

          {/* Customer Area Routes */}
          <Route path="/cliente" element={<CustomerLayout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="meus-dados" element={<MeusDados />} />
            <Route path="afiliado" element={<Afiliacao />} />
            <Route path="pedidos" element={<MeusPedidos />} />
            <Route path="endereco" element={<LocalEntrega />} />
            <Route path="produtos" element={<Catalog />} />
            <Route path="servicos" element={<ServicosEssenciais />} />
            <Route path="ordens-servico" element={<MinhasOrdensServico />} />
            <Route path="marcas" element={<MarcasParceiras />} />
            <Route path="beneficios" element={<ClubeBeneficios />} />
            <Route path="cartao" element={<CartaoVirtual />} />
            <Route path="cashback" element={<Cashback />} />
            <Route path="suporte" element={<CustomerSuporte />} />
          </Route>

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="configuracao-frete" element={<ConfiguracaoFrete />} />
            <Route path="configuracao-notificacoes" element={<ConfiguracaoNotificacoes />} />
            <Route path="mural-condominial" element={<MuralCondominialAdmin />} />
            <Route path="config-dashboard-cliente" element={<DashboardClienteConfig />} />
            <Route path="config-dashboard-financeiro" element={<DashboardFinanceiroConfig />} />
            <Route path="config-dashboard-comercial" element={<DashboardComercialConfig />} />
            <Route path="config-dashboard-comercial-externo" element={<DashboardComercialExternoConfig />} />
            <Route path="config-dashboard-entrega-mercadorias" element={<DashboardEntregaMercadoriasConfig />} />
            <Route path="config-dashboard-expedicao" element={<DashboardExpedicaoConfig />} />
            <Route
              path="produtos"
              element={<AdminProdutos />}
            />
            <Route
              path="usuarios"
              element={<Usuarios />}
            />
            <Route
              path="manutencao"
              element={<ManutencaoDados />}
            />
            <Route
              path="permissoes-usuario"
              element={<PermissoesUsuario />}
            />
            <Route
              path="cashback"
              element={<CashbackAdmin />}
            />
            <Route path="empregados" element={<Empregados />} />
            <Route path="franqueadora" element={<Franqueadora />} />
            <Route path="empresa" element={<Empresa />} />
            <Route path="backup-exportacao" element={<BackupExport />} />
            <Route path="backup" element={<BackupExport />} />
            <Route path="comercial-externo" element={<ComercialExternoDashboard />} />
            <Route
              path="kits-essenciais"
              element={
                <GenericModulePage
                  title="Kits Essenciais"
                  description="Gerencie os combos pré-montados de produtos."
                  onAddMessage="Novo Kit"
                  collectionName="kits_essenciais"
                  fields={[
                    {
                      key: "nome",
                      label: "Nome do Kit",
                      type: "text",
                      required: true,
                    },
                    {
                      key: "produtos",
                      label: "Produtos Inclusos",
                      type: "text",
                      required: true,
                    },
                    {
                      key: "preco",
                      label: "Preço Fixo (R$)",
                      type: "number",
                      required: true,
                    },
                  ]}
                  columns={[
                    { key: "nome", label: "Kit" },
                    { key: "produtos", label: "Produtos" },
                    {
                      key: "preco",
                      label: "Preço",
                      render: (val) => `R$ ${Number(val || 0).toFixed(2)}`,
                    },
                  ]}
                />
              }
            />
            <Route
              path="integracao-pagamentos"
              element={<IntegracaoPagamentos />}
            />
            <Route
              path="relatorios"
              element={<Relatorios />}
            />
            <Route
              path="acompanhamento-venda"
              element={<AcompanhamentoVenda />}
            />

            <Route
              path="clube-beneficios"
              element={
                <GenericModulePage
                  title="Clube de Benefícios"
                  description="Vantagens, descontos e brindes oferecidos aos clientes."
                  onAddMessage="Novo Benefício"
                  collectionName="clube_beneficios"
                  fields={[
                    {
                      key: "nome",
                      label: "Nome *",
                      type: "text",
                      required: true,
                    },
                    {
                      key: "tipo",
                      label: "Tipo",
                      type: "select",
                      options: ["Desconto (%)", "Desconto (R$)", "Vantagem Especial", "Brinde Exclusivo"],
                    },
                    {
                      key: "valor",
                      label: "Valor (ex: 10 para 10% ou R$ 10)",
                      type: "number",
                      required: false,
                    },
                    {
                      key: "imagem",
                      label: "Imagem do benefício",
                      type: "image",
                    },
                    {
                      key: "descricao",
                      label: "Descrição",
                      type: "textarea",
                    },
                    {
                      key: "endereco",
                      label: "Endereço",
                      type: "text",
                    },
                    {
                      key: "numero",
                      label: "Número",
                      type: "text",
                    },
                    {
                      key: "complemento",
                      label: "Complemento",
                      type: "text",
                    },
                    {
                      key: "cidade",
                      label: "Cidade",
                      type: "text",
                    },
                    {
                      key: "estado",
                      label: "Estado",
                      type: "text",
                    },
                    {
                      key: "cep",
                      label: "CEP",
                      type: "text",
                    },
                    {
                      key: "telefone",
                      label: "Telefone para Contato",
                      type: "text",
                    },
                    {
                      key: "email",
                      label: "E-mail",
                      type: "text",
                    },
                    {
                      key: "website",
                      label: "Website (se houver)",
                      type: "text",
                    },
                    {
                      key: "qrcode",
                      label: "Link do QR Code (opcional)",
                      type: "text",
                    },
                    {
                      key: "regras",
                      label: "Regras / Termos",
                      type: "textarea",
                    },
                    {
                      key: "status",
                      label: "Status",
                      type: "select",
                      options: ["Ativo", "Inativo"],
                    },
                  ]}
                  columns={[
                    {
                      key: "imagem",
                      label: "Imagem",
                      render: (val) =>
                        val ? (
                          <img
                            src={val}
                            alt="Benefício"
                            className="w-12 h-12 object-contain bg-white rounded border border-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        ),
                    },
                    { key: "nome", label: "Benefício" },
                    { key: "tipo", label: "Tipo" },
                    { key: "valor", label: "Valor" },
                    {
                      key: "clicks",
                      label: "Acessos (QR Code)",
                      render: (val, row) => (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <QrCode size={13} className="text-sky-600" />
                          {val || row.clicks || 0} cliques
                        </span>
                      ),
                    },
                    { key: "status", label: "Status" },
                  ]}
                />
              }
            />

            <Route
              path="marcas-parceiras"
              element={
                <GenericModulePage
                  title="Marcas Parceiras"
                  description="Gestão de marcas e logomarcas parceiras do portal."
                  onAddMessage="Nova Marca Parceira"
                  collectionName="marcas_parceiras"
                  fields={[
                    {
                      key: "nome",
                      label: "Nome da Marca",
                      type: "text",
                      required: true,
                    },
                    {
                      key: "descricao",
                      label: "Breve Descrição",
                      type: "text",
                    },
                    {
                      key: "produtos",
                      label: "Produtos Disponibilizados",
                      type: "text",
                    },
                    {
                      key: "logomarca",
                      label: "Logomarca",
                      type: "image",
                    },
                    {
                      key: "status",
                      label: "Status",
                      type: "select",
                      options: ["Ativo", "Inativo"],
                    },
                  ]}
                  columns={[
                    {
                      key: "logomarca",
                      label: "Logomarca",
                      render: (val) =>
                        val ? (
                          <img
                            src={val}
                            alt="Logomarca"
                            className="w-16 h-10 object-contain rounded bg-white"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        ),
                    },
                    { key: "nome", label: "Nome" },
                    { key: "produtos", label: "Produtos" },
                    { key: "status", label: "Status" },
                  ]}
                />
              }
            />

            <Route path="financeiro">
              <Route index element={<FinanceiroDashboard />} />
              <Route path="pagar" element={<ContasPagar />} />
              <Route path="receber" element={<ContasReceber />} />
              <Route path="bancos" element={<Bancos />} />
              <Route path="controle-cashback" element={<CashbackControle />} />
              <Route path="centros-custo" element={<CentrosCusto />} />
              <Route
                path="fornecedores"
                element={<Fornecedores />}
              />
              <Route
                path="clientes"
                element={
                  <GenericModulePage
                    title="Gestão de Clientes (Financeiro)"
                    description="Controle financeiro e dados de faturamento de clientes."
                    onAddMessage="Novo Cliente"
                    collectionName="clientes_crm"
                    fields={[
                      {
                        key: "nome",
                        label: "Nome / Razão Social",
                        type: "text",
                        required: true,
                      },
                      {
                        key: "documento",
                        label: "CPF / CNPJ",
                        type: "text",
                        required: true,
                      },
                      { key: "telefone", label: "Telefone", type: "text" },
                      {
                        key: "status",
                        label: "Status",
                        type: "select",
                        options: ["Ativo", "Inadimplente", "Inativo"],
                      },
                    ]}
                    columns={[
                      { key: "nome", label: "Cliente" },
                      { key: "documento", label: "Documento" },
                      { key: "telefone", label: "Telefone" },
                      { key: "status", label: "Status" },
                    ]}
                  />
                }
              />
              <Route path="faturamento" element={<FinanceiroFaturamento />} />
            </Route>

            <Route path="comercial">
              <Route index element={<ComercialDashboard />} />
              <Route path="externo" element={<ComercialExternoDashboard />} />
              <Route path="clientes" element={<ComercialClientes />} />
              <Route path="visitas" element={<ComercialVisitas />} />
              <Route path="comissoes" element={<ComercialComissoes />} />
              <Route path="afiliados" element={<ControleAfiliados />} />
              <Route path="codigos-indicacao" element={<ComercialCodigosIndicacao />} />
              <Route path="calculadora" element={<ComercialCalculadora />} />
              <Route
                path="categorias"
                element={
                  <GenericModulePage
                    title="Categorias de Produtos"
                    description="Organização do catálogo de produtos e departamentos."
                    onAddMessage="Nova Categoria"
                    collectionName="categorias_produtos"
                    fields={[
                      {
                        key: "imagem",
                        label: "Imagem",
                        type: "image",
                      },
                      {
                        key: "nome",
                        label: "Nome da Categoria",
                        type: "text",
                        required: true,
                      },
                      {
                        key: "categoriaPai",
                        label: "Categoria Pai",
                        type: "text",
                      },
                      { key: "descricao", label: "Descrição", type: "text" },
                      {
                        key: "status",
                        label: "Status",
                        type: "select",
                        options: ["Ativa", "Inativa"],
                      },
                    ]}
                    columns={[
                      {
                        key: "imagem",
                        label: "Imagem",
                        render: (val) =>
                          val ? (
                            <img
                              src={val}
                              alt="Categoria"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          ),
                      },
                      { key: "nome", label: "Categoria" },
                      { key: "categoriaPai", label: "Categoria Pai" },
                      { key: "status", label: "Status" },
                    ]}
                  />
                }
              />
              <Route path="servicos" element={<ServicosEssenciaisAdmin />} />
              <Route path="ordens-servico" element={<OrdensServicoAdmin />} />
            </Route>

            <Route path="entrega-mercadorias" element={<EntregadorDashboard />} />
            <Route path="logistica-roteirizacao" element={<LogisticaRoteirizacao />} />
            <Route path="expedicao">
              <Route index element={<ExpedicaoDashboard />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="estoque" element={<ExpedicaoEstoque />} />
              <Route path="pedidos-online" element={<ExpedicaoPedidosOnline />} />
              <Route path="logistica-roteirizacao" element={<LogisticaRoteirizacao />} />
            </Route>
          </Route>
            </Routes>
            <ScrollToTopButton />
            <A2HSPromptBanner />
            <A2HSInstallModal />
                </A2HSProvider>
              </ThemeProvider>
            </CartProvider>
          </FranqueadaProvider>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
