ALTER TABLE tblUser ADD COLUMN staff_profile MEDIUMTEXT NULL;

CREATE TABLE IF NOT EXISTS tblStaffDocument (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    doc_type VARCHAR(40) NOT NULL,
    file_name VARCHAR(160) NOT NULL,
    storage_key VARCHAR(250) NOT NULL,
    mime_type VARCHAR(80) NOT NULL,
    size_bytes INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_staff_document_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
