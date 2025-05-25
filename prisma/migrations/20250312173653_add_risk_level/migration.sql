-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "recommendation" TEXT,
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'Low';
