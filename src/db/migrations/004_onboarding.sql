CREATE TABLE IF NOT EXISTS tblOnboarding (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    token CHAR(32) NOT NULL,
    payload_json JSON NOT NULL,
    amount_paise INT UNSIGNED NOT NULL,
    provider_order_id VARCHAR(64) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    company_slug VARCHAR(48) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_onboarding_token (token),
    KEY idx_onboarding_order (provider_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
