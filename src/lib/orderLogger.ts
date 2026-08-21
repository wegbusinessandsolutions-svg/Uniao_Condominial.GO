import { sendEmailWithLog } from "./emailService";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { logAction } from "./audit";

/**
 * Registra uma mudança de status de um pedido de forma centralizada.
 * Grava o log na subcoleção do pedido e cria uma notificação para o cliente.
 */
export async function logOrderStatusChange(
  db: any,
  pedidoId: string,
  pedidoData: any,
  novoStatus: string,
  observacao: string,
  usuarioNome: string,
  usuarioEmail: string,
  usuarioRole: string
) {
  try {
    const statusAnterior = pedidoData.status || "Pendente";
    const numeroPedido = pedidoData.id_externo || pedidoId.slice(-6).toUpperCase();
    const agora = new Date().toISOString();

    // 1. Atualizar o documento principal do pedido
    const pedidoRef = doc(db, "pedidos", pedidoId);
    await updateDoc(pedidoRef, {
      status: novoStatus,
      data_atualizacao: agora,
      ultima_observacao: observacao || `Status alterado de "${statusAnterior}" para "${novoStatus}"`
    });

    // 2. Criar entrada na subcoleção 'historico_status' do pedido
    const historicoRef = collection(db, "pedidos", pedidoId, "historico_status");
    await addDoc(historicoRef, {
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      observacao: observacao || `Status alterado para ${novoStatus}`,
      data: agora,
      alterado_por: {
        nome: usuarioNome,
        email: usuarioEmail,
        perfil: usuarioRole
      },
      timestamp: serverTimestamp()
    });

    // 3. Notificar o cliente criando uma notificação no Firestore
    const clienteId = pedidoData.cliente_id || (pedidoData.cliente?.id ? pedidoData.cliente.id : null);
    if (clienteId) {
      const notifRef = collection(db, "usuarios", clienteId, "notificacoes");
      await addDoc(notifRef, {
        tipo: "pedido_status",
        titulo: `Pedido #${numeroPedido}: ${novoStatus}`,
        mensagem: observacao 
          ? `Seu pedido #${numeroPedido} teve o status alterado para "${novoStatus}". Obs: ${observacao}`
          : `O status do seu pedido #${numeroPedido} foi atualizado para "${novoStatus}".`,
        pedidoId: pedidoId,
        numeroPedido: numeroPedido,
        novoStatus: novoStatus,
        lida: false,
        data: agora,
        timestamp: serverTimestamp()
      });
    }

    // 4. Gravar auditoria geral do sistema
    await logAction(
      `Alterou o status do pedido #${numeroPedido} de "${statusAnterior}" para "${novoStatus}"${observacao ? ` (Obs: ${observacao})` : ""}`,
      "Comercial",
      { pedidoId, statusAnterior, novoStatus, usuarioEmail, usuarioNome }
    );

    // 5. Disparar e-mail de mudança de status se o template estiver ativo
    try {
      const configRef = doc(db, "config", "email");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const emailConfig = configSnap.data();
        const mudancaTemplate = emailConfig.templates?.mudancaStatus;
        
        if (mudancaTemplate && mudancaTemplate.ativo !== false) {
          const clienteEmail = pedidoData.cliente?.email || pedidoData.cliente_email;
          const clienteNome = pedidoData.cliente?.nome || pedidoData.cliente_nome || "Cliente";

          let conteudo = mudancaTemplate?.conteudo || `Olá <strong>${clienteNome}</strong>!<br/><br/>O status do seu pedido <strong>#${numeroPedido}</strong> foi atualizado para: <strong>${novoStatus}</strong>.<br/><br/>Observação: ${observacao}<br/><br/>Atenciosamente,<br/>Equipe União Condominial`;
          
          conteudo = conteudo.replace(/{{nome_cliente}}/g, clienteNome);
          conteudo = conteudo.replace(/{{numero_pedido}}/g, numeroPedido);
          conteudo = conteudo.replace(/{{novo_status}}/g, novoStatus);

          let assunto = mudancaTemplate?.assunto || `Atualização de Status do Pedido #${numeroPedido}`;
          assunto = assunto.replace(/{{numero_pedido}}/g, numeroPedido);
          assunto = assunto.replace(/{{novo_status}}/g, novoStatus);

          if (clienteEmail) {
            sendEmailWithLog({
                to: clienteEmail,
                subject: assunto,
                html: conteudo
              }, "Mudanca Status", numeroPedido);
          }
        }
      }
    } catch (e) {
      console.error("Erro ao notificar mudanca de status por email", e);
    }
  } catch (error) {
    console.error("Erro ao registrar mudança de status do pedido:", error);
    throw error;
  }
}

