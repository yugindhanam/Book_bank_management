ALTER TABLE "LibrarySettings" ALTER COLUMN "name" SET DEFAULT 'LICET Book Bank';
UPDATE "LibrarySettings" SET "name" = 'LICET Book Bank'
WHERE "id" = 'library' AND "name" IN ('Folio College Library', 'Campus library');
