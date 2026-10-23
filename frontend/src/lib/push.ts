import { api } from './api';

export type PushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const SW_URL = '/sw.js';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ se identifica como Mac con pantalla táctil
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** En iOS el push solo existe dentro de la app instalada en la pantalla de inicio. */
export function needsIosInstall(): boolean {
  return isIos() && !isStandalone();
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  return existing ?? navigator.serviceWorker.register(SW_URL, { scope: '/' });
}

/** Estado de este dispositivo. No pide permisos ni registra nada. */
export async function getPushState(): Promise<PushState> {
  if (needsIosInstall()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Debe llamarse desde un clic del usuario (iOS lo exige). Devuelve el estado resultante. */
export async function enablePush(): Promise<PushState> {
  if (needsIosInstall()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'denied';
  if (permission !== 'granted') return 'off';
  const { key } = await api<{ key: string }>('/push/vapid-public-key');
  if (!key) throw new Error('Las notificaciones no están configuradas en el servidor');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
  await api('/push/subscriptions', { method: 'POST', body: sub.toJSON() });
  return 'on';
}

/** Quita la suscripción del servidor y del navegador. Falla en silencio si algo no está disponible. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  } catch {
    /* mejor esfuerzo */
  }
}
