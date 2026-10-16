import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { IcsMethod } from './ics';

export interface CalendarInvite {
  method: IcsMethod;
  content: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    this.from = config.get('SMTP_FROM', 'Acuérdalo <no-reply@acuerdalo.local>');
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'mailpit'),
      port: parseInt(config.get('SMTP_PORT', '1025'), 10),
      secure: config.get('SMTP_SECURE') === 'true',
      auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
    });
  }

  /** Nunca lanza: los errores de envío se registran y se ignoran. */
  async send(to: string, subject: string, html: string, invite?: CalendarInvite): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
        // nodemailer añade el text/calendar como alternativa (Gmail/Outlook muestran la invitación) y como adjunto .ics
        ...(invite && {
          icalEvent: { method: invite.method, filename: invite.method === 'CANCEL' ? 'cancelacion.ics' : 'evento.ics', content: invite.content },
        }),
      });
      return true;
    } catch (err) {
      this.logger.error(`Fallo al enviar correo a ${to}: ${(err as Error).message}`);
      return false;
    }
  }
}
