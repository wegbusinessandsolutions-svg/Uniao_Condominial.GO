import React, { useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { collection, query, onSnapshot, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

export const AdminNotifications: React.FC = () => {
  const { addToast } = useToast();
  const { profile } = useAuth();
  
  // Request notification permissions on load (some browsers might require user gesture later)
  useEffect(() => {
    if (profile && profile.role !== 'Cliente' && profile.role !== 'cliente') {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(console.error);
      }
    }
  }, [profile]);

  // Listen to new orders
  useEffect(() => {
    // Only run this if we are authenticated admin/staff
    const isStaff = profile && ['Administrador', 'admin', 'Admin', 'Comercial', 'Comercial Externo', 'Vendedor Externo', 'Financeiro', 'Estoquista', 'Entregador', 'Expedição'].includes(profile.role || '');
    if (!isStaff) return;

    let isFirstRun = true;
    
    const q = query(
      collection(db, 'pedidos_venda'),
      orderBy('dataHora', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const cliente = typeof data.cliente === 'object' ? data.cliente?.nome : data.cliente;
          
          const isExpedicaoRole = ['admin', 'Administrador', 'Admin', 'Expedição', 'Estoquista'].includes(profile?.role || '');
          
          // E-commerce orders for Expedition
          if (data.canal === 'ECOMMERCE' && data.status === 'AGUARDANDO_CONFERENCIA') {
            if (isExpedicaoRole) {
              // 1. Prominent Visual Toast Alert
              addToast(`🔔 URGENTE: Novo Pedido Online E-commerce #${change.doc.id.substring(0, 6)} aguardando separação!`, 'success');
              
              // 2. Browser Push Notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('📦 Novo Pedido Online (Expedição)', {
                  body: `O pedido online #${change.doc.id.substring(0, 6)} de ${cliente || 'Cliente'} acaba de chegar.`,
                  icon: '/favicon.ico' // fallback to standard icon
                });
              }
              
              // 3. Optional Audio Alert (Beep)
              try {
                const audio = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3');
                audio.play().catch(() => {});
              } catch(e) {}
            }
          } else {
             // Normal alert for non-ecommerce or non-expedition
             addToast(`Novo pedido #${change.doc.id.substring(0, 6)} de ${cliente || 'Cliente'}`, 'info');
          }
        }
      });
    }, (error) => {
      console.warn("Error listening to new orders:", error);
    });

    return () => unsubscribe();
  }, [addToast, profile?.role]);

  // Listen to status changes that are critical (e.g., 'Aprovado', 'Cancelado', 'Falha')
  useEffect(() => {
    const isStaff = profile && ['Administrador', 'admin', 'Admin', 'Comercial', 'Comercial Externo', 'Vendedor Externo', 'Financeiro', 'Estoquista', 'Entregador', 'Expedição'].includes(profile.role || '');
    if (!isStaff) return;

    let isFirstRunStatus = true;

    const q = query(
      collection(db, 'pedidos_venda'),
      where('status', 'in', ['Aprovado', 'Cancelado', 'Falha', 'Devolvido'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isFirstRunStatus) {
        isFirstRunStatus = false;
        return;
      }
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          const cliente = typeof data.cliente === 'object' ? data.cliente?.nome : data.cliente;
          
          if (data.status === 'Cancelado' || data.status === 'Falha' || data.status === 'Devolvido') {
             addToast(`Pedido #${change.doc.id.substring(0, 6)} de ${cliente} alterado para ${data.status}`, 'error');
          } else if (data.status === 'Aprovado') {
             addToast(`Pedido #${change.doc.id.substring(0, 6)} aprovado!`, 'success');
          }
        }
      });
    }, (error) => {
      console.warn("Error listening to order status:", error);
    });

    return () => unsubscribe();
  }, [addToast, profile?.role]);

  return null;
};
