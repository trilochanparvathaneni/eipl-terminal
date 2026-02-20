-- CreateEnum
CREATE TYPE "ConvContextType" AS ENUM ('BOOKING', 'CLIENT', 'TRANSPORTER', 'INCIDENT');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "contextType"  "ConvContextType";
ALTER TABLE "Conversation" ADD COLUMN "contextId"    TEXT;
ALTER TABLE "Conversation" ADD COLUMN "contextLabel" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_contextType_contextId_idx" ON "Conversation"("contextType", "contextId");
