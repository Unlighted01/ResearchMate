-- ====================================================================
-- ResearchMate Supabase Schema Migration: Native Columns Refactoring
-- ====================================================================
-- This script adds color, pinned, and ocr_edited columns to the items table
-- and migrates any existing data from the tags array to clean up the schema.

-- 1. Add color, pinned, and ocr_edited columns if they don't already exist
ALTER TABLE items ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS ocr_edited boolean DEFAULT false;

-- 2. Migrate color values from tags array to native color column
UPDATE items
SET color = substring(tag FROM 'color:(.*)')
FROM unnest(tags) AS tag
WHERE tag LIKE 'color:%';

-- 3. Migrate pinned status from tags array to native pinned column
UPDATE items
SET pinned = true
WHERE 'pinned:true' = ANY(tags);

-- 4. Migrate ocr_edited status from tags array to native ocr_edited column
UPDATE items
SET ocr_edited = true
WHERE 'ocr:edited' = ANY(tags);

-- 5. Clean up the tags array by removing the migrated system tags
UPDATE items
SET tags = COALESCE(
  ARRAY(
    SELECT t 
    FROM unnest(tags) AS t 
    WHERE t NOT LIKE 'color:%' 
      AND t != 'pinned:true' 
      AND t != 'ocr:edited'
  ),
  '{}'::text[]
)
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;
