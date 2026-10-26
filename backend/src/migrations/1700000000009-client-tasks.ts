import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientTasks1700000000009 implements MigrationInterface {
  name = 'ClientTasks1700000000009';

  public async up(q: QueryRunner): Promise<void> {
    // al borrar un cliente sus tareas quedan como tareas generales: no se pierden
    await q.query(`ALTER TABLE "tasks" ADD COLUMN "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX "idx_tasks_client" ON "tasks" ("client_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "idx_tasks_client"`);
    await q.query(`ALTER TABLE "tasks" DROP COLUMN "client_id"`);
  }
}
