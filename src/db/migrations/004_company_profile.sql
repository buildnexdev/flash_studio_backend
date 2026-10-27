ALTER TABLE tblCompany ADD COLUMN address VARCHAR(300) NULL;
ALTER TABLE tblCompany ADD COLUMN logo_url MEDIUMTEXT NULL;
ALTER TABLE tblCompany ADD COLUMN gst_number VARCHAR(20) NULL;
ALTER TABLE tblCompany ADD COLUMN about_us TEXT NULL;
ALTER TABLE tblCompany ADD COLUMN aadhaar_number VARCHAR(12) NULL;
ALTER TABLE tblCompany ADD COLUMN pan_number VARCHAR(10) NULL;
ALTER TABLE tblCompany ADD COLUMN modules VARCHAR(200) NULL;
ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_phone (phone);
ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_gst (gst_number);
ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_aadhaar (aadhaar_number);
ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_pan (pan_number);

CREATE TABLE IF NOT EXISTS tblCompanySignup (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    payload MEDIUMTEXT NOT NULL,
    amount_paise INT UNSIGNED NOT NULL,
    provider_order_id VARCHAR(80) NOT NULL,
    status ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    company_id INT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_signup_order (provider_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
