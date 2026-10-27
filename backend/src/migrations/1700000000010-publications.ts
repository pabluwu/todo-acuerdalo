import { MigrationInterface, QueryRunner } from 'typeorm';

export class Publications1700000000010 implements MigrationInterface {
  name = 'Publications1700000000010';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "publications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar(200) NOT NULL,
      "format" varchar(10) NOT NULL CHECK ("format" IN ('video','post')),
      "platforms" text[] NOT NULL DEFAULT '{}',
      "status" varchar(20) NOT NULL DEFAULT 'idea' CHECK ("status" IN ('idea','edicion','por_publicar','publicada','cancelada')),
      "scheduled_at" timestamptz NOT NULL,
      "client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
      "caption" text NOT NULL DEFAULT '',
      "brief" text NOT NULL DEFAULT '',
      "cancelled_from" varchar(20),
      "published_at" timestamptz,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_publications_scheduled_at" ON "publications" ("scheduled_at")`);
    await q.query(`CREATE INDEX "idx_publications_client" ON "publications" ("client_id")`);

    await q.query(`CREATE TABLE "publication_reviewers" (
      "publication_id" uuid NOT NULL REFERENCES "publications"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      PRIMARY KEY ("publication_id", "user_id")
    )`);

    await q.query(`CREATE TABLE "publication_versions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "publication_id" uuid NOT NULL REFERENCES "publications"("id") ON DELETE CASCADE,
      "number" int NOT NULL,
      "note" text NOT NULL DEFAULT '',
      "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      UNIQUE ("publication_id", "number")
    )`);

    await q.query(`CREATE TABLE "publication_version_files" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "version_id" uuid NOT NULL REFERENCES "publication_versions"("id") ON DELETE CASCADE,
      "original_name" varchar(255) NOT NULL,
      "stored_name" varchar(500) NOT NULL,
      "mime_type" varchar(150) NOT NULL,
      "size" bigint NOT NULL,
      "position" int NOT NULL DEFAULT 0
    )`);
    await q.query(`CREATE INDEX "idx_pub_version_files_version" ON "publication_version_files" ("version_id")`);

    await q.query(`CREATE TABLE "publication_approvals" (
      "version_id" uuid NOT NULL REFERENCES "publication_versions"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "decision" varchar(10) NOT NULL CHECK ("decision" IN ('aprobada','cambios')),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("version_id", "user_id")
    )`);

    await q.query(`CREATE TABLE "publication_comments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "publication_id" uuid NOT NULL REFERENCES "publications"("id") ON DELETE CASCADE,
      "version_id" uuid REFERENCES "publication_versions"("id") ON DELETE SET NULL,
      "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "body" text NOT NULL,
      "timecode_sec" numeric(8,2),
      "slide_index" int,
      "mention_ids" uuid[] NOT NULL DEFAULT '{}',
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "idx_pub_comments_publication" ON "publication_comments" ("publication_id", "created_at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "publication_comments"`);
    await q.query(`DROP TABLE "publication_approvals"`);
    await q.query(`DROP TABLE "publication_version_files"`);
    await q.query(`DROP TABLE "publication_versions"`);
    await q.query(`DROP TABLE "publication_reviewers"`);
    await q.query(`DROP TABLE "publications"`);
  }
}
