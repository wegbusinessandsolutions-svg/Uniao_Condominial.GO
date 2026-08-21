import { collection, addDoc, updateDoc, doc, query, where, getDocs, getDoc } from "firebase/firestore";
import { initFirebase } from "./firebase";
import { GoogleGenAI } from "@google/genai";
import { logAction } from "./audit";
import { sendEmailWithLog } from "./emailService";
import { gravarLogCentralizadoPedido } from "./orderLogger";

/**
 * ============================================================
 * SISTEMA DE PEDIDOS E-COMMERCE → CRM → NF-e
 * Revenda de Mercadorias - Estado de Goiás (ICMS interno)
 * ============================================================
 */

export const CONFIG = {
  EMITENTE: {
    CNPJ: "00.000.000/0001-00",
    IE: "00.000.000-0",
    RAZAO_SOCIAL: "MINHA EMPRESA LTDA",
    NOME_FANTASIA: "MINHA LOJA",
    LOGRADOURO: "Rua das Mercadorias",
    NUMERO: "100",
    BAIRRO: "Setor Central",
    MUNICIPIO: "Goiânia",
    UF: "GO",
    CEP: "74000-000",
    FONE: "(62) 3000-0000",
    REGIME_TRIBUTARIO: "1",
    CRT: "1",
  },
  FISCAL: {
    CFOP_VENDA_ESTADUAL: "5102",
    CFOP_VENDA_CONSUMIDOR: "5405",
    CST_ICMS_TRIBUTADO: "000",
    CST_PIS_ISENTO: "07",
    CST_COFINS_ISENTO: "07",
    CSOSN_SIMPLES: "102",
    ALIQUOTA_ICMS_GO: 19,
    NATUREZA_OPERACAO: "VENDA DE MERCADORIA",
    CODIGO_MUNICIPIO_GOIANIA: "5208707",
    CODIGO_PAIS_BRASIL: "1058",
  },
  STATUS: {
    NOVO: "AGUARDANDO_CONFERENCIA",
    EM_CONFERENCIA: "EM_CONFERENCIA",
    CONFERIDO: "APROVADO_PARA_FATURAMENTO",
    REJEITADO: "REJEITADO_PELA_EXPEDICAO",
    FATURADO: "FATURADO",
    DESPACHADO: "DESPACHADO",
  },
};

export function criarPedidoCRM(pedidoWebsite: any, numeroPedido: string) {
  const agora = new Date();

  return {
    id_externo: numeroPedido,
    numero: numeroPedido,
    dataHora: agora.toISOString(),
    status: CONFIG.STATUS.NOVO,
    canal: "ECOMMERCE",
    prioridade: pedidoWebsite.prioridade || "Média",
    cliente: {
      nome: pedidoWebsite.cliente.nome,
      cpfCnpj: pedidoWebsite.cliente.cpfCnpj,
      ie: pedidoWebsite.cliente.ie || "ISENTO",
      email: pedidoWebsite.cliente.email,
      telefone: pedidoWebsite.cliente.telefone,
      endereco: {
        logradouro: pedidoWebsite.cliente.endereco.logradouro,
        numero: pedidoWebsite.cliente.endereco.numero,
        complemento: pedidoWebsite.cliente.endereco.complemento || "",
        bairro: pedidoWebsite.cliente.endereco.bairro,
        municipio: pedidoWebsite.cliente.endereco.municipio,
        uf: pedidoWebsite.cliente.endereco.uf,
        cep: pedidoWebsite.cliente.endereco.cep,
        codigoMunicipio: pedidoWebsite.cliente.endereco.codigoMunicipio || "",
        codPais: CONFIG.FISCAL.CODIGO_PAIS_BRASIL,
      },
      indIEDest: pedidoWebsite.cliente.ie ? "1" : "9",
    },
    itens: pedidoWebsite.itens.map((item: any, idx: number) => ({
      nItem: idx + 1,
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: CONFIG.FISCAL.CFOP_VENDA_ESTADUAL,
      unidade: item.unidade || "UN",
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: calcular(item.quantidade, item.valorUnitario),
      cst: CONFIG.FISCAL.CST_ICMS_TRIBUTADO,
      aliquotaIcms: CONFIG.FISCAL.ALIQUOTA_ICMS_GO,
      valorIcms: calcularIcms(item.quantidade, item.valorUnitario),
      cstPis: CONFIG.FISCAL.CST_PIS_ISENTO,
      cstCofins: CONFIG.FISCAL.CST_COFINS_ISENTO,
      conferido: false,
      qtdConferida: null,
      observacaoExpedicao: "",
    })),
    totais: calcularTotais(pedidoWebsite.itens),
    frete: {
      modalidade: pedidoWebsite.frete?.modalidade || "0",
      transportadora: pedidoWebsite.frete?.transportadora || null,
      valor: pedidoWebsite.frete?.valor || 0,
    },
    pagamento: {
      forma: pedidoWebsite.pagamento.forma,
      valor: pedidoWebsite.pagamento.valor,
    },
    historico: [
      {
        status: CONFIG.STATUS.NOVO,
        dataHora: agora.toISOString(),
        usuario: "SISTEMA_ECOMMERCE",
        observacao: "Pedido recebido pelo website",
      },
    ],
    nfe: null,
  };
}

