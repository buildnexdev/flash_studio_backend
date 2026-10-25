-- Legacy migration for databases that still use `id` as the primary key on tblUser/tblCompany.
-- If primary keys were renamed to userID/companyID before this file runs, skip via migrate.ts (errno 1054).
-- Renamed databases are handled by 007_user_company_role_pk.sql or scripts/apply-user-company-migration.ts.

ALTER TABLE tblUser ADD COLUMN company_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tblUser ADD COLUMN role_id INT UNSIGNED NULL AFTER company_id;

UPDATE tblUser u
JOIN (
    SELECT user_id, MIN(role_id) AS role_id
    FROM tblUserRole
    GROUP BY user_id
) ur ON ur.user_id = u.id
SET u.role_id = ur.role_id
WHERE u.role_id IS NULL;

UPDATE tblUser u
JOIN tblCompany c ON c.is_primary = 1
SET u.company_id = c.id
WHERE u.company_id IS NULL;

ALTER TABLE tblUser MODIFY company_id INT UNSIGNED NOT NULL;
ALTER TABLE tblUser MODIFY role_id INT UNSIGNED NOT NULL;
ALTER TABLE tblUser ADD KEY idx_users_company (company_id);
ALTER TABLE tblUser ADD KEY idx_users_role (role_id);
ALTER TABLE tblUser ADD CONSTRAINT fk_user_company FOREIGN KEY (company_id) REFERENCES tblCompany (id);
ALTER TABLE tblUser ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES tblRole (id);
