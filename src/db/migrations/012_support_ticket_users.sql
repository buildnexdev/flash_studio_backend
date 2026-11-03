ALTER TABLE tblSupportTicket
    MODIFY customer_id BIGINT UNSIGNED NULL,
    ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER ticket_no,
    ADD COLUMN deleted_at DATETIME NULL AFTER updated_at,
    ADD KEY idx_support_ticket_user_created (user_id, created_at),
    ADD KEY idx_support_ticket_deleted (deleted_at);
