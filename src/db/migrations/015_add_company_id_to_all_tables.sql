-- Migration 015: Add company_id to all tables for shared single-database multi-tenancy
-- Developer: Buildnexdev.in
-- Date: 2026-10-31

-- ============================================================================
-- 1. USERS, ROLES & STAFF
-- ============================================================================
ALTER TABLE `tblUserRole` 
  ADD COLUMN `role_name` VARCHAR(255) NULL AFTER `created_at`,
  ADD COLUMN `company_id` INT UNSIGNED NULL AFTER `role_name`,
  ADD KEY `idx_userrole_company` (`company_id`);

ALTER TABLE `tblUserPageAccess` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_userpageaccess_company` (`company_id`);

ALTER TABLE `tblStaff` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_staff_company` (`company_id`);

ALTER TABLE `tblStaffDocument` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_staffdocument_company` (`company_id`);

ALTER TABLE `tblPhotographer` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photographer_company` (`company_id`);

ALTER TABLE `tblEditor` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_editor_company` (`company_id`);

ALTER TABLE `tblRole` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_role_company` (`company_id`);

ALTER TABLE `tblRolePermission` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_rolepermission_company` (`company_id`);

-- ============================================================================
-- 2. CUSTOMERS, ENQUIRIES & AUTH SESSIONS
-- ============================================================================
ALTER TABLE `tblCustomer` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_customer_company` (`company_id`);

ALTER TABLE `tblOtpCode` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_otpcode_company` (`company_id`);

ALTER TABLE `tblRefreshToken` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_refreshtoken_company` (`company_id`);

-- ============================================================================
-- 3. EVENTS & WORKFLOW
-- ============================================================================
ALTER TABLE `tblEvent` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_event_company` (`company_id`);

ALTER TABLE `tblEventStaff` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_eventstaff_company` (`company_id`);

ALTER TABLE `tblEventAccess` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_eventaccess_company` (`company_id`);

-- ============================================================================
-- 4. GALLERIES, TOKENS & PHOTOS
-- ============================================================================
ALTER TABLE `tblGallery` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_gallery_company` (`company_id`);

ALTER TABLE `tblGalleryToken` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_gallerytoken_company` (`company_id`);

ALTER TABLE `tblGalleryAccessLog` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_galleryaccesslog_company` (`company_id`);

ALTER TABLE `tblPhoto` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photo_company` (`company_id`);

ALTER TABLE `tblPhotoMetadata` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photometadata_company` (`company_id`);

ALTER TABLE `tblPhotoFace` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photoface_company` (`company_id`);

ALTER TABLE `tblPhotoComment` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photocomment_company` (`company_id`);

ALTER TABLE `tblPhotoFavourite` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photofavourite_company` (`company_id`);

ALTER TABLE `tblPhotoSelection` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photoselection_company` (`company_id`);

ALTER TABLE `tblPhotoView` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_photoview_company` (`company_id`);

ALTER TABLE `tblDownload` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_download_company` (`company_id`);

-- ============================================================================
-- 5. ALBUMS, PROOFS & REVISIONS
-- ============================================================================
ALTER TABLE `tblAlbum` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_album_company` (`company_id`);

ALTER TABLE `tblAlbumProof` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_albumproof_company` (`company_id`);

ALTER TABLE `tblAlbumRevision` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_albumrevision_company` (`company_id`);

ALTER TABLE `tblSelectionSubmission` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_selectionsubmission_company` (`company_id`);

-- ============================================================================
-- 6. BOOKINGS, QUOTATIONS, ORDERS & PAYMENTS
-- ============================================================================
ALTER TABLE `tblBooking` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_booking_company` (`company_id`);

ALTER TABLE `tblQuotation` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_quotation_company` (`company_id`);

ALTER TABLE `tblQuotationItem` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_quotationitem_company` (`company_id`);

ALTER TABLE `tblOrder` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_order_company` (`company_id`);

ALTER TABLE `tblOrderItem` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_orderitem_company` (`company_id`);

ALTER TABLE `tblShopOrder` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_shoporder_company` (`company_id`);

ALTER TABLE `tblPrintOrder` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_printorder_company` (`company_id`);

ALTER TABLE `tblDeliveryOrder` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_deliveryorder_company` (`company_id`);

ALTER TABLE `tblInvoice` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_invoice_company` (`company_id`);

ALTER TABLE `tblPayment` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_payment_company` (`company_id`);

-- ============================================================================
-- 7. PRODUCTS, PACKAGES, SERVICES & COMMERCE
-- ============================================================================
ALTER TABLE `tblProduct` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_product_company` (`company_id`);

ALTER TABLE `tblProductCategory` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_productcategory_company` (`company_id`);

