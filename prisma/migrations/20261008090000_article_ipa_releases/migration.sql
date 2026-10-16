CREATE TABLE `article_ipa_releases` (
 `id` VARCHAR(191) NOT NULL, `postId` VARCHAR(191) NULL, `uploadedBy` VARCHAR(191) NOT NULL,
 `storageKey` VARCHAR(64) NOT NULL, `filename` VARCHAR(255) NOT NULL,
 `appName` VARCHAR(200) NOT NULL, `bundleId` VARCHAR(255) NOT NULL,
 `version` VARCHAR(64) NOT NULL, `build` VARCHAR(64) NOT NULL, `minIos` VARCHAR(32) NULL,
 `bytes` INTEGER NOT NULL, `sha256` CHAR(64) NOT NULL, `notes` TEXT NOT NULL,
 `sortOrder` INTEGER NOT NULL DEFAULT 0, `deletedAt` DATETIME(3) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `article_ipa_releases_storageKey_key` (`storageKey`),
 INDEX `article_ipa_releases_postId_deletedAt_sortOrder_idx` (`postId`, `deletedAt`, `sortOrder`),
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `article_ipa_releases` ADD CONSTRAINT `article_ipa_releases_postId_fkey`
 FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
