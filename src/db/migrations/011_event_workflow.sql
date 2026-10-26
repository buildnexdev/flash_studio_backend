-- Quotation revisions, event cover, and phone-verified gallery access.

ALTER TABLE tblQuotation
    ADD COLUMN revision INT UNSIGNED NOT NULL DEFAULT 1 AFTER quotation_no,
    ADD COLUMN revises_id BIGINT UNSIGNED NULL AFTER revision,
    ADD COLUMN revision_note VARCHAR(500) NULL AFTER revises_id,
    ADD COLUMN pdf_key VARCHAR(255) NULL AFTER terms,
    ADD COLUMN emailed_at DATETIME NULL AFTER sent_at;

ALTER TABLE tblEvent
    ADD COLUMN cover_key VARCHAR(255) NULL AFTER notes;

ALTER TABLE tblOtpCode
    MODIFY purpose ENUM('LOGIN','VERIFY','RESET_PASSWORD','EVENT_ACCESS') NOT NULL;

CREATE TABLE IF NOT EXISTS tblEventAccess (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id     BIGINT UNSIGNED NOT NULL,
    gallery_id   BIGINT UNSIGNED NOT NULL,
    phone        VARCHAR(20) NOT NULL,
    consent      TINYINT(1) NOT NULL DEFAULT 0,
    verified_at  DATETIME NOT NULL,
    expires_at   DATETIME NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_event_access_phone (event_id, phone),
    KEY idx_event_access_gallery (gallery_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
