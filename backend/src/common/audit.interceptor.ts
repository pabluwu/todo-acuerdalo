import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit/audit.service';

/** Respaldo: registra toda petición que no sea GET (además de los registros explícitos de cada servicio). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next.handle();
    const record = (status: number) => {
      const u = req.user;
      void this.audit.log(
        u ? { id: u.id, email: u.email, ip: req.ip } : { id: null, email: null, ip: req.ip },
        'http.request',
        'http',
        null,
        null,
        { method: req.method, path: req.originalUrl?.split('?')[0], status },
      );
    };
    return next.handle().pipe(
      tap({
        next: () => record(ctx.switchToHttp().getResponse().statusCode),
        error: (e) => record(typeof e?.getStatus === 'function' ? e.getStatus() : 500),
      }),
    );
  }
}
