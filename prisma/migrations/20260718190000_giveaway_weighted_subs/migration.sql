-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN "weightedSubs" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GiveawayEntry" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;
