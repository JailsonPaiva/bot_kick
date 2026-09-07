-- AlterTable
ALTER TABLE "ModerationConfig"
ADD COLUMN "linksActionType" TEXT NOT NULL DEFAULT 'warn',
ADD COLUMN "linksTimeoutDurationMinutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "capsActionType" TEXT NOT NULL DEFAULT 'warn',
ADD COLUMN "capsTimeoutDurationMinutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "spamActionType" TEXT NOT NULL DEFAULT 'warn',
ADD COLUMN "spamTimeoutDurationMinutes" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "bannedActionType" TEXT NOT NULL DEFAULT 'warn',
ADD COLUMN "bannedTimeoutDurationMinutes" INTEGER NOT NULL DEFAULT 1;
