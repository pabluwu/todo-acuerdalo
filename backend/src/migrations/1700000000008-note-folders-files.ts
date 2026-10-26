import { MigrationInterface, QueryRunner } from 'typeorm';

export class NoteFoldersFiles1700000000008 implements MigrationInterface {
  name = 'NoteFoldersFiles1700000000008';

  public async up(q: QueryRunner): Promise<void> {
    // las claves nuevas incluyen la ruta completa (p. ej. `clientes/<id>/<uuid>-nombre.pdf`)
    await q.query(`ALTER TABLE "attachments" ALTER COLUMN "stored_name" TYPE varchar(500)`);
    await q.query(`ALTER TABLE "client_files" ALTER COLUMN "stored_name" TYPE varchar(500)`);

    // comunes: del equipo (sin dueño); privadas: de una sola persona
    await q.query(`CREATE TABLE "note_folders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "visibility" varchar(10) NOT NULL,
      "owner_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
      "parent_id" uuid REFERENCES "note_folders"("id") ON DELETE CASCADE,
      "name" varchar(150) NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_note_folders_owner" CHECK (
        ("visibility" = 'common' AND "owner_id" IS NULL) OR ("visibility" = 'private' AND "owner_id" IS NOT NULL)
      )
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_note_folders_name" ON "note_folders" ("visibility", COALESCE("owner_id", '00000000-0000-0000-0000-000000000000'::uuid), COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::uuid), lower("name"))`,
    );
    await q.query(`CREATE INDEX "idx_note_folders_parent" ON "note_folders" ("parent_id")`);

    // al borrar una carpeta sus notas vuelven a la raíz: nunca se pierde una nota por eso
    await q.query(`ALTER TABLE "notes" ADD COLUMN "folder_id" uuid REFERENCES "note_folders"("id") ON DELETE SET NULL`);
    await q.query(`CREATE INDEX "idx_notes_folder" ON "notes" ("folder_id")`);

    await q.query(`CREATE TABLE "note_files" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
      "original_name" varchar(300) NOT NULL,
      "mime_type" varchar(150) NOT NULL,
      "size" integer NOT NULL,
      "stored_name" varchar(500) NOT NULL,
      "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_note_files_note" ON "note_files" ("note_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "note_files"`);
    await q.query(`ALTER TABLE "notes" DROP COLUMN IF EXISTS "folder_id"`);
    await q.query(`DROP TABLE IF EXISTS "note_folders"`);
  }
}
