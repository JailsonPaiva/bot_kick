-- CreateTable
CREATE TABLE "GiveawayWidgetConfig" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "animationDurationMs" INTEGER NOT NULL DEFAULT 3600,
    "confettiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showTopParticipants" BOOLEAN NOT NULL DEFAULT true,
    "topParticipantsLimit" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayWidgetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayWidgetConfig_channelSlug_key" ON "GiveawayWidgetConfig"("channelSlug");
