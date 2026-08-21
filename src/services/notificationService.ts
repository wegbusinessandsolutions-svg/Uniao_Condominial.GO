import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  data?: Record<string, any>;
  vibrate?: number[];
}

/**
 * Solicita permissão ao usuário para enviar notificações
 */
export async function requestNotificationPermission(userId?: string): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("Este navegador não suporta notificações de desktop.");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" && userId) {
      // Salva consentimento no documento do usuário
      try {
        await updateDoc(doc(db, "users", userId), {
          notificacoesPushAtivas: true,
          notificacoesAtualizadasEm: serverTimestamp(),
        });
      } catch (e) {
        console.warn("Não foi possível atualizar consentimento no perfil:", e);
      }
    }
    return permission;
  } catch (error) {
    console.error("Erro ao solicitar permissão de notificações:", error);
    return "denied";
  }
}

/**
 * Envia notificação local pelo Service Worker (ou fallback pela API Notification)
 */
export async function triggerLocalPushNotification(payload: PushNotificationPayload) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission !== "granted") {
    console.log("Notificação ignorada: permissão não concedida.");
    return;
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || "/uniao-condominial-logo.png",
    badge: "/uniao-condominial-logo.png",
    data: { url: payload.url || "/cliente", ...payload.data },
    tag: payload.tag || "uc-alert-" + Date.now(),
    vibrate: payload.vibrate || [200, 100, 200],
  };

  // 1. Tenta enviar através do Service Worker registrado
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: {
        title: payload.title,
        ...notificationOptions,
      },
    });
    return;
  }

  // 2. Se o controller ainda não estiver pronto, tenta buscar a registration do SW
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(payload.title, notificationOptions as any);
        return;
      }
    } catch (e) {
      console.warn("Falha ao exibir via ServiceWorker registration:", e);
    }
  }

  // 3. Fallback: Cria notificação via construtor padrão
  try {
    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: notificationOptions.icon,
      data: notificationOptions.data,
      tag: notificationOptions.tag,
    });
    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (payload.url) {
        window.location.href = payload.url;
      }
      notif.close();
    };
  } catch (err) {
    console.warn("Fallback Notification falhou:", err);
  }
}

/**
 * Registra um evento de notificação no Firestore para histórico persistente
 */
export async function logNotificationToFirestore(
  userId: string,
  userEmail: string,
  tipo: "pedido_status" | "promocao_clube" | "afiliacao" | "sistema",
  titulo: string,
  mensagem: string,
  linkUrl: string = "/cliente"
) {
  try {
    await addDoc(collection(db, "notificacoes_clientes"), {
      userId,
      userEmail,
      tipo,
      titulo,
      mensagem,
      linkUrl,
      lida: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Erro ao salvar histórico de notificação no Firestore:", err);
  }
}
