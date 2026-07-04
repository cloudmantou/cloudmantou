-- CreateTable
CREATE TABLE `payment_notify_audits` (
    `id` VARCHAR(191) NOT NULL,
    `channel` ENUM('ALIPAY', 'WECHAT', 'CARD_KEY') NOT NULL,
    `orderNo` VARCHAR(64) NULL,
    `status` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `rawBody` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `payment_notify_audits_orderNo_idx`(`orderNo`),
    INDEX `payment_notify_audits_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `targetType` VARCHAR(50) NULL,
    `targetId` VARCHAR(100) NULL,
    `detail` TEXT NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `admin_audit_logs_actorId_idx`(`actorId`),
    INDEX `admin_audit_logs_action_idx`(`action`),
    INDEX `admin_audit_logs_createdAt_idx`(`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;