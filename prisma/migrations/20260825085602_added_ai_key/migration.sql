-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "openaiApiKey" TEXT,
    "openaiModel" TEXT,
    "deepseekApiKey" TEXT,
    "deepseekModel" TEXT,
    "deepseekBaseUrl" TEXT,
    "openrouterApiKey" TEXT,
    "openrouterModel" TEXT,
    "openrouterBaseUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);
