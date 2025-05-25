/*
  Warnings:

  - You are about to drop the column `percentage` on the `Patient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "percentage",
ADD COLUMN     "precentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
