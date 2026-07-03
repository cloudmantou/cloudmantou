-- CreateTable
CREATE TABLE `card_packages` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `intro` TEXT NULL,
    `highlights` JSON NULL,
    `usageSteps` JSON NULL,
    `cardType` ENUM('VIP_DAYS', 'PAID_ARTICLE', 'BALANCE') NOT NULL,
    `cardValue` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `badge` VARCHAR(32) NOT NULL DEFAULT 'NEW',
    `accent` VARCHAR(32) NOT NULL DEFAULT 'gold',
    `cover` TEXT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `card_packages_slug_key`(`slug`),
    INDEX `card_packages_cardType_cardValue_idx`(`cardType`, `cardValue`),
    INDEX `card_packages_published_enabled_idx`(`published`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;