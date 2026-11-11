CREATE TABLE `assistant_install_manifests` (
 `id` CHAR(32) NOT NULL, `bundleId` VARCHAR(255) NOT NULL, `version` VARCHAR(64) NOT NULL,
 `title` VARCHAR(200) NOT NULL, `encryptedPlist` TEXT NOT NULL, `signatureVerified` BOOLEAN NOT NULL DEFAULT false,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `expiresAt` DATETIME(3) NOT NULL,
 `fetchedAt` DATETIME(3) NULL, `fetchCount` INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (`id`), INDEX `assistant_install_manifests_expiresAt_idx` (`expiresAt`), INDEX `assistant_install_manifests_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `assistant_service_snapshots` (
 `id` VARCHAR(191) NOT NULL, `region` VARCHAR(2) NOT NULL, `reachable` BOOLEAN NOT NULL,
 `summary` JSON NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`), INDEX `assistant_service_snapshots_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