export async function processarPedidoWebsite(pedidoWebsite: any) {
  console.log("📦 NOVO PEDIDO RECEBIDO DO E-COMMERCE");

  const erros = validarPedidoWebsite(pedidoWebsite);
  if (erros.length > 0) {
    throw new Error(`Pedido inválido: ${erros.join("; ")}`);
  }

  const { db } = await initFirebase();

  // Validate item prices directly against products collection in Firestore
  if (pedidoWebsite.itens && Array.isArray(pedidoWebsite.itens)) {
    for (const item of pedidoWebsite.itens) {
      let pRef = doc(db, "produtos", item.codigo);
      let pSnap = await getDoc(pRef);

      if (!pSnap.exists()) {
        const qSku = query(collection(db, "produtos"), where("sku", "==", item.codigo));
        const snapSku = await getDocs(qSku);
        if (!snapSku.empty) {
          pSnap = snapSku.docs[0];
        }
      }

      if (pSnap && pSnap.exists()) {
        const pData = pSnap.data();
        const officialPrice = Number(pData.precoPromocional || pData.preco || 0);
        if (officialPrice > 0 && Math.abs(Number(item.valorUnitario) - officialPrice) > 0.01) {
          throw new Error(`Divergência de preço detectada para o produto "${item.descricao}". Preço oficial no banco: R$ ${officialPrice.toFixed(2)}.`);
        }
        item.valorUnitario = officialPrice;
      }
    }
  }

  // Validate cashback usage against user's actual balance in Firestore
  if (pedidoWebsite.cashbackUsado && Number(pedidoWebsite.cashbackUsado) > 0) {
    let userSnap;
    if (pedidoWebsite.clienteId) {
      userSnap = await getDoc(doc(db, "users", pedidoWebsite.clienteId));
    } else if (pedidoWebsite.cliente?.email) {
      const qUser = query(collection(db, "users"), where("email", "==", pedidoWebsite.cliente.email));
      const userRes = await getDocs(qUser);
      if (!userRes.empty) userSnap = userRes.docs[0];
    }

    if (userSnap && userSnap.exists()) {
      const actualBalance = Number(userSnap.data().cashbackBalance || 0);
      if (actualBalance < Number(pedidoWebsite.cashbackUsado)) {
        throw new Error(`Saldo de cashback insuficiente no cadastro. Saldo disponível: R$ ${actualBalance.toFixed(2)}.`);
      }
    }
  }

  const uf = pedidoWebsite.cliente?.endereco?.uf || "XX";
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = String(agora.getFullYear()).slice(-2);
  const prefixo = `${uf.toUpperCase()}${dia}${mes}${ano}`;

  // Generate a random 4-digit suffix to avoid needing to query the entire collection from the client
  const randomSuffix = String(Math.floor(Math.random() * 9000) + 1000);
  const numeroPedido = `${prefixo}${randomSuffix}`;

  const pedidosRef = collection(db, "pedidos_venda");
  const pedidoCRM: any = criarPedidoCRM(pedidoWebsite, numeroPedido);

  const docRef = await addDoc(pedidosRef, pedidoCRM);
  pedidoCRM.firebaseId = docRef.id;

  // ==========================================
  // REDUÇÃO DE ESTOQUE (INVENTORY REDUCTION)
  // ==========================================
  for (const item of pedidoCRM.itens) {
    try {
      let productDocRef = doc(db, "produtos", item.codigo);
      let productSnap = await getDoc(productDocRef);

      if (!productSnap.exists()) {
        // Tenta buscar por SKU se o código não for o ID direto
        const qSku = query(collection(db, "produtos"), where("sku", "==", item.codigo));
        const snapSku = await getDocs(qSku);
        if (!snapSku.empty) {
          productDocRef = doc(db, "produtos", snapSku.docs[0].id);
          productSnap = snapSku.docs[0];
        } else {
          // Tenta buscar por Nome/Descrição se não achar por SKU
          const qName = query(collection(db, "produtos"), where("nome", "==", item.descricao));
          const snapName = await getDocs(qName);
          if (!snapName.empty) {
            productDocRef = doc(db, "produtos", snapName.docs[0].id);
            productSnap = snapName.docs[0];
          } else {
            productDocRef = null;
          }
        }
      }

      if (productDocRef && productSnap) {
        const pData = productSnap.data();
        const currentQtd = typeof pData.qtdAtual === "number" ? pData.qtdAtual : parseFloat(pData.qtdAtual || "0");
        const parsedQtd = isNaN(currentQtd) ? 0 : currentQtd;
        const newQtd = Math.max(0, parsedQtd - item.quantidade);

        // Atualiza o documento mantendo o tipo original
        const updatedValue = typeof pData.qtdAtual === "number" ? newQtd : String(newQtd);
        await updateDoc(productDocRef, {
          qtdAtual: updatedValue
        });

        // Log de Auditoria para Movimentação de Estoque
        await logAction(
          `Saída automática de estoque (Pedido #${numeroPedido}): ${item.descricao}`,
          "Estoque",
          {
            productId: productDocRef.id,
            productName: item.descricao,
            quantidadeMovimentada: item.quantidade,
            estoqueAnterior: parsedQtd,
            estoqueAtual: newQtd
          },
          { qtdAtual: pData.qtdAtual },
          { qtdAtual: updatedValue }
        );
      } else {
        console.warn(`Produto não localizado para redução de estoque: ${item.codigo} - ${item.descricao}`);
      }
    } catch (stockError: any) {
      console.error(`Falha ao reduzir estoque do produto ${item.codigo}:`, stockError);
    }
  }

  // ==========================================
  // CONEXÃO COM FINANCEIRO (CONTAS A RECEBER)
  // ==========================================
  try {
    let resolvedClienteId = pedidoWebsite.cliente.nome;
    const usersRef = collection(db, "users");
    const qClient = query(usersRef, where("role", "in", ["Cliente", "customer"]), where("cpfCnpj", "==", pedidoWebsite.cliente.cpfCnpj));
    const qClientSnap = await getDocs(qClient);
    if (!qClientSnap.empty) {
      resolvedClienteId = qClientSnap.docs[0].id;
    }

    const totalOrderValue = Number(pedidoWebsite.pagamento?.valor || pedidoCRM.totais.totalPedido + (pedidoWebsite.frete?.valor || 0));
    const todayStr = agora.toISOString().split("T")[0]; // YYYY-MM-DD
    
    // Status do contas a receber de acordo com o pagamento
    // 17 = PIX, 03 = Cartão de Crédito, 15 = Boleto
    const isPaidImmediately = pedidoWebsite.pagamento?.forma === "17" || pedidoWebsite.pagamento?.forma === "03";
    const statusReceber = isPaidImmediately ? "Recebido" : "Aberto";

    const contasReceberPayload: any = {
      descricao: `Pedido e-commerce #${numeroPedido}`,
      valor: totalOrderValue,
      vencimento: todayStr,
      parcelas: 1,
      clienteId: resolvedClienteId,
      clienteNome: pedidoWebsite.cliente.nome,
      status: statusReceber,
      createdAt: agora.toISOString(),
      updatedAt: agora.toISOString()
    };

    if (isPaidImmediately) {
      contasReceberPayload.recebidoEm = todayStr;
      contasReceberPayload.valorRecebido = totalOrderValue;
    }

    await addDoc(collection(db, "contas_receber"), contasReceberPayload);

    // Registrar Log do Pedido Finalizado
    await logAction(
      `Venda finalizada no Checkout: Pedido #${numeroPedido} - Total R$ ${totalOrderValue.toFixed(2)}`,
      "Comercial",
      {
        pedidoId: docRef.id,
        numeroPedido,
        cliente: pedidoWebsite.cliente.nome,
        formaPagamento: pedidoWebsite.pagamento?.forma,
        total: totalOrderValue
      }
    );
  } catch (financeError: any) {
    console.error("Falha ao integrar pedido ao módulo Financeiro (Contas a Receber):", financeError);
  }


  // Send Email Confirmation
  try {
    const configDoc = await getDoc(doc(db, "config", "email"));
    if (configDoc.exists()) {
      const emailConfig = configDoc.data();
      const template = emailConfig?.templates?.confirmacaoPedido;
      
      if (template && template.ativo) {
        let conteudo = template.conteudo || "";
        conteudo = conteudo.replace(/{{nome_cliente}}/g, pedidoCRM.cliente?.nome || "Cliente");
        conteudo = conteudo.replace(/{{numero_pedido}}/g, pedidoCRM.id_externo || numeroPedido);
        conteudo = conteudo.replace(/{{valor_total}}/g, Number(pedidoCRM.valorTotal).toFixed(2).replace('.', ','));
        conteudo = conteudo.replace(/{{cashback_ganho}}/g, "0,00"); // Padrão se não houver

        let assunto = template.assunto || `Confirmação do Pedido #${pedidoCRM.id_externo}`;
        assunto = assunto.replace(/{{numero_pedido}}/g, pedidoCRM.id_externo || numeroPedido);

        const toEmail = pedidoCRM.cliente?.email || (typeof pedidoWebsite.cliente === "object" ? pedidoWebsite.cliente.email : null);

        if (toEmail) {
          sendEmailWithLog({
              apiProvider: emailConfig.apiProvider,
              apiKey: emailConfig.apiKey,
              apiDomain: emailConfig.apiDomain,
              apiEndpoint: emailConfig.apiEndpoint,
              to: toEmail,
              subject: assunto,
              html: conteudo
            }, "Confirmacao Pedido", pedidoCRM.id_externo || numeroPedido);
        }
      }
    }
  } catch (err) {
    console.error("Erro ao enviar email de confirmacao", err);
  }

  return pedidoCRM;

}

