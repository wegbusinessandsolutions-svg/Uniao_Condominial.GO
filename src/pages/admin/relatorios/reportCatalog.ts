export interface ReportFilterDef {
  key: string;
  label: string;
  type: "dateRange" | "select" | "text";
  options?: { label: string; value: string }[];
}

export interface ReportColumnDef {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "currency" | "date" | "percent" | "text" | "badge";
}

export interface ReportDefinition {
  id: string;
  code: string;
  title: string;
  module: "Administrativo" | "Comercial" | "Expedição" | "Financeiro" | "Fiscal";
  description: string;
  sourceCollections: string[];
  filters: ReportFilterDef[];
  columns: ReportColumnDef[];
  buildSummaryCards: (rows: any[]) => { label: string; value: string; tone: "neutral" | "success" | "warning" | "danger" }[];
}

export const REPORT_CATALOG: ReportDefinition[] = [
  // ==========================================
  // ADMINISTRATIVO
  // ==========================================
  {
    id: "admin_users",
    code: "ADM-USR",
    title: "Usuários e Perfis de Acesso",
    module: "Administrativo",
    description: "Lista de usuários cadastrados no sistema.",
    sourceCollections: ["users"],
    filters: [
      { key: "role", label: "Papel", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Administrador", value: "Administrador"}, {label: "Comercial", value: "Comercial"}, {label: "Financeiro", value: "Financeiro"}, {label: "Estoquista", value: "Estoquista"}, {label: "Cliente", value: "cliente"}] },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Ativo", value: "Ativo"}, {label: "Inativo", value: "Inativo"}] }
    ],
    columns: [
      { key: "displayName", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "role", label: "Permissão", align: "center", format: "badge" },
      { key: "level", label: "Nível", align: "center" },
      { key: "createdAt", label: "Data de Cad.", align: "right", format: "date" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Total de Usuários", value: String(rows.length), tone: "neutral" },
      { label: "Clientes", value: String(rows.filter(r => r.role === 'cliente').length), tone: "neutral" },
      { label: "Administradores", value: String(rows.filter(r => r.role === 'Administrador' || r.role === 'admin').length), tone: "warning" },
    ]
  },
  {
    id: "admin_employees",
    code: "ADM-EMP",
    title: "Quadro de Empregados",
    module: "Administrativo",
    description: "Empregados e salários.",
    sourceCollections: ["empregados"],
    filters: [
      { key: "department", label: "Departamento", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Administrativo", value: "Administrativo"}, {label: "Comercial", value: "Comercial"}, {label: "Financeiro", value: "Financeiro"}, {label: "Operacional", value: "Operacional"}] },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Ativo", value: "Ativo"}, {label: "Inativo", value: "Inativo"}, {label: "Férias", value: "Férias"}] }
    ],
    columns: [
      { key: "nome", label: "Nome do Empregado" },
      { key: "cargo", label: "Cargo" },
      { key: "departamento", label: "Departamento" },
      { key: "admissao", label: "Admissão", align: "right", format: "date" },
      { key: "salario", label: "Salário Mensal", align: "right", format: "currency" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Total de Empregados", value: String(rows.length), tone: "neutral" },
      { label: "Ativos", value: String(rows.filter(r => r.status === 'Ativo').length), tone: "success" },
      { label: "Folha Salarial", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + (Number(r.salarioNum) || 0), 0)), tone: "warning" },
    ]
  },
  {
    id: "admin_logs",
    code: "ADM-LOG",
    title: "Auditoria e Logs do Sistema",
    module: "Administrativo",
    description: "Registro de atividades no sistema.",
    sourceCollections: ["logs_sistema"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" },
      { key: "modulo", label: "Módulo", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Financeiro", value: "Financeiro"}, {label: "Vendas", value: "Vendas"}, {label: "Sistema", value: "Sistema"}] }
    ],
    columns: [
      { key: "timestamp", label: "Data/Hora", format: "date" },
      { key: "operador", label: "Operador" },
      { key: "acao", label: "Ação", align: "center" },
      { key: "modulo", label: "Módulo", align: "center" },
      { key: "descricao", label: "Descrição" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Total de Logs", value: String(rows.length), tone: "neutral" }
    ]
  },
  {
    id: "adm_franchises",
    code: "ADM-FRANQ",
    title: "Rede de Unidades Franqueadas",
    module: "Administrativo",
    description: "Visão consolidada das unidades da rede de franquias, status operacional, contatos e cidades.",
    sourceCollections: ["config_empresa"],
    filters: [
      { key: "statusFranquia", label: "Status da Franquia", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Ativa", value: "Ativa"}, {label: "Em Implantação", value: "Em Implantação"}, {label: "Suspensa", value: "Suspensa"}, {label: "Inativa", value: "Inativa"}] },
      { key: "uf", label: "Estado (UF)", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "GO", value: "GO"}, {label: "DF", value: "DF"}, {label: "SP", value: "SP"}, {label: "MG", value: "MG"}, {label: "RJ", value: "RJ"}] }
    ],
    columns: [
      { key: "codigoUnidade", label: "Cód. Unidade", align: "center" },
      { key: "razaoSocial", label: "Razão Social / Nome Fantasia" },
      { key: "cnpj", label: "CNPJ" },
      { key: "cidadeUf", label: "Cidade / UF" },
      { key: "responsavelUnidade", label: "Franqueado / Gestor" },
      { key: "telefone", label: "Telefone" },
      { key: "statusFranquia", label: "Situação", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Total de Unidades", value: String(rows.length), tone: "neutral" },
      { label: "Unidades Ativas", value: String(rows.filter(r => (r.statusFranquia || 'Ativa') === 'Ativa').length), tone: "success" },
      { label: "Em Implantação", value: String(rows.filter(r => r.statusFranquia === 'Em Implantação').length), tone: "warning" }
    ]
  },

  // ==========================================
  // COMERCIAL
  // ==========================================
  {
    id: "com_sales",
    code: "COM-VEN",
    title: "Resumo de Vendas e Faturamento",
    module: "Comercial",
    description: "Pedidos de venda emitidos.",
    sourceCollections: ["pedidos_venda"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Novo", value: "Novo"}, {label: "Aprovado", value: "Aprovado"}, {label: "Cancelado", value: "Cancelado"}] },
      { key: "formaPagamento", label: "Pagamento", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "PIX", value: "17"}, {label: "Boleto", value: "15"}, {label: "Cartão", value: "03"}] }
    ],
    columns: [
      { key: "id", label: "Pedido", align: "center" },
      { key: "cliente", label: "Cliente" },
      { key: "dataHora", label: "Data", align: "right", format: "date" },
      { key: "formaPagamento", label: "Pagamento", align: "center" },
      { key: "itensCount", label: "Qtd.", align: "center" },
      { key: "total", label: "Valor Total", align: "right", format: "currency" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Qtd. Pedidos", value: String(rows.length), tone: "neutral" },
      { label: "Faturamento Bruto", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0)), tone: "success" },
      { label: "Ticket Médio", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.length > 0 ? rows.reduce((acc, r) => acc + (Number(r.total) || 0), 0) / rows.length : 0), tone: "neutral" },
    ]
  },
  {
    id: "com_clients",
    code: "COM-CLI",
    title: "Fidelização e Consumo de Clientes",
    module: "Comercial",
    description: "Métricas de clientes e cashback.",
    sourceCollections: ["users", "pedidos_venda"],
    filters: [
      { key: "level", label: "Nível", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Bronze", value: "Bronze"}, {label: "Prata", value: "Prata"}, {label: "Ouro", value: "Ouro"}, {label: "Diamante", value: "Diamante"}] },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Ativo", value: "Ativo"}, {label: "Inativo", value: "Inativo"}] }
    ],
    columns: [
      { key: "nome", label: "Nome do Cliente" },
      { key: "tipoCadastro", label: "Tipo" },
      { key: "level", label: "Plano", align: "center", format: "badge" },
      { key: "comprasCount", label: "Nº Pedidos", align: "center" },
      { key: "cashbackSaldo", label: "Cashback Saldo", align: "right", format: "currency" },
      { key: "comprasAcumulado", label: "Total Comprado", align: "right", format: "currency" },
      { key: "status", label: "Situação", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Clientes Listados", value: String(rows.length), tone: "neutral" },
      { label: "Total Cashback Virtual", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + (Number(r.cashbackSaldo) || 0), 0)), tone: "warning" },
      { label: "Giro Financeiro", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + (Number(r.comprasAcumulado) || 0), 0)), tone: "success" },
    ]
  },
  {
    id: "com_inventory",
    code: "COM-EST",
    title: "Inventário e Reposição de Estoque",
    module: "Comercial",
    description: "Posição atual do estoque de produtos.",
    sourceCollections: ["produtos"],
    filters: [
      { key: "statusEstoque", label: "Status Estoque", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Crítico", value: "Crítico"}, {label: "Baixo", value: "Baixo"}, {label: "Regular", value: "Regular"}] }
    ],
    columns: [
      { key: "sku", label: "SKU", align: "center" },
      { key: "nome", label: "Produto" },
      { key: "categoria", label: "Categoria" },
      { key: "qtdAtual", label: "Est. Atual", align: "center" },
      { key: "custoUltimo", label: "Custo", align: "right", format: "currency" },
      { key: "precoVenda", label: "Venda", align: "right", format: "currency" },
      { key: "statusEstoque", label: "Alerta", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Itens Cadastrados", value: String(rows.length), tone: "neutral" },
      { label: "Valuation Estoque", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + ((Number(r.qtdAtual) || 0) * (Number(r.custoUltimo) || 0)), 0)), tone: "neutral" },
      { label: "Itens Críticos", value: String(rows.filter(r => r.statusEstoque === 'Crítico').length), tone: "danger" },
    ]
  },
  {
    id: "com_abc",
    code: "COM-ABC",
    title: "Curva ABC de Produtos",
    module: "Comercial",
    description: "Classificação de produtos baseada no faturamento.",
    sourceCollections: ["pedidos_venda"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "sku", label: "SKU" },
      { key: "nome", label: "Produto" },
      { key: "qtdVendida", label: "Qtd. Vendida", align: "center" },
      { key: "faturamento", label: "Faturamento", align: "right", format: "currency" },
      { key: "percAcumulado", label: "% Acumulado", align: "right", format: "percent" },
      { key: "curva", label: "Curva", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => {
      const a = rows.filter(r => r.curva === 'A').length;
      const b = rows.filter(r => r.curva === 'B').length;
      const c = rows.filter(r => r.curva === 'C').length;
      return [
        { label: "Produtos Curva A", value: String(a), tone: "success" },
        { label: "Produtos Curva B", value: String(b), tone: "warning" },
        { label: "Produtos Curva C", value: String(c), tone: "neutral" }
      ];
    }
  },
  {
    id: "com_cashback_extrato",
    code: "COM-CBK",
    title: "Extrato Consolidado de Cashback",
    module: "Comercial",
    description: "Movimentação de cashback dos clientes.",
    sourceCollections: ["users"],
    filters: [
      { key: "level", label: "Plano do Cliente", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Bronze", value: "Bronze"}, {label: "Prata", value: "Prata"}, {label: "Ouro", value: "Ouro"}, {label: "Diamante", value: "Diamante"}] }
    ],
    columns: [
      { key: "cliente", label: "Cliente" },
      { key: "level", label: "Plano", align: "center", format: "badge" },
      { key: "totalCreditado", label: "Total Creditado", align: "right", format: "currency" },
      { key: "totalResgatado", label: "Total Resgatado", align: "right", format: "currency" },
      { key: "saldoAtual", label: "Saldo Atual", align: "right", format: "currency" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Passivo de Cashback", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.reduce((acc, r) => acc + (Number(r.saldoAtual) || 0), 0)), tone: "warning" },
    ]
  },

  // ==========================================
  // EXPEDIÇÃO
  // ==========================================
  {
    id: "exp_entregas",
    code: "EXP-ENT",
    title: "Entregas e Prazos",
    module: "Expedição",
    description: "Status de entregas despachadas.",
    sourceCollections: ["entregas"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Pendente", value: "Pendente"}, {label: "Em Rota", value: "Em Rota"}, {label: "Entregue", value: "Entregue"}] }
    ],
    columns: [
      { key: "id", label: "Código", align: "center" },
      { key: "pedidoId", label: "Pedido", align: "center" },
      { key: "transportadora", label: "Transportadora" },
      { key: "dataDespacho", label: "Despacho", align: "center", format: "date" },
      { key: "dataEntrega", label: "Entrega/Previsão", align: "center", format: "date" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Total de Entregas", value: String(rows.length), tone: "neutral" },
      { label: "Entregues", value: String(rows.filter(r => r.status === 'Entregue').length), tone: "success" },
      { label: "Em Rota", value: String(rows.filter(r => r.status === 'Em Rota').length), tone: "warning" },
    ]
  },
  {
    id: "exp_divergencias",
    code: "EXP-DIV",
    title: "Divergências de Conferência",
    module: "Expedição",
    description: "Itens com divergência na separação.",
    sourceCollections: ["pedidos_venda"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "pedidoId", label: "Pedido", align: "center" },
      { key: "sku", label: "SKU", align: "center" },
      { key: "produto", label: "Produto" },
      { key: "qtdPedida", label: "Qtd. Pedida", align: "center" },
      { key: "qtdConferida", label: "Qtd. Separada", align: "center" },
      { key: "diferenca", label: "Diferença", align: "center" }
    ],
    buildSummaryCards: (rows) => [
      { label: "Ocorrências", value: String(rows.length), tone: "danger" }
    ]
  },

  // ==========================================
  // FINANCEIRO
  // ==========================================
  {
    id: "fin_cashflow",
    code: "FIN-FLX",
    title: "Fluxo de Caixa Consolidado",
    module: "Financeiro",
    description: "Entradas e Saídas do período.",
    sourceCollections: ["contas_receber", "contas_pagar"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "tipo", label: "Tipo", align: "center", format: "badge" },
      { key: "descricao", label: "Descrição" },
      { key: "data", label: "Data", align: "center", format: "date" },
      { key: "valor", label: "Valor", align: "right", format: "currency" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => {
      const entradas = rows.filter(r => r.tipo === 'Entrada').reduce((a, b) => a + Number(b.valor), 0);
      const saidas = rows.filter(r => r.tipo === 'Saída').reduce((a, b) => a + Number(b.valor), 0);
      return [
        { label: "Entradas", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entradas), tone: "success" },
        { label: "Saídas", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saidas), tone: "danger" },
        { label: "Saldo", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entradas - saidas), tone: entradas >= saidas ? "success" : "danger" }
      ];
    }
  },
  {
    id: "fin_payables",
    code: "FIN-PAG",
    title: "Contas a Pagar",
    module: "Financeiro",
    description: "Obrigações e fornecedores.",
    sourceCollections: ["contas_pagar"],
    filters: [
      { key: "dateRange", label: "Vencimento", type: "dateRange" },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Pendente", value: "Pendente"}, {label: "Pago", value: "Pago"}, {label: "Atrasado", value: "Atrasado"}] }
    ],
    columns: [
      { key: "descricao", label: "Descrição" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "vencimento", label: "Vencimento", align: "center", format: "date" },
      { key: "valor", label: "Valor", align: "right", format: "currency" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => {
      const pendentes = rows.filter(r => r.status === 'Pendente' || r.status === 'Atrasado');
      const total = pendentes.reduce((a, b) => a + Number(b.valor), 0);
      return [
        { label: "Obrigações em Aberto", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total), tone: "warning" }
      ];
    }
  },
  {
    id: "fin_receivables",
    code: "FIN-REC",
    title: "Contas a Receber e Adimplência",
    module: "Financeiro",
    description: "Recebimentos previstos e atrasos.",
    sourceCollections: ["contas_receber"],
    filters: [
      { key: "dateRange", label: "Vencimento", type: "dateRange" },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Pendente", value: "Pendente"}, {label: "Recebido", value: "Recebido"}, {label: "Atrasado", value: "Atrasado"}] }
    ],
    columns: [
      { key: "cliente", label: "Cliente" },
      { key: "documento", label: "Documento", align: "center" },
      { key: "vencimento", label: "Vencimento", align: "center", format: "date" },
      { key: "valor", label: "Valor", align: "right", format: "currency" },
      { key: "atrasoDias", label: "Dias Atraso", align: "center" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => {
      const recebidos = rows.filter(r => r.status === 'Recebido').reduce((a, b) => a + Number(b.valor), 0);
      const pendentes = rows.filter(r => r.status === 'Pendente' || r.status === 'Atrasado').reduce((a, b) => a + Number(b.valor), 0);
      return [
        { label: "Realizado (Pago)", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recebidos), tone: "success" },
        { label: "A Receber", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendentes), tone: "warning" }
      ];
    }
  },
  {
    id: "fin_dre",
    code: "FIN-DRE",
    title: "DRE - Demonstração de Resultados",
    module: "Financeiro",
    description: "Estrutura gerencial DRE.",
    sourceCollections: ["contas_receber", "contas_pagar"],
    filters: [
      { key: "dateRange", label: "Período de Competência", type: "dateRange" }
    ],
    columns: [
      { key: "codigo", label: "Cód." },
      { key: "descricao", label: "Descrição da Conta" },
      { key: "valor", label: "Valor Financeiro", align: "right", format: "currency" },
      { key: "perc", label: "AV %", align: "center", format: "percent" }
    ],
    buildSummaryCards: (rows) => {
      const receitaL = rows.find(r => r.codigo === '3') || { valor: 0 };
      const lucroO = rows.find(r => r.codigo === '6') || { valor: 0 };
      return [
        { label: "Receita Líquida", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaL.valor), tone: "success" },
        { label: "Lucro Operacional", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroO.valor), tone: lucroO.valor >= 0 ? "success" : "danger" }
      ];
    }
  },
  {
    id: "fin_cash_movement",
    code: "FIN-MOC",
    title: "Movimentação de Caixa Detalhada",
    module: "Financeiro",
    description: "Saldo diário.",
    sourceCollections: ["contas_receber", "contas_pagar"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "data", label: "Data", align: "center", format: "date" },
      { key: "historico", label: "Histórico" },
      { key: "tipo", label: "Tipo", align: "center", format: "badge" },
      { key: "valor", label: "Valor Movimento", align: "right", format: "currency" },
      { key: "saldo", label: "Saldo de Caixa", align: "right", format: "currency" }
    ],
    buildSummaryCards: (rows) => []
  },
  {
    id: "fin_bank",
    code: "FIN-BAN",
    title: "Extrato Bancário por Conta",
    module: "Financeiro",
    description: "Movimentação detalhada bancária.",
    sourceCollections: ["bancos"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" },
      { key: "conta", label: "Conta", type: "text" }
    ],
    columns: [
      { key: "data", label: "Data", align: "center", format: "date" },
      { key: "historico", label: "Histórico" },
      { key: "tipo", label: "Tipo", align: "center", format: "badge" },
      { key: "valor", label: "Valor", align: "right", format: "currency" }
    ],
    buildSummaryCards: (rows) => []
  },
  {
    id: "fin_suppliers",
    code: "FIN-FOR",
    title: "Fornecedores e Compras",
    module: "Financeiro",
    description: "Volume de compras por fornecedor.",
    sourceCollections: ["contas_pagar", "fornecedores"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "fornecedor", label: "Fornecedor" },
      { key: "totalComprado", label: "Volume de Compras", align: "right", format: "currency" },
      { key: "qtdTitulos", label: "Títulos Emitidos", align: "center" }
    ],
    buildSummaryCards: (rows) => []
  },
  {
    id: "fin_cost_centers",
    code: "FIN-CTC",
    title: "Resultado por Centro de Custo",
    module: "Financeiro",
    description: "Análise por CC.",
    sourceCollections: ["contas_pagar", "centros_custo"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" }
    ],
    columns: [
      { key: "centroCusto", label: "Centro de Custo" },
      { key: "despesas", label: "Total Despesas", align: "right", format: "currency" },
      { key: "orcamento", label: "Orçamento Previsto", align: "right", format: "currency" }
    ],
    buildSummaryCards: (rows) => []
  },

  // ==========================================
  // FISCAL
  // ==========================================
  {
    id: "fis_nfe",
    code: "FIS-NFE",
    title: "Notas Fiscais Emitidas",
    module: "Fiscal",
    description: "Registro de NF-es geradas.",
    sourceCollections: ["pedidos_venda"],
    filters: [
      { key: "dateRange", label: "Período", type: "dateRange" },
      { key: "status", label: "Status", type: "select", options: [{label: "Todos", value: "Todos"}, {label: "Autorizada", value: "Autorizada"}, {label: "Cancelada", value: "Cancelada"}] }
    ],
    columns: [
      { key: "numero", label: "Nº NF-e", align: "center" },
      { key: "serie", label: "Série", align: "center" },
      { key: "dataEmissao", label: "Emissão", align: "center", format: "date" },
      { key: "cliente", label: "Destinatário" },
      { key: "valor", label: "Valor Bruto", align: "right", format: "currency" },
      { key: "status", label: "Status", align: "center", format: "badge" }
    ],
    buildSummaryCards: (rows) => [
      { label: "NF-es Emitidas", value: String(rows.length), tone: "neutral" },
      { label: "Total Faturado (NF-e)", value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rows.filter(r => r.status === 'Autorizada').reduce((a, b) => a + Number(b.valor), 0)), tone: "success" }
    ]
  }
];
