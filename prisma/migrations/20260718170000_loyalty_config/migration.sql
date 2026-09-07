-- CreateTable
CREATE TABLE "LoyaltyConfig" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsPerChatActivity" INTEGER NOT NULL DEFAULT 1,
    "chatIntervalSeconds" INTEGER NOT NULL DEFAULT 60,
    "memberMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "memberBonusFlat" INTEGER NOT NULL DEFAULT 0,
    "eventFollowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventFollowPoints" INTEGER NOT NULL DEFAULT 0,
    "eventSubscriptionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventSubscriptionPoints" INTEGER NOT NULL DEFAULT 0,
    "eventGiftSubEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventGiftSubPoints" INTEGER NOT NULL DEFAULT 0,
    "eventRaidEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventRaidPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyConfig_channelSlug_key" ON "LoyaltyConfig"("channelSlug");
