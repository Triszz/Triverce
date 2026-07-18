-- AlterTable
ALTER TABLE "users" ADD COLUMN     "address" VARCHAR(500),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "logo_url" VARCHAR(500),
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "store_name" VARCHAR(100),
ADD COLUMN     "support_email" VARCHAR(255);
