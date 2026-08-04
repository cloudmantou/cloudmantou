-- Article-specific search and social metadata. Nullable fields preserve existing posts.
ALTER TABLE `posts`
  ADD COLUMN `seoTitle` VARCHAR(120) NULL,
  ADD COLUMN `seoDescription` VARCHAR(320) NULL,
  ADD COLUMN `seoKeywords` JSON NULL,
  ADD COLUMN `socialTitle` VARCHAR(140) NULL,
  ADD COLUMN `socialDescription` VARCHAR(400) NULL;
