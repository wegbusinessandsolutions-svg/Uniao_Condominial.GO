# Manual Explicativo e Operacional do Modelo de Negócio — União Condominial

---

## 1. Visão Geral e Propósito do Negócio

O **União Condominial** (LimpEcommerce) é uma plataforma integrada de e-commerce B2B2C, gestão de benefícios e automação empresarial voltada ao ecossistema condominial. 

A plataforma conecta diretamente:
1. **A Distribuidora/Administradora:** Fornece produtos de limpeza, higiene, utilidades e serviços essenciais para condomínios e condôminos com condições diferenciadas.
2. **Os Condomínios e Síndicos:** Têm acesso a compras corporativas com faturamento, descontos progressivos e suporte dedicado.
3. **Os Condôminos (Moradores):** Beneficiam-se de compras diretas para suas residências com cashback exclusivo, entregas unificadas no condomínio e acesso ao **Clube de Benefícios**.
4. **A Rede de Parceiros Locais:** Empresas e prestadores de serviços parceiros que oferecem descontos exclusivos para os moradores cadastrados no condomínio.

---

## 2. Pilares do Modelo de Negócio

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            UNIÃO CONDOMINIAL                                │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
        ┌──────────────┴──────────────┐  ┌─────────────┴──────────────┐
        │      Atacado B2B & B2C      │  │     Clube de Benefícios    │
        │  (Vendas & Kits Essenciais) │  │  (Parceiros & Convênios)   │
        └──────────────┬──────────────┘  └─────────────┬──────────────┘
                       │                               │
        ┌──────────────┴──────────────┐  ┌─────────────┴──────────────┐
        │    Fidelização & Cashback   │  │   Ecossistema Integrado    │
        │    (Bronze, Prata, Ouro)    │  │  (Financeiro, CRM, Log)   │
        └─────────────────────────────┘  └────────────────────────────┘
