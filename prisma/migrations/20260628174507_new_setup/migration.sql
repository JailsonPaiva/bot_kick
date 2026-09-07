-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "kickChannelId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kickAccessTokenEnc" TEXT NOT NULL,
    "kickRefreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "botPrefix" TEXT NOT NULL DEFAULT '!',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "kickUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "aliases" TEXT[],
    "response" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'everyone',
    "cooldown" INTEGER NOT NULL DEFAULT 5,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "playerXId" TEXT NOT NULL,
    "playerOId" TEXT NOT NULL,
    "winnerId" TEXT,
    "status" TEXT NOT NULL,
    "boardState" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMove" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_kickChannelId_key" ON "Channel"("kickChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_slug_key" ON "Channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_kickUserId_key" ON "User"("kickUserId");

-- CreateIndex
CREATE INDEX "BotSession_channelId_status_idx" ON "BotSession"("channelId", "status");

-- CreateIndex
CREATE INDEX "Command_channelId_isActive_idx" ON "Command"("channelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Command_channelId_trigger_key" ON "Command"("channelId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "Player_kickUserId_key" ON "Player"("kickUserId");

-- CreateIndex
CREATE INDEX "Player_points_idx" ON "Player"("points");

-- CreateIndex
CREATE INDEX "Game_channelSlug_status_idx" ON "Game"("channelSlug", "status");

-- CreateIndex
CREATE INDEX "Game_gameType_startedAt_idx" ON "Game"("gameType", "startedAt");

-- CreateIndex
CREATE INDEX "GameMove_gameId_idx" ON "GameMove"("gameId");

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerXId_fkey" FOREIGN KEY ("playerXId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerOId_fkey" FOREIGN KEY ("playerOId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMove" ADD CONSTRAINT "GameMove_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMove" ADD CONSTRAINT "GameMove_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
