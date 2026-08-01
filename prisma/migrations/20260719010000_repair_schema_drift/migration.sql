-- Repair schema changes that were added to schema.prisma without a forward migration.
-- All additions are nullable or create new tables so existing card/order data is preserved.

-- AlterTable
ALTER TABLE `cards`
    ADD COLUMN `cardSecretEnc` TEXT NULL,
    ADD COLUMN `packageId` VARCHAR(191) NULL,
    ADD COLUMN `note` VARCHAR(500) NULL,
    ADD COLUMN `orderId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('VIP_DAYS', 'PAID_ARTICLE', 'BALANCE', 'GENERIC') NOT NULL;

-- AlterTable
ALTER TABLE `card_packages`
    ADD COLUMN `redemptionNote` VARCHAR(500) NULL,
    MODIFY `cardType` ENUM('VIP_DAYS', 'PAID_ARTICLE', 'BALANCE', 'GENERIC') NOT NULL,
    MODIFY `badge` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    MODIFY `accent` VARCHAR(191) NOT NULL DEFAULT 'gold';

-- AlterTable
ALTER TABLE `store_apps` MODIFY `installUrl` TEXT NULL;

-- CreateTable
CREATE TABLE `order_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `cardNo` VARCHAR(191) NOT NULL,
    `cardSecretEnc` TEXT NOT NULL,
    `status` ENUM('PENDING', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'DELIVERED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_deliveries_orderId_key`(`orderId`),
    UNIQUE INDEX `order_deliveries_cardId_key`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vault_entries` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('ACCOUNT', 'SECRET', 'NOTE') NOT NULL DEFAULT 'NOTE',
    `account` VARCHAR(500) NULL,
    `secretEnc` TEXT NULL,
    `url` VARCHAR(1000) NULL,
    `contentEnc` LONGTEXT NULL,
    `remark` VARCHAR(500) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vault_entries_type_pinned_idx`(`type`, `pinned`),
    INDEX `vault_entries_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `cards_orderId_key` ON `cards`(`orderId`);
CREATE INDEX `cards_type_value_status_idx` ON `cards`(`type`, `value`, `status`);
CREATE INDEX `cards_packageId_status_idx` ON `cards`(`packageId`, `status`);

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_packageId_fkey`
    FOREIGN KEY (`packageId`) REFERENCES `card_packages`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `order_deliveries` ADD CONSTRAINT `order_deliveries_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_deliveries` ADD CONSTRAINT `order_deliveries_cardId_fkey`
    FOREIGN KEY (`cardId`) REFERENCES `cards`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
