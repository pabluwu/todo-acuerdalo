# Acuérdalo

Aplicación de tareas para equipos con tablero kanban, asignaciones con aviso por correo, comentarios con archivos adjuntos (hilo de revisiones), filtros, alertas de vencimiento y registro de auditoría.

**Stack:** NestJS 11 + TypeORM + PostgreSQL 16 (backend) · Next.js 15 (App Router) + Tailwind + @dnd-kit (frontend) · Docker Compose · Mailpit (SMTP de desarrollo).

## Arranque rápido

```bash
cp .env.example .env        # revisa JWT_SECRET y las variables SMTP_*
docker compose up --build -d
```

| Servicio | URL |
| --- | --- |
| Aplicación | http://localhost:3000 |
| Mailpit (correos de desarrollo) | http://localhost:8025 |
| API (a través del proxy de Next) | http://localhost:3000/api |

Las migraciones de TypeORM se ejecutan automáticamente al arrancar el backend (`migrationsRun: true`) y siembran los tipos de tarea *Interna*, *Clientes* y *Publicaciones*.

## Primer administrador

1. Regístrate en http://localhost:3000/register. La cuenta queda **inactiva** hasta que un administrador la apruebe.
2. Promociónala desde la línea de comandos (activa la cuenta y le da el rol `admin`):

   ```bash
   docker compose exec backend npm run make-admin -- correo@dominio.com
   ```

   El script ejecuta JavaScript compilado (`node dist/scripts/make-admin.js`), por lo que funciona dentro del contenedor de producción y deja constancia en la tabla `logs`.
3. Inicia sesión. Desde *Usuarios* puedes aprobar o desactivar cuentas y hacer administradores a otros usuarios; *Tipos* gestiona los tipos de tarea y *Logs* muestra la auditoría. Estas secciones solo aparecen para administradores.

## Funcionamiento

- **Autenticación:** JWT en una cookie `httpOnly` (`access_token`) que pone el backend. Next.js hace proxy de `/api/*` al backend (`BACKEND_URL`), así que todo vive en el mismo origen. `middleware.ts` redirige a `/login` si no hay cookie.
- **Tablero:** vista Tablero (3 columnas: Sin iniciar · En proceso · Completada, con arrastrar y soltar y actualización optimista + `PATCH /api/tasks/:id/move`) o vista Lista (`?view=list`, agrupada por estado u ordenada por fecha, prioridad o recientes, con cambio rápido de estado). En móvil solo se muestra la lista. Los filtros viven en la URL: persona, prioridad y tipo se aplican en la API; "Vencidas"/"Vencen pronto" (`due`), estado y orden se aplican en el cliente. El panel de tarea se abre con `?task=<id>`.
- **Comentarios y adjuntos:** los archivos se guardan en el volumen Docker `uploads` (`/app/uploads`) y se descargan con autenticación en `GET /api/attachments/:id` (`?download=1` fuerza la descarga).
- **Correos** (eventos con `@nestjs/event-emitter` + nodemailer; un fallo de envío se registra pero nunca rompe la petición):
  - Asignación: solo a los usuarios recién asignados.
  - Cualquier cambio (título, descripción, estado, prioridad, fecha límite, tipo, asignados, comentario o adjunto): a los asignados y a todos los administradores activos, con el detalle del cambio. Quien hace el cambio también recibe el aviso si está involucrado (asignado o admin).
  - Aprobación de cuenta: al usuario aprobado.
- **Alertas de vencimiento:** un cron (`DUE_ALERT_CRON`) avisa a los asignados una sola vez cuando una tarea no completada vence en menos de 24 h (*por vencer*) y otra vez cuando ya venció (*vencida*). Si cambia la fecha límite se reinician los avisos.
- **Auditoría:** toda mutación llama a `AuditService.log(actor, acción, entidad, id, antes, después)` y se guarda en la tabla `logs` (`id bigserial`, `data jsonb`, `created_at`). Además, un interceptor global registra como respaldo cualquier petición que no sea GET (`http.request`). Consulta rápida:

  ```bash
  docker compose exec db psql -U acuerdalo -d acuerdalo -c "select data from logs order by id desc limit 20"
  ```

## Calendario

Calendario compartido en `/calendar` (Mes · Semana · Día en escritorio; en móvil, una agenda con tira semanal y lista de eventos agrupada por día). Todos ven todos los eventos; solo el creador o un administrador puede editarlos, moverlos (arrastrar o redimensionar) o eliminarlos (403 para el resto).

- **Filtros** (en la URL): por persona (varias a la vez, "Mi agenda", "Todos"), por contacto externo y capa de tareas con fecha límite.
- **Participantes internos** reciben correo al ser invitados, cuando cambia el título, el horario, el lugar o los participantes, y al cancelarse el evento; además, un recordatorio opcional (5 min, 15 min, 30 min, 1 h o 1 día antes) que un cron revisa cada minuto y envía una sola vez. Quien hace el cambio también recibe el aviso si participa o creó el evento. Los correos de eventos incluyen una invitación `.ics` (Google Calendar, Outlook y Apple Calendar la muestran para agregarla al calendario); la cancelación envía un `.ics` con `METHOD:CANCEL` que la retira. Los contactos externos nunca aparecen en el `.ics`.
- **Contactos externos** (nombre + correo) viven en un directorio reutilizable. Sirven solo para seguimiento: **nunca reciben correos**. Los destinatarios se construyen únicamente a partir de los usuarios internos (`computeEventRecipients`, con test que lo comprueba). Los administradores gestionan el directorio en `/admin/contacts`.
- Las fechas de los correos usan `APP_TIMEZONE`. Los eventos de día completo se guardan como medianoche UTC con fin exclusivo.
- API: `GET/POST /api/events`, `GET/PATCH/DELETE /api/events/:id`, `PATCH /api/events/:id/time`, `GET /api/events/conflicts`, `GET/POST/PATCH /api/contacts`, `DELETE /api/contacts/:id` (admin). Todo queda en el log (`event.create|update|move|delete`, `contact.create|update|delete`, `event.reminder`).