/**
 * Função utilizada pelo módulo de Entregas e Expedição para registrar mudança de status de pedidos_venda
 */
export async function registrarMudancaStatusPedido(
  db: any,
  pedidoId: string,
  novoStatus: string,
  usuarioNome: string,
  observacao?: string
) {
  try {
    const pedidoRef = doc(db, "pedidos_venda", pedidoId);
    const pedidoSnap = await getDoc(pedidoRef);
    const pedidoData = pedidoSnap.exists() ? pedidoSnap.data() : {};
    const statusAnterior = pedidoData.status || "Pendente";
    const numeroPedido = pedidoData.id_externo || pedidoData.codigo || pedidoId.slice(-6).toUpperCase();
    const agora = new Date().toISOString();

    await updateDoc(pedidoRef, {
      status: novoStatus,
      data_atualizacao: agora,
      ultima_observacao: observacao || `Status alterado para ${novoStatus}`
    });

    const historicoRef = collection(db, "pedidos_venda", pedidoId, "historico_status");
    await addDoc(historicoRef, {
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      observacao: observacao || `Status alterado para ${novoStatus}`,
      data: agora,
      alterado_por: {
        nome: usuarioNome,
        perfil: "Entregador/Expedição"
      },
      timestamp: serverTimestamp()
    });

    await logAction(
      `Alteração de status do pedido #${numeroPedido} de "${statusAnterior}" para "${novoStatus}"${observacao ? ` (${observacao})` : ""}`,
      "Estoque",
      { pedidoId, statusAnterior, novoStatus, usuarioNome }
    );

    // Enviar e-mail de notificação se o template de mudança de status estiver ativo
    try {
      const configRef = doc(db, "config", "email");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const emailConfig = configSnap.data();
        const mudancaTemplate = emailConfig.templates?.mudancaStatus;
        if (mudancaTemplate && mudancaTemplate.ativo !== false) {
          const clienteEmail = pedidoData.cliente?.email || pedidoData.cliente_email;
          const clienteNome = pedidoData.cliente?.nome || pedidoData.cliente_nome || "Cliente";

          let conteudo = mudancaTemplate?.conteudo || `Olá <strong>${clienteNome}</strong>!<br/><br/>O status do seu pedido <strong>#${numeroPedido}</strong> foi atualizado para: <strong>${novoStatus}</strong>.<br/><br/>Observação: ${observacao || ''}<br/><br/>Atenciosamente,<br/>Equipe União Condominial`;
          conteudo = conteudo.replace(/{{nome_cliente}}/g, clienteNome);
          conteudo = conteudo.replace(/{{numero_pedido}}/g, numeroPedido);
          conteudo = conteudo.replace(/{{novo_status}}/g, novoStatus);

          let assunto = mudancaTemplate?.assunto || `Atualização de Status do Pedido #${numeroPedido}`;
          assunto = assunto.replace(/{{numero_pedido}}/g, numeroPedido);
          assunto = assunto.replace(/{{novo_status}}/g, novoStatus);

          if (clienteEmail) {
            sendEmailWithLog({
              to: clienteEmail,
              subject: assunto,
              html: conteudo
            }, "Mudanca Status", numeroPedido);
          }
        }
      }
    } catch (mailErr) {
      console.warn("Erro ao disparar email de atualização de status:", mailErr);
    }
  } catch (err) {
    console.error("Erro ao registrar mudança de status no pedido:", err);
  }
}

/**
 * Função utilitária para gravar log centralizado de pedido a partir de fluxos como e-commerce e expedição.
 */
export async function gravarLogCentralizadoPedido(
  db: any,
  pedidoId: string,
  codigoPedido: string,
  statusAnterior: string,
  novoStatus: string,
  modulo: string,
  observacao?: string
) {
  try {
    const agora = new Date().toISOString();
    const historicoRef = collection(db, "pedidos_venda", pedidoId, "historico_status");
    await addDoc(historicoRef, {
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      modulo: modulo,
      observacao: observacao || `Status alterado para ${novoStatus} no módulo ${modulo}`,
      data: agora,
      timestamp: serverTimestamp()
    });

    await logAction(
      `Alteração de status do pedido #${codigoPedido} para "${novoStatus}" (${modulo})`,
      "Estoque",
      { pedidoId, statusAnterior, novoStatus, modulo }
    );
  } catch (err) {
    console.warn("Erro ao gravar log centralizado do pedido:", err);
  }
}
