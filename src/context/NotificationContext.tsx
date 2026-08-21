import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  requestNotificationPermission,
  triggerLocalPushNotification,
  logNotificationToFirestore,
} from "../services/notificationService";

export interface AppNotification {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "pedido_status" | "promocao_clube" | "afiliacao" | "sistema";
  linkUrl?: string;
  lida: boolean;
  createdAt?: any;
}

interface NotificationContextType {
  permission: NotificationPermission;
  notifications: AppNotification[];
  unreadCount: number;
  requestPermission: () => Promise<NotificationPermission>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  testOrderNotification: () => void;
  testPromotionNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  permission: "default",
  notifications: [],
  unreadCount: 0,
  requestPermission: async () => "default",
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  testOrderNotification: () => {},
  testPromotionNotification: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Mantém controle de status anteriores de pedidos para detectar mudanças em tempo real
  const previousOrdersRef = useRef<Map<string, string>>(new Map());
  const initialLoadOrdersRef = useRef(true);

  // Atualiza permissão quando a janela ganha foco
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission(user?.uid);
    setPermission(res);
    return res;
  };

  // 1. Escuta notificações salvas no Firestore para o usuário
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    try {
      const q = query(
        collection(db, "notificacoes_clientes"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(20)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list: AppNotification[] = [];
          snapshot.forEach((d) => {
            list.push({ id: d.id, ...(d.data() as any) });
          });
          setNotifications(list);
        },
        (error) => {
          console.warn("Erro no listener de notificacoes_clientes:", error);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn("Erro ao configurar listener de notificações:", err);
    }
  }, [user?.uid]);

  // 2. Escuta mudanças de status nos Pedidos do Cliente em Tempo Real
  useEffect(() => {
    const userEmail = profile?.email || user?.email;
    if (!user?.uid && !userEmail) return;

    initialLoadOrdersRef.current = true;
    previousOrdersRef.current.clear();

    try {
      let qOrders;
      if (userEmail) {
        qOrders = query(
          collection(db, "pedidos_venda"),
          where("cliente.email", "==", userEmail),
          limit(30)
        );
      } else {
        qOrders = query(
          collection(db, "pedidos_venda"),
          where("clienteId", "==", user.uid),
          limit(30)
        );
      }

      const unsubOrders = onSnapshot(
        qOrders,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const docData = change.doc.data();
            const orderId = change.doc.id;
            const currentStatus = docData.status || "Novo";
            const previousStatus = previousOrdersRef.current.get(orderId);

            // Se for carregamento inicial, apenas popula a referência
            if (initialLoadOrdersRef.current) {
              previousOrdersRef.current.set(orderId, currentStatus);
              return;
            }

            // Se houve alteração de status
            if (change.type === "modified" && previousStatus && previousStatus !== currentStatus) {
              previousOrdersRef.current.set(orderId, currentStatus);

              const numeroCurto = docData.numeroPedido || orderId.slice(0, 6).toUpperCase();
              let iconEmoji = "📦";
              if (currentStatus === "Em Rota de Entrega" || currentStatus === "Saiu para Entrega") {
                iconEmoji = "🚚";
              } else if (currentStatus === "Entregue") {
                iconEmoji = "✅";
              } else if (currentStatus === "Em Separação") {
                iconEmoji = "📋";
              } else if (currentStatus === "Cancelado") {
                iconEmoji = "❌";
              }

              const titulo = `${iconEmoji} Pedido #${numeroCurto}: ${currentStatus}`;
              const mensagem = `O status do seu pedido foi atualizado para "${currentStatus}". Clique para acompanhar.`;
              const linkUrl = "/cliente/pedidos";

              // Dispara notificação push pelo Service Worker
              triggerLocalPushNotification({
                title: titulo,
                body: mensagem,
                url: linkUrl,
                tag: `pedido-${orderId}-${currentStatus}`,
              });

              // Salva no histórico de notificações do Firestore
              if (user?.uid) {
                logNotificationToFirestore(
                  user.uid,
                  userEmail || "",
                  "pedido_status",
                  titulo,
                  mensagem,
                  linkUrl
                );
              }
            } else {
              previousOrdersRef.current.set(orderId, currentStatus);
            }
          });

          initialLoadOrdersRef.current = false;
        },
        (err) => {
          console.warn("Erro no listener de pedidos_venda:", err);
        }
      );

      return () => unsubOrders();
    } catch (e) {
      console.warn("Erro ao registrar snapshot de pedidos:", e);
    }
  }, [user?.uid, profile?.email, user?.email]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notificacoes_clientes", id), {
        lida: true,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
    } catch (e) {
      console.warn("Erro ao marcar notificação como lida:", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadList = notifications.filter((n) => !n.lida);
      await Promise.all(
        unreadList.map((n) =>
          updateDoc(doc(db, "notificacoes_clientes", n.id), { lida: true })
        )
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    } catch (e) {
      console.warn("Erro ao marcar todas como lidas:", e);
    }
  };

  // Funções para teste imediato de demonstração
  const testOrderNotification = () => {
    const titulo = "🚚 Pedido #8492: Em Rota de Entrega!";
    const mensagem = "Seu pedido de produtos de conservação e limpeza está a caminho do condomínio.";
    const linkUrl = "/cliente/pedidos";

    triggerLocalPushNotification({
      title: titulo,
      body: mensagem,
      url: linkUrl,
      tag: "test-pedido-" + Date.now(),
    });

    if (user?.uid) {
      logNotificationToFirestore(
        user.uid,
        user.email || profile?.email || "",
        "pedido_status",
        titulo,
        mensagem,
        linkUrl
      );
    }
  };

  const testPromotionNotification = () => {
    const titulo = "✨ Super Promoção no Clube de Benefícios!";
    const mensagem = "Desconto exclusivo de 25% em serviços de Jardinagem e Limpeza Técnica para afiliados.";
    const linkUrl = "/cliente/beneficios";

    triggerLocalPushNotification({
      title: titulo,
      body: mensagem,
      url: linkUrl,
      tag: "test-promocao-" + Date.now(),
    });

    if (user?.uid) {
      logNotificationToFirestore(
        user.uid,
        user.email || profile?.email || "",
        "promocao_clube",
        titulo,
        mensagem,
        linkUrl
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  return (
    <NotificationContext.Provider
      value={{
        permission,
        notifications,
        unreadCount,
        requestPermission: handleRequestPermission,
        markAsRead,
        markAllAsRead,
        testOrderNotification,
        testPromotionNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
