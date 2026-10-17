-- Additive fields only. Existing cards, products and receipts remain BLOG.
ALTER TABLE `cards` ADD COLUMN `legacyCardId` INTEGER NULL;
CREATE UNIQUE INDEX `cards_legacyCardId_key` ON `cards` (`legacyCardId`);
ALTER TABLE `card_packages` ADD COLUMN `deliverySource` VARCHAR(32) NOT NULL DEFAULT 'BLOG';
ALTER TABLE `order_deliveries` ADD COLUMN `deliverySource` VARCHAR(32) NOT NULL DEFAULT 'BLOG';