## Variables de entorno

Se definen en `.env` (plantilla en `.env.example`).

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL (también configuran el contenedor `db`) | `db`, `5432`, `acuerdalo`, `acuerdalo`, `acuerdalo` |
| `JWT_SECRET` | Secreto de firma del JWT. **Cámbialo en producción** | — |
| `JWT_EXPIRES_IN` | Duración del token | `7d` |
| `COOKIE_SECURE` | `true` si sirves la app por HTTPS | `false` |
| `APP_URL` | URL pública del frontend, usada en los enlaces de los correos | `http://localhost:3000` |
| `UPLOAD_MAX_MB` | Tamaño máximo por archivo adjunto (MB) | `10` |
| `SMTP_HOST`, `SMTP_PORT` | Servidor SMTP | `mailpit`, `1025` |
| `SMTP_SECURE` | `true` para TLS directo (puerto 465) | `false` |
| `SMTP_USER`, `SMTP_PASS` | Credenciales SMTP (vacías para mailpit) | vacío |
| `SMTP_FROM` | Remitente de los correos | `Acuérdalo <no-reply@acuerdalo.local>` |
| `DUE_ALERT_CRON` | Expresión cron de las alertas de vencimiento | `0 * * * *` (cada hora) |
| `APP_TIMEZONE` | Zona horaria (IANA) con la que se formatean fechas y horas en los correos del calendario | `America/Santiago` |
| `UPLOAD_DIR`, `PORT` | Los fija `docker-compose.yml` (`/app/uploads`, `3001`) | — |

Para usar un SMTP real basta con cambiar las variables `SMTP_*` y reiniciar el backend (`docker compose up -d backend`). Para probar las alertas de vencimiento, pon `DUE_ALERT_CRON=* * * * *`.

## Desarrollo local (sin Docker para la app)

```bash
# Base de datos y mailpit
docker compose up -d db mailpit      # expón el puerto 5432 si quieres conectarte desde fuera

# Backend (puerto 3001)
cd backend && npm install
DB_HOST=localhost JWT_SECRET=dev UPLOAD_DIR=./uploads SMTP_HOST=localhost npm run start:dev

# Frontend (puerto 3000)
cd frontend && npm install
BACKEND_URL=http://localhost:3001 npm run dev
```

Comprobaciones: `npm run build`, `npm run lint` (en ambos proyectos) y `npm test` (backend: pruebas unitarias de `AuthService` y de la detección de cambios / destinatarios de `TasksService`).

## Estructura

```
├─ docker-compose.yml     # db, backend, frontend, mailpit
├─ .env.example
├─ backend/               # NestJS (auth, users, tasks, task-types, comments, events, contacts, audit, mail, notifications, scheduler)
│  └─ src/{entities,migrations,scripts/make-admin.ts,...}
└─ frontend/              # Next.js (src/app, src/components, src/lib, src/middleware.ts)
```

## Despliegue a producción (GitHub Actions)

Cada push a `main` ejecuta `.github/workflows/deploy.yml`:

1. **test**: lint, tests y build del backend; lint del frontend.
2. **build**: construye las imágenes `backend` y `frontend` y las publica en GHCR (`ghcr.io/pabluwu/todo-acuerdalo/<servicio>:<sha>` y `:latest`).
3. **deploy**: por SSH copia `docker-compose.prod.yml` al servidor, hace `pull` y `up -d` con el tag del commit y espera a que el backend y el frontend respondan.

| Dominio | Servicio | Puerto local en el servidor |
|---|---|---|
| https://todo.acuerdalo.cl | frontend (proxy `/api` → backend) | `127.0.0.1:4101` |
| https://api-todo.acuerdalo.cl | backend (rutas bajo `/api`, p. ej. `/api/health`) | `127.0.0.1:4100` |

nginx del host termina TLS (certbot) con las configuraciones de `deploy/nginx/`.

**Secrets del repositorio:** `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY` (llave dedicada al despliegue) y `SSH_KNOWN_HOSTS`.

**En el servidor**, `~/todo-acuerdalo/.env` contiene la configuración real (contraseñas de BD, `JWT_SECRET`, SMTP, `COOKIE_SECURE=true`, `APP_URL=https://todo.acuerdalo.cl`). No se versiona.

Primer admin en producción (después de registrarte en la web):

```bash
ssh ubuntu@142.44.160.172
cd ~/todo-acuerdalo && docker compose -f docker-compose.prod.yml exec backend npm run make-admin -- tu@correo.cl
```

Para volver a una versión anterior, relanza el workflow (*Re-run jobs*) del commit deseado.
