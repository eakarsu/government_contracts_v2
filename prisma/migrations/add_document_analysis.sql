-- CreateTable
CREATE TABLE "DocumentAnalysis" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "contractNoticeId" TEXT NOT NULL,
    "analysisType" TEXT NOT NULL DEFAULT 'summary',
    "analysisResult" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysis_documentId_key" ON "DocumentAnalysis"("documentId");

-- CreateIndex
CREATE INDEX "DocumentAnalysis_contractNoticeId_idx" ON "DocumentAnalysis"("contractNoticeId");

-- CreateIndex
CREATE INDEX "DocumentAnalysis_analysisType_idx" ON "DocumentAnalysis"("analysisType");
