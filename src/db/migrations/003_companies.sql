CREATE TABLE tblCompany (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(120) NOT NULL,
    slug          VARCHAR(80) NOT NULL,
    database_name VARCHAR(64) NOT NULL,
    status        ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    email         VARCHAR(190) NULL,
    phone         VARCHAR(20) NULL,
    city          VARCHAR(80) NULL,
    owner_name    VARCHAR(120) NULL,
    owner_email   VARCHAR(190) NULL,
    is_primary    TINYINT(1) NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_company_slug (slug),
    UNIQUE KEY uq_company_database (database_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
