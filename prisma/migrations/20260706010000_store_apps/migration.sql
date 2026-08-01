-- CreateTable
CREATE TABLE `store_apps` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `tagline` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `iconUrl` VARCHAR(191) NULL,
    `coverUrl` VARCHAR(191) NULL,
    `screenshots` JSON NULL,
    `category` ENUM('READING', 'TOOL', 'ENTERTAINMENT', 'OTHER') NOT NULL DEFAULT 'READING',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `installUrl` VARCHAR(191) NULL,
    `minIos` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_apps_slug_key`(`slug`),
    INDEX `store_apps_published_featured_sortOrder_idx`(`published`, `featured`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;