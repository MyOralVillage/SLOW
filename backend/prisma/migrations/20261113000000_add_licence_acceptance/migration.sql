-- AlterTable
ALTER TABLE "User" ADD COLUMN "credit_name" TEXT,
ADD COLUMN "licence_terms_version" TEXT,
ADD COLUMN "licence_accepted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LicenceAcceptance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "terms_version" TEXT NOT NULL,
    "credit_name" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LicenceAcceptance_user_id_idx" ON "LicenceAcceptance"("user_id");

-- CreateIndex
CREATE INDEX "LicenceAcceptance_terms_version_idx" ON "LicenceAcceptance"("terms_version");

-- AddForeignKey
ALTER TABLE "LicenceAcceptance" ADD CONSTRAINT "LicenceAcceptance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