```

### 2.1 E-Commerce e Atacado Condominial
- **Catálogo Segmentado:** Produtos para uso profissional (áreas comuns, limpeza pesada) e uso residencial.
- **Kits Essenciais Condominiais:** Combos pré-configurados de produtos com descontos especiais para simplificar a compra periódica do síndico ou morador.
- **Precificação Flexível:** Suporte a preço promocional e preço de tabela regular.

### 2.2 Clube de Benefícios e Engajamento de Moradores
- **Cartão Virtual do Condômino:** Identificação digital do morador para uso nos estabelecimentos parceiros da região.
- **Relação de Benefícios (PDF):** Geração de relatório com a listagem completa de vantagens e descontos de parceiros locais, pronto para impressão e compartilhamento nos grupos de moradores.
- **Mensagem Proativa de Engajamento:** Incentivo direto ao envio do PDF ("Envie o arquivo PDF ao Grupo de Moradores do seu Condomínio, o benefício é para todos").

### 2.3 Programa de Cashback e Níveis de Fidelidade
- **Acúmulo Automático:** Cada compra gera saldo de cashback calculado com base no nível do cliente.
- **Níveis de Fidelidade:**
  - 🥉 **Bronze:** Nível inicial com taxa base de cashback.
  - 🥈 **Prata:** Benefícios intermediários e cashback turbinado.
  - 🥇 **Ouro:** Maior percentual de retorno, frete diferenciado e ofertas exclusivas.
- **Resgate Seguro:** O valor do cashback é validado no servidor contra o saldo em banco de dados e abatido diretamente no checkout da loja.

---

## 3. Estrutura Modular da Plataforma

A aplicação é dividida em módulos especializados para garantir alta produtividade e divisão de responsabilidades:

### 3.1 Módulo do Cliente / Condômino
- **Loja Virtual:** Busca intuitiva, navegação por categorias, carrinho interativo e suporte a cupons/cashback.
- **Área do Cliente:**
  - **Meus Pedidos:** Acompanhamento do status em tempo real (Pendente, Aprovado, Em Separação, Em Trânsito, Entregue).
  - **Clube de Benefícios:** Visualização de parceiros, descontos e botão para exportação/impressão do relatório PDF.
  - **Cartão Virtual:** Cartão digital personalizado com QR Code/Identificador.
  - **Histórico de Cashback:** Saldo atual, extrato de créditos e débitos.

### 3.2 Módulo Comercial e CRM
- **Gestão de Clientes e Condomínios:** Cadastro de síndicos, condomínios (CNPJ/Endereço) e condôminos vinculados.
- **Controle de Comissões:** Cálculo automático de comissões para consultores e parceiros comerciais baseados em códigos de indicação.
- **Códigos de Indicação:** Geração de cupons e rastreamento de vendas originadas por promotores ou conselhos comunitários.

### 3.3 Módulo Financeiro e Faturamento
- **Faturamento e Notificação Fiscal (GO):**
  - Configuração do **ICMS Interno de Goiás (19%)** conforme legislação vigente (Lei Estadual nº 22.460/2023).
  - Operação padrão em revenda de mercadorias (**CFOP 5102** e **CST 07 / CSOSN 102** para isenção/diferenciados de PIS/COFINS).
- **Contas a Pagar e Contas a Receber:** Lançamento de títulos, vencimentos, liquidações e saldos bancários.
- **Controle de Caixas e Bancos:** Conciliação bancária de recebíveis via PIX, Cartão e Boleto.
- **Relatórios Gerenciais:** Extratos de faturamento, vendas por período e relatório do Clube de Benefícios.

### 3.4 Módulo de Expedição, Estoque e Logística
- **Gestão de Estoque:** Controle de saldo de produtos por SKU.
- **Movimentações de Estoque:** Registro de entradas, saídas, perdas e ajustes manuais.
- **Acesso Rápido no Dashboard:** Atalho direto no Painel Principal (`/admin`) para registrar **Nova Movimentação de Estoque** sem navegação em submenus.
- **Roteirização e Entregas:** Agrupamento de pedidos por condomínio/bairro para otimização do frete.

### 3.5 Segurança da Informação, Backup & Exportação CSV
- **Exportação Integrada:** Botão e rotina de **Acesso Rápido** no Painel Administrativo (`/admin`) e na Central de Relatórios (`/admin/relatorios`).
- **Download em Formato CSV:** Geração de planilhas formatadas com suporte completo a caracteres em Português (`UTF-8 BOM`), prontas para abertura no Excel e Google Sheets.
- **Escopo do Backup:** Exportação individual ou em lote de todas as coleções chave do banco de dados (Usuários, Produtos, Pedidos de Venda, Movimentações de Estoque, Clientes CRM, Contas a Pagar/Receber, Bancos, Fornecedores e Colaboradores).
- **Lembrete de Backup:** Configuração de alerta/rotina para backups periódicos de cópias de segurança.

---

## 4. Segurança e Matriz de Permissões (RBAC)

A segurança da informação é garantida através do **Firebase Authentication** e das **Firestore Security Rules**. Senhas nunca são armazenadas em texto simples.

### Matriz de Perfis de Acesso

| Papel (*Role*) | Áreas Permitidas | Descrição da Permissão |
| :--- | :--- | :--- |
| **Administrador** | Todas as rotas do `/admin` e Loja | Acesso total a configurações, usuários, finanças, estoque e relatórios. |
| **Financeiro** | `/admin/financeiro/*` | Acesso a faturamento, contas a pagar/receber, bancos, DRE e fornecedores. |
| **Comercial** | `/admin/comercial/*` | Acesso ao CRM de clientes/condomínios, comissões e códigos de indicação. |
| **Expedição / Estoquista / Entregador** | `/admin/expedicao/*` | Acesso ao controle de estoque, movimentações e rotas de entrega. |
| **Cliente / Condômino** | Loja e Área do Cliente | Acesso exclusivo aos próprios pedidos, carrinho, cartão e clube de benefícios. |

> 🔒 **Garantia de Isolamento:** Se um usuário com papel *Financeiro* tentar acessar a URL do módulo *Comercial* ou *Usuários*, o sistema intercepta e exibe uma tela amigável de **"Acesso Restrito ao Módulo"** redirecionando-o para seu painel autorizado.

---

## 5. Fluxo da Operação Diária (Passo a Passo)

```
[Cliente faz o Pedido na Loja]
               │
               ▼
[Validação Automática de Preço e Cashback no Servidor]
               │
               ▼
[Geração do Pedido no Financeiro & Reserva de Estoque]
               │
               ▼
[Aprovação do Pagamento via Webhook / Pix / Cartão]
               │
               ▼
[Expedidor Registra Movimentação & Separação de Mercadoria]
               │
               ▼
[Entrega Roteirizada no Condomínio + Notificação ao Cliente]
```

---

## 6. Resumo dos Componentes do Sistema

- **Endereço do Servidor / Container:** `0.0.0.0:3000` (Node.js + Vite + Express).
- **Banco de Dados Persistente:** Google Cloud Firestore (`ai-studio-63680806-d418-4b0b-9ef4-6562cde069d9`).
- **Padrões Visuais:** Interface responsiva em Tailwind CSS com componentes fluidos, alta legibilidade e suporte a dispositivos móveis.
