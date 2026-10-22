import { MigrationInterface, QueryRunner } from 'typeorm';

export class CopyEmails1700000000002 implements MigrationInterface {
  name = 'CopyEmails1700000000002';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "copy_emails" text[] NOT NULL DEFAULT '{}'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN "copy_emails"`);
  }
}
