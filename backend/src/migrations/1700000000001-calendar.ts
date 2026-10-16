import { MigrationInterface, QueryRunner } from 'typeorm';

export class Calendar1700000000001 implements MigrationInterface {
  name = 'Calendar1700000000001';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar(300) NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "location" varchar(300) NOT NULL DEFAULT '',
      "start_at" timestamptz NOT NULL,
      "end_at" timestamptz NOT NULL,
      "all_day" boolean NOT NULL DEFAULT false,
      "color" varchar(20) NOT NULL DEFAULT 'accent',
      "reminder_minutes" integer,
      "reminder_sent_at" timestamptz,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "chk_events_range" CHECK ("end_at" >= "start_at")
    )`);
    await q.query(`CREATE INDEX "idx_events_range" ON "events" ("start_at", "end_at")`);
    await q.query(`CREATE TABLE "event_participants" (
      "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      PRIMARY KEY ("event_id", "user_id")
    )`);
    await q.query(`CREATE INDEX "idx_event_participants_user" ON "event_participants" ("user_id")`);
    await q.query(`CREATE TABLE "external_contacts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(200) NOT NULL,
      "email" varchar(320) NOT NULL,
      "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE UNIQUE INDEX "uq_external_contacts_email" ON "external_contacts" (lower("email"))`);
    await q.query(`CREATE TABLE "event_external_contacts" (
      "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "contact_id" uuid NOT NULL REFERENCES "external_contacts"("id") ON DELETE CASCADE,
      PRIMARY KEY ("event_id", "contact_id")
    )`);
    await q.query(`CREATE INDEX "idx_event_external_contacts_contact" ON "event_external_contacts" ("contact_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['event_external_contacts', 'external_contacts', 'event_participants', 'events']) {
      await q.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
