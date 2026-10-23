import { MigrationInterface, QueryRunner } from 'typeorm';

export class Clients1700000000006 implements MigrationInterface {
  name = 'Clients1700000000006';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "clients" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(200) NOT NULL,
      "rut" varchar(12),
      "clave_unica" varchar(200),
      "address" varchar(300),
      "email" varchar(320),
      "phone" varchar(40),
      "occupation" varchar(150),
      "marital_status" varchar(40),
      "matter" varchar(300),
      "defendant_name" varchar(200),
      "defendant_rut" varchar(12),
      "defendant_address" varchar(300),
      "defendant_income" varchar(100),
      "case_history" text NOT NULL DEFAULT '',
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_clients_name" ON "clients" (lower("name"))`);
    await q.query(`CREATE INDEX "idx_clients_rut" ON "clients" ("rut")`);

    await q.query(`CREATE TABLE "client_notes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
      "title" varchar(300) NOT NULL,
      "body" text NOT NULL DEFAULT '',
      "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_client_notes_client_updated" ON "client_notes" ("client_id", "updated_at")`);

    await q.query(`CREATE TABLE "client_folders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
      "parent_id" uuid REFERENCES "client_folders"("id") ON DELETE CASCADE,
      "name" varchar(150) NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    // el nombre es único dentro de la misma carpeta (la raíz usa un uuid nulo para poder indexarla)
    await q.query(
      `CREATE UNIQUE INDEX "uq_client_folders_name" ON "client_folders" ("client_id", COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::uuid), lower("name"))`,
    );
    await q.query(`CREATE INDEX "idx_client_folders_parent" ON "client_folders" ("parent_id")`);

    await q.query(`CREATE TABLE "client_files" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
      "folder_id" uuid REFERENCES "client_folders"("id") ON DELETE CASCADE,
      "original_name" varchar(300) NOT NULL,
      "mime_type" varchar(150) NOT NULL,
      "size" integer NOT NULL,
      "stored_name" varchar(200) NOT NULL,
      "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_client_files_client_folder" ON "client_files" ("client_id", "folder_id")`);

    // cada cliente tiene un contacto externo vinculado (puede no tener correo)
    await q.query(`ALTER TABLE "external_contacts" ALTER COLUMN "email" DROP NOT NULL`);
    await q.query(`ALTER TABLE "external_contacts" ADD COLUMN "client_id" uuid UNIQUE REFERENCES "clients"("id") ON DELETE SET NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "external_contacts" DROP COLUMN IF EXISTS "client_id"`);
    // sin correo no caben en la tabla anterior
    await q.query(`DELETE FROM "external_contacts" WHERE "email" IS NULL`);
    await q.query(`ALTER TABLE "external_contacts" ALTER COLUMN "email" SET NOT NULL`);
    for (const t of ['client_files', 'client_folders', 'client_notes', 'clients']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
