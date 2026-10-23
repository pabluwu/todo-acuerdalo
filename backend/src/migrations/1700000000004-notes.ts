import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notes1700000000004 implements MigrationInterface {
  name = 'Notes1700000000004';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "notes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar(300) NOT NULL,
      "body" text NOT NULL DEFAULT '',
      "visibility" varchar(10) NOT NULL DEFAULT 'common',
      "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_notes_visibility" CHECK ("visibility" IN ('common', 'private'))
    )`);
    await q.query(`CREATE INDEX "idx_notes_visibility_updated" ON "notes" ("visibility", "updated_at")`);
    await q.query(`CREATE INDEX "idx_notes_owner" ON "notes" ("owner_id")`);
    await q.query(`CREATE TABLE "note_shares" (
      "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "permission" varchar(10) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("note_id", "user_id"),
      CONSTRAINT "chk_note_shares_permission" CHECK ("permission" IN ('view', 'edit'))
    )`);
    await q.query(`CREATE INDEX "idx_note_shares_user" ON "note_shares" ("user_id")`);
    await q.query(`CREATE TABLE "note_access_requests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "note_id" uuid NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "status" varchar(10) NOT NULL DEFAULT 'pending',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "resolved_at" timestamptz,
      CONSTRAINT "chk_note_access_requests_status" CHECK ("status" IN ('pending', 'approved', 'rejected'))
    )`);
    await q.query(
      `CREATE UNIQUE INDEX "uq_note_access_requests_pending" ON "note_access_requests" ("note_id", "user_id") WHERE "status" = 'pending'`,
    );
    await q.query(`CREATE INDEX "idx_note_access_requests_user" ON "note_access_requests" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['note_access_requests', 'note_shares', 'notes']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