export async function conferirExpedicao(pedidoCRM: any, conferencia: any[]) {
  pedidoCRM.status = CONFIG.STATUS.EM_CONFERENCIA;
  let todosConferidos = true;
  let algumRejeitado = false;

  pedidoCRM.itens = pedidoCRM.itens.map((item: any) => {
    const resultadoItem = conferencia.find((c) => c.nItem === item.nItem);
    if (!resultadoItem) {
      todosConferidos = false;
      return item;
    }
    const aprovado = resultadoItem.qtdConferida === item.quantidade;
    if (!aprovado) algumRejeitado = true;

    return {
      ...item,
      conferido: true,
      qtdConferida: resultadoItem.qtdConferida,
      observacaoExpedicao: resultadoItem.observacao || "",
    };
  });

  const novoStatus =
    todosConferidos && !algumRejeitado
      ? CONFIG.STATUS.CONFERIDO
      : CONFIG.STATUS.REJEITADO;

  const statusAnterior = pedidoCRM.status || "N/A";
  pedidoCRM.status = novoStatus;
  
  const observacaoEvento = algumRejeitado
      ? "Divergências encontradas na conferência"
      : "Todos os itens conferidos com sucesso";

  pedidoCRM.historico.push({
    statusAnterior: statusAnterior,
    novoStatus: novoStatus,
    status: novoStatus,
    dataHora: new Date().toISOString(),
    usuario: "EXPEDICAO",
    observacao: observacaoEvento,
  });

  if (pedidoCRM.firebaseId) {
    const { db } = await initFirebase();
    await updateDoc(doc(db, "pedidos_venda", pedidoCRM.firebaseId), pedidoCRM);
    await gravarLogCentralizadoPedido(db, pedidoCRM.firebaseId, pedidoCRM.codigo || pedidoCRM.id_externo, statusAnterior, novoStatus, "EXPEDICAO", observacaoEvento);
  }

  return pedidoCRM;
}

