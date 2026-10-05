-- BuildNexDev Photo Studio Platform - initial schema (MySQL 5.7+ / 8.x)
-- Money columns are stored in the smallest currency unit (paise) as BIGINT.

CREATE TABLE tblUser (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name            VARCHAR(120) NOT NULL,
    email           VARCHAR(190) NULL,
    phone           VARCHAR(20) NULL,
    password_hash   VARCHAR(100) NULL,
    status          ENUM('ACTIVE','INACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
    avatar_key      VARCHAR(255) NULL,
    email_verified_at DATETIME NULL,
    phone_verified_at DATETIME NULL,
    last_login_at   DATETIME NULL,
    failed_logins   INT UNSIGNED NOT NULL DEFAULT 0,
    locked_until    DATETIME NULL,
    token_version   INT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at      DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone),
    KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblRole (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code        VARCHAR(40) NOT NULL,
    name        VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    is_system   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPermission (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code        VARCHAR(60) NOT NULL,
    module      VARCHAR(40) NOT NULL,
    description VARCHAR(255) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblRolePermission (
    role_id       INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES tblRole (id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES tblPermission (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblUserRole (
    user_id    BIGINT UNSIGNED NOT NULL,
    role_id    INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    KEY idx_user_roles_role (role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES tblRole (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblRefreshToken (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    family_id   CHAR(36) NOT NULL,
    token_hash  CHAR(64) NOT NULL,
    expires_at  DATETIME NOT NULL,
    revoked_at  DATETIME NULL,
    replaced_by BIGINT UNSIGNED NULL,
    ip          VARCHAR(64) NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_hash (token_hash),
    KEY idx_refresh_user (user_id),
    KEY idx_refresh_family (family_id),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblOtpCode (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NULL,
    destination VARCHAR(190) NOT NULL,
    purpose     ENUM('LOGIN','VERIFY','RESET_PASSWORD') NOT NULL,
    code_hash   CHAR(64) NOT NULL,
    attempts    INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_otp_dest (destination, purpose),
    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblCustomer (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NULL,
    name       VARCHAR(120) NOT NULL,
    email      VARCHAR(190) NULL,
    phone      VARCHAR(20) NULL,
    address    VARCHAR(255) NULL,
    city       VARCHAR(80) NULL,
    state      VARCHAR(80) NULL,
    pincode    VARCHAR(12) NULL,
    notes      TEXT NULL,
    source     ENUM('WEBSITE','ADMIN','QR','REFERRAL') NOT NULL DEFAULT 'ADMIN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customers_user (user_id),
    KEY idx_customers_email (email),
    KEY idx_customers_phone (phone),
    KEY idx_customers_created (created_at),
    CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblStaff (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    designation VARCHAR(80) NULL,
    department  VARCHAR(80) NULL,
    joined_on   DATE NULL,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_staff_user (user_id),
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotographer (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    camera_gear VARCHAR(255) NULL,
    specialties VARCHAR(255) NULL,
    day_rate    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_photographers_user (user_id),
    CONSTRAINT fk_photographers_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblEditor (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    software    VARCHAR(255) NULL,
    specialties VARCHAR(255) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_editors_user (user_id),
    CONSTRAINT fk_editors_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblService (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    summary     VARCHAR(255) NULL,
    description TEXT NULL,
    icon        VARCHAR(60) NULL,
    base_price  BIGINT UNSIGNED NOT NULL DEFAULT 0,
    is_active   TINYINT(1) NOT NULL DEFAULT 1,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_services_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPackage (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    service_id       INT UNSIGNED NULL,
    name             VARCHAR(120) NOT NULL,
    slug             VARCHAR(140) NOT NULL,
    description      TEXT NULL,
    price            BIGINT UNSIGNED NOT NULL,
    advance_percent  TINYINT UNSIGNED NOT NULL DEFAULT 30,
    features         JSON NULL,
    photo_count      INT UNSIGNED NULL,
    includes_digital TINYINT(1) NOT NULL DEFAULT 0,
    includes_album   TINYINT(1) NOT NULL DEFAULT 0,
    duration_hours   DECIMAL(5,1) NULL,
    is_featured      TINYINT(1) NOT NULL DEFAULT 0,
    is_active        TINYINT(1) NOT NULL DEFAULT 1,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at       DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_packages_slug (slug),
    KEY idx_packages_service (service_id),
    CONSTRAINT fk_packages_service FOREIGN KEY (service_id) REFERENCES tblService (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblCoupon (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code         VARCHAR(40) NOT NULL,
    description  VARCHAR(255) NULL,
    type         ENUM('PERCENT','FLAT') NOT NULL,
    value        BIGINT UNSIGNED NOT NULL,
    min_amount   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    max_discount BIGINT UNSIGNED NULL,
    applies_to   ENUM('ALL','ORDER','BOOKING') NOT NULL DEFAULT 'ALL',
    starts_at    DATETIME NULL,
    ends_at      DATETIME NULL,
    usage_limit  INT UNSIGNED NULL,
    used_count   INT UNSIGNED NOT NULL DEFAULT 0,
    is_active    TINYINT(1) NOT NULL DEFAULT 1,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblBooking (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_no     VARCHAR(30) NOT NULL,
    customer_id    BIGINT UNSIGNED NOT NULL,
    service_id     INT UNSIGNED NULL,
    package_id     INT UNSIGNED NULL,
    event_type     VARCHAR(60) NOT NULL,
    event_date     DATE NOT NULL,
    start_time     TIME NULL,
    end_time       TIME NULL,
    venue          VARCHAR(255) NULL,
    guests         INT UNSIGNED NULL,
    message        TEXT NULL,
    internal_notes TEXT NULL,
    status         ENUM('ENQUIRY','QUOTED','ADVANCE_PENDING','CONFIRMED','IN_PROGRESS','DELIVERED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ENQUIRY',
    total_amount   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    advance_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
    paid_amount    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    coupon_id      INT UNSIGNED NULL,
    source         ENUM('WEBSITE','ADMIN','CUSTOMER_PORTAL') NOT NULL DEFAULT 'WEBSITE',
    confirmed_at   DATETIME NULL,
    cancelled_at   DATETIME NULL,
    created_by     BIGINT UNSIGNED NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at     DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_bookings_no (booking_no),
    KEY idx_bookings_customer (customer_id),
    KEY idx_bookings_status (status),
    KEY idx_bookings_event_date (event_date),
    KEY idx_bookings_created (created_at),
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id),
    CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES tblService (id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_package FOREIGN KEY (package_id) REFERENCES tblPackage (id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_coupon FOREIGN KEY (coupon_id) REFERENCES tblCoupon (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblQuotation (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quotation_no     VARCHAR(30) NOT NULL,
    booking_id       BIGINT UNSIGNED NOT NULL,
    status           ENUM('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED') NOT NULL DEFAULT 'DRAFT',
    subtotal         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    tax_percent      DECIMAL(5,2) NOT NULL DEFAULT 0,
    tax              BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total            BIGINT UNSIGNED NOT NULL DEFAULT 0,
    advance_amount   BIGINT UNSIGNED NOT NULL DEFAULT 0,
    valid_until      DATE NULL,
    notes            TEXT NULL,
    terms            TEXT NULL,
    sent_at          DATETIME NULL,
    responded_at     DATETIME NULL,
    created_by       BIGINT UNSIGNED NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_quotations_no (quotation_no),
    KEY idx_quotations_booking (booking_id),
    CONSTRAINT fk_quotations_booking FOREIGN KEY (booking_id) REFERENCES tblBooking (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblQuotationItem (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    quotation_id BIGINT UNSIGNED NOT NULL,
    description  VARCHAR(255) NOT NULL,
    quantity     INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price   BIGINT UNSIGNED NOT NULL,
    total        BIGINT UNSIGNED NOT NULL,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_qitems_quotation (quotation_id),
    CONSTRAINT fk_qitems_quotation FOREIGN KEY (quotation_id) REFERENCES tblQuotation (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblEvent (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_code   VARCHAR(30) NOT NULL,
    booking_id   BIGINT UNSIGNED NULL,
    customer_id  BIGINT UNSIGNED NOT NULL,
    title        VARCHAR(160) NOT NULL,
    event_type   VARCHAR(60) NOT NULL,
    event_date   DATE NOT NULL,
    start_time   TIME NULL,
    end_time     TIME NULL,
    venue        VARCHAR(255) NULL,
    notes        TEXT NULL,
    status       ENUM('UPCOMING','LIVE','UPLOADING','PROCESSING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'UPCOMING',
    started_at   DATETIME NULL,
    stopped_at   DATETIME NULL,
    completed_at DATETIME NULL,
    created_by   BIGINT UNSIGNED NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_events_code (event_code),
    KEY idx_events_booking (booking_id),
    KEY idx_events_customer (customer_id),
    KEY idx_events_date (event_date),
    KEY idx_events_status (status),
    CONSTRAINT fk_events_booking FOREIGN KEY (booking_id) REFERENCES tblBooking (id) ON DELETE SET NULL,
    CONSTRAINT fk_events_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblEventStaff (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id    BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    role        ENUM('PHOTOGRAPHER','ASSISTANT','EDITOR','VIDEOGRAPHER','MANAGER','DELIVERY') NOT NULL DEFAULT 'PHOTOGRAPHER',
    camera_label VARCHAR(40) NULL,
    task_status ENUM('ASSIGNED','ACCEPTED','IN_PROGRESS','DONE') NOT NULL DEFAULT 'ASSIGNED',
    assigned_by BIGINT UNSIGNED NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_staff (event_id, user_id, role),
    KEY idx_event_staff_user (user_id),
    CONSTRAINT fk_es_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE,
    CONSTRAINT fk_es_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblGallery (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id          BIGINT UNSIGNED NOT NULL,
    title             VARCHAR(160) NOT NULL,
    description       TEXT NULL,
    status            ENUM('DRAFT','LIVE','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    watermark_enabled TINYINT(1) NOT NULL DEFAULT 1,
    allow_download    TINYINT(1) NOT NULL DEFAULT 1,
    auto_publish      TINYINT(1) NOT NULL DEFAULT 1,
    photo_price       BIGINT UNSIGNED NULL,
    expires_at        DATETIME NULL,
    cover_photo_id    BIGINT UNSIGNED NULL,
    created_by        BIGINT UNSIGNED NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at        DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_galleries_event (event_id),
    KEY idx_galleries_status (status),
    CONSTRAINT fk_galleries_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblAlbum (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    gallery_id  BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_albums_gallery (gallery_id),
    CONSTRAINT fk_albums_gallery FOREIGN KEY (gallery_id) REFERENCES tblGallery (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhoto (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id         BIGINT UNSIGNED NOT NULL,
    gallery_id       BIGINT UNSIGNED NOT NULL,
    album_id         BIGINT UNSIGNED NULL,
    uploaded_by      BIGINT UNSIGNED NULL,
    client_upload_id VARCHAR(64) NULL,
    camera_label     VARCHAR(40) NULL,
    file_name        VARCHAR(255) NOT NULL,
    mime_type        VARCHAR(60) NOT NULL,
    size_bytes       BIGINT UNSIGNED NOT NULL DEFAULT 0,
    checksum         CHAR(64) NULL,
    width            INT UNSIGNED NULL,
    height           INT UNSIGNED NULL,
    original_key     VARCHAR(255) NOT NULL,
    preview_key      VARCHAR(255) NULL,
    thumb_key        VARCHAR(255) NULL,
    edited_key       VARCHAR(255) NULL,
    status           ENUM('UPLOADED','PROCESSING','PREVIEW','SELECTED','EDITING','EDITED','APPROVED','DELIVERED') NOT NULL DEFAULT 'UPLOADED',
    is_published     TINYINT(1) NOT NULL DEFAULT 0,
    is_rejected      TINYINT(1) NOT NULL DEFAULT 0,
    processing_error VARCHAR(255) NULL,
    editor_id        BIGINT UNSIGNED NULL,
    price            BIGINT UNSIGNED NULL,
    sort_order       INT NOT NULL DEFAULT 0,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at       DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_photos_client_upload (event_id, client_upload_id),
    KEY idx_photos_gallery (gallery_id, is_published, deleted_at),
    KEY idx_photos_album (album_id),
    KEY idx_photos_status (status),
    KEY idx_photos_editor (editor_id),
    KEY idx_photos_checksum (event_id, checksum),
    CONSTRAINT fk_photos_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE,
    CONSTRAINT fk_photos_gallery FOREIGN KEY (gallery_id) REFERENCES tblGallery (id) ON DELETE CASCADE,
    CONSTRAINT fk_photos_album FOREIGN KEY (album_id) REFERENCES tblAlbum (id) ON DELETE SET NULL,
    CONSTRAINT fk_photos_editor FOREIGN KEY (editor_id) REFERENCES tblUser (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoMetadata (
    photo_id     BIGINT UNSIGNED NOT NULL,
    taken_at     DATETIME NULL,
    camera_make  VARCHAR(80) NULL,
    camera_model VARCHAR(120) NULL,
    lens         VARCHAR(120) NULL,
    iso          INT UNSIGNED NULL,
    exposure     VARCHAR(30) NULL,
    aperture     VARCHAR(20) NULL,
    focal_length VARCHAR(20) NULL,
    blur_score   DECIMAL(10,2) NULL,
    is_blurry    TINYINT(1) NULL,
    dhash        CHAR(16) NULL,
    duplicate_of BIGINT UNSIGNED NULL,
    faces_count  INT UNSIGNED NULL,
    eyes_closed  TINYINT(1) NULL,
    category     ENUM('SINGLE','COUPLE','FAMILY','GROUP','OTHER') NULL,
    tags         JSON NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (photo_id),
    KEY idx_pm_dhash (dhash),
    KEY idx_pm_category (category),
    CONSTRAINT fk_pm_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoFace (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_id    BIGINT UNSIGNED NOT NULL,
    event_id    BIGINT UNSIGNED NOT NULL,
    provider_face_id VARCHAR(80) NOT NULL,
    confidence  DECIMAL(6,3) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_faces_face (provider_face_id),
    KEY idx_faces_event (event_id),
    CONSTRAINT fk_faces_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblGalleryToken (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    gallery_id      BIGINT UNSIGNED NOT NULL,
    scope           ENUM('EVENT','ALBUM','PHOTO') NOT NULL DEFAULT 'EVENT',
    album_id        BIGINT UNSIGNED NULL,
    photo_id        BIGINT UNSIGNED NULL,
    label           VARCHAR(120) NULL,
    token_hash      CHAR(64) NOT NULL,
    token_encrypted VARCHAR(255) NOT NULL,
    token_hint      VARCHAR(12) NOT NULL,
    expires_at      DATETIME NULL,
    revoked_at      DATETIME NULL,
    revoked_by      BIGINT UNSIGNED NULL,
    max_uses        INT UNSIGNED NULL,
    use_count       INT UNSIGNED NOT NULL DEFAULT 0,
    last_used_at    DATETIME NULL,
    created_by      BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_gallery_tokens_hash (token_hash),
    KEY idx_gallery_tokens_gallery (gallery_id),
    CONSTRAINT fk_gt_gallery FOREIGN KEY (gallery_id) REFERENCES tblGallery (id) ON DELETE CASCADE,
    CONSTRAINT fk_gt_album FOREIGN KEY (album_id) REFERENCES tblAlbum (id) ON DELETE CASCADE,
    CONSTRAINT fk_gt_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblGalleryAccessLog (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    gallery_id  BIGINT UNSIGNED NOT NULL,
    token_id    BIGINT UNSIGNED NULL,
    user_id     BIGINT UNSIGNED NULL,
    result      ENUM('GRANTED','EXPIRED','REVOKED','INVALID','LIMIT') NOT NULL,
    ip          VARCHAR(64) NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_gal_access_gallery (gallery_id, created_at),
    KEY idx_gal_access_token (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoView (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_id    BIGINT UNSIGNED NOT NULL,
    gallery_id  BIGINT UNSIGNED NOT NULL,
    event_id    BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NULL,
    session_id  CHAR(36) NULL,
    ip          VARCHAR(64) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_photo_views_photo (photo_id),
    KEY idx_photo_views_event (event_id, created_at),
    CONSTRAINT fk_pv_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoFavourite (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_id    BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_fav (photo_id, user_id),
    KEY idx_fav_user (user_id),
    CONSTRAINT fk_fav_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblSelectionSubmission (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id     BIGINT UNSIGNED NOT NULL,
    customer_id  BIGINT UNSIGNED NOT NULL,
    status       ENUM('OPEN','SUBMITTED','CONFIRMED','REOPENED') NOT NULL DEFAULT 'OPEN',
    photo_count  INT UNSIGNED NOT NULL DEFAULT 0,
    note         TEXT NULL,
    submitted_at DATETIME NULL,
    confirmed_at DATETIME NULL,
    confirmed_by BIGINT UNSIGNED NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_selection_sub (event_id, customer_id),
    CONSTRAINT fk_ss_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE,
    CONSTRAINT fk_ss_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoSelection (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id    BIGINT UNSIGNED NOT NULL,
    photo_id    BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_selection (photo_id, customer_id),
    KEY idx_selection_event (event_id, customer_id),
    CONSTRAINT fk_sel_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE,
    CONSTRAINT fk_sel_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id) ON DELETE CASCADE,
    CONSTRAINT fk_sel_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPhotoComment (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_id    BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    body        VARCHAR(1000) NOT NULL,
    is_staff    TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_comments_photo (photo_id),
    CONSTRAINT fk_comments_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblOrder (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_no      VARCHAR(30) NOT NULL,
    customer_id   BIGINT UNSIGNED NOT NULL,
    event_id      BIGINT UNSIGNED NULL,
    booking_id    BIGINT UNSIGNED NULL,
    type          ENUM('PHOTO_DOWNLOAD','ALBUM','PRINT','FRAME','CANVAS','PACKAGE') NOT NULL,
    status        ENUM('CREATED','PAID','PROCESSING','READY','DELIVERED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'CREATED',
    subtotal      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    tax           BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    coupon_id     INT UNSIGNED NULL,
    delivery_method ENUM('DIGITAL','PICKUP','COURIER') NOT NULL DEFAULT 'DIGITAL',
    shipping_address JSON NULL,
    notes         TEXT NULL,
    paid_at       DATETIME NULL,
    completed_at  DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_no (order_no),
    KEY idx_orders_customer (customer_id),
    KEY idx_orders_status (status),
    KEY idx_orders_type (type),
    KEY idx_orders_event (event_id),
    KEY idx_orders_created (created_at),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id),
    CONSTRAINT fk_orders_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_booking FOREIGN KEY (booking_id) REFERENCES tblBooking (id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES tblCoupon (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblOrderItem (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id    BIGINT UNSIGNED NOT NULL,
    item_type   ENUM('PHOTO_DOWNLOAD','ALBUM','PRINT','FRAME','CANVAS','PACKAGE') NOT NULL,
    photo_id    BIGINT UNSIGNED NULL,
    package_id  INT UNSIGNED NULL,
    description VARCHAR(255) NOT NULL,
    size        VARCHAR(30) NULL,
    quantity    INT UNSIGNED NOT NULL DEFAULT 1,
    unit_price  BIGINT UNSIGNED NOT NULL,
    total       BIGINT UNSIGNED NOT NULL,
    options     JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_oi_order (order_id),
    KEY idx_oi_photo (photo_id),
    CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES tblOrder (id) ON DELETE CASCADE,
    CONSTRAINT fk_oi_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE SET NULL,
    CONSTRAINT fk_oi_package FOREIGN KEY (package_id) REFERENCES tblPackage (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPayment (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_no          VARCHAR(30) NOT NULL,
    customer_id         BIGINT UNSIGNED NOT NULL,
    booking_id          BIGINT UNSIGNED NULL,
    order_id            BIGINT UNSIGNED NULL,
    purpose             ENUM('ADVANCE','BALANCE','PHOTO_PURCHASE','PACKAGE','HD_UNLOCK','PRINT','ALBUM') NOT NULL,
    amount              BIGINT UNSIGNED NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    status              ENUM('PENDING','PROCESSING','SUCCESS','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
    provider            VARCHAR(20) NOT NULL,
    provider_order_id   VARCHAR(80) NULL,
    provider_payment_id VARCHAR(80) NULL,
    method              VARCHAR(30) NULL,
    failure_reason      VARCHAR(255) NULL,
    refunded_amount     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    paid_at             DATETIME NULL,
    recorded_by         BIGINT UNSIGNED NULL,
    meta                JSON NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_no (payment_no),
    UNIQUE KEY uq_payments_provider_order (provider, provider_order_id),
    KEY idx_payments_customer (customer_id),
    KEY idx_payments_booking (booking_id),
    KEY idx_payments_order (order_id),
    KEY idx_payments_status (status, paid_at),
    CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id),
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES tblBooking (id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES tblOrder (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblInvoice (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_no  VARCHAR(30) NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    payment_id  BIGINT UNSIGNED NOT NULL,
    booking_id  BIGINT UNSIGNED NULL,
    order_id    BIGINT UNSIGNED NULL,
    description VARCHAR(255) NOT NULL,
    subtotal    BIGINT UNSIGNED NOT NULL,
    tax         BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total       BIGINT UNSIGNED NOT NULL,
    line_items  JSON NULL,
    issued_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoices_no (invoice_no),
    UNIQUE KEY uq_invoices_payment (payment_id),
    KEY idx_invoices_customer (customer_id),
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES tblCustomer (id),
    CONSTRAINT fk_invoices_payment FOREIGN KEY (payment_id) REFERENCES tblPayment (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblDownload (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    photo_id    BIGINT UNSIGNED NOT NULL,
    event_id    BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NULL,
    order_id    BIGINT UNSIGNED NULL,
    variant     ENUM('ORIGINAL','EDITED') NOT NULL DEFAULT 'ORIGINAL',
    ip          VARCHAR(64) NULL,
    user_agent  VARCHAR(255) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_downloads_photo (photo_id),
    KEY idx_downloads_user (user_id),
    KEY idx_downloads_event (event_id, created_at),
    CONSTRAINT fk_dl_photo FOREIGN KEY (photo_id) REFERENCES tblPhoto (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblAlbumProof (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id      BIGINT UNSIGNED NOT NULL,
    order_id      BIGINT UNSIGNED NULL,
    version       INT UNSIGNED NOT NULL DEFAULT 1,
    title         VARCHAR(160) NOT NULL,
    pages         JSON NOT NULL,
    status        ENUM('DRAFT','SENT','APPROVED','REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT',
    customer_note TEXT NULL,
    uploaded_by   BIGINT UNSIGNED NULL,
    sent_at       DATETIME NULL,
    approved_at   DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_proofs_event (event_id),
    KEY idx_proofs_status (status),
    CONSTRAINT fk_proofs_event FOREIGN KEY (event_id) REFERENCES tblEvent (id) ON DELETE CASCADE,
    CONSTRAINT fk_proofs_order FOREIGN KEY (order_id) REFERENCES tblOrder (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblAlbumRevision (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    proof_id     BIGINT UNSIGNED NOT NULL,
    requested_by BIGINT UNSIGNED NOT NULL,
    notes        TEXT NOT NULL,
    page_refs    VARCHAR(255) NULL,
    status       ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
    resolved_by  BIGINT UNSIGNED NULL,
    resolved_at  DATETIME NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_revisions_proof (proof_id),
    CONSTRAINT fk_revisions_proof FOREIGN KEY (proof_id) REFERENCES tblAlbumProof (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPrintOrder (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id      BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NULL,
    proof_id      BIGINT UNSIGNED NULL,
    kind          ENUM('PRINT','FRAME','CANVAS','ALBUM') NOT NULL,
    photo_id      BIGINT UNSIGNED NULL,
    size          VARCHAR(30) NULL,
    quantity      INT UNSIGNED NOT NULL DEFAULT 1,
    status        ENUM('QUEUED','PRINTING','PRINTED','READY','CANCELLED') NOT NULL DEFAULT 'QUEUED',
    assigned_to   BIGINT UNSIGNED NULL,
    notes         VARCHAR(255) NULL,
    started_at    DATETIME NULL,
    completed_at  DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_print_orders_order (order_id),
    KEY idx_print_orders_status (status),
    CONSTRAINT fk_po_order FOREIGN KEY (order_id) REFERENCES tblOrder (id) ON DELETE CASCADE,
    CONSTRAINT fk_po_item FOREIGN KEY (order_item_id) REFERENCES tblOrderItem (id) ON DELETE SET NULL,
    CONSTRAINT fk_po_proof FOREIGN KEY (proof_id) REFERENCES tblAlbumProof (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblDeliveryOrder (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id      BIGINT UNSIGNED NOT NULL,
    method        ENUM('PICKUP','COURIER','HAND_DELIVERY') NOT NULL DEFAULT 'PICKUP',
    address       JSON NULL,
    status        ENUM('PENDING','READY','DISPATCHED','IN_TRANSIT','DELIVERED','FAILED') NOT NULL DEFAULT 'PENDING',
    courier       VARCHAR(80) NULL,
    tracking_no   VARCHAR(80) NULL,
    assigned_to   BIGINT UNSIGNED NULL,
    notes         VARCHAR(255) NULL,
    dispatched_at DATETIME NULL,
    delivered_at  DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_delivery_order (order_id),
    KEY idx_delivery_status (status),
    CONSTRAINT fk_do_order FOREIGN KEY (order_id) REFERENCES tblOrder (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblNotification (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    type       VARCHAR(40) NOT NULL,
    title      VARCHAR(160) NOT NULL,
    body       VARCHAR(500) NOT NULL,
    link       VARCHAR(255) NULL,
    data       JSON NULL,
    channels   JSON NULL,
    read_at    DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user (user_id, read_at, created_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES tblUser (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblAuditLog (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NULL,
    action     VARCHAR(60) NOT NULL,
    module     VARCHAR(40) NOT NULL,
    record_id  VARCHAR(40) NULL,
    ip         VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    metadata   JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_module (module, action),
    KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblSetting (
    `key`      VARCHAR(80) NOT NULL,
    value      JSON NOT NULL,
    is_public  TINYINT(1) NOT NULL DEFAULT 0,
    updated_by BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblPortfolioItem (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title       VARCHAR(160) NOT NULL,
    category    VARCHAR(60) NOT NULL,
    description VARCHAR(255) NULL,
    image_key   VARCHAR(255) NOT NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_portfolio_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tblTestimonial (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name         VARCHAR(120) NOT NULL,
    event_label  VARCHAR(120) NULL,
    quote        VARCHAR(1000) NOT NULL,
    rating       TINYINT UNSIGNED NOT NULL DEFAULT 5,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at   DATETIME NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
