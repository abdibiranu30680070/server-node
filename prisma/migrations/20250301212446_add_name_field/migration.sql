/*
  Warnings:

  - You are about to drop the column `Bmi` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `Name` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `Percentage` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `Prediction` on the `Patient` table. All the data in the column will be lost.
  - Added the required column `BMI` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prediction` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "Bmi",
DROP COLUMN "Name",
DROP COLUMN "Percentage",
DROP COLUMN "Prediction",
ADD COLUMN     "BMI" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "precentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "prediction" BOOLEAN NOT NULL;
