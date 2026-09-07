/*
  Warnings:

  - You are about to drop the column `channelId` on the `Command` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[channelSlug,trigger]` on the table `Command` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `channelSlug` to the `Command` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Command" DROP CONSTRAINT "Command_channelId_fkey";

-- DropIndex
DROP INDEX "Command_channelId_isActive_idx";

-- DropIndex
DROP INDEX "Command_channelId_trigger_key";

-- AlterTable
ALTER TABLE "Command" DROP COLUMN "channelId",
ADD COLUMN     "channelSlug" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messages" TEXT[],
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "minViewers" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationConfig" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "linksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linksWhitelist" TEXT[],
    "capsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "capsPercent" INTEGER NOT NULL DEFAULT 70,
    "spamEnabled" BOOLEAN NOT NULL DEFAULT false,
    "spamWindow" INTEGER NOT NULL DEFAULT 5,
    "bannedWords" TEXT[],
    "actionType" TEXT NOT NULL DEFAULT 'warn',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationLog" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerPoints" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertConfig" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "message" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchSession" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "prize" TEXT NOT NULL,
    "filterType" TEXT NOT NULL DEFAULT 'everyone',
    "costPoints" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winnerKickUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "durationS" INTEGER NOT NULL DEFAULT 60,
    "weightedSubs" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winnerOption" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closesAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "option" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Timer_channelSlug_isActive_idx" ON "Timer"("channelSlug", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationConfig_channelSlug_key" ON "ModerationConfig"("channelSlug");

-- CreateIndex
CREATE INDEX "ModerationLog_channelSlug_createdAt_idx" ON "ModerationLog"("channelSlug", "createdAt");

-- CreateIndex
CREATE INDEX "ViewerPoints_channelSlug_balance_idx" ON "ViewerPoints"("channelSlug", "balance");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerPoints_channelSlug_kickUserId_key" ON "ViewerPoints"("channelSlug", "kickUserId");

-- CreateIndex
CREATE INDEX "PointTransaction_channelSlug_kickUserId_createdAt_idx" ON "PointTransaction"("channelSlug", "kickUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertConfig_channelSlug_type_key" ON "AlertConfig"("channelSlug", "type");

-- CreateIndex
CREATE INDEX "WatchSession_channelSlug_kickUserId_startedAt_idx" ON "WatchSession"("channelSlug", "kickUserId", "startedAt");

-- CreateIndex
CREATE INDEX "Giveaway_channelSlug_status_createdAt_idx" ON "Giveaway"("channelSlug", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_createdAt_idx" ON "GiveawayEntry"("giveawayId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_kickUserId_key" ON "GiveawayEntry"("giveawayId", "kickUserId");

-- CreateIndex
CREATE INDEX "Poll_channelSlug_status_createdAt_idx" ON "Poll"("channelSlug", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PollVote_pollId_option_idx" ON "PollVote"("pollId", "option");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_kickUserId_key" ON "PollVote"("pollId", "kickUserId");

-- CreateIndex
CREATE INDEX "Command_channelSlug_isActive_idx" ON "Command"("channelSlug", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Command_channelSlug_trigger_key" ON "Command"("channelSlug", "trigger");

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
