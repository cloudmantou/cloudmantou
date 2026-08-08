-- Store reviewed locale-specific article versions separately from the source post.
CREATE TABLE `post_translations` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NOT NULL,
    `seoTitle` VARCHAR(120) NULL,
    `seoDescription` VARCHAR(320) NULL,
    `seoKeywords` JSON NULL,
    `socialTitle` VARCHAR(140) NULL,
    `socialDescription` VARCHAR(400) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'STALE') NOT NULL DEFAULT 'DRAFT',
    `sourceHash` CHAR(64) NOT NULL,
    `sourceUpdatedAt` DATETIME(3) NOT NULL,
    `provider` VARCHAR(100) NULL,
    `model` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `post_translations_postId_locale_key`(`postId`, `locale`),
    INDEX `post_translations_locale_status_publishedAt_idx`(`locale`, `status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `post_translations` ADD CONSTRAINT `post_translations_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
