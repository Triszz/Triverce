-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_seller_id_fkey";

-- DropIndex
DROP INDEX "idx_notifications_seller_id_created_at";

-- CreateIndex
CREATE INDEX "idx_notifications_seller_id_created_at" ON "notifications"("seller_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
