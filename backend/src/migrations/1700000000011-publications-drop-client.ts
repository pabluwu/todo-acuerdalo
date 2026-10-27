import { MigrationInterface, QueryRunner } from 'typeorm';

// las publicaciones no se relacionan con clientes
export class PublicationsDropClient1700000000011 implements MigrationInterface {
  name = 'PublicationsDropClient1700000000011';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_publications_client"`);
    await q.query(`ALTER TABLE "publications" DROP COLUMN IF EXISTS "client_id"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "publications" ADD COLUMN "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX "idx_publications_client" ON "publications" ("client_id")`);
  }
}
