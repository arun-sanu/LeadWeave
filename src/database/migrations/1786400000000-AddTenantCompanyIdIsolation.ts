import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `companyId` / `company_id` columns across sessions, campaigns, and lead_records for
 * multi-tenant database isolation and Supabase tenant boundary partitioning.
 */
export class AddTenantCompanyIdIsolation1786400000000 implements MigrationInterface {
  name = 'AddTenantCompanyIdIsolation1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. sessions.companyId
    if (await queryRunner.hasTable('sessions')) {
      if (!(await queryRunner.hasColumn('sessions', 'companyId'))) {
        await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN "companyId" varchar(100)`);
      }
    }

    // 2. campaigns.company_id
    if (await queryRunner.hasTable('campaigns')) {
      if (!(await queryRunner.hasColumn('campaigns', 'company_id'))) {
        await queryRunner.query(`ALTER TABLE "campaigns" ADD COLUMN "company_id" varchar(100)`);
      }
    }

    // 3. lead_records.company_id
    if (await queryRunner.hasTable('lead_records')) {
      if (!(await queryRunner.hasColumn('lead_records', 'company_id'))) {
        await queryRunner.query(`ALTER TABLE "lead_records" ADD COLUMN "company_id" varchar(100)`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('lead_records') && (await queryRunner.hasColumn('lead_records', 'company_id'))) {
      await queryRunner.query(`ALTER TABLE "lead_records" DROP COLUMN "company_id"`);
    }
    if (await queryRunner.hasTable('campaigns') && (await queryRunner.hasColumn('campaigns', 'company_id'))) {
      await queryRunner.query(`ALTER TABLE "campaigns" DROP COLUMN "company_id"`);
    }
    if (await queryRunner.hasTable('sessions') && (await queryRunner.hasColumn('sessions', 'companyId'))) {
      await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "companyId"`);
    }
  }
}