export async function faturarPedido(pedidoCRM: any, dadosAdicionais: any = {}) {
  if (pedidoCRM.status !== CONFIG.STATUS.CONFERIDO && pedidoCRM.status !== "AGUARDANDO EMISSÃO N.F." && pedidoCRM.status !== "APROVADO_PARA_FATURAMENTO") {
    throw new Error(`Pedido não pode ser faturado. Status atual: ${pedidoCRM.status}`);
  }

  // Chamar webhook / API Cloud Function de NF-e real (ex: Focus NFe)
  try {
    const response = await fetch('/api/nfe/emitir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido: pedidoCRM, extras: dadosAdicionais })
    });
    
    if (!response.ok) {
      throw new Error("Erro na integração com Focus NFe / PlugNotas");
    }

    const nfeResponse = await response.json();
    
    pedidoCRM.nfe = nfeResponse.nfe;
    pedidoCRM.status = CONFIG.STATUS.FATURADO;

    pedidoCRM.historico.push({
      status: CONFIG.STATUS.FATURADO,
      dataHora: new Date().toISOString(),
      usuario: "SISTEMA",
      observacao: `NF-e emitida via API (Focus NFe): Série ${nfeResponse.nfe?.serie} | Número ${nfeResponse.nfe?.numero}`,
    });

    if (pedidoCRM.firebaseId) {
      const { db } = await initFirebase();
      await updateDoc(doc(db, "pedidos_venda", pedidoCRM.firebaseId), pedidoCRM);
    }
  } catch (error) {
    console.error("Falha ao faturar NF-e via API", error);
    throw error;
  }

  return pedidoCRM;
}

