-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN "entryMode" TEXT NOT NULL DEFAULT 'command';
ALTER TABLE "Giveaway" ADD COLUMN "entryCommand" TEXT NOT NULL DEFAULT 'entrar';
ALTER TABLE "Giveaway" ADD COLUMN "entryDurationSeconds" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Giveaway" ADD COLUMN "entryEndsAt" TIMESTAMP(3);
