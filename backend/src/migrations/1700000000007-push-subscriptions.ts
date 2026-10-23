import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushSubscriptions1700000000007 implements MigrationInterface {
  name = 'PushSubscriptions1700000000007';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "push_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "endpoint" text NOT NULL,
      "p256dh" text NOT NULL,
      "auth" text NOT NULL,
      "user_agent" varchar(300),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "uq_push_subscription_endpoint" UNIQUE ("endpoint")
    )`);
    await q.query(`CREATE INDEX "idx_push_subscription_user" ON "push_subscriptions" ("user_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
  }
}
