import React, { useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

export const CustomerNotifications: React.FC = () => {
  const { addToast } = useToast();
  const { user, profile } = useAuth();
  
  // Keep track of the initial load to avoid alerting about old orders
  const isInitialLoad = useRef(true);
  const isInitialLoadStatus = useRef(true);

  // Listen to new orders placed by this customer
  useEffect(() => {
    const customerEmail = profile?.email || user?.email;
    if (!user || (profile?.role !== 'Cliente' && profile?.role !== 'cliente') || !customerEmail) return;

    const q = query(
      collection(db, 'pedidos_venda'),
      where('cliente.email', '==', customerEmail)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          addToast(`📧 E-mail transacional simulado: Recebemos o seu pedido #${change.doc.id.substring(0, 6)}. Acompanhe o status no seu painel.`, 'info');
        }
      });
    }, (error) => {
      console.warn("Notice for new customer orders listener:", error);
    });

    return () => unsubscribe();
  }, [addToast, user, profile?.role, profile?.email]);

  // Listen to status changes
  useEffect(() => {
    if (!user || (profile?.role !== 'Cliente' && profile?.role !== 'cliente')) return;

    const q = query(
      collection(db, 'pedidos_venda'),
      where('clienteId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoadStatus.current) {
        isInitialLoadStatus.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          
          if (data.status === 'Cancelado' || data.status === 'Falha' || data.status === 'Devolvido') {
             addToast(`📧 E-mail simulado: Seu pedido #${change.doc.id.substring(0, 6)} foi atualizado para ${data.status}.`, 'error');
          } else if (data.status === 'Aprovado') {
             addToast(`📧 E-mail simulado: Pagamento do pedido #${change.doc.id.substring(0, 6)} aprovado!`, 'success');
          } else if (data.status === 'Pronta para Envio') { 
            addToast(`📧 E-mail simulado: Seu pedido #${change.doc.id.substring(0, 6)} está pronto para envio!`, 'info');
          } else if (data.status === 'Em trânsito') {
             addToast(`📧 E-mail simulado: Seu pedido #${change.doc.id.substring(0, 6)} está a caminho!`, 'info');
          } else if (data.status === 'Entregue') {
             addToast(`📧 E-mail simulado: Seu pedido #${change.doc.id.substring(0, 6)} foi entregue com sucesso!`, 'success');
          }
        }
      });
    }, (error) => {
      console.warn("Notice for customer order status listener:", error);
    });

    return () => unsubscribe();
  }, [addToast, user, profile?.role]);

  return null;
};
