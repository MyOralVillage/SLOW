-- CreateEnum
CREATE TYPE "CategoryGroup" AS ENUM ('main', 'cross_cutting');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group_type" "CategoryGroup" NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_group_type_idx" ON "Category"("group_type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_group_type_name_key" ON "Category"("group_type", "name");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