export function gerarEstruturaNFe(pedidoCRM: any, extras: any = {}) {
  const agora = new Date();
  const serie = extras.serie || "001";
  const numero = extras.numeroNFe || gerarNumeroNFe();
  const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, "0");

  return {
    versao: "4.00",
    serie,
    numero,
    chaveAcesso: gerarChaveAcesso(serie, numero, cNF),
    cNF,
    natOp: CONFIG.FISCAL.NATUREZA_OPERACAO,
    indPag: pedidoCRM.pagamento.forma === "01" ? "0" : "1",
    mod: "55",
    dhEmi: agora.toISOString(),
    dhSaiEnt: agora.toISOString(),
    tpNF: "1",
    idDest: "1",
    cMunFG: CONFIG.FISCAL.CODIGO_MUNICIPIO_GOIANIA,
    tpImp: "1",
    tpEmis: "1",
    finNFe: "1",
    indFinal: "1",
    indPres: "2",
    tpAmb: extras.ambiente || "2",
    emitente: {
      ...CONFIG.EMITENTE,
      CRT: CONFIG.EMITENTE.CRT,
    },
    destinatario: {
      CNPJ_CPF: pedidoCRM.cliente.cpfCnpj,
      xNome: pedidoCRM.cliente.nome,
      email: pedidoCRM.cliente.email,
      indIEDest: pedidoCRM.cliente.indIEDest,
      IE: pedidoCRM.cliente.ie,
      endereco: pedidoCRM.cliente.endereco,
    },
    detalhes: pedidoCRM.itens.map((item: any) => ({
      nItem: item.nItem,
      produto: {
        cProd: item.codigo,
        cEAN: item.ean || "SEM GTIN",
        xProd: item.descricao,
        NCM: item.ncm,
        CFOP: item.cfop,
        uCom: item.unidade,
        qCom: item.quantidade,
        vUnCom: item.valorUnitario.toFixed(10),
        vProd: item.valorTotal.toFixed(2),
        cEANTrib: item.ean || "SEM GTIN",
        uTrib: item.unidade,
        qTrib: item.quantidade,
        vUnTrib: item.valorUnitario.toFixed(10),
        indTot: "1",
      },
      impostos: gerarImpostosItem(item),
    })),
    totais: calcularTotaisNFe(pedidoCRM),
    transporte: {
      modFrete: pedidoCRM.frete.modalidade,
    },
    cobranca: {
      forma: pedidoCRM.pagamento.forma,
      valor: pedidoCRM.pagamento.valor.toFixed(2),
    },
    infAdic: {
      infCpl: extras.infCpl ||
        `Pedido e-commerce: ${pedidoCRM.id_externo} | ` +
        `Conferido em: ${obterDataConferencia(pedidoCRM)} | ` +
        "Venda para consumidor final dentro do Estado de Goiás. " +
        `CFOP ${CONFIG.FISCAL.CFOP_VENDA_ESTADUAL} - ` +
        "Operação sujeita ao ICMS conforme legislação vigente do Estado de Goiás.",
    },
  };
}

