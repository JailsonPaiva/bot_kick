-- CreateTable
CREATE TABLE "StoreItem" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "costPoints" INTEGER NOT NULL,
    "stock" INTEGER,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRedemption" (
    "id" TEXT NOT NULL,
    "channelSlug" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "kickUserId" BIGINT NOT NULL,
    "username" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_channelSlug_code_key" ON "StoreItem"("channelSlug", "code");

-- CreateIndex
CREATE INDEX "StoreItem_channelSlug_isActive_createdAt_idx" ON "StoreItem"("channelSlug", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "StoreRedemption_channelSlug_createdAt_idx" ON "StoreRedemption"("channelSlug", "createdAt");

-- CreateIndex
CREATE INDEX "StoreRedemption_channelSlug_kickUserId_createdAt_idx" ON "StoreRedemption"("channelSlug", "kickUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StoreRedemption_itemId_createdAt_idx" ON "StoreRedemption"("itemId", "createdAt");
