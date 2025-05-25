/*
  Warnings:

  - The primary key for the `Patient` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `age` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `bloodPressure` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `bmi` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `diabetesPedigreeFunction` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `glucose` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `insulin` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `percentage` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `prediction` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `pregnancies` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `skinThickness` on the `Patient` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Patient` table. All the data in the column will be lost.
  - Added the required column `Age` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `BloodPressure` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Bmi` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DiabetesPedigreeFunction` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Glucose` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Insulin` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Name` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Prediction` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Pregnancies` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `SkinThickness` to the `Patient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `UpdatedAt` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_pkey",
DROP COLUMN "age",
DROP COLUMN "bloodPressure",
DROP COLUMN "bmi",
DROP COLUMN "createdAt",
DROP COLUMN "diabetesPedigreeFunction",
DROP COLUMN "glucose",
DROP COLUMN "id",
DROP COLUMN "insulin",
DROP COLUMN "name",
DROP COLUMN "percentage",
DROP COLUMN "prediction",
DROP COLUMN "pregnancies",
DROP COLUMN "skinThickness",
DROP COLUMN "updatedAt",
ADD COLUMN     "Age" INTEGER NOT NULL,
ADD COLUMN     "BloodPressure" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "Bmi" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "DiabetesPedigreeFunction" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "Glucose" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "Id" SERIAL NOT NULL,
ADD COLUMN     "Insulin" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "Name" TEXT NOT NULL,
ADD COLUMN     "Percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "Prediction" BOOLEAN NOT NULL,
ADD COLUMN     "Pregnancies" INTEGER NOT NULL,
ADD COLUMN     "SkinThickness" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "UpdatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "Patient_pkey" PRIMARY KEY ("Id");
