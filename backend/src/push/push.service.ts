import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from '../entities/push-subscription.entity';

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta relativa (p. ej. `/tasks/<id>`) para que abra dentro de la PWA instalada. */
  url: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  readonly publicKey: string;

  constructor(
    config: ConfigService,
    @InjectRepository(PushSubscription) private subs: Repository<PushSubscription>,
  ) {
    this.publicKey = config.get('VAPID_PUBLIC_KEY', '');
    const privateKey = config.get('VAPID_PRIVATE_KEY', '');
    const subject = config.get('VAPID_SUBJECT', 'mailto:no-reply@acuerdalo.local');
    if (this.publicKey && privateKey) {
      try {
        webpush.setVapidDetails(subject, this.publicKey, privateKey);
        this.enabled = true;
      } catch (err) {
        this.logger.error(`VAPID inválido, push desactivado: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY sin configurar: las notificaciones push están desactivadas');
    }
  }

  get isEnabled() {
    return this.enabled;
  }

  /** Un dispositivo solo pertenece a un usuario: si cambia de cuenta, la suscripción pasa a la nueva. */
  async subscribe(userId: string, endpoint: string, keys: { p256dh: string; auth: string }, userAgent?: string) {
    const existing = await this.subs.findOne({ where: { endpoint } });
    const ua = userAgent?.slice(0, 300) ?? null;
    if (existing) {
      Object.assign(existing, { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua });
      await this.subs.save(existing);
    } else {
      await this.subs.save(this.subs.create({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua }));
    }
  }

  /** Solo borra si la suscripción es del propio usuario. */
  async unsubscribe(userId: string, endpoint: string) {
    await this.subs.delete({ userId, endpoint });
  }

  /** Nunca lanza: un push fallido no debe bloquear el correo ni el flujo que lo originó. Solo a usuarios activos. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    try {
      const ids = [...new Set(userIds)];
      if (ids.length === 0) return;
      const rows = await this.subs.find({ where: { userId: In(ids), user: { isActive: true } } });
      const body = JSON.stringify(payload);
      await Promise.all(rows.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.subs.delete({ id: s.id }).catch(() => undefined);
          } else {
            this.logger.warn(`push a ${s.endpoint.slice(0, 60)}…: ${(err as Error).message}`);
          }
        }
      }));
    } catch (err) {
      this.logger.error(`sendToUsers: ${(err as Error).message}`);
    }
  }
}
