-- Payroll entries for staff salary / day-rate payouts
CREATE TABLE IF NOT EXISTS tblPayrollEntry (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payroll_no      VARCHAR(32) NOT NULL,
    staff_user_id   BIGINT UNSIGNED NOT NULL,
    period_month    CHAR(7) NOT NULL COMMENT 'YYYY-MM',
    amount          BIGINT UNSIGNED NOT NULL DEFAULT 0,
    status          ENUM('DRAFT', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    paid_at         DATETIME NULL,
    notes           TEXT NULL,
    created_by      BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payroll_no (payroll_no),
    KEY idx_payroll_month (period_month),
    KEY idx_payroll_staff (staff_user_id),
    CONSTRAINT fk_payroll_staff FOREIGN KEY (staff_user_id) REFERENCES tblUser (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
