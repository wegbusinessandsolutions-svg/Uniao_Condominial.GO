# União Condominial - Sistema de Gestão e E-commerce

Plataforma integrada de E-commerce, CRM, Clube de Benefícios e Gestão Condominial.

## 🚀 Arquitetura Tecnológica
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Motion
- **Backend / Autenticação:** Firebase Auth + Firestore
- **Estilização:** Tailwind CSS v4 com sistema de temas (Claro/Escuro)
- **Ícones:** Lucide React

---

## 🔐 Controle de Acesso e Matriz de Permissões (RBAC)

A plataforma possui controle estrito de permissões baseado em papéis (*Roles*) tanto no **Firestore Security Rules** quanto no **React Router**:

| Papel | Módulos Permitidos | Permissões de Dados |
| :--- | :--- | :--- |
| **Administrador** | Todos os módulos | Acesso total de leitura e escrita em todo o sistema. |
| **Financeiro** | `/admin/financeiro` | `contas_pagar`, `contas_receber`, `bancos`, `centros_custo`, `fornecedores`, `faturamento`, `empregados` |
| **Comercial** | `/admin/comercial` | `clientes_crm`, `comissoes`, `codigos_indicacao`, `categorias_produtos` |
| **Estoquista / Entregador / Expedição** | `/admin/expedicao` | `entregas`, `estoque_movimentacoes`, `produtos` |
| **Cliente / Condômino** | Loja e Área do Cliente | `pedidos_venda` (próprios), `carrinho`, `wishlist`, `clube_beneficios` |

> ⚠️ **Aviso de Segurança:** Nenhuma senha de usuário é gravada no banco de dados Firestore. A autenticação é gerenciada exclusivamente via Firebase Auth. Todos os cadastros públicos nascem como `Cliente`. Promoção a papéis administrativos só é realizada manualmente por um Administrador autenticado.

---

## 🏛️ Regras Fiscais (Goiás - ICMS Interno)
- **Regime Tributário:** Simples Nacional / Lucro Presumido - Revenda de Mercadorias (GO)
- **Alíquota ICMS (GO):** 19% (Lei Estadual nº 22.460/2023)
- **CFOP Padrão:** `5102` (Venda Estadual) / `5405` (Substituição Tributária Consumidor)
- **PIS / COFINS:** Isento (`CST 07` / `CSOSN 102`)

---

## 🛠️ Instruções de Execução
```bash
# Instalar dependências
npm install

# Executar servidor de desenvolvimento
npm run dev

# Compilar para produção
npm run build

# Executar linter / verificação de tipos TypeScript
npm run lint
```