export function gerarImpostosItem(item: any) {
  const vBC = item.valorTotal;
  const vICMS = calcularIcms(item.quantidade, item.valorUnitario);

  const icmsSN = {
    CSOSN: CONFIG.FISCAL.CSOSN_SIMPLES,
  };

  const icmsLucroReal = {
    orig: "0",
    CST: item.cst,
    modBC: "3",
    vBC: vBC.toFixed(2),
    pICMS: CONFIG.FISCAL.ALIQUOTA_ICMS_GO.toFixed(2),
    vICMS: vICMS.toFixed(2),
  };

  return {
    ICMS: CONFIG.EMITENTE.CRT === "1" ? { ICMSSN102: icmsSN } : { ICMS00: icmsLucroReal },
    PIS: {
      PISNT: {
        CST: CONFIG.FISCAL.CST_PIS_ISENTO,
      },
    },
    COFINS: {
      COFINSNT: {
        CST: CONFIG.FISCAL.CST_COFINS_ISENTO,
      },
    },
  };
}

export async function despacharEntrega(pedidoCRM: any, dadosEntrega: any = {}) {
  if (pedidoCRM.status !== CONFIG.STATUS.FATURADO) {
    throw new Error(`Pedido não pode ser despachado. Status: ${pedidoCRM.status}`);
  }

  pedidoCRM.status = CONFIG.STATUS.DESPACHADO;
  pedidoCRM.entrega = {
    dataHoraDespacho: new Date().toISOString(),
    responsavel: dadosEntrega.responsavel || "ENTREGA",
    transportadora: dadosEntrega.transportadora || pedidoCRM.frete.transportadora,
    codigoRastreio: dadosEntrega.codigoRastreio || null,
    observacao: dadosEntrega.observacao || "",
  };

  pedidoCRM.historico.push({
    status: CONFIG.STATUS.DESPACHADO,
    dataHora: new Date().toISOString(),
    usuario: dadosEntrega.responsavel || "ENTREGA",
    observacao: `Mercadoria despachada. Rastreio: ${dadosEntrega.codigoRastreio || "N/A"}`,
  });

  const { db } = await initFirebase();

  if (pedidoCRM.firebaseId) {
    await updateDoc(doc(db, "pedidos_venda", pedidoCRM.firebaseId), pedidoCRM);
  }

  // Integrar com a coleção entregas para a UI atualizada
  const novaEntrega = {
    pedidoId: pedidoCRM.id_externo,
    nf: pedidoCRM.nfe?.numero || "",
    cliente: pedidoCRM.cliente.nome,
    valorTotal: pedidoCRM.totais.totalPedido,
    dataPedido: pedidoCRM.dataHora.split("T")[0],
    horaPedido: pedidoCRM.dataHora.split("T")[1].substring(0, 5),
    horaSaida: new Date().toISOString().split("T")[1].substring(0, 5),
    horaEntrega: "",
    entregador: dadosEntrega.responsavel || "Transportadora",
    recebedor: "",
    situacao: "",
    status: "Separando", 
    createdAt: new Date().toISOString()
  };

  await addDoc(collection(db, "entregas"), novaEntrega);

  return pedidoCRM;
}

