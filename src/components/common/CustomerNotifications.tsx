import React, { useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { triggerLocalPushNotification, logNotificationToFirestore } from '../../services/notificationService';

export const CustomerNotifications: React.FC = () => {
  const { addToast, addOrderToast } = useToast();
  const { user, profile } = useAuth();
  
  // Track previous order statuses to fire notifications only on real modifications
  const previousOrdersRef = useRef<Map<string, string>>(new Map());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    const customerEmail = profile?.email || user?.email;
    if (!user && !customerEmail) return;

    // Reset initial load tracking when user or email changes
    isInitialLoadRef.current = true;
    previousOrdersRef.current.clear();

    const formatHumanStatus = (rawStatus: string) => {
      switch (rawStatus) {
        case 'AGUARDANDO_CONFERENCIA':
        case 'Novo':
        case 'Aguardando':
          return { label: 'Aguardando Confirmação', title: '📦 Pedido Recebido', emoji: '📦' };
        case 'EM_CONFERENCIA':
        case 'Em Separação':
        case 'Em Conferencia':
          return { label: 'Em Separação', title: '📋 Pedido em Separação', emoji: '📋' };
        case 'APROVADO_PARA_FATURAMENTO':
        case 'Conferido':
        case 'Aprovado':
          return { label: 'Aprovado para Faturamento', title: '✔️ Pedido Aprovado', emoji: '✔️' };
        case 'FATURADO':
        case 'Faturado':
          return { label: 'Faturado (Nota Fiscal Emitida)', title: '📄 Nota Fiscal Emitida', emoji: '📄' };
        case 'DESPACHADO':
        case 'Despachado':
        case 'Em trânsito':
        case 'Em Rota de Entrega':
        case 'Saiu para Entrega':
        case 'Enviado':
          return { label: 'Despachado / Em Rota de Entrega', title: '🚚 Pedido Despachado!', emoji: '🚚' };
        case 'Entregue':
        case 'ENTREGUE':
        case 'Finalizado':
          return { label: 'Entregue', title: '✅ Pedido Entregue com Sucesso!', emoji: '✅' };
        case 'Falha':
        case 'Falha na Entrega':
          return { label: 'Tentativa de Entrega não Concluída', title: '⚠️ Falha na Entrega', emoji: '⚠️' };
        case 'REJEITADO_PELA_EXPEDICAO':
        case 'Cancelado':
        case 'Devolvido':
          return { label: 'Cancelado', title: '❌ Pedido Cancelado', emoji: '❌' };
        default:
          return { label: rawStatus || 'Em Processamento', title: `📦 Atualização do Pedido`, emoji: '📦' };
      }
    };

    const handleOrderChange = (changeType: 'added' | 'modified', orderDoc: any) => {
      const orderData = orderDoc.data();
      const orderId = orderDoc.id;
      const orderNum = orderData.id_externo || orderData.numero || (orderData.numeroPedido ? `#${orderData.numeroPedido}` : `#${orderId.slice(-6).toUpperCase()}`);
      const currentStatus = orderData.status || 'Novo';
      const prevStatus = previousOrdersRef.current.get(orderId);

      // On initial load, record current status without firing notifications
      if (isInitialLoadRef.current) {
        previousOrdersRef.current.set(orderId, currentStatus);
        return;
      }

      // New order created during the session
      if (changeType === 'added' && !prevStatus) {
        previousOrdersRef.current.set(orderId, currentStatus);
        const { title, emoji } = formatHumanStatus(currentStatus);
        
        addToast({
          id: `order-new-${orderId}`,
          title: `🎉 Pedido Realizado: ${orderNum}`,
          message: `Recebemos seu pedido com sucesso! Você pode acompanhar o status em tempo real pelo painel.`,
          type: 'order',
          orderNumber: orderNum,
          status: 'Aguardando',
          actionUrl: '/cliente/pedidos',
          actionLabel: 'Ver Pedido',
          duration: 7000,
          playSound: true,
        });

        triggerLocalPushNotification({
          title: `${emoji} Novo Pedido ${orderNum}`,
          body: `Recebemos seu pedido com sucesso! Acompanhe o processo de separação e entrega.`,
          url: '/cliente/pedidos',
          tag: `new-order-${orderId}`,
        });

        if (user?.uid) {
          logNotificationToFirestore(
            user.uid,
            customerEmail || '',
            'pedido_status',
            `Novo Pedido ${orderNum}`,
            `Recebemos seu pedido com sucesso! Acompanhe a entrega.`,
            '/cliente/pedidos'
          );
        }
        return;
      }

      // Order status updated
      if (changeType === 'modified' && prevStatus && prevStatus !== currentStatus) {
        previousOrdersRef.current.set(orderId, currentStatus);
        const { label, title, emoji } = formatHumanStatus(currentStatus);

        let descMessage = `O status do seu pedido ${orderNum} mudou para "${label}".`;
        if (currentStatus === 'DESPACHADO' || currentStatus === 'Despachado' || currentStatus === 'Saiu para Entrega' || currentStatus === 'Em trânsito') {
          descMessage = `Seu pedido ${orderNum} saiu para entrega e está a caminho do seu condomínio!`;
        } else if (currentStatus === 'Entregue' || currentStatus === 'ENTREGUE') {
          descMessage = `Seu pedido ${orderNum} foi entregue com sucesso no seu condomínio!`;
        } else if (currentStatus === 'FATURADO' || currentStatus === 'Faturado') {
          descMessage = `A Nota Fiscal Eletrônica do pedido ${orderNum} foi emitida e o pacote está pronto para envio.`;
        } else if (currentStatus === 'EM_CONFERENCIA' || currentStatus === 'Em Separação') {
          descMessage = `A equipe de expedição começou a separar os produtos do pedido ${orderNum}.`;
        }

        // 1. Interactive Toast Alert
        addOrderToast({
          id: `order-status-${orderId}-${currentStatus}`,
          title: `${emoji} ${title}`,
          message: descMessage,
          orderNumber: orderNum,
          status: label,
          actionUrl: '/cliente/pedidos',
          actionLabel: 'Ver Detalhes do Pedido',
          duration: 8000,
          playSound: true,
        });

        // 2. Web Push Notification
        triggerLocalPushNotification({
          title: `${emoji} ${orderNum}: ${label}`,
          body: descMessage,
          url: '/cliente/pedidos',
          tag: `order-${orderId}-${currentStatus}`,
        });

        // 3. Firestore Customer Notification Log
        if (user?.uid) {
          logNotificationToFirestore(
            user.uid,
            customerEmail || '',
            'pedido_status',
            `${emoji} Pedido ${orderNum}: ${label}`,
            descMessage,
            '/cliente/pedidos'
          );
        }
      } else {
        // Record current status if not set
        previousOrdersRef.current.set(orderId, currentStatus);
      }
    };

    // Primary query by customer email
    let qOrders;
    if (customerEmail) {
      qOrders = query(
        collection(db, 'pedidos_venda'),
        where('cliente.email', '==', customerEmail)
      );
    } else {
      qOrders = query(
        collection(db, 'pedidos_venda'),
        where('clienteId', '==', user?.uid)
      );
    }

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          handleOrderChange(change.type, change.doc);
        });
        isInitialLoadRef.current = false;
      },
      (error) => {
        console.warn("Notice for customer order status listener:", error);
      }
    );

    return () => unsubscribe();
  }, [addToast, addOrderToast, user, profile?.email]);

  return null;
};
