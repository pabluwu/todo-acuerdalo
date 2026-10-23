import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordReset1700000000003 implements MigrationInterface {
  name = 'PasswordReset1700000000003';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "password_reset_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token_hash" varchar(64) NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "used_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_password_reset_token_hash" UNIQUE ("token_hash")
    )`);
    await q.query(`CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
