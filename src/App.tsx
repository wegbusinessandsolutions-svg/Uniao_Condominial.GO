/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";
import { CustomerNotifications } from "./components/common/CustomerNotifications";
import { GeolocationLoginPrompt } from "./components/common/GeolocationLoginPrompt";
import ShopLayout from "./components/layouts/ShopLayout";
import AdminLayout from "./components/layouts/AdminLayout";

import { QrCode } from "lucide-react";

// Shop Pages
import Home from "./pages/shop/Home";
import Sobre from "./pages/shop/Sobre";
import Contato from "./pages/shop/Contato";
import Catalog from "./pages/shop/Catalog";
import ProductDetail from "./pages/shop/ProductDetail";
import Cart from "./pages/shop/Cart";
import CustomerArea from "./pages/shop/CustomerArea";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Usuarios from "./pages/admin/Usuarios";
import GenericModulePage from "./pages/admin/GenericModulePage";
import ManutencaoDados from "./pages/admin/ManutencaoDados";
import AdminProdutos from "./pages/admin/Produtos";
import AcompanhamentoVenda from "./pages/admin/AcompanhamentoVenda";
import Relatorios from "./pages/admin/relatorios";
import IntegracaoPagamentos from "./pages/admin/IntegracaoPagamentos";
import ConfiguracaoFrete from "./pages/admin/ConfiguracaoFrete";
import ConfiguracaoNotificacoes from "./pages/admin/ConfiguracaoNotificacoes";
import MuralCondominialAdmin from "./pages/admin/MuralCondominialAdmin";
import DashboardClienteConfig from "./pages/admin/DashboardClienteConfig";
import DashboardFinanceiroConfig from "./pages/admin/DashboardFinanceiroConfig";
import DashboardComercialConfig from "./pages/admin/DashboardComercialConfig";
import DashboardComercialExternoConfig from "./pages/admin/DashboardComercialExternoConfig";
import DashboardEntregaMercadoriasConfig from "./pages/admin/DashboardEntregaMercadoriasConfig";
import DashboardExpedicaoConfig from "./pages/admin/DashboardExpedicaoConfig";

import Empregados from "./pages/admin/Empregados";
import Empresa from "./pages/admin/Empresa";
import Franqueadora from "./pages/admin/Franqueadora";
import PermissoesUsuario from "./pages/admin/PermissoesUsuario";
import BackupExport from "./pages/admin/BackupExport";

import CustomerLayout from "./components/layouts/CustomerLayout";
import CustomerDashboard from "./pages/cliente/Dashboard";
import MeusDados from "./pages/cliente/MeusDados";
import MeusPedidos from "./pages/cliente/MeusPedidos";
import LocalEntrega from "./pages/cliente/LocalEntrega";
import ServicosEssenciais from "./pages/cliente/ServicosEssenciais";
import MinhasOrdensServico from "./pages/cliente/OrdensServico";
import ServicosEssenciaisAdmin from "./pages/admin/ServicosEssenciais";
import OrdensServicoAdmin from "./pages/admin/OrdensServico";

import MarcasParceiras from "./pages/cliente/MarcasParceiras";
import ClubeBeneficios from "./pages/cliente/ClubeBeneficios";
import CartaoVirtual from "./pages/cliente/CartaoVirtual";
import Cashback from "./pages/cliente/Cashback";
import CustomerSuporte from "./pages/cliente/Suporte";
import CashbackAdmin from "./pages/admin/CashbackAdmin";

import CashbackControle from "./pages/financeiro/CashbackControle";
import FinanceiroDashboard from "./pages/financeiro/Dashboard";

import Fornecedores from "./pages/financeiro/Fornecedores";

import ContasPagar from "./pages/financeiro/ContasPagar";
import ContasReceber from "./pages/financeiro/ContasReceber";
import Bancos from "./pages/financeiro/Bancos";
import CentrosCusto from "./pages/financeiro/CentrosCusto";

import ComercialDashboard from "./pages/comercial/Dashboard";
import ComercialExternoDashboard from "./pages/comercial/DashboardExterno";
import ComercialClientes from "./pages/comercial/Clientes";
import ComercialVisitas from "./pages/comercial/VisitasCliente";
import ComercialComissoes from "./pages/comercial/Comissoes";
import ControleAfiliados from "./pages/comercial/ControleAfiliados";
import ComercialCodigosIndicacao from "./pages/comercial/CodigosIndicacao";
import ComercialCalculadora from "./pages/comercial/CalculadoraPrecos";
import ExpedicaoDashboard from "./pages/expedicao/Dashboard";
import Entregas from "./pages/expedicao/Entregas";
import ExpedicaoPedidosOnline from "./pages/expedicao/PedidosOnline";
import ExpedicaoEstoque from "./pages/expedicao/Estoque";
import EntregadorDashboard from "./pages/entregador/Dashboard";

import FinanceiroFaturamento from "./pages/financeiro/Faturamento";
import AceiteAfiliacao from "./pages/AceiteAfiliacao";
import ScrollToTopButton from "./components/ui/ScrollToTopButton";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <ThemeProvider>
              <NotificationProvider>
                <CustomerNotifications />
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
            <Route path="expedicao">
              <Route index element={<ExpedicaoDashboard />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="estoque" element={<ExpedicaoEstoque />} />
              <Route path="pedidos-online" element={<ExpedicaoPedidosOnline />} />
            </Route>
          </Route>
            </Routes>
            <ScrollToTopButton />
              </NotificationProvider>
          </ThemeProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
    </ToastProvider>
  );
}
