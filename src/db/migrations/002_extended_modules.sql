-- Migration 002: Extended Modules Schema for Flash Studio Platform

-- E-Commerce Product Categories
CREATE TABLE IF NOT EXISTS tblProductCategory (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    description TEXT NULL,
    image_url   VARCHAR(255) NULL,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pcat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E-Commerce Products
CREATE TABLE IF NOT EXISTS tblProduct (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category_id         INT UNSIGNED NULL,
    sku                 VARCHAR(40) NOT NULL,
    name                VARCHAR(160) NOT NULL,
    slug                VARCHAR(180) NOT NULL,
    description         TEXT NULL,
    images              JSON NULL,
    price               BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount_price      BIGINT UNSIGNED NULL,
    stock               INT NOT NULL DEFAULT 0,
    status              ENUM('DRAFT','ACTIVE','OUT_OF_STOCK','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    is_featured         TINYINT(1) NOT NULL DEFAULT 0,
    customization_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at          DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_sku (sku),
    UNIQUE KEY uq_product_slug (slug),
    KEY idx_product_category (category_id),
    CONSTRAINT fk_product_cat FOREIGN KEY (category_id) REFERENCES tblProductCategory (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product Variants
CREATE TABLE IF NOT EXISTS tblProductVariant (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id  BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(120) NOT NULL,
    sku         VARCHAR(40) NOT NULL,
    price       BIGINT UNSIGNED NOT NULL,
    stock       INT NOT NULL DEFAULT 0,
    options     JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pvariant_sku (sku),
    KEY idx_pvariant_product (product_id),
    CONSTRAINT fk_pvariant_product FOREIGN KEY (product_id) REFERENCES tblProduct (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Shopping Cart
CREATE TABLE IF NOT EXISTS tblCart (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NULL,
    session_id  VARCHAR(64) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cart_customer (customer_id),
    KEY idx_cart_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cart Items
CREATE TABLE IF NOT EXISTS tblCartItem (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cart_id       BIGINT UNSIGNED NOT NULL,
    product_id    BIGINT UNSIGNED NOT NULL,
    variant_id    BIGINT UNSIGNED NULL,
    quantity      INT UNSIGNED NOT NULL DEFAULT 1,
    customization JSON NULL,
    unit_price    BIGINT UNSIGNED NOT NULL,
    total_price   BIGINT UNSIGNED NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ci_cart (cart_id),
    CONSTRAINT fk_ci_cart FOREIGN KEY (cart_id) REFERENCES tblCart (id) ON DELETE CASCADE,
    CONSTRAINT fk_ci_product FOREIGN KEY (product_id) REFERENCES tblProduct (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Offers & Promotions
CREATE TABLE IF NOT EXISTS tblOffer (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(140) NOT NULL,
    description   TEXT NULL,
    poster_url    VARCHAR(255) NULL,
    discount_type ENUM('PERCENT','FLAT') NOT NULL DEFAULT 'PERCENT',
    discount_value BIGINT UNSIGNED NOT NULL,
    start_date    DATETIME NOT NULL,
    end_date      DATETIME NOT NULL,
    min_order     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    max_discount  BIGINT UNSIGNED NULL,
    usage_limit   INT UNSIGNED NULL,
    used_count    INT UNSIGNED NOT NULL DEFAULT 0,
    is_active     TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Referral System
CREATE TABLE IF NOT EXISTS tblReferral (
    id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    referrer_customer_id BIGINT UNSIGNED NOT NULL,
    referred_customer_id BIGINT UNSIGNED NOT NULL,
    referral_code        VARCHAR(30) NOT NULL,
    order_id             BIGINT UNSIGNED NULL,
    reward_amount        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status               ENUM('PENDING','QUALIFIED','REWARDED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ref_referrer (referrer_customer_id),
    KEY idx_ref_referred (referred_customer_id),
    CONSTRAINT fk_ref_referrer FOREIGN KEY (referrer_customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE,
    CONSTRAINT fk_ref_referred FOREIGN KEY (referred_customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Reward / Bonus System
CREATE TABLE IF NOT EXISTS tblReward (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id  BIGINT UNSIGNED NOT NULL,
    title        VARCHAR(140) NOT NULL,
    description  VARCHAR(255) NULL,
    points       INT NOT NULL DEFAULT 0,
    reward_type  ENUM('REFERRAL_BONUS','PURCHASE_REWARD','EVENT_BONUS','CAMPAIGN_REWARD') NOT NULL,
    amount_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status       ENUM('EARNED','REDEEMED','EXPIRED') NOT NULL DEFAULT 'EARNED',
    expires_at   DATETIME NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reward_customer (customer_id),
    CONSTRAINT fk_reward_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asset Management (Studio Gear & Equipment)
CREATE TABLE IF NOT EXISTS tblAsset (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_code       VARCHAR(40) NOT NULL,
    name             VARCHAR(140) NOT NULL,
    category         ENUM('CAMERA','LENS','FLASH','TRIPOD','LIGHTS','MEMORY_CARD','LAPTOP','PRINTER','STUDIO_EQUIPMENT','OTHER') NOT NULL DEFAULT 'CAMERA',
    purchase_date    DATE NULL,
    purchase_price   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    current_value    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    asset_condition  ENUM('EXCELLENT','GOOD','FAIR','POOR','DAMAGED') NOT NULL DEFAULT 'EXCELLENT',
    location         VARCHAR(120) NULL,
    status           ENUM('AVAILABLE','ASSIGNED','IN_USE','MAINTENANCE','DAMAGED','LOST','RETIRED') NOT NULL DEFAULT 'AVAILABLE',
    maintenance_date DATE NULL,
    notes            TEXT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_asset_code (asset_code),
    KEY idx_asset_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Asset Assignments
CREATE TABLE IF NOT EXISTS tblAssetAssignment (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_id    BIGINT UNSIGNED NOT NULL,
    staff_id    BIGINT UNSIGNED NULL,
    event_id    BIGINT UNSIGNED NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME NULL,
    notes       TEXT NULL,
    PRIMARY KEY (id),
    KEY idx_aa_asset (asset_id),
    CONSTRAINT fk_aa_asset FOREIGN KEY (asset_id) REFERENCES tblAsset (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Studio Finance Transactions (Income & Expense)
CREATE TABLE IF NOT EXISTS tblFinanceTransaction (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    transaction_no   VARCHAR(30) NOT NULL,
    type             ENUM('INCOME','EXPENSE') NOT NULL,
    category         VARCHAR(60) NOT NULL,
    amount           BIGINT UNSIGNED NOT NULL DEFAULT 0,
    payment_method   VARCHAR(40) NULL,
    reference_no     VARCHAR(80) NULL,
    order_id         BIGINT UNSIGNED NULL,
    event_id         BIGINT UNSIGNED NULL,
    staff_id         BIGINT UNSIGNED NULL,
    asset_id         BIGINT UNSIGNED NULL,
    description      TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    created_by       BIGINT UNSIGNED NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_finance_no (transaction_no),
    KEY idx_finance_type_date (type, transaction_date),
    KEY idx_finance_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer Support Tickets & Original Photo Requests
CREATE TABLE IF NOT EXISTS tblSupportTicket (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_no   VARCHAR(30) NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    category    ENUM('GENERAL','ORDER','PHOTO_REQUEST','EVENT','PAYMENT','OTHER') NOT NULL DEFAULT 'GENERAL',
    subject     VARCHAR(180) NOT NULL,
    status      ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
    priority    ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
    photo_id    BIGINT UNSIGNED NULL,
    event_id    BIGINT UNSIGNED NULL,
    assigned_to BIGINT UNSIGNED NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ticket_no (ticket_no),
    KEY idx_ticket_customer (customer_id),
    KEY idx_ticket_status (status),
    CONSTRAINT fk_st_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Support Ticket Messages
CREATE TABLE IF NOT EXISTS tblSupportMessage (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id      BIGINT UNSIGNED NOT NULL,
    user_id        BIGINT UNSIGNED NOT NULL,
    message        TEXT NOT NULL,
    is_staff       TINYINT(1) NOT NULL DEFAULT 0,
    attachment_url VARCHAR(255) NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sm_ticket (ticket_id),
    CONSTRAINT fk_sm_ticket FOREIGN KEY (ticket_id) REFERENCES tblSupportTicket (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extend tblEvent with Security & Expiry columns if not existing
ALTER TABLE tblEvent ADD COLUMN security_pin VARCHAR(100) NULL;
ALTER TABLE tblEvent ADD COLUMN access_start_time DATETIME NULL;
ALTER TABLE tblEvent ADD COLUMN access_end_time DATETIME NULL;
ALTER TABLE tblEvent ADD COLUMN download_mode ENUM('VIEW_ONLY','VIEW_AND_DOWNLOAD') NOT NULL DEFAULT 'VIEW_ONLY';
ALTER TABLE tblEvent ADD COLUMN pin_attempts INT UNSIGNED NOT NULL DEFAULT 0;

-- Extend tblCustomer with referral_code if not existing
ALTER TABLE tblCustomer ADD COLUMN referral_code VARCHAR(30) NULL;