export async function analisarPedidoComIA(pedidoCRM: any) {
  const API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!API_KEY) return { valido: true, alertas: [], sugestoes: [], resumo: "API Key não configurada" };

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const prompt = `
Você é um especialista em fiscal e e-commerce no Brasil.
Analise o pedido abaixo e retorne um JSON com:
1. "valido": true/false
2. "alertas": array de strings com possíveis problemas fiscais ou operacionais
3. "sugestoes": array de strings com melhorias recomendadas
4. "resumo": uma linha descrevendo o pedido

Pedido:
${JSON.stringify(pedidoCRM, null, 2)}

Contexto fiscal:
- Operação: Venda de mercadoria dentro do Estado de Goiás
- CFOP: ${CONFIG.FISCAL.CFOP_VENDA_ESTADUAL}
- ICMS interno GO: ${CONFIG.FISCAL.ALIQUOTA_ICMS_GO}%
- Regime: ${CONFIG.EMITENTE.CRT === "1" ? "Simples Nacional" : "Lucro Real/Presumido"}

Retorne APENAS o JSON, sem explicações adicionais.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const texto = response.text || "";
    const jsonLimpo = texto.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonLimpo);
  } catch (err: any) {
    console.error("Erro ao consultar Gemini:", err.message);
    return { valido: true, alertas: [], sugestoes: [], resumo: "Análise IA indisponível" };
  }
}

export async function processPedido(pedidoWebsite: any, opcoes: any = {}) {
  try {
    let pedido = await processarPedidoWebsite(pedidoWebsite);

    const conferencia = pedido.itens.map((item: any) => ({
      nItem: item.nItem,
      qtdConferida: item.quantidade,
      observacao: "OK",
    }));
    pedido = await conferirExpedicao(pedido, conferencia);

    if (pedido.status === CONFIG.STATUS.CONFERIDO) {
      pedido = await faturarPedido(pedido, {
        serie: opcoes.serie || "001",
        numeroNFe: opcoes.numeroNFe,
        infCpl: opcoes.infCpl,
        ambiente: opcoes.ambiente || "2", 
      });

      pedido = await despacharEntrega(pedido, {
        responsavel: "JOAO_SILVA",
        codigoRastreio: `GO${Date.now()}`,
        transportadora: pedidoWebsite.frete?.transportadora || "Transportadora Própria",
      });
    }

    return pedido;
  } catch (err: any) {
    console.error("ERRO NO PROCESSAMENTO DO PEDIDO:", err.message);
    throw err;
  }
}

function calcular(qtd: number, vUnit: number) {
  return Math.round(qtd * vUnit * 100) / 100;
}

function calcularIcms(qtd: number, vUnit: number) {
  const base = calcular(qtd, vUnit);
  return Math.round(base * (CONFIG.FISCAL.ALIQUOTA_ICMS_GO / 100) * 100) / 100;
}

function calcularTotais(itens: any[]) {
  const totalProdutos = itens.reduce((s, i) => s + calcular(i.quantidade, i.valorUnitario), 0);
  const totalIcms = itens.reduce((s, i) => s + calcularIcms(i.quantidade, i.valorUnitario), 0);
  return {
    totalProdutos: Math.round(totalProdutos * 100) / 100,
    totalIcms: Math.round(totalIcms * 100) / 100,
    totalPedido: Math.round(totalProdutos * 100) / 100,
  };
}

function calcularTotaisNFe(pedidoCRM: any) {
  const vProd = pedidoCRM.totais.totalProdutos;
  const vICMS = pedidoCRM.totais.totalIcms;
  const vFrete = pedidoCRM.frete.valor || 0;
  const vNF = Math.round((vProd + vFrete) * 100) / 100;
  return {
    vBC: vProd.toFixed(2),
    vICMS: vICMS.toFixed(2),
    vPIS: "0.00",
    vCOFINS: "0.00",
    vProd: vProd.toFixed(2),
    vFrete: vFrete.toFixed(2),
    vOutro: "0.00",
    vNF: vNF.toFixed(2),
  };
}

function gerarNumeroPedido() {
  return `${Date.now()}`.slice(-8);
}

function gerarNumeroNFe() {
  return String(Math.floor(Math.random() * 999999999)).padStart(9, "0");
}

function gerarChaveAcesso(serie: string, numero: string, cNF: string) {
  const cUF = "52"; 
  const ano = new Date().toISOString().slice(2, 4);
  const mes = new Date().toISOString().slice(5, 7);
  const cnpj = CONFIG.EMITENTE.CNPJ.replace(/\D/g, "");
  const base = `${cUF}${ano}${mes}${cnpj}55${String(serie).padStart(3,"0")}${numero.padStart(9,"0")}1${cNF}`;
  return base + "0"; 
}

function validarPedidoWebsite(p: any) {
  const erros = [];
  if (!p?.cliente?.nome) erros.push("Nome do cliente obrigatório");
  if (!p?.cliente?.cpfCnpj) erros.push("CPF/CNPJ do cliente obrigatório");
  if (!p?.cliente?.endereco?.uf) erros.push("UF do cliente obrigatória");
  if (!p?.itens?.length) erros.push("Pedido sem itens");
  p?.itens?.forEach((item: any, i: number) => {
    if (!item.ncm) erros.push(`Item ${i + 1}: NCM obrigatório para NF-e`);
    if (!item.codigo) erros.push(`Item ${i + 1}: Código do produto obrigatório`);
  });
  if (!p?.pagamento?.forma) erros.push("Forma de pagamento obrigatória");
  return erros;
}

function obterDataConferencia(pedidoCRM: any) {
  const conf = pedidoCRM.historico.find((h: any) => h.status === CONFIG.STATUS.CONFERIDO);
  return conf ? new Date(conf.dataHora).toLocaleString("pt-BR") : "N/A";
}

export const EXEMPLO_PEDIDO_WEBSITE = {
  cliente: {
    nome: "Maria Aparecida da Silva",
    cpfCnpj: "123.456.789-00",
    ie: "ISENTO",
    email: "maria@email.com",
    telefone: "(62) 99999-0000",
    endereco: {
      logradouro: "Rua das Flores",
      numero: "123",
      complemento: "Apto 4",
      bairro: "Jardim América",
      municipio: "Goiânia",
      uf: "GO",
      cep: "74000-000",
      codigoMunicipio: "5208707",
    },
  },
  itens: [
    {
      codigo: "PROD-001",
      descricao: "Notebook Dell Inspiron 15 i5 8GB SSD256",
      ncm: "84713012",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 2899.90,
      ean: "7891234567890",
    },
    {
      codigo: "PROD-002",
      descricao: "Mouse Sem Fio Logitech MX Anywhere",
      ncm: "84716060",
      unidade: "UN",
      quantidade: 2,
      valorUnitario: 159.90,
      ean: "0097855145611",
    },
  ],
  frete: {
    modalidade: "0",
    transportadora: "Transportadora GO Express",
    valor: 25.00,
  },
  pagamento: {
    forma: "03",
    valor: 3244.70,
  },
};
