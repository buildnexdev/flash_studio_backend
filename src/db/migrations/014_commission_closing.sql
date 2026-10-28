-- Staff pay defaults
ALTER TABLE tblStaff ADD COLUMN monthly_salary BIGINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE tblStaff ADD COLUMN default_commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE tblStaff ADD COLUMN default_event_share_pct DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Member-wise event share / commission on assignment
ALTER TABLE tblEventStaff ADD COLUMN pay_basis ENUM('DAY_RATE','SHARE','COMMISSION','FLAT','NONE') NOT NULL DEFAULT 'DAY_RATE';
ALTER TABLE tblEventStaff ADD COLUMN share_pct DECIMAL(5,2) NULL;
ALTER TABLE tblEventStaff ADD COLUMN commission_pct DECIMAL(5,2) NULL;
ALTER TABLE tblEventStaff ADD COLUMN day_rate_override BIGINT UNSIGNED NULL;
ALTER TABLE tblEventStaff ADD COLUMN flat_amount BIGINT UNSIGNED NULL;
ALTER TABLE tblEventStaff ADD COLUMN payout_status ENUM('PENDING','INCLUDED','PAID','WAIVED') NOT NULL DEFAULT 'PENDING';

-- Calculated earnings feeding payroll
CREATE TABLE IF NOT EXISTS tblStaffEarning (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    staff_user_id     BIGINT UNSIGNED NOT NULL,
    event_id          BIGINT UNSIGNED NULL,
    event_staff_id    BIGINT UNSIGNED NULL,
    earning_date      DATE NOT NULL,
    period_month      CHAR(7) NOT NULL,
    type              ENUM('DAY_RATE','SHARE','COMMISSION','SALARY','BONUS','ADJUSTMENT') NOT NULL,
    base_amount       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    rate_pct          DECIMAL(5,2) NULL,
    amount            BIGINT UNSIGNED NOT NULL,
    payroll_entry_id  BIGINT UNSIGNED NULL,
    notes             TEXT NULL,
    created_by        BIGINT UNSIGNED NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_earning_staff_month (staff_user_id, period_month),
    KEY idx_earning_event (event_id),
    KEY idx_earning_payroll (payroll_entry_id),
    CONSTRAINT fk_earning_staff FOREIGN KEY (staff_user_id) REFERENCES tblUser (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE tblPayrollEntry ADD COLUMN pay_type ENUM('SALARY','DAY_RATE','COMMISSION','SHARE','MIXED','MANUAL') NOT NULL DEFAULT 'MANUAL';
ALTER TABLE tblPayrollEntry ADD COLUMN commission_pct DECIMAL(5,2) NULL;

-- End of day cash closing
CREATE TABLE IF NOT EXISTS tblCashClosingDay (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    close_date      DATE NOT NULL,
    opening_float   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_cash     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_upi      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_card     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_bank     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_other    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    system_refunds  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    counted_cash    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    variance        BIGINT NOT NULL DEFAULT 0,
    payment_count   INT UNSIGNED NOT NULL DEFAULT 0,
    status          ENUM('OPEN','SUBMITTED','APPROVED','LOCKED') NOT NULL DEFAULT 'OPEN',
    notes           TEXT NULL,
    closed_by       BIGINT UNSIGNED NULL,
    approved_by     BIGINT UNSIGNED NULL,
    closed_at       DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_close_date (close_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- End of month closing
CREATE TABLE IF NOT EXISTS tblCashClosingMonth (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    period_month      CHAR(7) NOT NULL,
    revenue_total     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    refunds_total     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    cash_total        BIGINT UNSIGNED NOT NULL DEFAULT 0,
    non_cash_total    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    bookings_due      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    payroll_draft     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    payroll_paid      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    commission_total  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    net               BIGINT NOT NULL DEFAULT 0,
    days_closed       INT UNSIGNED NOT NULL DEFAULT 0,
    status            ENUM('OPEN','SUBMITTED','APPROVED','LOCKED') NOT NULL DEFAULT 'OPEN',
    notes             TEXT NULL,
    closed_by         BIGINT UNSIGNED NULL,
    approved_by       BIGINT UNSIGNED NULL,
    closed_at         DATETIME NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_close_month (period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
