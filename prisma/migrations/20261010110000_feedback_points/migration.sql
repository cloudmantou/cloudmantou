-- AlterTable
ALTER TABLE `users` ADD COLUMN `points` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `article_feedbacks` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('QUESTION', 'BUG', 'IDEA') NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `content` TEXT NOT NULL,
    `appVersion` VARCHAR(64) NULL,
    `environment` VARCHAR(300) NULL,
    `status` ENUM('SUBMITTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED') NOT NULL DEFAULT 'SUBMITTED',
    `published` BOOLEAN NOT NULL DEFAULT false,
    `allowPublic` BOOLEAN NOT NULL DEFAULT true,
    `resolvedVersion` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `article_feedbacks_postId_published_createdAt_idx`(`postId`, `published`, `createdAt`),
    INDEX `article_feedbacks_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `article_feedbacks_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback_events` (
    `id` VARCHAR(191) NOT NULL,
    `feedbackId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `status` ENUM('SUBMITTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED') NOT NULL,
    `note` TEXT NOT NULL,
    `awardedPoints` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `feedback_events_feedbackId_createdAt_idx`(`feedbackId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback_images` (
    `id` VARCHAR(191) NOT NULL,
    `feedbackId` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(64) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feedback_images_storageKey_key`(`storageKey`),
    INDEX `feedback_images_uploadedBy_createdAt_idx`(`uploadedBy`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_entries` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `feedbackId` VARCHAR(191) NULL,
    `key` VARCHAR(191) NOT NULL,
    `delta` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `reason` VARCHAR(200) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `point_entries_key_key`(`key`),
    INDEX `point_entries_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_rewards` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `cost` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `point_rewards_packageId_key`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_redemptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `rewardId` VARCHAR(191) NOT NULL,
    `requestKey` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `cost` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `point_redemptions_orderId_key`(`orderId`),
    INDEX `point_redemptions_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `point_redemptions_userId_requestKey_key`(`userId`, `requestKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `article_feedbacks` ADD CONSTRAINT `article_feedbacks_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `article_feedbacks` ADD CONSTRAINT `article_feedbacks_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_events` ADD CONSTRAINT `feedback_events_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `article_feedbacks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_images` ADD CONSTRAINT `feedback_images_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `article_feedbacks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_entries` ADD CONSTRAINT `point_entries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_entries` ADD CONSTRAINT `point_entries_feedbackId_fkey` FOREIGN KEY (`feedbackId`) REFERENCES `article_feedbacks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_rewards` ADD CONSTRAINT `point_rewards_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `card_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_redemptions` ADD CONSTRAINT `point_redemptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_redemptions` ADD CONSTRAINT `point_redemptions_rewardId_fkey` FOREIGN KEY (`rewardId`) REFERENCES `point_rewards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `point_redemptions` ADD CONSTRAINT `point_redemptions_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

