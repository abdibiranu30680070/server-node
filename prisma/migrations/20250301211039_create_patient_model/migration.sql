-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "bmi" DOUBLE PRECISION NOT NULL,
    "insulin" DOUBLE PRECISION NOT NULL,
    "pregnancies" INTEGER NOT NULL,
    "glucose" DOUBLE PRECISION NOT NULL,
    "bloodPressure" DOUBLE PRECISION NOT NULL,
    "skinThickness" DOUBLE PRECISION NOT NULL,
    "diabetesPedigreeFunction" DOUBLE PRECISION NOT NULL,
    "prediction" BOOLEAN NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);
