import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `userId` column to sessions table for user workspace isolation under company workspace.
 */
export class AddSessionUserIdColumn1786500000000 implements MigrationInterface {
  name = 'AddSessionUserIdColumn1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sessions')) {
      if (!(await queryRunner.hasColumn('sessions', 'userId'))) {
        await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN "userId" varchar(100)`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('sessions') && (await queryRunner.hasColumn('sessions', 'userId'))) {
      await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "userId"`);
    }
  }
}
