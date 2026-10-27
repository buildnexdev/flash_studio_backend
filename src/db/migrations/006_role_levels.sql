ALTER TABLE tblRole ADD COLUMN level INT NOT NULL DEFAULT 2 AFTER is_system;

UPDATE tblRole SET level = 100 WHERE code = 'SUPER_ADMIN';
UPDATE tblRole SET level = 1 WHERE code = 'STUDIO_OWNER';
UPDATE tblRole SET level = 2 WHERE code = 'MANAGER';
UPDATE tblRole SET level = 3 WHERE code = 'PHOTOGRAPHER';
UPDATE tblRole SET level = 4 WHERE code = 'EDITOR_DESIGNER';
UPDATE tblRole SET level = 5 WHERE code = 'PRINTER_DELIVERY_STAFF';
UPDATE tblRole SET level = 0 WHERE code = 'CUSTOMER';
