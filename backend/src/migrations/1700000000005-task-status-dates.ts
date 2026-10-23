import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskStatusDates1700000000005 implements MigrationInterface {
  name = 'TaskStatusDates1700000000005';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tasks" ADD COLUMN "started_at" timestamptz NULL, ADD COLUMN "completed_at" timestamptz NULL`);
    await q.query(`CREATE INDEX "idx_tasks_started_at" ON "tasks" ("started_at")`);
    await q.query(`CREATE INDEX "idx_tasks_completed_at" ON "tasks" ("completed_at")`);
    // aproximación para las tareas existentes: la última modificación
    await q.query(`UPDATE "tasks" SET "started_at" = "updated_at" WHERE "status" = 'in_progress'`);
    await q.query(`UPDATE "tasks" SET "completed_at" = "updated_at" WHERE "status" = 'completed'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_tasks_completed_at"`);
    await q.query(`DROP INDEX IF EXISTS "idx_tasks_started_at"`);
    await q.query(`ALTER TABLE "tasks" DROP COLUMN "completed_at", DROP COLUMN "started_at"`);
  }
}