ALTER TABLE `tblProductVariant` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_productvariant_company` (`company_id`);

ALTER TABLE `tblCart` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_cart_company` (`company_id`);

ALTER TABLE `tblCartItem` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_cartitem_company` (`company_id`);

ALTER TABLE `tblPackage` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_package_company` (`company_id`);

ALTER TABLE `tblService` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_service_company` (`company_id`);

ALTER TABLE `tblCoupon` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_coupon_company` (`company_id`);

ALTER TABLE `tblOffer` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_offer_company` (`company_id`);

-- ============================================================================
-- 8. ASSETS, FINANCE & LOGS
-- ============================================================================
ALTER TABLE `tblAsset` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_asset_company` (`company_id`);

ALTER TABLE `tblAssetAssignment` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_assetassignment_company` (`company_id`);

ALTER TABLE `tblFinanceTransaction` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_financetransaction_company` (`company_id`);

ALTER TABLE `tblNotification` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_notification_company` (`company_id`);

ALTER TABLE `tblAuditLog` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_auditlog_company` (`company_id`);

ALTER TABLE `tblPortfolioItem` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_portfolioitem_company` (`company_id`);

ALTER TABLE `tblTestimonial` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_testimonial_company` (`company_id`);

ALTER TABLE `tblOnboarding` 
  ADD COLUMN `company_id` INT UNSIGNED NULL,
  ADD KEY `idx_onboarding_company` (`company_id`);

-- ============================================================================
-- 9. SETTINGS (Composite Primary Key per Company)
-- ============================================================================
ALTER TABLE `tblSetting` 
  ADD COLUMN `company_id` INT UNSIGNED NOT NULL DEFAULT 1 FIRST,
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (`company_id`, `key`);

-- ============================================================================
-- 10. BACKFILL EXISTING DATA WITH PRIMARY COMPANY (company_id = 1)
-- ============================================================================
UPDATE `tblUserRole` ur JOIN `tblRole` r ON r.roleID = ur.role_id SET ur.role_name = r.name WHERE ur.role_name IS NULL;
UPDATE `tblUserRole` ur JOIN `tblUser` u ON u.userID = ur.user_id SET ur.company_id = u.company_id WHERE ur.company_id IS NULL;
UPDATE `tblUserPageAccess` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblStaff` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblStaffDocument` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotographer` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblEditor` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCustomer` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblEvent` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblEventStaff` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblEventAccess` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblGallery` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblGalleryToken` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblGalleryAccessLog` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhoto` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoMetadata` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoFace` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoComment` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoFavourite` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoSelection` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPhotoView` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblDownload` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAlbum` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAlbumProof` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAlbumRevision` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblSelectionSubmission` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblBooking` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblQuotation` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblQuotationItem` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblOrder` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblOrderItem` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblShopOrder` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPrintOrder` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblDeliveryOrder` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblInvoice` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPayment` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblProduct` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblProductCategory` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblProductVariant` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCart` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCartItem` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPackage` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblService` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCoupon` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblOffer` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAsset` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAssetAssignment` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblFinanceTransaction` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblNotification` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblAuditLog` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblPortfolioItem` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblTestimonial` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblOnboarding` SET `company_id` = 1 WHERE `company_id` IS NULL;

-- 15. PAYROLL & CLOSING
ALTER TABLE `tblPayrollEntry` ADD COLUMN IF NOT EXISTS `company_id` INT UNSIGNED NULL AFTER `id`, ADD KEY IF NOT EXISTS `idx_payrollentry_company` (`company_id`);
ALTER TABLE `tblStaffEarning` ADD COLUMN IF NOT EXISTS `company_id` INT UNSIGNED NULL AFTER `id`, ADD KEY IF NOT EXISTS `idx_staffearning_company` (`company_id`);
ALTER TABLE `tblCashClosingDay` ADD COLUMN IF NOT EXISTS `company_id` INT UNSIGNED NULL AFTER `id`, ADD KEY IF NOT EXISTS `idx_cashclosingday_company` (`company_id`);
ALTER TABLE `tblCashClosingMonth` ADD COLUMN IF NOT EXISTS `company_id` INT UNSIGNED NULL AFTER `id`, ADD KEY IF NOT EXISTS `idx_cashclosingmonth_company` (`company_id`);
UPDATE `tblPayrollEntry` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblStaffEarning` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCashClosingDay` SET `company_id` = 1 WHERE `company_id` IS NULL;
UPDATE `tblCashClosingMonth` SET `company_id` = 1 WHERE `company_id` IS NULL;
