import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(120) NOT NULL,
      "email" varchar(200) NOT NULL UNIQUE,
      "password_hash" varchar(100) NOT NULL,
      "role" varchar(10) NOT NULL DEFAULT 'user',
      "is_active" boolean NOT NULL DEFAULT false,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE "task_types" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(80) NOT NULL UNIQUE,
      "is_active" boolean NOT NULL DEFAULT true
    )`);
    await q.query(`CREATE TABLE "tasks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar(300) NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "status" varchar(20) NOT NULL DEFAULT 'not_started',
      "priority" varchar(10) NOT NULL DEFAULT 'medium',
      "type_id" uuid NOT NULL REFERENCES "task_types"("id"),
      "due_date" timestamptz,
      "position" integer NOT NULL DEFAULT 0,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "due_soon_notified_at" timestamptz,
      "overdue_notified_at" timestamptz
    )`);
    await q.query(`CREATE INDEX "idx_tasks_status_position" ON "tasks" ("status", "position")`);
    await q.query(`CREATE TABLE "task_assignees" (
      "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      PRIMARY KEY ("task_id", "user_id")
    )`);
    await q.query(`CREATE TABLE "comments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
      "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "body" text NOT NULL DEFAULT '',
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_comments_task" ON "comments" ("task_id", "created_at")`);
    await q.query(`CREATE TABLE "attachments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "comment_id" uuid NOT NULL REFERENCES "comments"("id") ON DELETE CASCADE,
      "original_name" varchar(300) NOT NULL,
      "mime_type" varchar(150) NOT NULL,
      "size" integer NOT NULL,
      "stored_name" varchar(200) NOT NULL
    )`);
    await q.query(`CREATE TABLE "logs" (
      "id" bigserial PRIMARY KEY,
      "data" jsonb NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`INSERT INTO "task_types" ("name") VALUES ('Interna'), ('Clientes'), ('Publicaciones')`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['logs', 'attachments', 'comments', 'task_assignees', 'tasks', 'task_types', 'users']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
