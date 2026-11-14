-- MySQL dump 10.13  Distrib 5.7.24, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: photo_lab
-- ------------------------------------------------------
-- Server version	5.7.24

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `tblalbum`
--

DROP TABLE IF EXISTS `tblalbum`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblalbum` (
  `albumID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`albumID`),
  KEY `idx_albums_gallery` (`gallery_id`),
  CONSTRAINT `fk_albums_gallery` FOREIGN KEY (`gallery_id`) REFERENCES `tblgallery` (`galleryID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblalbum`
--

LOCK TABLES `tblalbum` WRITE;
/*!40000 ALTER TABLE `tblalbum` DISABLE KEYS */;
INSERT INTO `tblalbum` VALUES (1,1,'Testing',NULL,0,'2026-10-06 04:50:09','2026-10-06 04:50:09',NULL);
/*!40000 ALTER TABLE `tblalbum` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblalbumproof`
--

DROP TABLE IF EXISTS `tblalbumproof`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblalbumproof` (
  `albumProofID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pages` json NOT NULL,
  `status` enum('DRAFT','SENT','APPROVED','REVISION_REQUESTED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `customer_note` text COLLATE utf8mb4_unicode_ci,
  `uploaded_by` bigint(20) unsigned DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`albumProofID`),
  KEY `idx_proofs_event` (`event_id`),
  KEY `idx_proofs_status` (`status`),
  KEY `fk_proofs_order` (`order_id`),
  CONSTRAINT `fk_proofs_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_proofs_order` FOREIGN KEY (`order_id`) REFERENCES `tblorder` (`orderID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblalbumproof`
--

LOCK TABLES `tblalbumproof` WRITE;
/*!40000 ALTER TABLE `tblalbumproof` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblalbumproof` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblalbumrevision`
--

DROP TABLE IF EXISTS `tblalbumrevision`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblalbumrevision` (
  `albumRevisionID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `proof_id` bigint(20) unsigned NOT NULL,
  `requested_by` bigint(20) unsigned NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_refs` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('OPEN','RESOLVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `resolved_by` bigint(20) unsigned DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`albumRevisionID`),
  KEY `idx_revisions_proof` (`proof_id`),
  CONSTRAINT `fk_revisions_proof` FOREIGN KEY (`proof_id`) REFERENCES `tblalbumproof` (`albumProofID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblalbumrevision`
--

LOCK TABLES `tblalbumrevision` WRITE;
/*!40000 ALTER TABLE `tblalbumrevision` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblalbumrevision` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblasset`
--

DROP TABLE IF EXISTS `tblasset`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblasset` (
  `assetID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `asset_code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('CAMERA','LENS','FLASH','TRIPOD','LIGHTS','MEMORY_CARD','LAPTOP','PRINTER','STUDIO_EQUIPMENT','OTHER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CAMERA',
  `purchase_date` date DEFAULT NULL,
  `purchase_price` bigint(20) unsigned NOT NULL DEFAULT '0',
  `current_value` bigint(20) unsigned NOT NULL DEFAULT '0',
  `asset_condition` enum('EXCELLENT','GOOD','FAIR','POOR','DAMAGED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EXCELLENT',
  `location` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('AVAILABLE','ASSIGNED','IN_USE','MAINTENANCE','DAMAGED','LOST','RETIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'AVAILABLE',
  `maintenance_date` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`assetID`),
  UNIQUE KEY `uq_asset_code` (`asset_code`),
  KEY `idx_asset_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblasset`
--

LOCK TABLES `tblasset` WRITE;
/*!40000 ALTER TABLE `tblasset` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblasset` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblassetassignment`
--

DROP TABLE IF EXISTS `tblassetassignment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblassetassignment` (
  `assetAssignmentID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` bigint(20) unsigned NOT NULL,
  `staff_id` bigint(20) unsigned DEFAULT NULL,
  `event_id` bigint(20) unsigned DEFAULT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `returned_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`assetAssignmentID`),
  KEY `idx_aa_asset` (`asset_id`),
  CONSTRAINT `fk_aa_asset` FOREIGN KEY (`asset_id`) REFERENCES `tblasset` (`assetID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblassetassignment`
--

LOCK TABLES `tblassetassignment` WRITE;
/*!40000 ALTER TABLE `tblassetassignment` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblassetassignment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblauditlog`
--

DROP TABLE IF EXISTS `tblauditlog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblauditlog` (
  `auditLogID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`auditLogID`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_module` (`module`,`action`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=121 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblauditlog`
--

LOCK TABLES `tblauditlog` WRITE;
/*!40000 ALTER TABLE `tblauditlog` DISABLE KEYS */;
INSERT INTO `tblauditlog` VALUES (1,1,'LOGIN','auth','1','127.0.0.1',NULL,NULL,'2026-10-01 09:47:50'),(2,2,'LOGIN','auth','2','127.0.0.1',NULL,NULL,'2026-10-01 09:47:50'),(3,3,'LOGIN','auth','3','127.0.0.1',NULL,NULL,'2026-10-01 09:47:51'),(4,4,'LOGIN','auth','4','127.0.0.1',NULL,NULL,'2026-10-01 09:47:51'),(5,5,'LOGIN','auth','5','127.0.0.1',NULL,NULL,'2026-10-01 09:47:51'),(6,6,'LOGIN','auth','6','127.0.0.1',NULL,NULL,'2026-10-01 09:47:52'),(7,7,'LOGIN','auth','7','127.0.0.1',NULL,NULL,'2026-10-01 09:47:52'),(8,1,'LOGIN','auth','1','127.0.0.1',NULL,NULL,'2026-10-01 09:52:01'),(9,1,'LOGIN_FAILED','auth','1','::ffff:127.0.0.1','','{\"locked\": false}','2026-10-01 09:53:28'),(10,1,'LOGIN_FAILED','auth','1','::1','node','{\"locked\": false}','2026-10-01 09:54:50'),(11,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-01 09:54:51'),(12,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-01 09:57:13'),(13,1,'LOGIN_FAILED','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"locked\": false}','2026-10-01 09:58:47'),(14,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 09:58:53'),(15,1,'REFRESH_TOKEN_REUSE','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 10:06:23'),(16,1,'LOGIN_FAILED','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"locked\": false}','2026-10-01 10:06:49'),(17,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 10:06:55'),(18,1,'LOGOUT','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 10:21:14'),(19,5,'LOGIN','auth','5','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 10:25:28'),(20,5,'LOGOUT','auth','5','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 10:25:40'),(21,1,'LOGIN_FAILED','auth','1','::ffff:127.0.0.1','node','{\"locked\": false}','2026-10-01 10:28:10'),(22,1,'LOGIN','auth','1','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:18'),(23,2,'LOGIN','auth','2','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(24,6,'LOGIN','auth','6','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(25,7,'LOGIN','auth','7','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(26,5,'LOGIN','auth','5','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(27,4,'LOGIN','auth','4','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(28,3,'LOGIN','auth','3','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:28:39'),(29,3,'LOGIN','auth','3','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(30,5,'LOGIN','auth','5','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(31,4,'LOGIN','auth','4','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(32,2,'LOGIN','auth','2','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(33,6,'LOGIN','auth','6','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(34,7,'LOGIN','auth','7','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(35,1,'LOGIN','auth','1','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:18'),(36,5,'LOGIN','auth','5','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(37,3,'LOGIN','auth','3','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(38,4,'LOGIN','auth','4','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(39,6,'LOGIN','auth','6','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(40,1,'LOGIN','auth','1','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(41,2,'LOGIN','auth','2','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(42,7,'LOGIN','auth','7','::ffff:127.0.0.1','node',NULL,'2026-10-01 10:29:21'),(43,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 11:38:45'),(44,1,'REFRESH_TOKEN_REUSE','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 11:54:45'),(45,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 11:59:45'),(46,1,'LOGOUT','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 16:14:47'),(47,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 16:36:36'),(48,1,'SETTINGS_UPDATED','settings','website','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-01 16:37:12'),(49,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-05 07:25:49'),(50,1,'LOGOUT','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-05 09:48:46'),(51,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 04:46:00'),(52,1,'CUSTOMER_CREATED','customers','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"name\": \"Nandhakumar S.v\"}','2026-10-06 04:46:54'),(53,1,'CUSTOMER_UPDATED','customers','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 04:47:04'),(54,1,'BOOKING_CREATED','bookings','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"source\": \"ADMIN\", \"bookingNo\": \"BK-2610-47168\"}','2026-10-06 04:47:48'),(55,1,'QUOTATION_CREATED','bookings','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"quotationId\": 1}','2026-10-06 04:48:14'),(56,1,'QUOTATION_SENT','bookings','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"quotationId\": 1}','2026-10-06 04:48:16'),(57,1,'QUOTATION_ACCEPTED','bookings','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"quotationId\": 1}','2026-10-06 04:48:20'),(58,1,'EVENT_CREATED','events','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"title\": \"Nandha Event\", \"bookingId\": null}','2026-10-06 04:49:15'),(59,1,'QR_GENERATED','galleries','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"scope\": \"EVENT\", \"tokenId\": \"[redacted]\", \"expiresAt\": \"2026-10-14 04:49:00\"}','2026-10-06 04:49:52'),(60,1,'ALBUM_SAVED','galleries','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"name\": \"Testing\", \"albumId\": 1}','2026-10-06 04:50:09'),(61,1,'GALLERY_REPROCESS','galleries','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"count\": 0}','2026-10-06 04:50:21'),(62,1,'EVENT_CREATED','events','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"title\": \"Nandhakumar S.v - Birthday\", \"bookingId\": 1}','2026-10-06 05:04:47'),(63,1,'PAYMENT_SUCCESS','payments','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"amount\": 8850000, \"purpose\": \"ADVANCE\", \"provider\": \"offline\"}','2026-10-06 05:04:47'),(64,1,'STAFF_ASSIGNED','events','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"role\": \"PHOTOGRAPHER\", \"userId\": 4}','2026-10-06 05:08:43'),(65,1,'PHOTO_UPLOAD','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"count\": 1, \"camera\": null}','2026-10-06 05:14:53'),(66,1,'PHOTO_UPLOAD','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"count\": 1, \"camera\": null}','2026-10-06 05:15:01'),(67,1,'PHOTO_UPLOAD','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"count\": 1, \"camera\": null}','2026-10-06 05:15:09'),(68,1,'QR_GENERATED','galleries','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"scope\": \"EVENT\", \"tokenId\": \"[redacted]\", \"expiresAt\": \"2026-10-06 05:20:00\"}','2026-10-06 05:15:50'),(69,1,'PHOTO_APPROVE','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"ids\": [1, 2, 3], \"count\": 3}','2026-10-06 05:16:38'),(70,1,'PHOTO_APPROVE','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"ids\": [1, 2, 3], \"count\": 3}','2026-10-06 05:16:41'),(71,1,'PHOTO_PUBLISH','photos','2','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"ids\": [1, 2, 3], \"count\": 3}','2026-10-06 05:16:45'),(72,1,'PERMISSION_CHANGED','roles','STUDIO_OWNER','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"to\": [\"ai.use\", \"audit.view\", \"bookings.manage\", \"bookings.view\", \"customers.manage\", \"customers.view\", \"dashboard.view\", \"delivery.manage\", \"events.assigned\", \"events.manage\", \"events.view\", \"galleries.manage\", \"notifications.send\", \"orders.manage\", \"orders.view\", \"payments.manage\", \"payments.view\", \"photos.edit\", \"photos.manage\", \"photos.upload\", \"pricing.manage\", \"printing.manage\", \"proofs.manage\", \"reports.view\", \"settings.manage\", \"staff.assign\", \"staff.manage\", \"users.manage\", \"customer.portal\"], \"from\": [\"users.manage\", \"settings.manage\", \"audit.view\", \"reports.view\", \"dashboard.view\", \"customers.view\", \"customers.manage\", \"bookings.view\", \"bookings.manage\", \"events.view\", \"events.manage\", \"events.assigned\", \"staff.assign\", \"staff.manage\", \"galleries.manage\", \"photos.upload\", \"photos.manage\", \"photos.edit\", \"proofs.manage\", \"payments.view\", \"payments.manage\", \"orders.view\", \"orders.manage\", \"pricing.manage\", \"printing.manage\", \"delivery.manage\", \"notifications.send\", \"ai.use\"]}','2026-10-06 06:34:50'),(73,1,'USER_UPDATED','users','6','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"status\": \"ACTIVE\", \"passwordReset\": \"[redacted]\"}','2026-10-06 06:35:26'),(74,1,'USER_UPDATED','users','6','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"status\": \"ACTIVE\", \"passwordReset\": \"[redacted]\"}','2026-10-06 06:35:52'),(75,1,'USER_UPDATED','users','6','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"status\": \"INACTIVE\", \"passwordReset\": \"[redacted]\"}','2026-10-06 06:46:51'),(76,1,'USER_UPDATED','users','6','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','{\"status\": \"LOCKED\", \"passwordReset\": \"[redacted]\"}','2026-10-06 06:46:57'),(77,1,'SERVICE_DELETED','catalog','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 06:51:53'),(78,1,'SETTINGS_UPDATED','settings','notifications','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:10:37'),(79,1,'SETTINGS_UPDATED','settings','ai','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:10:41'),(80,1,'SETTINGS_UPDATED','settings','gallery','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:10:55'),(81,1,'SETTINGS_UPDATED','settings','studio','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:20:30'),(82,1,'SETTINGS_UPDATED','settings','studio','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:21:44'),(83,1,'COUPON_DELETED','catalog','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:29:04'),(84,1,'LOGOUT_ALL','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',NULL,'2026-10-06 07:30:44'),(85,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',NULL,'2026-10-14 10:05:47'),(86,1,'REFRESH_TOKEN_REUSE','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',NULL,'2026-10-14 10:55:59'),(87,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',NULL,'2026-10-14 11:34:17'),(88,1,'LOGIN','auth','1','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9444',NULL,'2026-10-14 11:59:07'),(89,1,'CUSTOMER_CREATED','customers','3','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9444','{\"name\": \"Walk-in Check\"}','2026-10-14 11:59:07'),(90,1,'CUSTOMER_DELETED','customers','3','::ffff:127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9444',NULL,'2026-10-14 11:59:07'),(91,1,'CUSTOMER_CREATED','customers','4','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"name\": \"liya\"}','2026-10-14 12:22:47'),(92,1,'EVENT_CREATED','events','3','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"title\": \"test\", \"bookingId\": null}','2026-10-14 12:23:02'),(93,1,'QR_GENERATED','galleries','3','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"scope\": \"EVENT\", \"tokenId\": \"[redacted]\", \"expiresAt\": \"2026-10-15 12:24:00\"}','2026-10-14 12:24:06'),(94,1,'EVENT_START','events','3','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"to\": \"LIVE\", \"from\": \"UPCOMING\"}','2026-10-14 13:11:19'),(95,1,'PHOTO_UPLOAD','photos','3','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"count\": 1, \"camera\": null}','2026-10-14 13:11:50'),(96,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',NULL,'2026-10-26 11:31:12'),(97,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 13:20:10'),(98,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 13:20:30'),(99,1,'USER_CREATED','users','12','::1','node','{\"email\": \"test_staff@example.com\", \"roles\": [\"STAFF\"]}','2026-10-26 13:20:31'),(100,1,'USER_CREATED','users','13','::1','node','{\"email\": \"test_company_admin@example.com\", \"roles\": [\"COMPANY_ADMIN\"]}','2026-10-26 13:20:31'),(101,1,'USER_CREATED','users','14','::1','node','{\"email\": \"test_report_manager@example.com\", \"roles\": [\"REPORT_MANAGER\"]}','2026-10-26 13:20:31'),(102,1,'USER_CREATED','users','15','::1','node','{\"email\": \"test_finance@example.com\", \"roles\": [\"FINANCE\"]}','2026-10-26 13:20:32'),(103,1,'LOGIN','auth','1','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',NULL,'2026-10-26 13:22:37'),(104,1,'USER_CREATED','users','16','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"email\": \"agalyakk34@gmail.com\", \"roles\": [\"FINANCE\"]}','2026-10-26 13:23:41'),(105,1,'USER_UPDATED','users','16','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"status\": \"ACTIVE\", \"passwordReset\": \"[redacted]\"}','2026-10-26 13:24:01'),(106,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 13:53:31'),(107,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 14:13:30'),(108,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 14:14:35'),(109,1,'ASSET_SAVED','system','1','::1','node','{\"code\": \"CAM-01\", \"name\": \"Sony A7 IV\"}','2026-10-26 14:14:35'),(110,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 14:16:15'),(111,1,'ASSET_SAVED','system','1','::1','node','{\"code\": \"CAM-01\", \"name\": \"Sony A7 IV (Updated)\"}','2026-10-26 14:16:15'),(112,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 15:00:08'),(113,1,'LOGIN','auth','1','::1','node',NULL,'2026-10-26 15:00:29'),(114,1,'EVENT_CREATED','events','4','::1','node','{\"title\": \"Forced Same-Day Wedding Event\", \"bookingId\": null}','2026-10-26 15:00:29'),(115,1,'EVENT_DELETED','events','4','::1','node',NULL,'2026-10-26 15:00:29'),(116,1,'EVENT_CREATED','events','5','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"title\": \"MARRIAGE\", \"bookingId\": null}','2026-10-26 15:03:01'),(117,1,'PHOTO_UPLOAD','photos','5','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"count\": 1, \"camera\": null}','2026-10-27 06:16:47'),(118,1,'QR_GENERATED','galleries','5','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','{\"scope\": \"EVENT\", \"tokenId\": \"[redacted]\", \"expiresAt\": \"2027-01-24 15:03:01\"}','2026-10-27 06:17:01'),(119,NULL,'QR_GENERATED','galleries','3','127.0.0.1','system','{\"scope\": \"EVENT\", \"tokenId\": \"[redacted]\", \"expiresAt\": \"2027-01-12 12:23:02\"}','2026-10-27 06:50:53'),(120,1,'EVENT_COVER_UPDATED','events','3','::1','node',NULL,'2026-10-27 06:59:21');
/*!40000 ALTER TABLE `tblauditlog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblbooking`
--

DROP TABLE IF EXISTS `tblbooking`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblbooking` (
  `bookingID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `booking_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `service_id` int(10) unsigned DEFAULT NULL,
  `package_id` int(10) unsigned DEFAULT NULL,
  `event_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `venue` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `guests` int(10) unsigned DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `internal_notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('ENQUIRY','QUOTED','ADVANCE_PENDING','CONFIRMED','IN_PROGRESS','DELIVERED','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ENQUIRY',
  `total_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `advance_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `paid_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `coupon_id` int(10) unsigned DEFAULT NULL,
  `source` enum('WEBSITE','ADMIN','CUSTOMER_PORTAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WEBSITE',
  `confirmed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`bookingID`),
  UNIQUE KEY `uq_bookings_no` (`booking_no`),
  KEY `idx_bookings_customer` (`customer_id`),
  KEY `idx_bookings_status` (`status`),
  KEY `idx_bookings_event_date` (`event_date`),
  KEY `idx_bookings_created` (`created_at`),
  KEY `fk_bookings_service` (`service_id`),
  KEY `fk_bookings_package` (`package_id`),
  KEY `fk_bookings_coupon` (`coupon_id`),
  CONSTRAINT `fk_bookings_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `tblcoupon` (`couponID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_bookings_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_bookings_package` FOREIGN KEY (`package_id`) REFERENCES `tblpackage` (`packageID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_bookings_service` FOREIGN KEY (`service_id`) REFERENCES `tblservice` (`serviceID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblbooking`
--

LOCK TABLES `tblbooking` WRITE;
/*!40000 ALTER TABLE `tblbooking` DISABLE KEYS */;
INSERT INTO `tblbooking` VALUES (1,'BK-2610-47168',2,1,1,'Birthday','2026-10-06','22:17:00','22:23:00',NULL,NULL,NULL,NULL,'CONFIRMED',8850000,1000000,8850000,NULL,'ADMIN','2026-10-06 05:04:47',NULL,1,'2026-10-06 04:47:48','2026-10-06 05:04:47',NULL);
/*!40000 ALTER TABLE `tblbooking` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcart`
--

DROP TABLE IF EXISTS `tblcart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcart` (
  `cartID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cartID`),
  KEY `idx_cart_customer` (`customer_id`),
  KEY `idx_cart_session` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcart`
--

LOCK TABLES `tblcart` WRITE;
/*!40000 ALTER TABLE `tblcart` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblcart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcartitem`
--

DROP TABLE IF EXISTS `tblcartitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcartitem` (
  `cartItemID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cart_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT '1',
  `customization` json DEFAULT NULL,
  `unit_price` bigint(20) unsigned NOT NULL,
  `total_price` bigint(20) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cartItemID`),
  KEY `idx_ci_cart` (`cart_id`),
  KEY `fk_ci_product` (`product_id`),
  CONSTRAINT `fk_ci_cart` FOREIGN KEY (`cart_id`) REFERENCES `tblcart` (`cartID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_ci_product` FOREIGN KEY (`product_id`) REFERENCES `tblproduct` (`productID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcartitem`
--

LOCK TABLES `tblcartitem` WRITE;
/*!40000 ALTER TABLE `tblcartitem` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblcartitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcompany`
--

DROP TABLE IF EXISTS `tblcompany`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcompany` (
  `companyID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `database_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('ACTIVE','SUSPENDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `address` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` mediumtext COLLATE utf8mb4_unicode_ci,
  `gst_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `about_us` text COLLATE utf8mb4_unicode_ci,
  `aadhaar_number` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pan_number` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modules` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`companyID`),
  UNIQUE KEY `uq_company_slug` (`slug`),
  UNIQUE KEY `uq_company_database` (`database_name`),
  UNIQUE KEY `uq_company_phone` (`phone`),
  UNIQUE KEY `uq_company_gst` (`gst_number`),
  UNIQUE KEY `uq_company_aadhaar` (`aadhaar_number`),
  UNIQUE KEY `uq_company_pan` (`pan_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcompany`
--

LOCK TABLES `tblcompany` WRITE;
/*!40000 ALTER TABLE `tblcompany` DISABLE KEYS */;
INSERT INTO `tblcompany` VALUES (1,'FlashLight Photography','flashlight','photo_lab','ACTIVE','hello@flashlightphotography.com','+91 98765 43210','Chennai','FlashLight Photography',NULL,1,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `tblcompany` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcompanysignup`
--

DROP TABLE IF EXISTS `tblcompanysignup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcompanysignup` (
  `companySignupID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payload` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount_paise` int(10) unsigned NOT NULL,
  `provider_order_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','PAID') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `company_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`companySignupID`),
  UNIQUE KEY `uq_signup_order` (`provider_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcompanysignup`
--

LOCK TABLES `tblcompanysignup` WRITE;
/*!40000 ALTER TABLE `tblcompanysignup` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblcompanysignup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcoupon`
--

DROP TABLE IF EXISTS `tblcoupon`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcoupon` (
  `couponID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('PERCENT','FLAT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` bigint(20) unsigned NOT NULL,
  `min_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `max_discount` bigint(20) unsigned DEFAULT NULL,
  `applies_to` enum('ALL','ORDER','BOOKING') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ALL',
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `usage_limit` int(10) unsigned DEFAULT NULL,
  `used_count` int(10) unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`couponID`),
  UNIQUE KEY `uq_coupons_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcoupon`
--

LOCK TABLES `tblcoupon` WRITE;
/*!40000 ALTER TABLE `tblcoupon` DISABLE KEYS */;
INSERT INTO `tblcoupon` VALUES (1,'WELCOME10','10% off photo orders','PERCENT',10,0,50000,'ORDER',NULL,NULL,NULL,0,0,'2026-10-01 09:47:25','2026-10-06 07:29:04','2026-10-06 07:29:04');
/*!40000 ALTER TABLE `tblcoupon` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblcustomer`
--

DROP TABLE IF EXISTS `tblcustomer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblcustomer` (
  `customerID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(12) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `source` enum('WEBSITE','ADMIN','QR','REFERRAL') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `referral_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`customerID`),
  UNIQUE KEY `uq_customers_user` (`user_id`),
  KEY `idx_customers_email` (`email`),
  KEY `idx_customers_phone` (`phone`),
  KEY `idx_customers_created` (`created_at`),
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblcustomer`
--

LOCK TABLES `tblcustomer` WRITE;
/*!40000 ALTER TABLE `tblcustomer` DISABLE KEYS */;
INSERT INTO `tblcustomer` VALUES (1,7,'Priya Customer','customer@photolab.test','9000000007',NULL,'Chennai',NULL,NULL,NULL,'WEBSITE','2026-10-01 09:47:28','2026-10-01 09:47:28',NULL,NULL),(2,NULL,'Nandhakumar S.v','nandhakumarsv2002@gmail.com','09790875933','3/160,South Street,,Sirugalappur','Trichy','Tamilnadu','621651',NULL,'ADMIN','2026-10-06 04:46:54','2026-10-06 04:46:54',NULL,NULL),(3,NULL,'Walk-in Check',NULL,'9876501234',NULL,NULL,NULL,NULL,NULL,'ADMIN','2026-10-14 11:59:07','2026-10-14 11:59:07','2026-10-14 11:59:07',NULL),(4,NULL,'liya',NULL,'9876543210',NULL,NULL,NULL,NULL,NULL,'ADMIN','2026-10-14 12:22:47','2026-10-14 12:22:47',NULL,NULL);
/*!40000 ALTER TABLE `tblcustomer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbldeliveryorder`
--

DROP TABLE IF EXISTS `tbldeliveryorder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbldeliveryorder` (
  `deliveryOrderID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `method` enum('PICKUP','COURIER','HAND_DELIVERY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PICKUP',
  `address` json DEFAULT NULL,
  `status` enum('PENDING','READY','DISPATCHED','IN_TRANSIT','DELIVERED','FAILED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `courier` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_no` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to` bigint(20) unsigned DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dispatched_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`deliveryOrderID`),
  UNIQUE KEY `uq_delivery_order` (`order_id`),
  KEY `idx_delivery_status` (`status`),
  CONSTRAINT `fk_do_order` FOREIGN KEY (`order_id`) REFERENCES `tblorder` (`orderID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbldeliveryorder`
--

LOCK TABLES `tbldeliveryorder` WRITE;
/*!40000 ALTER TABLE `tbldeliveryorder` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbldeliveryorder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbldownload`
--

DROP TABLE IF EXISTS `tbldownload`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbldownload` (
  `downloadID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` bigint(20) unsigned NOT NULL,
  `event_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `variant` enum('ORIGINAL','EDITED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ORIGINAL',
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`downloadID`),
  KEY `idx_downloads_photo` (`photo_id`),
  KEY `idx_downloads_user` (`user_id`),
  KEY `idx_downloads_event` (`event_id`,`created_at`),
  CONSTRAINT `fk_dl_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbldownload`
--

LOCK TABLES `tbldownload` WRITE;
/*!40000 ALTER TABLE `tbldownload` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbldownload` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbleditor`
--

DROP TABLE IF EXISTS `tbleditor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbleditor` (
  `editorID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `software` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialties` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`editorID`),
  UNIQUE KEY `uq_editors_user` (`user_id`),
  CONSTRAINT `fk_editors_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbleditor`
--

LOCK TABLES `tbleditor` WRITE;
/*!40000 ALTER TABLE `tbleditor` DISABLE KEYS */;
INSERT INTO `tbleditor` VALUES (1,5,'Lightroom, Photoshop','Retouching, album design','2026-10-01 09:47:27','2026-10-01 09:47:27');
/*!40000 ALTER TABLE `tbleditor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblevent`
--

DROP TABLE IF EXISTS `tblevent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblevent` (
  `eventID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `booking_id` bigint(20) unsigned DEFAULT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `venue` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `cover_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('UPCOMING','LIVE','UPLOADING','PROCESSING','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UPCOMING',
  `started_at` datetime DEFAULT NULL,
  `stopped_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `access_start_time` datetime DEFAULT NULL,
  `access_end_time` datetime DEFAULT NULL,
  `download_mode` enum('VIEW_ONLY','VIEW_AND_DOWNLOAD') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'VIEW_ONLY',
  `pin_attempts` int(10) unsigned NOT NULL DEFAULT '0',
  `security_pin` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`eventID`),
  UNIQUE KEY `uq_events_code` (`event_code`),
  KEY `idx_events_booking` (`booking_id`),
  KEY `idx_events_customer` (`customer_id`),
  KEY `idx_events_date` (`event_date`),
  KEY `idx_events_status` (`status`),
  CONSTRAINT `fk_events_booking` FOREIGN KEY (`booking_id`) REFERENCES `tblbooking` (`bookingID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_events_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblevent`
--

LOCK TABLES `tblevent` WRITE;
/*!40000 ALTER TABLE `tblevent` DISABLE KEYS */;
INSERT INTO `tblevent` VALUES (1,'EV-2610-22463',NULL,1,'Nandha Event','Corporate event','2026-10-06','10:19:00','12:19:00',NULL,NULL,NULL,'UPCOMING',NULL,NULL,NULL,1,'2026-10-06 04:49:15','2026-10-06 04:49:15',NULL,NULL,NULL,'VIEW_ONLY',0,NULL),(2,'EV-2610-26326',1,2,'Nandhakumar S.v - Birthday','Birthday','2026-10-06','22:17:00','22:23:00',NULL,NULL,NULL,'UPCOMING',NULL,NULL,NULL,1,'2026-10-06 05:04:47','2026-10-06 05:04:47',NULL,NULL,NULL,'VIEW_ONLY',0,NULL),(3,'EV-2610-96343',NULL,4,'test','Wedding','2026-10-14',NULL,NULL,NULL,NULL,'events/3/cover.jpg','LIVE','2026-10-14 13:11:19',NULL,NULL,1,'2026-10-14 12:23:02','2026-10-27 06:59:21',NULL,NULL,NULL,'VIEW_ONLY',0,NULL),(4,'EV-2610-71808',NULL,1,'Forced Same-Day Wedding Event','Wedding','2026-10-06','10:30:00','11:30:00',NULL,NULL,NULL,'UPCOMING',NULL,NULL,NULL,1,'2026-10-26 15:00:29','2026-10-26 15:00:29','2026-10-26 15:00:29',NULL,NULL,'VIEW_ONLY',0,NULL),(5,'EV-2610-39204',NULL,4,'MARRIAGE','Wedding','2026-10-14','02:00:00','03:00:00',NULL,NULL,NULL,'UPCOMING',NULL,NULL,NULL,1,'2026-10-26 15:03:01','2026-10-26 15:03:01',NULL,NULL,NULL,'VIEW_ONLY',0,NULL);
/*!40000 ALTER TABLE `tblevent` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbleventaccess`
--

DROP TABLE IF EXISTS `tbleventaccess`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbleventaccess` (
  `eventAccessID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consent` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`eventAccessID`),
  KEY `idx_event_access_phone` (`event_id`,`phone`),
  KEY `idx_event_access_gallery` (`gallery_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbleventaccess`
--

LOCK TABLES `tbleventaccess` WRITE;
/*!40000 ALTER TABLE `tbleventaccess` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbleventaccess` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbleventstaff`
--

DROP TABLE IF EXISTS `tbleventstaff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbleventstaff` (
  `eventStaffID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `role` enum('PHOTOGRAPHER','ASSISTANT','EDITOR','VIDEOGRAPHER','MANAGER','DELIVERY') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PHOTOGRAPHER',
  `camera_label` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `task_status` enum('ASSIGNED','ACCEPTED','IN_PROGRESS','DONE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ASSIGNED',
  `assigned_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`eventStaffID`),
  UNIQUE KEY `uq_event_staff` (`event_id`,`user_id`,`role`),
  KEY `idx_event_staff_user` (`user_id`),
  CONSTRAINT `fk_es_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_es_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbleventstaff`
--

LOCK TABLES `tbleventstaff` WRITE;
/*!40000 ALTER TABLE `tbleventstaff` DISABLE KEYS */;
INSERT INTO `tbleventstaff` VALUES (1,2,4,'PHOTOGRAPHER','http://10.103.10.33/sap_reports/index.ph','ASSIGNED',1,'2026-10-06 05:08:43','2026-10-06 05:08:43');
/*!40000 ALTER TABLE `tbleventstaff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblfinancetransaction`
--

DROP TABLE IF EXISTS `tblfinancetransaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblfinancetransaction` (
  `financeTransactionID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transaction_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('INCOME','EXPENSE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `payment_method` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_no` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `event_id` bigint(20) unsigned DEFAULT NULL,
  `staff_id` bigint(20) unsigned DEFAULT NULL,
  `asset_id` bigint(20) unsigned DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_date` date NOT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`financeTransactionID`),
  UNIQUE KEY `uq_finance_no` (`transaction_no`),
  KEY `idx_finance_type_date` (`type`,`transaction_date`),
  KEY `idx_finance_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblfinancetransaction`
--

LOCK TABLES `tblfinancetransaction` WRITE;
/*!40000 ALTER TABLE `tblfinancetransaction` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblfinancetransaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblgallery`
--

DROP TABLE IF EXISTS `tblgallery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblgallery` (
  `galleryID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('DRAFT','LIVE','PUBLISHED','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `watermark_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `allow_download` tinyint(1) NOT NULL DEFAULT '1',
  `auto_publish` tinyint(1) NOT NULL DEFAULT '1',
  `photo_price` bigint(20) unsigned DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `cover_photo_id` bigint(20) unsigned DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`galleryID`),
  KEY `idx_galleries_event` (`event_id`),
  KEY `idx_galleries_status` (`status`),
  CONSTRAINT `fk_galleries_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblgallery`
--

LOCK TABLES `tblgallery` WRITE;
/*!40000 ALTER TABLE `tblgallery` DISABLE KEYS */;
INSERT INTO `tblgallery` VALUES (1,1,'Nandha Event',NULL,'DRAFT',1,1,1,NULL,'2027-01-04 04:49:15',NULL,1,'2026-10-06 04:49:15','2026-10-06 04:49:15',NULL),(2,2,'Nandhakumar S.v - Birthday',NULL,'DRAFT',1,1,1,NULL,'2027-01-04 05:04:47',NULL,1,'2026-10-06 05:04:47','2026-10-06 05:04:47',NULL),(3,3,'test',NULL,'LIVE',1,1,1,NULL,'2027-01-12 12:23:02',NULL,1,'2026-10-14 12:23:02','2026-10-14 13:11:19',NULL),(4,4,'Forced Same-Day Wedding Event',NULL,'DRAFT',1,1,1,NULL,'2027-01-24 15:00:29',NULL,1,'2026-10-26 15:00:29','2026-10-26 15:00:29','2026-10-26 15:00:29'),(5,5,'MARRIAGE',NULL,'DRAFT',1,1,1,NULL,'2027-01-24 15:03:01',NULL,1,'2026-10-26 15:03:01','2026-10-26 15:03:01',NULL);
/*!40000 ALTER TABLE `tblgallery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblgalleryaccesslog`
--

DROP TABLE IF EXISTS `tblgalleryaccesslog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblgalleryaccesslog` (
  `galleryAccessLogID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `token_id` bigint(20) unsigned DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `result` enum('GRANTED','EXPIRED','REVOKED','INVALID','LIMIT') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`galleryAccessLogID`),
  KEY `idx_gal_access_gallery` (`gallery_id`,`created_at`),
  KEY `idx_gal_access_token` (`token_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblgalleryaccesslog`
--

LOCK TABLES `tblgalleryaccesslog` WRITE;
/*!40000 ALTER TABLE `tblgalleryaccesslog` DISABLE KEYS */;
INSERT INTO `tblgalleryaccesslog` VALUES (1,1,1,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:53:18'),(2,1,1,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:53:18'),(3,1,1,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:53:21'),(4,2,2,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:16:05'),(5,2,2,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:16:05'),(6,2,2,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:16:12'),(7,2,2,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:16:12'),(8,2,2,NULL,'INVALID','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:16:14'),(9,3,5,NULL,'GRANTED','::1','node','2026-10-27 06:58:48'),(10,3,5,NULL,'GRANTED','::1','node','2026-10-27 06:59:04'),(11,3,5,NULL,'GRANTED','::1','node','2026-10-27 06:59:21'),(12,3,5,NULL,'GRANTED','::1','node','2026-10-27 06:59:39');
/*!40000 ALTER TABLE `tblgalleryaccesslog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblgallerytoken`
--

DROP TABLE IF EXISTS `tblgallerytoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblgallerytoken` (
  `galleryTokenID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `scope` enum('EVENT','ALBUM','PHOTO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EVENT',
  `album_id` bigint(20) unsigned DEFAULT NULL,
  `photo_id` bigint(20) unsigned DEFAULT NULL,
  `label` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_encrypted` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hint` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` bigint(20) unsigned DEFAULT NULL,
  `max_uses` int(10) unsigned DEFAULT NULL,
  `use_count` int(10) unsigned NOT NULL DEFAULT '0',
  `last_used_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`galleryTokenID`),
  UNIQUE KEY `uq_gallery_tokens_hash` (`token_hash`),
  KEY `idx_gallery_tokens_gallery` (`gallery_id`),
  KEY `fk_gt_album` (`album_id`),
  KEY `fk_gt_photo` (`photo_id`),
  CONSTRAINT `fk_gt_album` FOREIGN KEY (`album_id`) REFERENCES `tblalbum` (`albumID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_gt_gallery` FOREIGN KEY (`gallery_id`) REFERENCES `tblgallery` (`galleryID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_gt_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblgallerytoken`
--

LOCK TABLES `tblgallerytoken` WRITE;
/*!40000 ALTER TABLE `tblgallerytoken` DISABLE KEYS */;
INSERT INTO `tblgallerytoken` VALUES (1,1,'EVENT',NULL,NULL,'Test','af3d7760c66a18ea9aadf8bb2c259862c10266719cababeb7977e16e4e3b690d','SOJzT0dMj7KOr2Sn.-Mkwti-qA8uJnGIWqvtK6w.RCKilpsQ6dAnT_qZ31s8GXmFtcFk7J1Q512u-ngG0ug','Ca2W9u','2026-10-14 04:49:00',NULL,NULL,1000,0,NULL,1,'2026-10-06 04:49:52','2026-10-06 04:49:52'),(2,2,'EVENT',NULL,NULL,'Test','a462fa7da38b8f0fea4efe955d29bfb55836dceb66d0d602bd8355f06d21ab1e','_a4K5PGWyuTAX5qD.c11fwNSZ1qUtGo92nhUe7w.KRNQlu20cIKeRoA4g_aKk2UAdXjaSnrh-jo0IF9vgqs','S8R2NG','2026-10-06 05:20:00',NULL,NULL,2,0,NULL,1,'2026-10-06 05:15:50','2026-10-06 05:15:50'),(3,3,'EVENT',NULL,NULL,'test','da65107f4b2babe81b40888a94048dc3ad001ee9720d97687909e9a3868601d9','wheUcKfrszL00DRs._U9RZgMV9PXeU3rwuyN6aA.IasauKS6Gm6T59eRIaB1_J4ns3tw3APYuBdmHjsxFxU','_4JboZ','2026-10-15 12:24:00',NULL,NULL,NULL,0,NULL,1,'2026-10-14 12:24:06','2026-10-14 12:24:06'),(4,5,'EVENT',NULL,NULL,NULL,'a23f4eaac02f6eca6ef2fc7e0184bf9ee8dc09b7c5bb35c346fe82c3b6d9c792','jJ_iXzfEivtdLV61.MEU05cE5PUAnANhIpw4yHg.Ny5lWZxhIRvZnS4r1Q8Swjr7wlA8-Q3wzmFCtOQJKcs','Hrzjxd','2027-01-24 15:03:01',NULL,NULL,NULL,0,NULL,1,'2026-10-27 06:17:01','2026-10-27 06:17:01'),(5,3,'EVENT',NULL,NULL,'Live event','54c0f3d5a1903117906134cf46fb95d95eaacd63f6420006dfa77f54928d55b0','16B9TJLR51dbmHWY.eE2vyUjPpUKVMw39tQ8VqQ.Jrg33A4jzKupIXU8Rx_KoC__3C5a0W4aP6KFpIz5NPs','yd-BgR','2027-01-12 12:23:02',NULL,NULL,NULL,4,'2026-10-27 06:59:39',NULL,'2026-10-27 06:50:53','2026-10-27 06:59:39');
/*!40000 ALTER TABLE `tblgallerytoken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblinvoice`
--

DROP TABLE IF EXISTS `tblinvoice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblinvoice` (
  `invoiceID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `payment_id` bigint(20) unsigned NOT NULL,
  `booking_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtotal` bigint(20) unsigned NOT NULL,
  `tax` bigint(20) unsigned NOT NULL DEFAULT '0',
  `total` bigint(20) unsigned NOT NULL,
  `line_items` json DEFAULT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`invoiceID`),
  UNIQUE KEY `uq_invoices_no` (`invoice_no`),
  UNIQUE KEY `uq_invoices_payment` (`payment_id`),
  KEY `idx_invoices_customer` (`customer_id`),
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_invoices_payment` FOREIGN KEY (`payment_id`) REFERENCES `tblpayment` (`paymentID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblinvoice`
--

LOCK TABLES `tblinvoice` WRITE;
/*!40000 ALTER TABLE `tblinvoice` DISABLE KEYS */;
INSERT INTO `tblinvoice` VALUES (1,'INV-202610-0001',2,1,1,NULL,'Advance for booking BK-2610-47168',7500000,1350000,8850000,'[{\"total\": 8850000, \"quantity\": 1, \"unit_price\": 8850000, \"description\": \"Advance for booking BK-2610-47168\"}]','2026-10-06 05:04:47','2026-10-06 05:04:47','2026-10-06 05:04:47');
/*!40000 ALTER TABLE `tblinvoice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblnotification`
--

DROP TABLE IF EXISTS `tblnotification`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblnotification` (
  `notificationID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `data` json DEFAULT NULL,
  `channels` json DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`notificationID`),
  KEY `idx_notifications_user` (`user_id`,`read_at`,`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblnotification`
--

LOCK TABLES `tblnotification` WRITE;
/*!40000 ALTER TABLE `tblnotification` DISABLE KEYS */;
INSERT INTO `tblnotification` VALUES (1,1,'PAYMENT_SUCCESS','Payment received','₹88500.00 - Advance for booking BK-2610-47168','/admin/payments',NULL,'{\"inApp\": {\"sent\": true}}','2026-10-06 05:05:01','2026-10-06 05:04:47','2026-10-06 05:05:01'),(2,2,'PAYMENT_SUCCESS','Payment received','₹88500.00 - Advance for booking BK-2610-47168','/admin/payments',NULL,'{\"inApp\": {\"sent\": true}}',NULL,'2026-10-06 05:04:47','2026-10-06 05:04:47'),(3,3,'PAYMENT_SUCCESS','Payment received','₹88500.00 - Advance for booking BK-2610-47168','/admin/payments',NULL,'{\"inApp\": {\"sent\": true}}',NULL,'2026-10-06 05:04:47','2026-10-06 05:04:47'),(4,4,'EVENT_ASSIGNED','New event assignment','You are assigned as photographer for Nandhakumar S.v - Birthday on 2026-10-06.','/photographer/event/2',NULL,'{\"email\": {\"sent\": false, \"reason\": \"SMTP not configured\"}, \"inApp\": {\"sent\": true}}',NULL,'2026-10-06 05:08:43','2026-10-06 05:08:43');
/*!40000 ALTER TABLE `tblnotification` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbloffer`
--

DROP TABLE IF EXISTS `tbloffer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbloffer` (
  `offerID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `poster_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `discount_type` enum('PERCENT','FLAT') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PERCENT',
  `discount_value` bigint(20) unsigned NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `min_order` bigint(20) unsigned NOT NULL DEFAULT '0',
  `max_discount` bigint(20) unsigned DEFAULT NULL,
  `usage_limit` int(10) unsigned DEFAULT NULL,
  `used_count` int(10) unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`offerID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbloffer`
--

LOCK TABLES `tbloffer` WRITE;
/*!40000 ALTER TABLE `tbloffer` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbloffer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblonboarding`
--

DROP TABLE IF EXISTS `tblonboarding`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblonboarding` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `token` char(32) NOT NULL,
  `payload_json` json NOT NULL,
  `amount_paise` int(10) unsigned NOT NULL,
  `provider_order_id` varchar(64) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `company_slug` varchar(48) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_onboarding_token` (`token`),
  KEY `idx_onboarding_order` (`provider_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblonboarding`
--

LOCK TABLES `tblonboarding` WRITE;
/*!40000 ALTER TABLE `tblonboarding` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblonboarding` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblorder`
--

DROP TABLE IF EXISTS `tblorder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblorder` (
  `orderID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `event_id` bigint(20) unsigned DEFAULT NULL,
  `booking_id` bigint(20) unsigned DEFAULT NULL,
  `type` enum('PHOTO_DOWNLOAD','ALBUM','PRINT','FRAME','CANVAS','PACKAGE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('CREATED','PAID','PROCESSING','READY','DELIVERED','COMPLETED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CREATED',
  `subtotal` bigint(20) unsigned NOT NULL DEFAULT '0',
  `discount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `tax` bigint(20) unsigned NOT NULL DEFAULT '0',
  `total` bigint(20) unsigned NOT NULL DEFAULT '0',
  `coupon_id` int(10) unsigned DEFAULT NULL,
  `delivery_method` enum('DIGITAL','PICKUP','COURIER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DIGITAL',
  `shipping_address` json DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `paid_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`orderID`),
  UNIQUE KEY `uq_orders_no` (`order_no`),
  KEY `idx_orders_customer` (`customer_id`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_type` (`type`),
  KEY `idx_orders_event` (`event_id`),
  KEY `idx_orders_created` (`created_at`),
  KEY `fk_orders_booking` (`booking_id`),
  KEY `fk_orders_coupon` (`coupon_id`),
  CONSTRAINT `fk_orders_booking` FOREIGN KEY (`booking_id`) REFERENCES `tblbooking` (`bookingID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_coupon` FOREIGN KEY (`coupon_id`) REFERENCES `tblcoupon` (`couponID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblorder`
--

LOCK TABLES `tblorder` WRITE;
/*!40000 ALTER TABLE `tblorder` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblorder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblorderitem`
--

DROP TABLE IF EXISTS `tblorderitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblorderitem` (
  `orderItemID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `item_type` enum('PHOTO_DOWNLOAD','ALBUM','PRINT','FRAME','CANVAS','PACKAGE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_id` bigint(20) unsigned DEFAULT NULL,
  `package_id` int(10) unsigned DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT '1',
  `unit_price` bigint(20) unsigned NOT NULL,
  `total` bigint(20) unsigned NOT NULL,
  `options` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`orderItemID`),
  KEY `idx_oi_order` (`order_id`),
  KEY `idx_oi_photo` (`photo_id`),
  KEY `fk_oi_package` (`package_id`),
  CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `tblorder` (`orderID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_oi_package` FOREIGN KEY (`package_id`) REFERENCES `tblpackage` (`packageID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_oi_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblorderitem`
--

LOCK TABLES `tblorderitem` WRITE;
/*!40000 ALTER TABLE `tblorderitem` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblorderitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblotpcode`
--

DROP TABLE IF EXISTS `tblotpcode`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblotpcode` (
  `otpCodeID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `destination` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` enum('LOGIN','VERIFY','RESET_PASSWORD','EVENT_ACCESS') COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`otpCodeID`),
  KEY `idx_otp_dest` (`destination`,`purpose`),
  KEY `fk_otp_user` (`user_id`),
  CONSTRAINT `fk_otp_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblotpcode`
--

LOCK TABLES `tblotpcode` WRITE;
/*!40000 ALTER TABLE `tblotpcode` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblotpcode` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblpackage`
--

DROP TABLE IF EXISTS `tblpackage`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblpackage` (
  `packageID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `service_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` bigint(20) unsigned NOT NULL,
  `advance_percent` tinyint(3) unsigned NOT NULL DEFAULT '30',
  `features` json DEFAULT NULL,
  `photo_count` int(10) unsigned DEFAULT NULL,
  `includes_digital` tinyint(1) NOT NULL DEFAULT '0',
  `includes_album` tinyint(1) NOT NULL DEFAULT '0',
  `duration_hours` decimal(5,1) DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`packageID`),
  UNIQUE KEY `uq_packages_slug` (`slug`),
  KEY `idx_packages_service` (`service_id`),
  CONSTRAINT `fk_packages_service` FOREIGN KEY (`service_id`) REFERENCES `tblservice` (`serviceID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblpackage`
--

LOCK TABLES `tblpackage` WRITE;
/*!40000 ALTER TABLE `tblpackage` DISABLE KEYS */;
INSERT INTO `tblpackage` VALUES (1,1,'Wedding Silver Collection','wedding-silver','Essential single-day wedding coverage featuring edited digital delivery and live online guest gallery.',7500000,30,'[\"1 Senior Lead Photographer\", \"8 Hours of Continuous Coverage\", \"400+ Curated & Retouched Photographs\", \"Instant Live QR Guest Gallery\", \"Master High-Resolution Digital Downloads\"]',400,1,0,8.0,0,1,1,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(2,1,'Wedding Gold Collection','wedding-gold','Our most sought-after full-day package with two photographers and a handcrafted flush-mount album.',12500000,30,'[\"2 Senior Photographers (Candid + Traditional)\", \"Full-Day Comprehensive Coverage (12 Hours)\", \"800+ Master Retouched Photographs\", \"Live Event QR Gallery for Instant Guest Access\", \"40-Page Handcrafted Archival Album\", \"Complete High-Resolution Digital Master Collection\"]',800,1,1,12.0,1,1,2,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(3,1,'Wedding Platinum Legacy','wedding-platinum','Multi-day grand celebration package with aerial cinematography and twin heirloom albums.',20000000,30,'[\"3 Senior Photographers + Drone Aerial Visuals\", \"Two Full Days of Extensive Coverage (24 Hours)\", \"1,500+ Master Retouched High-Resolution Files\", \"Live QR Gallery with Real-Time Event Sync\", \"Two Handcrafted Archival Leather Albums\", \"Same-Day Digital Highlight Reel\"]',1500,1,1,24.0,0,1,3,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(4,2,'Pre-Wedding Classic','pre-wedding-classic','Pre-Wedding Classic package',2500000,30,'[\"2 locations\", \"4 hours\", \"150 edited photos\", \"Online gallery\"]',150,1,0,4.0,0,0,3,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(5,3,'Celebration Basic','celebration-basic','Celebration Basic package',1500000,30,'[\"1 photographer\", \"4 hours\", \"Watermarked QR gallery\", \"Buy HD photos individually\"]',200,0,0,4.0,0,0,4,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(6,5,'Studio Portrait','studio-portrait','Studio Portrait package',500000,30,'[\"1-hour studio session\", \"20 retouched portraits\", \"Digital files\"]',20,1,0,1.0,0,0,5,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL);
/*!40000 ALTER TABLE `tblpackage` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblpayment`
--

DROP TABLE IF EXISTS `tblpayment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblpayment` (
  `paymentID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `payment_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `booking_id` bigint(20) unsigned DEFAULT NULL,
  `order_id` bigint(20) unsigned DEFAULT NULL,
  `purpose` enum('ADVANCE','BALANCE','PHOTO_PURCHASE','PACKAGE','HD_UNLOCK','PRINT','ALBUM') COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` bigint(20) unsigned NOT NULL,
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `status` enum('PENDING','PROCESSING','SUCCESS','FAILED','REFUNDED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_order_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_payment_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `failure_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `refunded_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `paid_at` datetime DEFAULT NULL,
  `recorded_by` bigint(20) unsigned DEFAULT NULL,
  `meta` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`paymentID`),
  UNIQUE KEY `uq_payments_no` (`payment_no`),
  UNIQUE KEY `uq_payments_provider_order` (`provider`,`provider_order_id`),
  KEY `idx_payments_customer` (`customer_id`),
  KEY `idx_payments_booking` (`booking_id`),
  KEY `idx_payments_order` (`order_id`),
  KEY `idx_payments_status` (`status`,`paid_at`),
  CONSTRAINT `fk_payments_booking` FOREIGN KEY (`booking_id`) REFERENCES `tblbooking` (`bookingID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `tblorder` (`orderID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblpayment`
--

LOCK TABLES `tblpayment` WRITE;
/*!40000 ALTER TABLE `tblpayment` DISABLE KEYS */;
INSERT INTO `tblpayment` VALUES (1,'PY-2610-42996',2,1,NULL,'ADVANCE',8850000,'INR','SUCCESS','offline','offline_PY-2610-42996',NULL,'cash',NULL,0,'2026-10-06 05:04:47',1,'{\"reference\": null}','2026-10-06 05:04:47','2026-10-06 05:04:47');
/*!40000 ALTER TABLE `tblpayment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblpermission`
--

DROP TABLE IF EXISTS `tblpermission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblpermission` (
  `permissionID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`permissionID`),
  UNIQUE KEY `uq_permissions_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblpermission`
--

LOCK TABLES `tblpermission` WRITE;
/*!40000 ALTER TABLE `tblpermission` DISABLE KEYS */;
INSERT INTO `tblpermission` VALUES (1,'users.manage','users','Create, update and deactivate users','2026-10-01 09:47:25','2026-10-01 09:47:25'),(2,'roles.manage','users','Edit roles and permissions','2026-10-01 09:47:25','2026-10-01 09:47:25'),(3,'settings.manage','settings','Change studio settings and pricing','2026-10-01 09:47:25','2026-10-01 09:47:25'),(4,'audit.view','security','View audit logs','2026-10-01 09:47:25','2026-10-01 09:47:25'),(5,'reports.view','reports','View reports and analytics','2026-10-01 09:47:25','2026-10-01 09:47:25'),(6,'dashboard.view','dashboard','View the studio dashboard','2026-10-01 09:47:25','2026-10-01 09:47:25'),(7,'customers.view','customers','View customers','2026-10-01 09:47:25','2026-10-01 09:47:25'),(8,'customers.manage','customers','Create and update tblCustomer','2026-10-01 09:47:25','2026-10-01 09:47:25'),(9,'bookings.view','bookings','View bookings and enquiries','2026-10-01 09:47:25','2026-10-01 09:47:25'),(10,'bookings.manage','bookings','Create and update tblBooking and quotations','2026-10-01 09:47:25','2026-10-01 09:47:25'),(11,'events.view','events','View all events','2026-10-01 09:47:25','2026-10-01 09:47:25'),(12,'events.manage','events','Create, edit, start and complete events','2026-10-01 09:47:25','2026-10-01 09:47:25'),(13,'events.assigned','events','Work on events assigned to me','2026-10-01 09:47:25','2026-10-01 09:47:25'),(14,'staff.assign','events','Assign staff to events','2026-10-01 09:47:25','2026-10-01 09:47:25'),(15,'staff.manage','staff','Manage staff, photographer and editor profiles','2026-10-01 09:47:25','2026-10-01 09:47:25'),(16,'galleries.manage','galleries','Manage galleries, albums and QR codes','2026-10-01 09:47:25','2026-10-01 09:47:25'),(17,'photos.upload','photos','Upload photos to events','2026-10-01 09:47:25','2026-10-01 09:47:25'),(18,'photos.manage','photos','Move, delete, approve and reject photos','2026-10-01 09:47:25','2026-10-01 09:47:25'),(19,'photos.edit','photos','Work on the editing queue and upload edits','2026-10-01 09:47:25','2026-10-01 09:47:25'),(20,'proofs.manage','albums','Create album proofs and handle revisions','2026-10-01 09:47:25','2026-10-01 09:47:25'),(21,'payments.view','payments','View payments','2026-10-01 09:47:25','2026-10-01 09:47:25'),(22,'payments.manage','payments','Record offline payments and refunds','2026-10-01 09:47:25','2026-10-01 09:47:25'),(23,'orders.view','orders','View orders','2026-10-01 09:47:25','2026-10-01 09:47:25'),(24,'orders.manage','orders','Update tblOrder','2026-10-01 09:47:25','2026-10-01 09:47:25'),(25,'pricing.manage','pricing','Manage services, packages, coupons and website content','2026-10-01 09:47:25','2026-10-01 09:47:25'),(26,'printing.manage','printing','Work on print jobs','2026-10-01 09:47:25','2026-10-01 09:47:25'),(27,'delivery.manage','delivery','Work on deliveries','2026-10-01 09:47:25','2026-10-01 09:47:25'),(28,'notifications.send','notifications','Send notifications to customers','2026-10-01 09:47:25','2026-10-01 09:47:25'),(29,'ai.use','ai','Use AI culling and smart search tools','2026-10-01 09:47:25','2026-10-01 09:47:25'),(30,'customer.portal','customer','Use the customer portal','2026-10-01 09:47:25','2026-10-01 09:47:25');
/*!40000 ALTER TABLE `tblpermission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphoto`
--

DROP TABLE IF EXISTS `tblphoto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphoto` (
  `photoID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `album_id` bigint(20) unsigned DEFAULT NULL,
  `uploaded_by` bigint(20) unsigned DEFAULT NULL,
  `client_upload_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camera_label` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` bigint(20) unsigned NOT NULL DEFAULT '0',
  `checksum` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `width` int(10) unsigned DEFAULT NULL,
  `height` int(10) unsigned DEFAULT NULL,
  `original_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `preview_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumb_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `edited_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('UPLOADED','PROCESSING','PREVIEW','SELECTED','EDITING','EDITED','APPROVED','DELIVERED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UPLOADED',
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `is_rejected` tinyint(1) NOT NULL DEFAULT '0',
  `processing_error` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `editor_id` bigint(20) unsigned DEFAULT NULL,
  `price` bigint(20) unsigned DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`photoID`),
  UNIQUE KEY `uq_photos_client_upload` (`event_id`,`client_upload_id`),
  KEY `idx_photos_gallery` (`gallery_id`,`is_published`,`deleted_at`),
  KEY `idx_photos_album` (`album_id`),
  KEY `idx_photos_status` (`status`),
  KEY `idx_photos_editor` (`editor_id`),
  KEY `idx_photos_checksum` (`event_id`,`checksum`),
  CONSTRAINT `fk_photos_album` FOREIGN KEY (`album_id`) REFERENCES `tblalbum` (`albumID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_photos_editor` FOREIGN KEY (`editor_id`) REFERENCES `tbluser` (`userID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_photos_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_photos_gallery` FOREIGN KEY (`gallery_id`) REFERENCES `tblgallery` (`galleryID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphoto`
--

LOCK TABLES `tblphoto` WRITE;
/*!40000 ALTER TABLE `tblphoto` DISABLE KEYS */;
INSERT INTO `tblphoto` VALUES (1,2,2,NULL,1,'da5e5306-53bf-4cb6-a5f9-1fc9082190cd',NULL,'2025 Calendar Tag _ Canva Template.jfif','image/jpeg',114495,'d81c42156be6fd77db1f7851b234e3644250c3318482f875a21aeb5d14ce8e3f',736,1078,'events/2/originals/e9c1b09c-c5de-41b2-a213-210d74ed1757.jpg','events/2/previews/44022192-887f-4f7f-b0df-6f4046b1a6b5.jpg','events/2/previews/44022192-887f-4f7f-b0df-6f4046b1a6b5_t.jpg',NULL,'APPROVED',1,0,NULL,NULL,NULL,0,'2026-10-06 05:14:53','2026-10-06 05:16:38',NULL),(2,2,2,NULL,1,'e1b8ff79-7a05-4aae-bc21-e3d1b4c9597c',NULL,'Unique Birthday Gift Idea _ Custom Printable Photo Collage Frame _ Personalized A4 Gift PDF.jfif','image/jpeg',162546,'1a10a5f7c76f4691678fcec7caa436d8f87920d3063e207596bf26ffe8b05a92',736,1104,'events/2/originals/dfbe827b-31ea-4497-9aa7-50871c29484b.jpg','events/2/previews/ca83c2b2-6c9e-483e-8c38-328f83b0922f.jpg','events/2/previews/ca83c2b2-6c9e-483e-8c38-328f83b0922f_t.jpg',NULL,'APPROVED',1,0,NULL,NULL,NULL,0,'2026-10-06 05:15:01','2026-10-06 05:16:38',NULL),(3,2,2,NULL,1,'dc6c8c08-8082-4089-8787-20ed6c43e5dd',NULL,'gallery-1-qr-1.png','image/png',9729,'f0327c27bd29d7b66609aa2a51fe54c4a01a1614efd09e736e9c367821c45f1a',1200,1200,'events/2/originals/5d22b7fb-8a93-4126-b2aa-77433bd2ed92.png','events/2/previews/8362921e-531e-4739-be7b-767994026577.jpg','events/2/previews/8362921e-531e-4739-be7b-767994026577_t.jpg',NULL,'APPROVED',1,0,NULL,NULL,NULL,0,'2026-10-06 05:15:09','2026-10-06 05:16:38',NULL),(4,3,3,NULL,1,'100246c6-d072-4651-b5b5-1f9e9be7aa9b',NULL,'WhatsApp Image 2026-10-03 at 11.46.11 PM.jpeg','image/jpeg',231829,'a6a3f7caea87bbf51c03abf5f4c20d992f961b5f64b53e2097d98a31ef921773',1024,1536,'events/3/originals/dd1922cb-d78b-467b-b347-e4c4e43515b5.jpg','events/3/previews/33146903-6301-447d-b0a8-9dbb3bc2c1ad.jpg','events/3/previews/33146903-6301-447d-b0a8-9dbb3bc2c1ad_t.jpg',NULL,'PREVIEW',1,0,NULL,NULL,NULL,0,'2026-10-14 13:11:50','2026-10-14 13:11:52',NULL),(5,5,5,NULL,1,'9c59f0a0-9fa0-4392-a728-fa72d7a49d1c',NULL,'bg.webp','image/webp',45314,'3898d87a1296dd2c68e1eca60c558184dd9fe6bec2964dad6935044b8060fc68',1080,675,'events/5/originals/c3ad7c40-504f-4ac7-b829-5e595d4912f9.webp','events/5/previews/51ba2ec8-c35b-462f-bedd-38a04ae52ac9.jpg','events/5/previews/51ba2ec8-c35b-462f-bedd-38a04ae52ac9_t.jpg',NULL,'PREVIEW',1,0,NULL,NULL,NULL,0,'2026-10-27 06:16:47','2026-10-27 06:16:49',NULL);
/*!40000 ALTER TABLE `tblphoto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotocomment`
--

DROP TABLE IF EXISTS `tblphotocomment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotocomment` (
  `photoCommentID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `body` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_staff` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`photoCommentID`),
  KEY `idx_comments_photo` (`photo_id`),
  KEY `fk_comments_user` (`user_id`),
  CONSTRAINT `fk_comments_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotocomment`
--

LOCK TABLES `tblphotocomment` WRITE;
/*!40000 ALTER TABLE `tblphotocomment` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblphotocomment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotoface`
--

DROP TABLE IF EXISTS `tblphotoface`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotoface` (
  `photoFaceID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` bigint(20) unsigned NOT NULL,
  `event_id` bigint(20) unsigned NOT NULL,
  `provider_face_id` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence` decimal(6,3) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photoFaceID`),
  KEY `idx_faces_face` (`provider_face_id`),
  KEY `idx_faces_event` (`event_id`),
  KEY `fk_faces_photo` (`photo_id`),
  CONSTRAINT `fk_faces_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotoface`
--

LOCK TABLES `tblphotoface` WRITE;
/*!40000 ALTER TABLE `tblphotoface` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblphotoface` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotofavourite`
--

DROP TABLE IF EXISTS `tblphotofavourite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotofavourite` (
  `photoFavouriteID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photoFavouriteID`),
  UNIQUE KEY `uq_fav` (`photo_id`,`user_id`),
  KEY `idx_fav_user` (`user_id`),
  CONSTRAINT `fk_fav_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotofavourite`
--

LOCK TABLES `tblphotofavourite` WRITE;
/*!40000 ALTER TABLE `tblphotofavourite` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblphotofavourite` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotographer`
--

DROP TABLE IF EXISTS `tblphotographer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotographer` (
  `photographerID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `camera_gear` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialties` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `day_rate` bigint(20) unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`photographerID`),
  UNIQUE KEY `uq_photographers_user` (`user_id`),
  CONSTRAINT `fk_photographers_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotographer`
--

LOCK TABLES `tblphotographer` WRITE;
/*!40000 ALTER TABLE `tblphotographer` DISABLE KEYS */;
INSERT INTO `tblphotographer` VALUES (1,4,'Sony A7 IV, 24-70mm f/2.8','Weddings, candid',0,'2026-10-01 09:47:27','2026-10-01 09:47:27');
/*!40000 ALTER TABLE `tblphotographer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotometadata`
--

DROP TABLE IF EXISTS `tblphotometadata`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotometadata` (
  `photo_id` bigint(20) unsigned NOT NULL,
  `taken_at` datetime DEFAULT NULL,
  `camera_make` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `camera_model` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lens` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `iso` int(10) unsigned DEFAULT NULL,
  `exposure` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aperture` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `focal_length` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `blur_score` decimal(10,2) DEFAULT NULL,
  `is_blurry` tinyint(1) DEFAULT NULL,
  `dhash` char(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duplicate_of` bigint(20) unsigned DEFAULT NULL,
  `faces_count` int(10) unsigned DEFAULT NULL,
  `eyes_closed` tinyint(1) DEFAULT NULL,
  `category` enum('SINGLE','COUPLE','FAMILY','GROUP','OTHER') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`photo_id`),
  KEY `idx_pm_dhash` (`dhash`),
  KEY `idx_pm_category` (`category`),
  CONSTRAINT `fk_pm_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotometadata`
--

LOCK TABLES `tblphotometadata` WRITE;
/*!40000 ALTER TABLE `tblphotometadata` DISABLE KEYS */;
INSERT INTO `tblphotometadata` VALUES (1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2632.04,0,'dbdbdbdbdbdbdbdb',NULL,NULL,NULL,NULL,NULL,'2026-10-06 05:14:53','2026-10-06 05:14:53'),(2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,4695.36,0,'cf6f1f371b1b1d9d',NULL,NULL,NULL,NULL,NULL,'2026-10-06 05:15:01','2026-10-06 05:15:02'),(3,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,14061.57,0,'aa86bacea6a6a6a6',NULL,NULL,NULL,NULL,NULL,'2026-10-06 05:15:09','2026-10-06 05:15:10'),(4,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-14 13:11:50','2026-10-14 13:11:50'),(5,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-27 06:16:47','2026-10-27 06:16:47');
/*!40000 ALTER TABLE `tblphotometadata` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotoselection`
--

DROP TABLE IF EXISTS `tblphotoselection`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotoselection` (
  `photoSelectionID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `photo_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photoSelectionID`),
  UNIQUE KEY `uq_selection` (`photo_id`,`customer_id`),
  KEY `idx_selection_event` (`event_id`,`customer_id`),
  KEY `fk_sel_customer` (`customer_id`),
  CONSTRAINT `fk_sel_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_sel_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_sel_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotoselection`
--

LOCK TABLES `tblphotoselection` WRITE;
/*!40000 ALTER TABLE `tblphotoselection` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblphotoselection` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblphotoview`
--

DROP TABLE IF EXISTS `tblphotoview`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblphotoview` (
  `photoViewID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `photo_id` bigint(20) unsigned NOT NULL,
  `gallery_id` bigint(20) unsigned NOT NULL,
  `event_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `session_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`photoViewID`),
  KEY `idx_photo_views_photo` (`photo_id`),
  KEY `idx_photo_views_event` (`event_id`,`created_at`),
  CONSTRAINT `fk_pv_photo` FOREIGN KEY (`photo_id`) REFERENCES `tblphoto` (`photoID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblphotoview`
--

LOCK TABLES `tblphotoview` WRITE;
/*!40000 ALTER TABLE `tblphotoview` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblphotoview` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblportfolioitem`
--

DROP TABLE IF EXISTS `tblportfolioitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblportfolioitem` (
  `portfolioItemID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`portfolioItemID`),
  KEY `idx_portfolio_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblportfolioitem`
--

LOCK TABLES `tblportfolioitem` WRITE;
/*!40000 ALTER TABLE `tblportfolioitem` DISABLE KEYS */;
INSERT INTO `tblportfolioitem` VALUES (1,'Muhurtham & Sacred Garlands at Sri Venkateswara Mandapam','Weddings','Traditional flower garland exchange amidst sacred chanting and blessings.','/images/weddingphoto2.jpg',1,1,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(2,'Sunset Oorvalam & Kasi Yatra Rituals','Weddings','Sacred procession under the evening sky surrounded by joyous elders and family.','/images/weddingphoto1.jpg',1,2,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(3,'Golden Marigold Celebration & Joyous Family Candids','Candid Moments','Heartwarming laughter and genuine smiles adorned with fresh yellow marigold strands.','/images/hero-wedding-garlands.jpg',1,3,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(4,'Crimson Rose Petals & Heritage Serenade','Couples','An editorial overhead perspective framing the bride and groom in delicate floral symmetry.','/images/hero-couple-petals.jpg',1,4,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(5,'Architectural Destination Pre-Wedding Shoot','Couples','Intimate candid romance framed against historic South Indian temple pillars and courtyard.','/images/hero-couple-outdoor.jpg',1,5,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(6,'The Royal Mahabalipuram Wedding Highlight Film','Wedding Films','A 4K cinematic film capturing the rhythmic beats of nadaswaram, sacred thali moments, and evening vows.','/images/weddingphoto2.jpg',1,6,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(7,'Spontaneous Laughter & Saptapadi Joy','Candid Moments','Unposed, heartfelt laughter between cousins and friends following the muhurtham rituals.','/images/weddingphoto3.jfif',1,7,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(8,'Sacred Griha Pravesh & Traditional Vilakku Pooja','Candid Moments','Blessing the new threshold with brass lamps, auspicious prayers, and family togetherness.','/images/house warming.jfif',1,8,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL);
/*!40000 ALTER TABLE `tblportfolioitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblprintorder`
--

DROP TABLE IF EXISTS `tblprintorder`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblprintorder` (
  `printOrderID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `order_item_id` bigint(20) unsigned DEFAULT NULL,
  `proof_id` bigint(20) unsigned DEFAULT NULL,
  `kind` enum('PRINT','FRAME','CANVAS','ALBUM') COLLATE utf8mb4_unicode_ci NOT NULL,
  `photo_id` bigint(20) unsigned DEFAULT NULL,
  `size` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT '1',
  `status` enum('QUEUED','PRINTING','PRINTED','READY','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'QUEUED',
  `assigned_to` bigint(20) unsigned DEFAULT NULL,
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`printOrderID`),
  KEY `idx_print_orders_order` (`order_id`),
  KEY `idx_print_orders_status` (`status`),
  KEY `fk_po_item` (`order_item_id`),
  KEY `fk_po_proof` (`proof_id`),
  CONSTRAINT `fk_po_item` FOREIGN KEY (`order_item_id`) REFERENCES `tblorderitem` (`orderItemID`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `fk_po_order` FOREIGN KEY (`order_id`) REFERENCES `tblorder` (`orderID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_po_proof` FOREIGN KEY (`proof_id`) REFERENCES `tblalbumproof` (`albumProofID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblprintorder`
--

LOCK TABLES `tblprintorder` WRITE;
/*!40000 ALTER TABLE `tblprintorder` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblprintorder` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblproduct`
--

DROP TABLE IF EXISTS `tblproduct`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblproduct` (
  `productID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int(10) unsigned DEFAULT NULL,
  `sku` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `images` json DEFAULT NULL,
  `price` bigint(20) unsigned NOT NULL DEFAULT '0',
  `discount_price` bigint(20) unsigned DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT '0',
  `status` enum('DRAFT','ACTIVE','OUT_OF_STOCK','ARCHIVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `customization_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`productID`),
  UNIQUE KEY `uq_product_sku` (`sku`),
  UNIQUE KEY `uq_product_slug` (`slug`),
  KEY `idx_product_category` (`category_id`),
  CONSTRAINT `fk_product_cat` FOREIGN KEY (`category_id`) REFERENCES `tblproductcategory` (`productCategoryID`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblproduct`
--

LOCK TABLES `tblproduct` WRITE;
/*!40000 ALTER TABLE `tblproduct` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblproduct` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblproductcategory`
--

DROP TABLE IF EXISTS `tblproductcategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblproductcategory` (
  `productCategoryID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`productCategoryID`),
  UNIQUE KEY `uq_pcat_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblproductcategory`
--

LOCK TABLES `tblproductcategory` WRITE;
/*!40000 ALTER TABLE `tblproductcategory` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblproductcategory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblproductvariant`
--

DROP TABLE IF EXISTS `tblproductvariant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblproductvariant` (
  `productVariantID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` bigint(20) unsigned NOT NULL,
  `stock` int(11) NOT NULL DEFAULT '0',
  `options` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`productVariantID`),
  UNIQUE KEY `uq_pvariant_sku` (`sku`),
  KEY `idx_pvariant_product` (`product_id`),
  CONSTRAINT `fk_pvariant_product` FOREIGN KEY (`product_id`) REFERENCES `tblproduct` (`productID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblproductvariant`
--

LOCK TABLES `tblproductvariant` WRITE;
/*!40000 ALTER TABLE `tblproductvariant` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblproductvariant` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblquotation`
--

DROP TABLE IF EXISTS `tblquotation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblquotation` (
  `quotationID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `quotation_no` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `revision` int(10) unsigned NOT NULL DEFAULT '1',
  `revises_id` bigint(20) unsigned DEFAULT NULL,
  `revision_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `booking_id` bigint(20) unsigned NOT NULL,
  `status` enum('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `subtotal` bigint(20) unsigned NOT NULL DEFAULT '0',
  `discount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `tax_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `tax` bigint(20) unsigned NOT NULL DEFAULT '0',
  `total` bigint(20) unsigned NOT NULL DEFAULT '0',
  `advance_amount` bigint(20) unsigned NOT NULL DEFAULT '0',
  `valid_until` date DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `terms` text COLLATE utf8mb4_unicode_ci,
  `pdf_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `emailed_at` datetime DEFAULT NULL,
  `responded_at` datetime DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`quotationID`),
  UNIQUE KEY `uq_quotations_no` (`quotation_no`),
  KEY `idx_quotations_booking` (`booking_id`),
  CONSTRAINT `fk_quotations_booking` FOREIGN KEY (`booking_id`) REFERENCES `tblbooking` (`bookingID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblquotation`
--

LOCK TABLES `tblquotation` WRITE;
/*!40000 ALTER TABLE `tblquotation` DISABLE KEYS */;
INSERT INTO `tblquotation` VALUES (1,'QT-2610-51669',1,NULL,NULL,1,'ACCEPTED',7500000,0,18.00,1350000,8850000,1000000,'2026-10-20',NULL,'Advance is non-refundable within 15 days of the event. Balance is payable on delivery. Travel and stay outside city limits are charged at actuals.',NULL,'2026-10-06 04:48:16',NULL,'2026-10-06 04:48:20',1,'2026-10-06 04:48:14','2026-10-06 04:48:20');
/*!40000 ALTER TABLE `tblquotation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblquotationitem`
--

DROP TABLE IF EXISTS `tblquotationitem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblquotationitem` (
  `quotationItemID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `quotation_id` bigint(20) unsigned NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT '1',
  `unit_price` bigint(20) unsigned NOT NULL,
  `total` bigint(20) unsigned NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`quotationItemID`),
  KEY `idx_qitems_quotation` (`quotation_id`),
  CONSTRAINT `fk_qitems_quotation` FOREIGN KEY (`quotation_id`) REFERENCES `tblquotation` (`quotationID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblquotationitem`
--

LOCK TABLES `tblquotationitem` WRITE;
/*!40000 ALTER TABLE `tblquotationitem` DISABLE KEYS */;
INSERT INTO `tblquotationitem` VALUES (1,1,'Wedding Silver - Birthday',1,7500000,7500000,0,'2026-10-06 04:48:14','2026-10-06 04:48:14');
/*!40000 ALTER TABLE `tblquotationitem` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblrefreshtoken`
--

DROP TABLE IF EXISTS `tblrefreshtoken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblrefreshtoken` (
  `refreshTokenID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `family_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `replaced_by` bigint(20) unsigned DEFAULT NULL,
  `ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`refreshTokenID`),
  UNIQUE KEY `uq_refresh_hash` (`token_hash`),
  KEY `idx_refresh_user` (`user_id`),
  KEY `idx_refresh_family` (`family_id`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=307 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblrefreshtoken`
--

LOCK TABLES `tblrefreshtoken` WRITE;
/*!40000 ALTER TABLE `tblrefreshtoken` DISABLE KEYS */;
INSERT INTO `tblrefreshtoken` VALUES (1,1,'5dc0c411-2cc9-4918-be4c-796ab3cf3322','3c4ac61bafacd67365f64a5fda8ffae2a5a69dfebb34462c1a492bb62323eb3e','2026-10-31 09:47:50','2026-10-06 07:30:44',NULL,'127.0.0.1','test','2026-10-01 09:47:50','2026-10-06 07:30:44'),(2,2,'4f864fd6-a60e-4bda-9c17-164bb7f80e14','da1771301f90cb1ffc3bd7599a8688004a241d4adaa285bdc08475c8cc2775a0','2026-10-31 09:47:50',NULL,NULL,'127.0.0.1','test','2026-10-01 09:47:50','2026-10-01 09:47:50'),(3,3,'8fdffbc1-0384-4906-bf28-dff4620c0294','6a3a8979286cc4e1357ab979011185445c7a27fd550b8c26cecb28fd0860239a','2026-10-31 09:47:51',NULL,NULL,'127.0.0.1','test','2026-10-01 09:47:51','2026-10-01 09:47:51'),(4,4,'50a1d4da-46ec-4369-8131-a505c29f27bd','25171f9c566094c73abd7cbb85e187ed7438137dcc1a2f6505a2e87dc0b80543','2026-10-31 09:47:51',NULL,NULL,'127.0.0.1','test','2026-10-01 09:47:51','2026-10-01 09:47:51'),(5,5,'fb9c79ad-14b7-4e8f-8e31-278a847fc0c7','f6d92d42c6796ae2ff350df42cee808d1d41f69767cbb2492070dcc949638ab1','2026-10-31 09:47:51',NULL,NULL,'127.0.0.1','test','2026-10-01 09:47:51','2026-10-01 09:47:51'),(6,6,'830ba6dc-a031-42b4-ae9d-6ed67c4e82d1','12256df2fa1adeae4bf6531689b5dfd48f9237e8abb0deacb64e3a40dfd6f71e','2026-10-31 09:47:52','2026-10-06 06:46:51',NULL,'127.0.0.1','test','2026-10-01 09:47:52','2026-10-06 06:46:51'),(7,7,'64795e67-98b9-4deb-8ccb-69166705fe10','4bd840d4055deeb264a955c5714039c16ab11c9a22ff28eb9e3ad4ae2731028e','2026-10-31 09:47:52',NULL,NULL,'127.0.0.1','test','2026-10-01 09:47:52','2026-10-01 09:47:52'),(8,1,'916bb67d-0c07-403b-ac00-80ea9748fbb3','f8ae6999ea02d96d6b9f3fdcf31144d8c1f92439839ae02cee0ca319aed1eb77','2026-10-31 09:52:01','2026-10-06 07:30:44',NULL,'127.0.0.1','test','2026-10-01 09:52:01','2026-10-06 07:30:44'),(9,1,'4c66ac80-269c-4298-9364-9f66dbcbebfa','068fdadef90865b7fe5fc2b3d158fe833b50cd90a63253a656ec35a23a0be67b','2026-10-31 09:54:51','2026-10-06 07:30:44',NULL,'::1','node','2026-10-01 09:54:51','2026-10-06 07:30:44'),(10,1,'bab8ec73-11f5-4a8d-92b9-d97d4e0dd202','0fbf8a4c01add20bb713fb49d0be62368fba0fec689277786fec8e0429913409','2026-10-31 09:57:13','2026-10-06 07:30:44',NULL,'::1','node','2026-10-01 09:57:13','2026-10-06 07:30:44'),(11,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','5e1287fdbcc36d1d3524fcbd5df13bbe27bd121e0896c2b88a797fc505f86ef2','2026-10-31 09:58:53','2026-10-01 09:59:15',12,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 09:58:53','2026-10-01 09:59:15'),(12,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','9fef22704d80981c7937f7ee983353f95a507963274ae31ba02cce64351514ba','2026-10-31 09:59:15','2026-10-01 10:00:07',13,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 09:59:15','2026-10-01 10:00:07'),(13,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','d8361d0b9cb6adc48a3c32dedcc5248cce8590e4504dbad61e73a6b70e628435','2026-10-31 10:00:07','2026-10-01 10:00:42',14,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:00:07','2026-10-01 10:00:42'),(14,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','d5e72650a80b72b15a61bead7b7de934cdf889674ac0d0406fe24fa0ce33a248','2026-10-31 10:00:42','2026-10-01 10:04:25',15,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:00:42','2026-10-01 10:04:25'),(15,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','e2e4e9dd4b98cadf72faa5b22b43ac18b8322cb0d9c03d79f4b9553e74ac87ef','2026-10-31 10:04:25','2026-10-01 10:06:23',16,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:04:25','2026-10-01 10:06:23'),(16,1,'b85e604b-74e0-4dca-9f73-5744cbea4faa','983a20de12065e561f2d718d7662581a9ff0608c41639b0a2ecd8075c5a7a05b','2026-10-31 10:06:23','2026-10-01 10:06:23',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:06:23','2026-10-01 10:06:23'),(17,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','73290df816b8ffa8c07fddb01681c2ba48f0e880c116f501b9bfbae1272c7dff','2026-10-31 10:06:55','2026-10-01 10:08:06',18,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:06:55','2026-10-01 10:08:06'),(18,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','d261d2f055d33e203e6def2a6acd2c7aee51092d27416192187e6067910a124b','2026-10-31 10:08:06','2026-10-01 10:09:15',19,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:08:06','2026-10-01 10:09:15'),(19,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','eb0cd92d12c57bef226824fe5c4ae9c04f1c05fe1ee8049fd5068f532d8516b5','2026-10-31 10:09:15','2026-10-01 10:12:33',20,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:09:15','2026-10-01 10:12:33'),(20,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','9930acfc6fb51e24c255a4384e3ddfaec6cf34dadf27937d2736fe409ae07fee','2026-10-31 10:12:33','2026-10-01 10:13:38',21,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:12:33','2026-10-01 10:13:38'),(21,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','1c1255dcf19c631f8f05b9b3cceb8eb5c92698a4f232a2505379b3588b19bd07','2026-10-31 10:13:38','2026-10-01 10:13:55',22,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:13:38','2026-10-01 10:13:55'),(22,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','e243094064f0a92dd0b7d3b66983d5025ea0dfdc9096f3dfcf67448fddd63b4e','2026-10-31 10:13:55','2026-10-01 10:14:13',23,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:13:55','2026-10-01 10:14:13'),(23,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','0edb04b66a2e8cfd01f10c2ee1c3244bfce273cb377b76d2b4e1af110b36f2db','2026-10-31 10:14:13','2026-10-01 10:15:02',24,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:14:13','2026-10-01 10:15:02'),(24,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','eb619400dd64fcae6cbd709a27d12ac7849e39a01965cbe60e226d90aaead607','2026-10-31 10:15:02','2026-10-01 10:15:31',25,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:02','2026-10-01 10:15:31'),(25,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','2d466939beed82200086b10d4832d2a32ca2803b2aaef3075bb3303802ead98c','2026-10-31 10:15:31','2026-10-01 10:15:33',26,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:31','2026-10-01 10:15:33'),(26,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','d661bf7c49e2c946dfff368ff6e495361eb4ad29ea402618272b7e404636d6d7','2026-10-31 10:15:33','2026-10-01 10:15:44',27,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:33','2026-10-01 10:15:44'),(27,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','343247eb88ac0c71a3fec7829db016950306d5216ba1088768ba1e79312325ce','2026-10-31 10:15:44','2026-10-01 10:15:47',28,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:44','2026-10-01 10:15:47'),(28,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','8d5413ad9304b41a95bcd4329d7ff0307c5ee2c6e18b5c95c81a9bd5b7bdd544','2026-10-31 10:15:47','2026-10-01 10:15:55',29,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:47','2026-10-01 10:15:55'),(29,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','e0da97f54d2d56ff1fefac349e0711d369814b9c37218e6b61d28c24674d6dde','2026-10-31 10:15:55','2026-10-01 10:15:57',30,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:55','2026-10-01 10:15:57'),(30,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','8087c85d61b23a43a742ad13dddc36efc9eb5eea4d71d70ec76ccb32c16d9819','2026-10-31 10:15:57','2026-10-01 10:16:06',31,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:15:57','2026-10-01 10:16:06'),(31,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','7cf6f925b70939bf69ee82ba86fde0a2e81304bc95ea5a75c326ee75826617df','2026-10-31 10:16:06','2026-10-01 10:16:11',32,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:16:06','2026-10-01 10:16:11'),(32,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','2fd0c02cbe27226611d9a23738be1809007823fa7d75961bd0aedc8bf0ee0985','2026-10-31 10:16:11','2026-10-01 10:16:17',33,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:16:11','2026-10-01 10:16:17'),(33,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','53846dd17d57bcd24771b4c6f18413c7694ed63faaa0d32b9d40c04935c4993c','2026-10-31 10:16:17','2026-10-01 10:16:21',34,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:16:17','2026-10-01 10:16:21'),(34,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','ec4372aec7c3cc1741610b16e9090e444fb9d8d6975e79ee27fcc8647ba00d36','2026-10-31 10:16:21','2026-10-01 10:16:31',35,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:16:21','2026-10-01 10:16:31'),(35,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','cd98a4876ab705c68acd04c037e7aba9c6af6babda7946c8167368d4d0dd2cd2','2026-10-31 10:16:31','2026-10-01 10:17:05',36,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:16:31','2026-10-01 10:17:05'),(36,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','915214729ccec58620f7ea1db7adb65329fbbd4205be85f34301d98dd07cc2d9','2026-10-31 10:17:05','2026-10-01 10:18:51',37,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:17:05','2026-10-01 10:18:51'),(37,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','eea49234e6ccba04481c5ceb676d6a39a3e26bfe6ad12c527c333e7c11a2a28c','2026-10-31 10:18:51','2026-10-01 10:19:27',38,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:18:51','2026-10-01 10:19:27'),(38,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','9faafbfac1456cd5fe913fe93e3385eeccfff381c23dd47d46cdac245f0299ff','2026-10-31 10:19:27','2026-10-01 10:19:56',39,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:19:27','2026-10-01 10:19:56'),(39,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','f9debbc91ad6d2d3510f4f67391fea6338bdb19a03b6569cf8d86006223e1776','2026-10-31 10:19:56','2026-10-01 10:20:09',40,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:19:56','2026-10-01 10:20:09'),(40,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','9e2de23798e719bade548b0835e5c154724654fede5a72d02942f6b65bcab88c','2026-10-31 10:20:09','2026-10-01 10:20:16',41,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:20:09','2026-10-01 10:20:16'),(41,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','6dce03978aa03dd7eeb0b7c03f404530d4a13794b68fbf357177ad527fc8156d','2026-10-31 10:20:16','2026-10-01 10:20:39',42,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:20:16','2026-10-01 10:20:39'),(42,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','c579cad1e25d7abef2d695f52a2b32f07ad36a22424e5c22c37cabae15407b88','2026-10-31 10:20:39','2026-10-01 10:20:56',43,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:20:39','2026-10-01 10:20:56'),(43,1,'3c41dbd7-b431-46b9-b85e-3c42a75584e4','399db378679e43bebe33dc19496527e8d6299c8edfbeb1dbd9a63d0376184451','2026-10-31 10:20:56','2026-10-01 10:21:14',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:20:56','2026-10-01 10:21:14'),(44,5,'c8e1133b-d288-4f6a-9e3c-4bdb25e4a6e5','2b64b3c89bcf1646a01d93fae2a4f56f35b9d1de8759dbe9e437d3164fdd4087','2026-10-31 10:25:28','2026-10-01 10:25:40',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 10:25:28','2026-10-01 10:25:40'),(45,1,'004fd13b-5886-4922-9b07-bd9267b28add','3892f2d7cb135fc295e6e6e896e581b3ce23f809538585ef322e2e0c59fd0cda','2026-10-31 10:28:18','2026-10-06 07:30:44',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:18','2026-10-06 07:30:44'),(46,2,'751e5bd9-b9c1-4dd1-bc52-f481ebf91c8c','baaf49ac6e6d2d9a78f2f86d182355494b0d88f08f6be73169f4297decc93175','2026-10-31 10:28:39',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-01 10:28:39'),(47,6,'6c52ece2-b6b7-40fd-91d9-14fdfabea91a','b92ea735913d8f5169e37eeadddbc980a2c3d8d6e8a2628baead0bb9571ced7e','2026-10-31 10:28:39','2026-10-06 06:46:51',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-06 06:46:51'),(48,7,'ee349954-5a8f-4ce3-b097-e25f909574a5','b054cc2c292245cab25d3fc978591a1b78f9991889bdfbd87a39749fe0355f1c','2026-10-31 10:28:39',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-01 10:28:39'),(49,5,'7c51623a-7de7-49a3-a7e7-6033342714d6','57726ebebf22c4859a112bb7cb2aa1262bdc85e1d0ebb75a27d9627ff2a833ea','2026-10-31 10:28:39',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-01 10:28:39'),(50,3,'7d769055-40ab-44a9-b8bb-eeb5669a5131','98c415b33f6ff305aeacdb7cb5142ee0bf9b2fee19352ca12606945dc4ec9819','2026-10-31 10:28:39',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-01 10:28:39'),(51,4,'23d54c26-f30f-4830-a4f1-6f63f8cf5a26','3c3618f148ba8d37983e160e52f154880084ef0e97d71dcf3c34f3d7a00bd73f','2026-10-31 10:28:39',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:28:39','2026-10-01 10:28:39'),(52,6,'310ad92d-a30e-4730-8e0b-7dcc705ef6ab','0bd052fd658c09f4366e9078d354c4af950be492752a786ee1169b29f22aa55f','2026-10-31 10:29:18','2026-10-06 06:46:51',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-06 06:46:51'),(53,3,'8b10a23c-4ebc-4a2b-bbff-17143d67fdea','9ecd638d6df4499d48af072e4f71675c9302a4d0f67841f908263ec8644e76b9','2026-10-31 10:29:18',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-01 10:29:18'),(54,5,'db42870b-4c33-4407-ab32-c9f69bf7726b','4112d57dbf51c13c01372b1c766e517eacb84334bd1b5344f010bd0a0f1b9532','2026-10-31 10:29:18',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-01 10:29:18'),(55,4,'0f3b0fc3-1bce-4ead-a9df-84e6f82dd4ab','f46f5ecdf79db52ecd43bba12ba8aabf7f81526c58121da040ee6d80aa6ffe20','2026-10-31 10:29:18',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-01 10:29:18'),(56,2,'35535fc5-7d58-4eed-8a18-3636461342cf','f1663efd7d6e2db6f68290df6c2cab4ca167276edfc4e8d0e6a5b9e173194104','2026-10-31 10:29:18',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-01 10:29:18'),(57,1,'38cdab7b-06b6-4b24-ae7a-4f3aa7e28794','4035cffc6a1ab1c8b4748af9d737129190715dd1ec5df39791fe60331b4b429f','2026-10-31 10:29:18','2026-10-06 07:30:44',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-06 07:30:44'),(58,7,'36e4580d-f8e1-4ae2-8bdd-b3ea2864a426','03f0c1fe157f03c9e83bf38ed2a9037d1193952250050ebf3c1d0df6bdc881ea','2026-10-31 10:29:18',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:18','2026-10-01 10:29:18'),(59,6,'5f251df0-9b64-4f9d-a874-607c3096389f','c25b1c643a485bde765a9d48108a965e21816e53bc7ace3c0076c7c0ac695b95','2026-10-31 10:29:22','2026-10-06 06:46:51',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:22','2026-10-06 06:46:51'),(60,5,'385b0540-5a01-42c3-ba4e-c52b817c9f0c','629cbbb56cf04b6f46a40cff014fbce7d21e764cce0e0a14c61b4a57a3c783ad','2026-10-31 10:29:21',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:21','2026-10-01 10:29:21'),(61,3,'efb909fd-7f14-42a3-837d-60e0f25e0eb6','e81b8794c7746faa8a409f50a4957d5851366db59605e94225d2340c1310e7e4','2026-10-31 10:29:22',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:22','2026-10-01 10:29:22'),(62,4,'da0c75e1-0ba2-4ea6-9db9-f418e399ca7d','52245ad3537e84c1e7b166a2adcbe2cbbde66c8dbf273c93986272948402dc14','2026-10-31 10:29:21',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:21','2026-10-01 10:29:21'),(63,1,'46471fe0-ac61-46ec-9def-46c1a29c7b51','6081d9ec88a980dae7c9ed201a50e8664bc81a8cae6afb84687fc5c337a8c07d','2026-10-31 10:29:22','2026-10-06 07:30:44',NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:22','2026-10-06 07:30:44'),(64,2,'f7810611-ba60-470b-8232-23e1af15cc87','e5c1a97466313eb52664c3548988fd2a04cf76aa835b6032983330808f292281','2026-10-31 10:29:22',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:22','2026-10-01 10:29:22'),(65,7,'99ea7f81-edd8-43c6-b3fa-b074c9b63a80','14e1a460213ae0aaa2b65e1fe04fe9d140fe5d66f34e899efbe6d6b18cefd9b5','2026-10-31 10:29:22',NULL,NULL,'::ffff:127.0.0.1','node','2026-10-01 10:29:22','2026-10-01 10:29:22'),(66,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','889eb4410cb567918564b21baea28adfb8ec017cfda66625475da3e2251ac759','2026-10-31 11:38:45','2026-10-01 11:40:11',67,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:38:45','2026-10-01 11:40:11'),(67,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','1955bf4a0dd248fd2c1d662551846544d4e8bbdd40b2a8e0129c88b1dee5760d','2026-10-31 11:40:11','2026-10-01 11:40:13',68,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:40:11','2026-10-01 11:40:13'),(68,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','13aca9736eb6fb8b0f357da4de415e02b82c34df5cdd9c7d21e9e6e46b033ac6','2026-10-31 11:40:13','2026-10-01 11:40:47',69,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:40:13','2026-10-01 11:40:47'),(69,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','2932f73d98ba075154a9e59ded695b6cdf732debfbe9bae16b5355973ac5760d','2026-10-31 11:40:47','2026-10-01 11:44:22',70,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:40:47','2026-10-01 11:44:22'),(70,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','323fdab29d4b0187c3f57bdd6d57231e0d02ee30bb800c62664676ee2fe619ad','2026-10-31 11:44:22','2026-10-01 11:45:29',71,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:44:22','2026-10-01 11:45:29'),(71,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','031fb1b7a5a273048a2ec9eda4983a2c22ac1a8ef7dfae40c72a85b740316672','2026-10-31 11:45:29','2026-10-01 11:46:32',72,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:45:29','2026-10-01 11:46:32'),(72,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','06025d85cdf4c3958a3429bc104fb47f8af02c7144fd6f106ef644239f48043e','2026-10-31 11:46:32','2026-10-01 11:47:17',73,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:46:32','2026-10-01 11:47:17'),(73,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','1fc64f9a185f3d15f297bea455d363f8b813cb9a719e1dc5289b099d697208cd','2026-10-31 11:47:17','2026-10-01 11:47:58',74,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:47:17','2026-10-01 11:47:58'),(74,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','31d7ad0466e2df48dcf4fb2ec488137db34ceda121ba268316ed0290b55377e3','2026-10-31 11:47:58','2026-10-01 11:48:31',75,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:47:58','2026-10-01 11:48:31'),(75,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','28f8e0fe79d56c9f60327b206bf7988b1b2cc39669554f96c9dafe08de0ba70b','2026-10-31 11:48:31','2026-10-01 11:50:01',76,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:48:31','2026-10-01 11:50:01'),(76,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','f1295dcf2d5862bb72db777d50334742a9299da3a226e26fbae49c450ee7bf9b','2026-10-31 11:50:01','2026-10-01 11:53:45',77,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:50:01','2026-10-01 11:53:45'),(77,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','15758e042dfbfe9f0e37d4ee7eab6ad509be30d670d5f290e20e9e071aad73f9','2026-10-31 11:53:45','2026-10-01 11:53:48',78,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:53:45','2026-10-01 11:53:48'),(78,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','5332a59b4ac149953aced0a7402450a9895b48856918a3febd1a22bd4bd811c1','2026-10-31 11:53:48','2026-10-01 11:53:50',79,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:53:48','2026-10-01 11:53:50'),(79,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','869c4ae59ee774d1d641a0fe4282f1f7574c40acd04f2c5ef0d351849f380cd2','2026-10-31 11:53:50','2026-10-01 11:53:52',80,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:53:50','2026-10-01 11:53:52'),(80,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','3e597dfd6437c95f76dcf8fc6ed026fff0a9e43e05929dd8bd249e02e5b76118','2026-10-31 11:53:52','2026-10-01 11:54:12',81,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:53:52','2026-10-01 11:54:12'),(81,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','bb6e8bdf5025c5eabbd10b3c1de920a220a0a66bde3896f25792512ec3ba8ecc','2026-10-31 11:54:12','2026-10-01 11:54:45',82,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:54:12','2026-10-01 11:54:45'),(82,1,'da42e564-8b64-47c2-bf78-72156dea0d2c','ea580328291e55f8ac27d193bff2347189d91bf975ad2ea75c4a9fa2893432b4','2026-10-31 11:54:45','2026-10-01 11:54:45',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:54:45','2026-10-01 11:54:45'),(83,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','9cd3017ee442d337a79e33f3c4f206c47da6fab47daf99bb8d927e62309fa09e','2026-10-31 11:59:45','2026-10-01 12:07:17',84,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 11:59:45','2026-10-01 12:07:17'),(84,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','ff8bd63db8130946b45aeff365dd3cc63b1e4f1e4573d89a4db8152d5034a849','2026-10-31 12:07:17','2026-10-01 12:08:41',85,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:07:17','2026-10-01 12:08:41'),(85,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','919837dc38bbc8e26836a3b4d1a713dc18f0b08e0b1b971c5ef9401cd8a28058','2026-10-31 12:08:41','2026-10-01 12:09:17',86,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:08:41','2026-10-01 12:09:17'),(86,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','aca35172175d964ad7df78c578fb85600c51ad69e1aca43adbee9aa8f0964b7b','2026-10-31 12:09:17','2026-10-01 12:09:30',87,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:09:17','2026-10-01 12:09:30'),(87,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','1fdb269eb47c8f0da4ebea03598cc683b65084dfe640beef7e4bea3e6e330ef2','2026-10-31 12:09:30','2026-10-01 12:09:41',88,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:09:30','2026-10-01 12:09:41'),(88,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','d2f55b469be1fd04260a4afdfcc1cd3842605b87e33eeec01360f41c2c5963f1','2026-10-31 12:09:41','2026-10-01 12:11:47',89,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:09:41','2026-10-01 12:11:47'),(89,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','f88279c92940a51d0ba19a28c8d78a5a372c8b331efb5a81ec9c22f0b97363b8','2026-10-31 12:11:47','2026-10-01 12:11:54',90,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:11:47','2026-10-01 12:11:54'),(90,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','92d3f9e99db5d8547398166e5eb92b17cda8ca974db1c69d8055a062c8b18dea','2026-10-31 12:11:54','2026-10-01 12:12:12',91,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:11:54','2026-10-01 12:12:12'),(91,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','add357d438863de304e042b4df72d7e71fed46e65537b49a29ff80e7c9c8adb9','2026-10-31 12:12:12','2026-10-01 12:12:19',92,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:12:12','2026-10-01 12:12:19'),(92,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','9f6063d9dc03c35f7e77d3395431b42c1fb41e516fccdc71f1b9fd7b02330f01','2026-10-31 12:12:19','2026-10-01 12:12:37',93,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:12:19','2026-10-01 12:12:37'),(93,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','479b9e5a0828db364c114c7a2b4428862078b2f8cc9396448d9f484f8265742e','2026-10-31 12:12:37','2026-10-01 12:13:27',94,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:12:37','2026-10-01 12:13:27'),(94,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','45c65b8d6da615d7c59b4988ecbaa7c1e2834b7adaa3c932c7dc6658b735a037','2026-10-31 12:13:27','2026-10-01 12:14:01',95,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:13:27','2026-10-01 12:14:01'),(95,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','8f15bbabef4e4a0183a892d8be8edc81507e29eefd366a5c4322036ca32b2df0','2026-10-31 12:14:01','2026-10-01 12:14:06',96,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:14:01','2026-10-01 12:14:06'),(96,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','374d98c65893013e65046f7663e42d83917705c9af8c58e8c9f5c6db34c745ea','2026-10-31 12:14:06','2026-10-01 12:14:24',97,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:14:06','2026-10-01 12:14:24'),(97,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','0e2e1c0df90f049b51e5d0c0b36e2b6a235c91769b49f5cbbffc3c54d424f45b','2026-10-31 12:14:24','2026-10-01 12:14:33',98,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:14:24','2026-10-01 12:14:33'),(98,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','4e7ed6980c3500792ff8033ad827034b01da3b6bbffdce8a9131448589ad7bb0','2026-10-31 12:14:33','2026-10-01 12:15:16',99,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:14:33','2026-10-01 12:15:16'),(99,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','4638f991a4c859e06d23ba87d2fdeb415a94d0c3fd0936c21abceecbb495078b','2026-10-31 12:15:16','2026-10-01 12:15:33',100,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:15:16','2026-10-01 12:15:33'),(100,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','9a3171f4f149e6c3f0dcc946d733ccace92bd6d50fd33d87cdd83adbc371c445','2026-10-31 12:15:33','2026-10-01 12:15:39',101,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:15:33','2026-10-01 12:15:39'),(101,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','52c8df072a8efd9bd44ac3c926c9f09d38bc29f1377eb1e1d1b04540e6116888','2026-10-31 12:15:39','2026-10-01 12:16:06',102,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:15:39','2026-10-01 12:16:06'),(102,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','8a5b15019653f4a849ed574ce90f79e949ee65b32dac071959cb47cc2a53a6b3','2026-10-31 12:16:06','2026-10-01 12:16:35',103,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:16:06','2026-10-01 12:16:35'),(103,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','2b0ea436b59d7d27bd73cb86bbdb0e1612fc8737fda799be3989635fa863cde9','2026-10-31 12:16:35','2026-10-01 12:16:40',104,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:16:35','2026-10-01 12:16:40'),(104,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','e7382a11361cacedd277585874ce8d190822e68d07cd991d98f0b797b4c73df3','2026-10-31 12:16:40','2026-10-01 15:28:46',105,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 12:16:40','2026-10-01 15:28:46'),(105,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','06c4cc3a245e0fb474d6a9b39eb844cb6c77f17b014ed57b7be7b90962ca6ff9','2026-10-31 15:28:46','2026-10-01 15:40:47',106,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:28:46','2026-10-01 15:40:47'),(106,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','6d670be1c7232428f64d330bdc34ef1c2765e6a65ba733dd1cc67c94cf2e83dc','2026-10-31 15:40:47','2026-10-01 15:47:02',107,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:40:47','2026-10-01 15:47:02'),(107,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','e5292011f2bbd710e4c9e76f30fa507b449404aa6708cfd987028cbf578dffe8','2026-10-31 15:47:02','2026-10-01 15:47:11',108,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:47:02','2026-10-01 15:47:11'),(108,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','2acea4d486e4fa4d0e32cb7ce39d46b506261866e103cc6c5e156615a157927e','2026-10-31 15:47:11','2026-10-01 15:49:09',109,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:47:11','2026-10-01 15:49:09'),(109,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','d18f657d164800bebe56cb7080d962168db99f9b58411a3c4a3daae7bd6dcbd4','2026-10-31 15:49:09','2026-10-01 15:49:38',110,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:49:09','2026-10-01 15:49:38'),(110,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','ef5d13df6168ebb97d8a7db933ab4051f1b589581183e2852bcf1307c010fa75','2026-10-31 15:49:38','2026-10-01 15:49:56',111,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:49:38','2026-10-01 15:49:56'),(111,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','cf27178645c7743871e3bc2d75a66fc78746c5831c690a7806528c3d96569c01','2026-10-31 15:49:56','2026-10-01 15:51:55',112,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:49:56','2026-10-01 15:51:55'),(112,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','a37b00cc064e1cd7fe2e29e4d6f536d94ee30299d31c7bb4a009d88725f4fbe6','2026-10-31 15:51:55','2026-10-01 16:03:31',113,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 15:51:55','2026-10-01 16:03:31'),(113,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','aa74bd4ea6d6110802bfda3de073ac6b1b2382a10dfc24943e53e5bb0624339d','2026-10-31 16:03:31','2026-10-01 16:05:14',114,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:03:31','2026-10-01 16:05:14'),(114,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','8a568487c52f386c67224a24e24cda4d1369f12e5e08f9f3aebe84c07ff9a99e','2026-10-31 16:05:14','2026-10-01 16:10:41',115,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:05:14','2026-10-01 16:10:41'),(115,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','f758ddb93076d74cd178211ebc0e45a34cf76fe34fec3fce161a618963a63404','2026-10-31 16:10:41','2026-10-01 16:11:03',116,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:10:41','2026-10-01 16:11:03'),(116,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','a5c713e16de67dcff82dfa86f41181a575e47b9101e42c32c3dc4c1f5a08dc46','2026-10-31 16:11:03','2026-10-01 16:11:09',117,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:11:03','2026-10-01 16:11:09'),(117,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','1d24a3b5a0db06f2f4351b3c7e18be865b6799d9bd31c3c576f0348b53b0aebd','2026-10-31 16:11:09','2026-10-01 16:11:56',118,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:11:09','2026-10-01 16:11:56'),(118,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','75ef2d7d3e7b80e325dacf48a7496db74028164294219316487887f4a2bfff3a','2026-10-31 16:11:56','2026-10-01 16:12:20',119,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:11:56','2026-10-01 16:12:20'),(119,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','025d06ba83ebdab4f676f6c888e1080a11447c0cb1731ba0fda2648ff369acf5','2026-10-31 16:12:20','2026-10-01 16:12:39',120,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:12:20','2026-10-01 16:12:39'),(120,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','d32ed690ba042f6178c0ab4cf8cf63858dbc93de96d2b1de6d8549280c5bdcfd','2026-10-31 16:12:39','2026-10-01 16:14:00',121,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:12:39','2026-10-01 16:14:00'),(121,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','831583c8d6c17f7ecdf4f9172799c585ec7cc772bf1faa045ad1fbd3698ac125','2026-10-31 16:14:00','2026-10-01 16:14:03',122,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:14:00','2026-10-01 16:14:03'),(122,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','c12898a57d4d56092019795b8d6cd1d8c48b9da2e92ddd40bd8ccda326d258da','2026-10-31 16:14:03','2026-10-01 16:14:42',123,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:14:03','2026-10-01 16:14:42'),(123,1,'0203d37e-b4c5-44ef-9b1a-ece6e5e501cc','8632e926d4ef45f048c573e7804728c856a6638563ffae379e709b26f0847642','2026-10-31 16:14:42','2026-10-01 16:14:47',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:14:42','2026-10-01 16:14:47'),(124,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','169bb1ef5f7db7d725a756800d162a1e7491d697f1629de092545f75dcfa334f','2026-10-31 16:36:36','2026-10-01 16:48:37',125,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:36:36','2026-10-01 16:48:37'),(125,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','fffe39e6aa3ab8d10379f53b93940502791a92cc1413ec5825228ade6c685d36','2026-10-31 16:48:37','2026-10-05 07:40:30',129,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-01 16:48:37','2026-10-05 07:40:30'),(126,1,'12f0a57c-da38-43e0-8aaa-d20f954c9c64','b385a93e60727382bf73b54816fa909aaaa597e1bded6d19f646c38902fa7389','2026-11-04 07:25:49','2026-10-05 07:26:07',127,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 07:25:49','2026-10-05 07:26:07'),(127,1,'12f0a57c-da38-43e0-8aaa-d20f954c9c64','6b6b44912feaee8e205528ec9f926cd0d72bee8714c7c2e64d405e80070518ca','2026-11-04 07:26:07','2026-10-05 07:26:37',128,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 07:26:07','2026-10-05 07:26:37'),(128,1,'12f0a57c-da38-43e0-8aaa-d20f954c9c64','d1e128ab3581f34d5fb60416485b47ca259d8efacf9448f1a9a9a14d1308b9c6','2026-11-04 07:26:37','2026-10-06 07:30:44',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 07:26:37','2026-10-06 07:30:44'),(129,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','130c39370ba130c4f30cebc85b29d097513d4dce14e150f6a038452555e4f95d','2026-11-04 07:40:30','2026-10-05 08:16:50',130,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 07:40:30','2026-10-05 08:16:50'),(130,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','b3a0451786d52b182158cb85687be7e764f7d06ac6cef8ab3ee436ebf5c73ac6','2026-11-04 08:16:50','2026-10-05 09:21:24',131,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 08:16:50','2026-10-05 09:21:24'),(131,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','0f1cc9ae174326d496114a43ab238930c1304458f0f327953664393e56fe88f3','2026-11-04 09:21:24','2026-10-05 09:22:30',132,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:21:24','2026-10-05 09:22:30'),(132,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','613c593ff5f8fa1c1c5ec5ea450ff9612bbbe5bc3a170ad27888a3a037dce188','2026-11-04 09:22:30','2026-10-05 09:22:47',133,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:22:30','2026-10-05 09:22:47'),(133,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','38c2e997f4ad61d3ec808a8ab236274c25cb5e998017251d55ac2095b7c9052a','2026-11-04 09:22:47','2026-10-05 09:23:42',134,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:22:47','2026-10-05 09:23:42'),(134,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','14c8f7cbbd3a1b6e9e4ecdb664cb0799419b14de3723149da6cbc18d1fe669f4','2026-11-04 09:23:42','2026-10-05 09:25:01',135,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:23:42','2026-10-05 09:25:01'),(135,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','950ef0cc01e64380fbc631ed3b129b2b5081e48491d4ea6cac8d8774effff2ed','2026-11-04 09:25:01','2026-10-05 09:26:32',136,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:25:01','2026-10-05 09:26:32'),(136,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','026559acb95d162e75e35120e495183ceff45e8443588105300f999bba076ae0','2026-11-04 09:26:32','2026-10-05 09:26:45',137,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:26:32','2026-10-05 09:26:45'),(137,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','adc2b9bf02d19cd49547bd277f4a11aa0829b5340f138a99f28eabe1dd362a66','2026-11-04 09:26:45','2026-10-05 09:27:34',138,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:26:45','2026-10-05 09:27:34'),(138,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','a8c8d59093a53168102f3d1dc3cc9bd071a396a3eaeae5082607416f785c6c42','2026-11-04 09:27:34','2026-10-05 09:28:07',139,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:27:34','2026-10-05 09:28:07'),(139,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','aef9feaaeb06cd3911aece63c9b50c61b58fe6ad5a1c689f7dfad3934bd5ddd7','2026-11-04 09:28:07','2026-10-05 09:29:34',140,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:28:07','2026-10-05 09:29:34'),(140,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','35ccaf187c05c1becda3f10cf17e37fcccad00309c9bafa11d389287235abe96','2026-11-04 09:29:34','2026-10-05 09:29:48',141,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:29:34','2026-10-05 09:29:48'),(141,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','541a2d90042c55ff0d84117fa0fd1a826d998963600978976a7c67534f050ac5','2026-11-04 09:29:48','2026-10-05 09:30:41',142,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:29:48','2026-10-05 09:30:41'),(142,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','76a8bd692d1278ca24858aea9ec6f989efe14574817d72857848248f43f02c45','2026-11-04 09:30:41','2026-10-05 09:30:43',143,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:30:41','2026-10-05 09:30:43'),(143,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','3b46adf7b10af3d26b9f2775e5e093b1715c17b9534dfcdb4dad46cd6fefec5e','2026-11-04 09:30:43','2026-10-05 09:30:53',144,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:30:43','2026-10-05 09:30:53'),(144,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','6f4704224ce21b320688e96c4083c06fef1ff8c598e255e4c893d09a3259f51d','2026-11-04 09:30:53','2026-10-05 09:42:54',145,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:30:53','2026-10-05 09:42:54'),(145,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','cddb65424f1c26a069344a0f11feef8966077bd3c82287693134bd5c4ad8aea1','2026-11-04 09:42:54','2026-10-05 09:48:35',146,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:42:54','2026-10-05 09:48:35'),(146,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','6893403fabf956b3adcba5b6d613c361bcda810c0e69bb78bb74844b05ef68fc','2026-11-04 09:48:35','2026-10-05 09:48:37',147,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:48:35','2026-10-05 09:48:37'),(147,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','48cfb21197a3c6f83e0dd3875eddb74cd815b50588a4cdd623246f5ce569fc66','2026-11-04 09:48:37','2026-10-05 09:48:41',148,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:48:37','2026-10-05 09:48:41'),(148,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','f8dfc279708e8081c4d6fdc241e4213874693f8452621878623af403f0da7fbc','2026-11-04 09:48:41','2026-10-05 09:48:42',149,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:48:41','2026-10-05 09:48:42'),(149,1,'4c4c7976-a003-4e54-bb47-d3a11ed9eaf2','ec1ad479dcba6fe56f661e9d94e306160275b0de35dc2f4cfeac4bc12432331a','2026-11-04 09:48:42','2026-10-05 09:48:46',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-05 09:48:42','2026-10-05 09:48:46'),(150,1,'6746b18a-f964-4c59-8961-08c5c5a78936','1a04803679bbd2af4cf3811babe1ede4294f6ee92bfbe09e872bc3e6ab96d66c','2026-11-05 04:46:00','2026-10-06 04:46:05',151,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:46:00','2026-10-06 04:46:05'),(151,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e837c8df1b2e81fddc946776df8029f25f2826a2db90bf091d4a940e86ab6913','2026-11-05 04:46:05','2026-10-06 04:52:02',152,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:46:05','2026-10-06 04:52:02'),(152,1,'6746b18a-f964-4c59-8961-08c5c5a78936','269117c67a61359d0972549db0b533f3260969d8d4c6715c84db22ae6e44171e','2026-11-05 04:52:02','2026-10-06 04:55:19',153,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:52:02','2026-10-06 04:55:19'),(153,1,'6746b18a-f964-4c59-8961-08c5c5a78936','16e36677dc1a5ca9943f251445d4ba289c639bac6867889cec6e44b4ccee5869','2026-11-05 04:55:19','2026-10-06 04:56:06',154,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:55:19','2026-10-06 04:56:06'),(154,1,'6746b18a-f964-4c59-8961-08c5c5a78936','69d508e370c111736632666eba01ddce84a83f8c0852bd320e3a0387adb28406','2026-11-05 04:56:06','2026-10-06 05:00:07',155,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 04:56:06','2026-10-06 05:00:07'),(155,1,'6746b18a-f964-4c59-8961-08c5c5a78936','b82e40568d65f0fa3c1c05832807f2b0085a544341329ab2c83b7a0200ccdc22','2026-11-05 05:00:07','2026-10-06 05:00:24',156,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:00:07','2026-10-06 05:00:24'),(156,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e85072c9290f3282419538272ce69983bac237a20fdabed4ce1f8e25203818d2','2026-11-05 05:00:24','2026-10-06 05:00:43',157,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:00:24','2026-10-06 05:00:43'),(157,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c6eb82094b4e5fd80614b2ef00210d5a7c2d375c4dd9ee8a4bb88e67a31332dc','2026-11-05 05:00:43','2026-10-06 05:01:22',158,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:00:43','2026-10-06 05:01:22'),(158,1,'6746b18a-f964-4c59-8961-08c5c5a78936','17a337452d62503bb583de474292a4fc4adbe15322ce0cef865058b50bbdd419','2026-11-05 05:01:22','2026-10-06 05:02:02',159,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:01:22','2026-10-06 05:02:02'),(159,1,'6746b18a-f964-4c59-8961-08c5c5a78936','1fb79d8b1c4d4408d025f9fb84fdecf8c454e508626fa8f62532361f3032c652','2026-11-05 05:02:02','2026-10-06 05:02:20',160,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:02:02','2026-10-06 05:02:20'),(160,1,'6746b18a-f964-4c59-8961-08c5c5a78936','bf3a8583f7e213a3c96e72feac05c961ee8a16c81419ef3b136f16717072f7a5','2026-11-05 05:02:20','2026-10-06 05:02:23',161,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:02:20','2026-10-06 05:02:23'),(161,1,'6746b18a-f964-4c59-8961-08c5c5a78936','56dd2431a9bc7b1429dbdf984d3e08ecd06dccdd2ef082ff12992934c197b055','2026-11-05 05:02:23','2026-10-06 05:03:27',162,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:02:23','2026-10-06 05:03:27'),(162,1,'6746b18a-f964-4c59-8961-08c5c5a78936','20e2d46c84b8cd56f3d79829c387a2bcf95c972e5b1d48bb6a83f343eb48965c','2026-11-05 05:03:27','2026-10-06 05:04:02',163,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:03:27','2026-10-06 05:04:02'),(163,1,'6746b18a-f964-4c59-8961-08c5c5a78936','9ad7ca447acc54c9905fb0415cc0a3387cb0f61bb48b115295bd2e7443552271','2026-11-05 05:04:02','2026-10-06 05:07:43',164,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:04:02','2026-10-06 05:07:43'),(164,1,'6746b18a-f964-4c59-8961-08c5c5a78936','0472ace4a6395a3ebf07cbadb3ee0ccb51b454a9dc665f3dd485785041c708c4','2026-11-05 05:07:43','2026-10-06 05:07:56',165,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:07:43','2026-10-06 05:07:56'),(165,1,'6746b18a-f964-4c59-8961-08c5c5a78936','bbed814120229bb5ffaef1de6ad9ff7f838b7b98e8f5d03d646913414d5b02e2','2026-11-05 05:07:56','2026-10-06 05:10:38',166,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:07:56','2026-10-06 05:10:38'),(166,1,'6746b18a-f964-4c59-8961-08c5c5a78936','7f7619745bb3a25158e09d510059ff84fedbb185a95d2665dddf7240b5b7cf98','2026-11-05 05:10:38','2026-10-06 05:10:49',167,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:10:38','2026-10-06 05:10:49'),(167,1,'6746b18a-f964-4c59-8961-08c5c5a78936','b659232f7f40742d69909f1b9a5b75b01056d3b9e607ce056964948e2193d4a5','2026-11-05 05:10:49','2026-10-06 05:22:50',168,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:10:49','2026-10-06 05:22:50'),(168,1,'6746b18a-f964-4c59-8961-08c5c5a78936','b1e8269e5da0a19bfcf938f0f6c694646a4d1536784e685fc6c258c60e6a62a0','2026-11-05 05:22:50','2026-10-06 05:34:50',169,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:22:50','2026-10-06 05:34:50'),(169,1,'6746b18a-f964-4c59-8961-08c5c5a78936','422e8cf3979bbfa111d83ddf1c87b9fb90969f22f51695203566096eabb9606d','2026-11-05 05:34:50','2026-10-06 05:37:40',170,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:34:50','2026-10-06 05:37:40'),(170,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e2de0cd31c8d95c975cc52bb9d8b4d6168f90f17972ef40fb05810b07d4adb2a','2026-11-05 05:37:40','2026-10-06 05:38:18',171,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:37:40','2026-10-06 05:38:18'),(171,1,'6746b18a-f964-4c59-8961-08c5c5a78936','f7dfcca39b99f2cc567d97fc6f13f23de81b2fba8162108ac345789d0172966a','2026-11-05 05:38:18','2026-10-06 05:40:30',172,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:38:18','2026-10-06 05:40:30'),(172,1,'6746b18a-f964-4c59-8961-08c5c5a78936','b1b5bd5e2fac6a53dc8923133e9f94c3e27686465c8d374fa39f4f1a504ca551','2026-11-05 05:40:30','2026-10-06 05:52:30',173,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:40:30','2026-10-06 05:52:30'),(173,1,'6746b18a-f964-4c59-8961-08c5c5a78936','d24d4761c17f41962f903f6b77866941755f2a8048ef78cd07967bc2bd3522d6','2026-11-05 05:52:30','2026-10-06 06:04:30',174,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 05:52:30','2026-10-06 06:04:30'),(174,1,'6746b18a-f964-4c59-8961-08c5c5a78936','a4b7f9854dbefdb747e7aa70617516d8e4d0f725ac2f3bff3852ed0a5d54e8fb','2026-11-05 06:04:30','2026-10-06 06:16:27',175,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:04:30','2026-10-06 06:16:27'),(175,1,'6746b18a-f964-4c59-8961-08c5c5a78936','f2ac66cde697281e2ddfb0bdaf165f883aaefd926f4d08d56f09fa1dd95d6d25','2026-11-05 06:16:27','2026-10-06 06:23:18',176,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:16:27','2026-10-06 06:23:18'),(176,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c9c0e1535f6d33a879975bf6ea5d512f29d9e4962cdc4ced410c26cc62fd069e','2026-11-05 06:23:18','2026-10-06 06:23:20',177,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:23:18','2026-10-06 06:23:20'),(177,1,'6746b18a-f964-4c59-8961-08c5c5a78936','fe404c2bd4db5eea08ee490480f74542c55b5ccd1bac1599d6ec5c4730dc9a1c','2026-11-05 06:23:20','2026-10-06 06:29:14',178,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:23:20','2026-10-06 06:29:14'),(178,1,'6746b18a-f964-4c59-8961-08c5c5a78936','23b042477d043d5cf1eb970390db114afdc7a18c7a7062b10464d828de2cde22','2026-11-05 06:29:14','2026-10-06 06:33:29',179,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:29:14','2026-10-06 06:33:29'),(179,1,'6746b18a-f964-4c59-8961-08c5c5a78936','09bb0fefead35285369485f0e2cf610f877c46aea30a26634c16ca91c8821dea','2026-11-05 06:33:29','2026-10-06 06:33:44',180,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:33:29','2026-10-06 06:33:44'),(180,1,'6746b18a-f964-4c59-8961-08c5c5a78936','1b0c3df12b996bcb419df6061ba60c47b1594ee264ef3f22c69ccb2f17455f83','2026-11-05 06:33:44','2026-10-06 06:34:19',181,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:33:44','2026-10-06 06:34:19'),(181,1,'6746b18a-f964-4c59-8961-08c5c5a78936','d23ad00ae286b1cc1982c9b84a7c57810e25749cd83b277ec75d0f0f3b125d68','2026-11-05 06:34:19','2026-10-06 06:34:23',182,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:34:19','2026-10-06 06:34:23'),(182,1,'6746b18a-f964-4c59-8961-08c5c5a78936','a544b509c930f71ddd2854f3d497ecc5d81378a7a186a676d81b8d1c1318bd25','2026-11-05 06:34:23','2026-10-06 06:34:29',183,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:34:23','2026-10-06 06:34:29'),(183,1,'6746b18a-f964-4c59-8961-08c5c5a78936','d64094bf78a0b11a1e677db42afac36c1635cada76a51ee9c0f1eae87bc4a188','2026-11-05 06:34:29','2026-10-06 06:34:31',184,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:34:29','2026-10-06 06:34:31'),(184,1,'6746b18a-f964-4c59-8961-08c5c5a78936','dbc1ac871625f068c8e39e9c18909c639edbd405b1b4092586760e55735e186e','2026-11-05 06:34:31','2026-10-06 06:34:33',185,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:34:31','2026-10-06 06:34:33'),(185,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c7aeacb022f2576e809a080d70616906d26470db266238b222726dcc808d6397','2026-11-05 06:34:33','2026-10-06 06:38:54',186,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:34:33','2026-10-06 06:38:54'),(186,1,'6746b18a-f964-4c59-8961-08c5c5a78936','77105d7ecb4f0f4ecfe554d294272eeeddbf8b1df4e6cfe4e78908ce6015eef2','2026-11-05 06:38:54','2026-10-06 06:40:46',187,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:38:54','2026-10-06 06:40:46'),(187,1,'6746b18a-f964-4c59-8961-08c5c5a78936','45782b8e36e298fe74aa453601acc0e6f3a0855c97be04befc2ee36fbddae654','2026-11-05 06:40:46','2026-10-06 06:42:49',188,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:40:46','2026-10-06 06:42:49'),(188,1,'6746b18a-f964-4c59-8961-08c5c5a78936','4c7bc58057bebc883a2543b77c9766b27ae60433bdb9ff690bd93337d7b46b72','2026-11-05 06:42:49','2026-10-06 06:44:06',189,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:42:49','2026-10-06 06:44:06'),(189,1,'6746b18a-f964-4c59-8961-08c5c5a78936','dd35d0dd881f7cfd89993af10f76fd607c82be02732b82be1a241f1054732a45','2026-11-05 06:44:06','2026-10-06 06:44:46',190,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:44:06','2026-10-06 06:44:46'),(190,1,'6746b18a-f964-4c59-8961-08c5c5a78936','0d8a84993d8c1e08c712ecad081213d1374246cd245d0488fca5ff96699b3d47','2026-11-05 06:44:46','2026-10-06 06:47:55',191,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:44:46','2026-10-06 06:47:55'),(191,1,'6746b18a-f964-4c59-8961-08c5c5a78936','b21cc5cb7bc9d4242daa65d780a0f31661c22632824be11bd301fc8d2e492c34','2026-11-05 06:47:55','2026-10-06 06:49:28',192,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:47:55','2026-10-06 06:49:28'),(192,1,'6746b18a-f964-4c59-8961-08c5c5a78936','3774128f1483f366a671fb95572c3007c76f0451eda7c4a3bda38008f32d7567','2026-11-05 06:49:28','2026-10-06 06:50:27',193,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:49:28','2026-10-06 06:50:27'),(193,1,'6746b18a-f964-4c59-8961-08c5c5a78936','5e423f2b7fd1677d54a1cd7699600772a5e5a3cd8440ce850f3413194f053dee','2026-11-05 06:50:27','2026-10-06 06:53:12',194,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:50:27','2026-10-06 06:53:12'),(194,1,'6746b18a-f964-4c59-8961-08c5c5a78936','2e1787929b82dbde3529be37bbfa914781fbab71193fabb35066ff0d7cee0f4c','2026-11-05 06:53:12','2026-10-06 06:56:15',195,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:53:12','2026-10-06 06:56:15'),(195,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c8712b26865ffa8cafef7e480d2d85d638f8953afddc27602226d46875b95dd6','2026-11-05 06:56:15','2026-10-06 06:59:08',196,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:56:15','2026-10-06 06:59:08'),(196,1,'6746b18a-f964-4c59-8961-08c5c5a78936','f97bf6b705b4f8d99268ea618aff64c5ceabcc33f2ef1e25b499df909a8fda9e','2026-11-05 06:59:08','2026-10-06 07:02:15',197,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 06:59:08','2026-10-06 07:02:15'),(197,1,'6746b18a-f964-4c59-8961-08c5c5a78936','62f41b5f6482c82f4eb6e6073ac363a3bee81adde0cada10729bc7b3c02c9756','2026-11-05 07:02:15','2026-10-06 07:02:17',198,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:02:15','2026-10-06 07:02:17'),(198,1,'6746b18a-f964-4c59-8961-08c5c5a78936','37d1f062924a2a15b26d86fbe319e3e093da1c5809c7fb8c11c201cf4a6f0aac','2026-11-05 07:02:17','2026-10-06 07:03:34',199,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:02:17','2026-10-06 07:03:34'),(199,1,'6746b18a-f964-4c59-8961-08c5c5a78936','6b424a0d0cf777b5579cdab9a68a0485d52e86c90d1fa1bf49ef0c01a1490243','2026-11-05 07:03:34','2026-10-06 07:05:25',200,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:03:34','2026-10-06 07:05:25'),(200,1,'6746b18a-f964-4c59-8961-08c5c5a78936','622a9cdcf82e6abeb2402f466894eba5eee8f5d0d875289b17e04289e1845344','2026-11-05 07:05:25','2026-10-06 07:05:27',201,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:05:25','2026-10-06 07:05:27'),(201,1,'6746b18a-f964-4c59-8961-08c5c5a78936','6750dcbaee30fedb52c3881c50095ddf0a4b1ddcd684f83fe073b4d593b87a04','2026-11-05 07:05:27','2026-10-06 07:05:59',202,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:05:27','2026-10-06 07:05:59'),(202,1,'6746b18a-f964-4c59-8961-08c5c5a78936','ea56eaf85c4cdf5a55a48e3b879cc7bfcd6080e6639c02e5c0bbc0b410482c54','2026-11-05 07:05:59','2026-10-06 07:07:02',203,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:05:59','2026-10-06 07:07:02'),(203,1,'6746b18a-f964-4c59-8961-08c5c5a78936','8ee9a60f4458cac8c5a68704ca206fa224ea3e3dde1f9d5b96d4ae778d089eb6','2026-11-05 07:07:02','2026-10-06 07:08:29',204,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:07:02','2026-10-06 07:08:29'),(204,1,'6746b18a-f964-4c59-8961-08c5c5a78936','00d748cda2783c3ce453b1b40a6ebd08609424bb9f2db65387858e76e70920a2','2026-11-05 07:08:29','2026-10-06 07:09:51',205,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:08:29','2026-10-06 07:09:51'),(205,1,'6746b18a-f964-4c59-8961-08c5c5a78936','8c0c48cbe225a64627fda51f5b5d223f1d0962228e7a46518cc99dd9d02c5506','2026-11-05 07:09:51','2026-10-06 07:15:28',206,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:09:51','2026-10-06 07:15:28'),(206,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e7a24e0e26512c7c6770ae315bd45d53782849fdca8cb3927284f5d43cc5eaba','2026-11-05 07:15:28','2026-10-06 07:17:31',207,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:15:28','2026-10-06 07:17:31'),(207,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e2023da13df9ed6249718f951719671db6beb374a403312431213c6180b91278','2026-11-05 07:17:31','2026-10-06 07:18:31',208,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:17:31','2026-10-06 07:18:31'),(208,1,'6746b18a-f964-4c59-8961-08c5c5a78936','d4dbfa4e8cb57404526dfd88a5ae85e6e9b55bfb204109bcaf70bd5627bf8b80','2026-11-05 07:18:31','2026-10-06 07:18:36',209,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:18:31','2026-10-06 07:18:36'),(209,1,'6746b18a-f964-4c59-8961-08c5c5a78936','0dfed35d45360f3b1aed952c2ef5fededac56cb487d0c1bc3e08ca20b54c98ec','2026-11-05 07:18:36','2026-10-06 07:19:17',210,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:18:36','2026-10-06 07:19:17'),(210,1,'6746b18a-f964-4c59-8961-08c5c5a78936','72da6b2fa4725ffb25d2ae6a16bfd6cbd53c71d432b390ed7d1989f1a8ce27ea','2026-11-05 07:19:17','2026-10-06 07:19:22',211,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:19:17','2026-10-06 07:19:22'),(211,1,'6746b18a-f964-4c59-8961-08c5c5a78936','9e4b21398c212371a5b7b719d40ab96bcf5b49cf88c76f81f5556526713ddf16','2026-11-05 07:19:22','2026-10-06 07:19:25',212,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:19:22','2026-10-06 07:19:25'),(212,1,'6746b18a-f964-4c59-8961-08c5c5a78936','74b0f06b2bfed19d3bad2dfe4727e18a989631c4cbd94dee908756e17eb5e7e1','2026-11-05 07:19:25','2026-10-06 07:20:05',213,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:19:25','2026-10-06 07:20:05'),(213,1,'6746b18a-f964-4c59-8961-08c5c5a78936','0b1079014c4e57646545525a9de2970b5ec6e8876e93189e898b2c617891f9da','2026-11-05 07:20:05','2026-10-06 07:20:12',214,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:20:05','2026-10-06 07:20:12'),(214,1,'6746b18a-f964-4c59-8961-08c5c5a78936','073c92b488381eb7d257d026e53a79ef65f4fb356e1dc50cf4f51eef3e68ce9d','2026-11-05 07:20:12','2026-10-06 07:22:03',215,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:20:12','2026-10-06 07:22:03'),(215,1,'6746b18a-f964-4c59-8961-08c5c5a78936','e6c701e9411d4351026f47246efa55f29e6bec3aeebe7b839dd69120449105b3','2026-11-05 07:22:03','2026-10-06 07:23:54',216,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:22:03','2026-10-06 07:23:54'),(216,1,'6746b18a-f964-4c59-8961-08c5c5a78936','5bce954f74bd63d5a6245ffc75ccb13d2978a3eb59ea2dddbbbdbc14325bb37f','2026-11-05 07:23:54','2026-10-06 07:27:21',217,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:23:54','2026-10-06 07:27:21'),(217,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c307e23cf069197af6b034a5b2336a842b9b3445f9ccb49d029369197ec0c3a1','2026-11-05 07:27:21','2026-10-06 07:27:27',218,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:27:21','2026-10-06 07:27:27'),(218,1,'6746b18a-f964-4c59-8961-08c5c5a78936','c17222e97ac52535e84abc97e63a06f8f45e33f067c15910312fa3e41163c59a','2026-11-05 07:27:27','2026-10-06 07:27:45',219,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:27:27','2026-10-06 07:27:45'),(219,1,'6746b18a-f964-4c59-8961-08c5c5a78936','ddca64422f8144422c96bf4be15e90d239014c4643104c3fb47239a633acef14','2026-11-05 07:27:45','2026-10-06 07:28:04',220,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:27:45','2026-10-06 07:28:04'),(220,1,'6746b18a-f964-4c59-8961-08c5c5a78936','7fbdf13acff57124047be6875fc62f4b86dd5354adc1058a2d407518e76f9eed','2026-11-05 07:28:04','2026-10-06 07:30:31',221,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:28:04','2026-10-06 07:30:31'),(221,1,'6746b18a-f964-4c59-8961-08c5c5a78936','da87f7e146da9f703312904b4e58e2bd174614d6d2bab1291ea4d6b185d4c7d1','2026-11-05 07:30:31','2026-10-06 07:30:44',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36','2026-10-06 07:30:31','2026-10-06 07:30:44'),(222,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','15eb6909c305e2db9b20d45c50170a3f36f739713d39d9d1c426fc083740da6e','2026-11-13 10:05:47','2026-10-14 10:14:33',223,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:05:47','2026-10-14 10:14:33'),(223,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','4b06a8b3eb33de453241394302aa512427330fac9fcbe30155bfa1ff05a22d1e','2026-11-13 10:14:33','2026-10-14 10:17:47',224,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:14:33','2026-10-14 10:17:47'),(224,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','e6898b510cc57ef6731ba89b5e7f3b32360dc19180a8e77c438f3a19ee905870','2026-11-13 10:17:47','2026-10-14 10:26:33',225,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:17:47','2026-10-14 10:26:33'),(225,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','79fe037cd8996f4fed242163b813cc7da1f9fe692b537af4b38c5857fa145561','2026-11-13 10:26:33','2026-10-14 10:29:47',226,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:26:33','2026-10-14 10:29:47'),(226,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','b3dd1cf5f973ce42c1eedef1eca1035b9a4e92885522591e2abead9a4e704b41','2026-11-13 10:29:47','2026-10-14 10:32:51',227,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:29:47','2026-10-14 10:32:51'),(227,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','9b787df01d843c098cd30c78515dac26428c0249e4425c0925b1dd1a3751ab00','2026-11-13 10:32:51','2026-10-14 10:32:51',228,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:32:51','2026-10-14 10:32:51'),(228,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','9ac1327ca3d8b0a8a27b948c582fc55f99ec0998e80328c555b31f9ec0c2df86','2026-11-13 10:32:51','2026-10-14 10:33:13',229,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:32:51','2026-10-14 10:33:13'),(229,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','64e069e00e6b4e75085b7c8a02e717f32cbe9f3bc88bc9b6426e73278f2f0db4','2026-11-13 10:33:13','2026-10-14 10:33:13',230,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:33:13','2026-10-14 10:33:13'),(230,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','acb1aaa28bf4500de2e5458ee6f451fbe88ce7c674af3656787203b11504b102','2026-11-13 10:33:13','2026-10-14 10:45:14',231,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:33:13','2026-10-14 10:45:14'),(231,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','2c91295bab561c5bad54f445ce76374d9c9bd97da5a8da296cd8d4427d2b27e2','2026-11-13 10:45:14','2026-10-14 10:55:59',232,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:45:14','2026-10-14 10:55:59'),(232,1,'2aefc8b0-9e29-41f2-94ad-687ed311257a','49cf65e80ab75707e0271ea4e4445c3f9285de5393b985613180ab78670b92b3','2026-11-13 10:55:59','2026-10-14 10:55:59',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 10:55:59','2026-10-14 10:55:59'),(233,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','4113fbfe405606d8f9e8826299efd0c13300815677f865138aa0ee19dc22d6e0','2026-11-13 11:34:17','2026-10-14 11:46:17',234,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 11:34:17','2026-10-14 11:46:17'),(234,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','5cebc07efa98295656941e39cf5f0c439844ba90597f8e9ca3b43cb69015c42e','2026-11-13 11:46:17','2026-10-14 11:49:28',235,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 11:46:17','2026-10-14 11:49:28'),(235,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','1551d6f57835b72ef1835522e2aecab0462e466032fc477eba908cbe1573c527','2026-11-13 11:49:28','2026-10-14 12:01:29',237,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 11:49:28','2026-10-14 12:01:29'),(236,1,'9c5342f4-ac2a-41a3-ac44-b85038b62cf8','187bab87d40a44e618692f260c577ba3f14bc96e2354a7ed2651cfa9ea2b948f','2026-11-13 11:59:07',NULL,NULL,'::ffff:127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.26100.9444','2026-10-14 11:59:07','2026-10-14 11:59:07'),(237,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','be21b1adef12e210e9988d94a60334136f0c67d2ac2f95a84dbaaceeecc5c379','2026-11-13 12:01:29','2026-10-14 12:13:29',238,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 12:01:29','2026-10-14 12:13:29'),(238,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','7e35914799487efa34ced4c365c69b571a16d7c80d0510b5851edc8d23238b99','2026-11-13 12:13:29','2026-10-14 12:25:29',239,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 12:13:29','2026-10-14 12:25:29'),(239,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','a0cd4e0249112fcde1a5e774b2014bdbb0e367be599c3e88b4fa4649f525e665','2026-11-13 12:25:29','2026-10-14 12:37:29',240,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 12:25:29','2026-10-14 12:37:29'),(240,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','dc958422606c7242b1d0754cb5707d7032f4d6b6939ba5770e043477edafcc64','2026-11-13 12:37:29','2026-10-14 12:49:29',241,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 12:37:29','2026-10-14 12:49:29'),(241,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','e331d6dceeb9404a1d440e70c12dcbf7c82b40de177c710f048cdee56cd97a52','2026-11-13 12:49:29','2026-10-14 13:01:29',242,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 12:49:29','2026-10-14 13:01:29'),(242,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','89d3212d5972fcf76f9818409efcad74a675e1930eaf3554f8358a19a810ff25','2026-11-13 13:01:29','2026-10-14 13:13:29',243,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 13:01:29','2026-10-14 13:13:29'),(243,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','871e30d10254acb582f8d4b114540d711585f629042a4b226ec59ee31a0b03ff','2026-11-13 13:13:29','2026-10-14 14:05:22',244,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 13:13:29','2026-10-14 14:05:22'),(244,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','6d8e892e92484d489b9bcfa14ae803df861f357b562cad99243b5789ddbad025','2026-11-13 14:05:22','2026-10-14 14:06:42',245,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 14:05:22','2026-10-14 14:06:42'),(245,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','e34504a5b06fabf504499b13d16f1f18e5c1de5b6b60869937f9b00309b80a69','2026-11-13 14:06:42','2026-10-14 14:17:23',246,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 14:06:42','2026-10-14 14:17:23'),(246,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','d5499fdcdc3505c05a37be2f497c74266acdd03cb8c84cb43a36795cca7f2f10','2026-11-13 14:17:23','2026-10-14 14:18:43',247,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 14:17:23','2026-10-14 14:18:43'),(247,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','4cdf5b369453898500e963160abcde61034294ddf709f21d8b721bf1330bfa54','2026-11-13 14:18:43','2026-10-14 16:22:33',248,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 14:18:43','2026-10-14 16:22:33'),(248,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','20d97fd500e8442581932f3205d663f860ee86b145774411b6ebd77b91c46df5','2026-11-13 16:22:33','2026-10-15 07:55:29',249,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-14 16:22:33','2026-10-15 07:55:29'),(249,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','c60d5da74674b5b77b556f2e261828524b763d69e9092b26d37f0cb59cb3a230','2026-11-14 07:55:29','2026-10-15 07:55:31',250,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-15 07:55:29','2026-10-15 07:55:31'),(250,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','46f69b6ef347e1e2698d9e979f6c689439a3598817cbfde92daeed594a9d5db1','2026-11-14 07:55:31','2026-10-15 08:07:54',251,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-15 07:55:31','2026-10-15 08:07:54'),(251,1,'91374e38-a596-41f3-b00a-b9f1d3f2b79f','870049e44d59947290d4af41cd9f4e6cd13e772c46cd7417ab09c58e1ac780ce','2026-11-14 08:07:54',NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-15 08:07:54','2026-10-15 08:07:54'),(252,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','adad7e5f46904f8450e05dd4e7d4276b4b898f17ad99ef84ac09086639157344','2026-11-25 11:31:12','2026-10-26 11:43:13',253,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 11:31:12','2026-10-26 11:43:13'),(253,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','9994bb03f62bba4ff7d2b3121454feab63a8c98e2b302642b36c4e6d5d59ab09','2026-11-25 11:43:13','2026-10-26 11:55:13',254,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 11:43:13','2026-10-26 11:55:13'),(254,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','922ebbf73bffa5d596e46be4e0e349f27e0c7920b933d33bc124f0a7b9143738','2026-11-25 11:55:13','2026-10-26 12:07:13',255,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 11:55:13','2026-10-26 12:07:13'),(255,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','7575e0524d2517ea2128bde88eef77467363730b77f9c3f89ba536d3ab134f1e','2026-11-25 12:07:13','2026-10-26 12:19:13',256,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:07:13','2026-10-26 12:19:13'),(256,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','2601f9e5f1007c360a5b63bc58dd11176215523d13e3b34295023e9cf5f0ec74','2026-11-25 12:19:13','2026-10-26 12:28:02',257,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:19:13','2026-10-26 12:28:02'),(257,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','4e9d12f76e05ae76d772be72c20c4ac9f1b87a9aa03f914c68129dadd3498b61','2026-11-25 12:28:02','2026-10-26 12:28:13',258,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:28:02','2026-10-26 12:28:13'),(258,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','1d4ff3050413f736772dc4bef11907438189b31667f7b30226fa13adbebc1764','2026-11-25 12:28:13','2026-10-26 12:39:02',259,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:28:13','2026-10-26 12:39:02'),(259,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','5e840a5a2e9d8dd3ec7b1759d5d06bec490b6a46841224c1757bd6071f833480','2026-11-25 12:39:02','2026-10-26 12:40:02',260,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:39:02','2026-10-26 12:40:02'),(260,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','4ae4af822df0f30e91c5cf96c19db826aa2c28a4904f1852da36c803c66108ad','2026-11-25 12:40:02','2026-10-26 12:41:02',261,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:40:02','2026-10-26 12:41:02'),(261,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','d4f70baa20650e4c80c4420537a5e129f77fa3e2defd28e818ad969af23ccf65','2026-11-25 12:41:02','2026-10-26 12:42:02',262,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:41:02','2026-10-26 12:42:02'),(262,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','ebd741ad402355301db26e2b05a19f9d278faf473871d69ecca8647f3fc6142a','2026-11-25 12:42:02','2026-10-26 12:43:02',263,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:42:02','2026-10-26 12:43:02'),(263,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','e15a5ca64e2e9db855311d05f17dd47303dea2a58d018c49573e47c64890f4a3','2026-11-25 12:43:02','2026-10-26 12:44:02',264,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:43:02','2026-10-26 12:44:02'),(264,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','edbd35b467e66f9e2c4aa4adeb5a8bcc8d537630d7cbd32231206c645ee8a8b8','2026-11-25 12:44:02','2026-10-26 12:45:02',265,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:44:02','2026-10-26 12:45:02'),(265,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','78c5b5da160afb3164ac40a62ebc23a3374f352232fe0f041f1c2a62fd135028','2026-11-25 12:45:02','2026-10-26 12:46:02',266,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:45:02','2026-10-26 12:46:02'),(266,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','6754d08371a6a4760b104a2debe15a5e419dae1f66b30ad528fd1f95df753892','2026-11-25 12:46:02','2026-10-26 12:47:02',267,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:46:02','2026-10-26 12:47:02'),(267,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','d24eb93480e9cd778ed842ef8e701026f1d031a2f3773883334e6cb43571bdb6','2026-11-25 12:47:02','2026-10-26 12:48:02',268,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:47:02','2026-10-26 12:48:02'),(268,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','4669517ff522c1037852a255e9d8b26482dd0754b34c3d532fa89154fc3290f3','2026-11-25 12:48:02','2026-10-26 12:49:02',269,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:48:02','2026-10-26 12:49:02'),(269,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','76690b98ede666484e043837d69d931cd5f13af38e73ea4764a7f047a2834199','2026-11-25 12:49:02','2026-10-26 12:50:02',270,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:49:02','2026-10-26 12:50:02'),(270,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','a70e5e6cf6ca3e61c7bd0dd08fab97fe6314495cb77db012526526820c9c9c36','2026-11-25 12:50:02','2026-10-26 12:51:02',271,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:50:02','2026-10-26 12:51:02'),(271,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','5c7af527b2321e1a830f77f1dcac9c67c82f4bcadb6513eece85f2f3dec987c2','2026-11-25 12:51:02','2026-10-26 12:52:02',272,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:51:02','2026-10-26 12:52:02'),(272,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','eae45aca0db2844735d6a6638bed8144f725a9172d1abebebfec13e24deccc85','2026-11-25 12:52:02','2026-10-26 12:52:59',273,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:52:02','2026-10-26 12:52:59'),(273,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','c926a18b0e704349373b500aa16d7d2b2f26521cad1aac798e2287ee650513be','2026-11-25 12:52:59','2026-10-26 13:02:06',274,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 12:52:59','2026-10-26 13:02:06'),(274,1,'4967184f-e1dc-4225-a1a3-ed5af1e30ff0','985edeb42b985cfa9a18b876c5efdf0c9600d7dd6f4d214332fd0ae7653b1c3c','2026-11-25 13:02:06',NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 13:02:06','2026-10-26 13:02:06'),(275,1,'6749ba51-9c1f-4388-91d9-1d09dcc2b25c','8716444fa49f1fc3b3e49f1f3c6f732f75095c7540b1689550ffbe3b56e67c90','2026-11-25 13:20:10',NULL,NULL,'::1','node','2026-10-26 13:20:10','2026-10-26 13:20:10'),(276,1,'973d1b32-61a5-4026-bd66-b5bea1330e42','f77b0a43b61fb9f49cfee20ef5350c54b153228aa54db65c4b5c3c184f66722b','2026-11-25 13:20:30',NULL,NULL,'::1','node','2026-10-26 13:20:30','2026-10-26 13:20:30'),(277,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','fcfe61b573cd9eae6218e747dd9467bcfb02b743c1a906ee327770193a1c9c3d','2026-11-25 13:22:37','2026-10-26 13:34:39',278,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 13:22:37','2026-10-26 13:34:39'),(278,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','2af0a0be1424b129a01039f8df874202f780057e82f8056ccd02bf419f76fd00','2026-11-25 13:34:39','2026-10-26 13:41:15',279,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 13:34:39','2026-10-26 13:41:15'),(279,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','617c90ae400f13138ea44a6ebe95573ec4a5dfb3e4a36b2c91e6ad1698e61c40','2026-11-25 13:41:15','2026-10-26 13:53:17',280,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 13:41:15','2026-10-26 13:53:17'),(280,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','56b6da2a632186759d56669c88b2ff558003e60b01bbceeb4c3f2e094fb013f0','2026-11-25 13:53:17','2026-10-26 14:05:16',282,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 13:53:17','2026-10-26 14:05:16'),(281,1,'089b8c80-aa47-42d3-833a-867d4d7dadfc','a9b3ce4a68c1d93a294ab45b665bbcd2b6286b31f097fedcefa4af27c20aef03','2026-11-25 13:53:31',NULL,NULL,'::1','node','2026-10-26 13:53:31','2026-10-26 13:53:31'),(282,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','a55d8b6982fd39a36e52aae45fca7458954b3185f9a0eb8266d5d5f7d0ad7239','2026-11-25 14:05:16','2026-10-26 14:17:16',286,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:05:16','2026-10-26 14:17:16'),(283,1,'f2253d13-495f-441c-bb26-ab7addc6124c','e5112070085ee5c0bc9680e96ed1ea5c243238ba2b3512485285ffc84222dc7e','2026-11-25 14:13:30',NULL,NULL,'::1','node','2026-10-26 14:13:30','2026-10-26 14:13:30'),(284,1,'8d83ce15-934f-4f94-8b30-89c2257e319b','8a2cb4dec647baf433afb2f0fdbbec00f5b47336cac420b918e4c1212fda2aa7','2026-11-25 14:14:35',NULL,NULL,'::1','node','2026-10-26 14:14:35','2026-10-26 14:14:35'),(285,1,'49ae2a9d-3098-4568-878b-02b1236009a6','8c5f93d79f28f5be2506675162beb4d96d3b071b12ca615a2961351ad750a1c6','2026-11-25 14:16:15',NULL,NULL,'::1','node','2026-10-26 14:16:15','2026-10-26 14:16:15'),(286,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','dfe91cdc201e4ca8ee4a62c1ac92af2e42031f295bf48c85f070d0e406daeb96','2026-11-25 14:17:16','2026-10-26 14:20:52',287,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:17:16','2026-10-26 14:20:52'),(287,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','e1d1525d9bdb3b8ca175e0d2008bca85af705e1bda59068a9b9fff44ffe5cc22','2026-11-25 14:20:52','2026-10-26 14:32:52',288,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:20:52','2026-10-26 14:32:52'),(288,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','630d421c2266a8d9757872e28e3024f27a1cc9b4ccdd2351cf08d6f459d3cdff','2026-11-25 14:32:52','2026-10-26 14:44:52',289,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:32:52','2026-10-26 14:44:52'),(289,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','6c0db8cc3bdbd77acc1e6a89b064fc5b6c6908d217b09a73d876ade836b3f681','2026-11-25 14:44:52','2026-10-26 14:55:43',290,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:44:52','2026-10-26 14:55:43'),(290,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','3291241263a179ee555bb49a8dd397eb6a98e185492cba32d15ac3fffd3c8ab7','2026-11-25 14:55:43','2026-10-26 14:55:53',291,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:55:43','2026-10-26 14:55:53'),(291,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','2132f597a77c2886944caa5db7422c7818a5954fdba4c495b048a0f920c1676d','2026-11-25 14:55:53','2026-10-26 15:02:10',294,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 14:55:53','2026-10-26 15:02:10'),(292,1,'5aa99383-0b4e-403c-bacc-afe6979fd348','7b745184b4b296db7df3221df8a744c9aaa3bea026cf5e66d8c3fbaef68f1067','2026-11-25 15:00:08',NULL,NULL,'::1','node','2026-10-26 15:00:08','2026-10-26 15:00:08'),(293,1,'97f7f7c3-ac37-4b96-b515-08863a9707d6','45ab5a06b764036741772c70eecddd95d7e11bdf57476aadf063b19161a0937a','2026-11-25 15:00:29',NULL,NULL,'::1','node','2026-10-26 15:00:29','2026-10-26 15:00:29'),(294,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','0dd30ac735be6d837c494fd3b5697249a6b7c9bd2aedad20087d84d4f171fa8f','2026-11-25 15:02:10','2026-10-26 15:14:11',295,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 15:02:10','2026-10-26 15:14:11'),(295,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','e96ef1e0ad51bfe68dea9c48235d0ecc6bcda8ea992a77c36ae5cce59a4c7de4','2026-11-25 15:14:11','2026-10-26 15:26:10',296,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 15:14:11','2026-10-26 15:26:10'),(296,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','30b44a3b2d906b362bb28a8df5faf97a70202c6664d2e91a682d9e87493ed1ba','2026-11-25 15:26:10','2026-10-26 15:38:11',297,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 15:26:10','2026-10-26 15:38:11'),(297,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','e90c38911cf7ed78a7b57238917e83a67e4fae6187c011e47f3fbcb2d660db97','2026-11-25 15:38:11','2026-10-26 17:40:38',298,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 15:38:11','2026-10-26 17:40:38'),(298,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','5f038b00073a68be4d6498515d211544823575c03fb2cb965597c1b0e4c6fbb9','2026-11-25 17:40:38','2026-10-27 06:14:46',299,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-26 17:40:38','2026-10-27 06:14:46'),(299,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','6d9503630166ee2cdf1b543d519d32b43fee6012761d2ce228ffd8ad02379b45','2026-11-26 06:14:46','2026-10-27 06:26:47',300,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 06:14:46','2026-10-27 06:26:47'),(300,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','3bd9ab094671967694206b323fb1ae8a4c05c2beb6e567683627716ee3757421','2026-11-26 06:26:47','2026-10-27 06:38:47',301,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 06:26:47','2026-10-27 06:38:47'),(301,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','17e369d4471475d42863dac6983784b665cc5cc5ff53eb54c1f3a09d2c7aad84','2026-11-26 06:38:47','2026-10-27 06:50:47',302,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 06:38:47','2026-10-27 06:50:47'),(302,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','4f1a0efa7e56c22607a3601d33ff73710d0da74dcbeab2b2b4c6d6b845358f8e','2026-11-26 06:50:47','2026-10-27 06:52:54',303,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 06:50:47','2026-10-27 06:52:54'),(303,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','598d5c2f2c4f9a2dc476166f073ed5e1a89c6df0cf97d78e22eb117e6d0c40a7','2026-11-26 06:52:54','2026-10-27 07:04:54',304,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 06:52:54','2026-10-27 07:04:54'),(304,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','8874d02c0a14806d3ecdb32d154d86741ed28450f1819c2530725920f94edae0','2026-11-26 07:04:54','2026-10-27 07:16:54',305,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 07:04:54','2026-10-27 07:16:54'),(305,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','50fde3ab4f8f88b8cfa5cc5ea930a9fd6248d31ff89efdce5f356f7b047fb230','2026-11-26 07:16:54','2026-10-27 07:28:54',306,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 07:16:54','2026-10-27 07:28:54'),(306,1,'961686c6-08d3-4998-9b8c-54c3443f7d31','e4fc8adf38bcd45382fce83b9915cb657b828f69038f3ee4edbfd10f0b78516b','2026-11-26 07:28:54',NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36','2026-10-27 07:28:54','2026-10-27 07:28:54');
/*!40000 ALTER TABLE `tblrefreshtoken` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblrole`
--

DROP TABLE IF EXISTS `tblrole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblrole` (
  `roleID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '1',
  `level` int(11) NOT NULL DEFAULT '2',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`roleID`),
  UNIQUE KEY `uq_roles_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblrole`
--

LOCK TABLES `tblrole` WRITE;
/*!40000 ALTER TABLE `tblrole` DISABLE KEYS */;
INSERT INTO `tblrole` VALUES (1,'SUPER_ADMIN','Super Admin',NULL,1,100,'2026-10-01 09:47:25','2026-10-26 13:13:55'),(2,'STUDIO_OWNER','Company Owner',NULL,1,1,'2026-10-01 09:47:25','2026-10-26 13:14:17'),(3,'MANAGER','Manager',NULL,1,2,'2026-10-01 09:47:25','2026-10-01 09:47:25'),(4,'PHOTOGRAPHER','Photographer',NULL,1,3,'2026-10-01 09:47:25','2026-10-26 13:13:55'),(5,'EDITOR_DESIGNER','Editor',NULL,1,4,'2026-10-01 09:47:25','2026-10-26 13:14:17'),(6,'PRINTER_DELIVERY_STAFF','Print & Delivery Staff',NULL,1,5,'2026-10-01 09:47:25','2026-10-26 13:14:17'),(7,'CUSTOMER','Customer',NULL,1,0,'2026-10-01 09:47:25','2026-10-26 13:13:55'),(10,'COMPANY_ADMIN','Company Admin',NULL,1,1,'2026-10-26 13:14:17','2026-10-26 13:14:17'),(14,'STAFF','Staff',NULL,1,5,'2026-10-26 13:14:17','2026-10-26 13:14:17'),(16,'REPORT_MANAGER','Report Manager',NULL,1,6,'2026-10-26 13:14:17','2026-10-26 13:14:17'),(17,'FINANCE','Finance Team',NULL,1,7,'2026-10-26 13:14:17','2026-10-26 13:14:17');
/*!40000 ALTER TABLE `tblrole` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblrolepermission`
--

DROP TABLE IF EXISTS `tblrolepermission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblrolepermission` (
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_rp_perm` (`permission_id`),
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `tblpermission` (`permissionID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `tblrole` (`roleID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblrolepermission`
--

LOCK TABLES `tblrolepermission` WRITE;
/*!40000 ALTER TABLE `tblrolepermission` DISABLE KEYS */;
INSERT INTO `tblrolepermission` VALUES (1,1,'2026-10-26 13:14:17'),(1,2,'2026-10-26 13:14:17'),(1,3,'2026-10-26 13:14:17'),(1,4,'2026-10-26 13:14:17'),(1,5,'2026-10-26 13:14:17'),(1,6,'2026-10-26 13:14:17'),(1,7,'2026-10-26 13:14:17'),(1,8,'2026-10-26 13:14:17'),(1,9,'2026-10-26 13:14:17'),(1,10,'2026-10-26 13:14:17'),(1,11,'2026-10-26 13:14:17'),(1,12,'2026-10-26 13:14:17'),(1,13,'2026-10-26 13:14:17'),(1,14,'2026-10-26 13:14:17'),(1,15,'2026-10-26 13:14:17'),(1,16,'2026-10-26 13:14:17'),(1,17,'2026-10-26 13:14:17'),(1,18,'2026-10-26 13:14:17'),(1,19,'2026-10-26 13:14:17'),(1,20,'2026-10-26 13:14:17'),(1,21,'2026-10-26 13:14:17'),(1,22,'2026-10-26 13:14:17'),(1,23,'2026-10-26 13:14:17'),(1,24,'2026-10-26 13:14:17'),(1,25,'2026-10-26 13:14:17'),(1,26,'2026-10-26 13:14:17'),(1,27,'2026-10-26 13:14:17'),(1,28,'2026-10-26 13:14:17'),(1,29,'2026-10-26 13:14:17'),(2,1,'2026-10-06 06:34:50'),(2,2,'2026-10-26 13:14:17'),(2,3,'2026-10-06 06:34:50'),(2,4,'2026-10-06 06:34:50'),(2,5,'2026-10-06 06:34:50'),(2,6,'2026-10-06 06:34:50'),(2,7,'2026-10-06 06:34:50'),(2,8,'2026-10-06 06:34:50'),(2,9,'2026-10-06 06:34:50'),(2,10,'2026-10-06 06:34:50'),(2,11,'2026-10-06 06:34:50'),(2,12,'2026-10-06 06:34:50'),(2,13,'2026-10-06 06:34:50'),(2,14,'2026-10-06 06:34:50'),(2,15,'2026-10-06 06:34:50'),(2,16,'2026-10-06 06:34:50'),(2,17,'2026-10-06 06:34:50'),(2,18,'2026-10-06 06:34:50'),(2,19,'2026-10-06 06:34:50'),(2,20,'2026-10-06 06:34:50'),(2,21,'2026-10-06 06:34:50'),(2,22,'2026-10-06 06:34:50'),(2,23,'2026-10-06 06:34:50'),(2,24,'2026-10-06 06:34:50'),(2,25,'2026-10-06 06:34:50'),(2,26,'2026-10-06 06:34:50'),(2,27,'2026-10-06 06:34:50'),(2,28,'2026-10-06 06:34:50'),(2,29,'2026-10-06 06:34:50'),(2,30,'2026-10-06 06:34:50'),(3,5,'2026-10-01 09:47:25'),(3,6,'2026-10-01 09:47:25'),(3,7,'2026-10-01 09:47:25'),(3,8,'2026-10-01 09:47:25'),(3,9,'2026-10-01 09:47:25'),(3,10,'2026-10-01 09:47:25'),(3,11,'2026-10-01 09:47:25'),(3,12,'2026-10-01 09:47:25'),(3,14,'2026-10-01 09:47:25'),(3,16,'2026-10-01 09:47:25'),(3,17,'2026-10-01 09:47:25'),(3,18,'2026-10-01 09:47:25'),(3,20,'2026-10-01 09:47:25'),(3,21,'2026-10-01 09:47:25'),(3,23,'2026-10-01 09:47:25'),(3,24,'2026-10-01 09:47:25'),(3,26,'2026-10-01 09:47:25'),(3,27,'2026-10-01 09:47:25'),(3,28,'2026-10-01 09:47:25'),(3,29,'2026-10-01 09:47:25'),(4,13,'2026-10-01 09:47:25'),(4,17,'2026-10-01 09:47:25'),(5,13,'2026-10-01 09:47:25'),(5,19,'2026-10-01 09:47:25'),(5,20,'2026-10-01 09:47:25'),(6,23,'2026-10-01 09:47:25'),(6,26,'2026-10-01 09:47:25'),(6,27,'2026-10-01 09:47:25'),(7,30,'2026-10-01 09:47:25'),(10,1,'2026-10-26 13:14:17'),(10,2,'2026-10-26 13:14:17'),(10,3,'2026-10-26 13:14:17'),(10,4,'2026-10-26 13:14:17'),(10,5,'2026-10-26 13:14:17'),(10,6,'2026-10-26 13:14:17'),(10,7,'2026-10-26 13:14:17'),(10,8,'2026-10-26 13:14:17'),(10,9,'2026-10-26 13:14:17'),(10,10,'2026-10-26 13:14:17'),(10,11,'2026-10-26 13:14:17'),(10,12,'2026-10-26 13:14:17'),(10,13,'2026-10-26 13:14:17'),(10,14,'2026-10-26 13:14:17'),(10,15,'2026-10-26 13:14:17'),(10,16,'2026-10-26 13:14:17'),(10,17,'2026-10-26 13:14:17'),(10,18,'2026-10-26 13:14:17'),(10,19,'2026-10-26 13:14:17'),(10,20,'2026-10-26 13:14:17'),(10,21,'2026-10-26 13:14:17'),(10,22,'2026-10-26 13:14:17'),(10,23,'2026-10-26 13:14:17'),(10,24,'2026-10-26 13:14:17'),(10,25,'2026-10-26 13:14:17'),(10,26,'2026-10-26 13:14:17'),(10,27,'2026-10-26 13:14:17'),(10,28,'2026-10-26 13:14:17'),(10,29,'2026-10-26 13:14:17'),(14,13,'2026-10-26 13:14:17'),(14,23,'2026-10-26 13:14:17'),(14,26,'2026-10-26 13:14:17'),(14,27,'2026-10-26 13:14:17'),(16,5,'2026-10-26 13:14:17'),(16,6,'2026-10-26 13:14:17'),(16,7,'2026-10-26 13:14:17'),(16,9,'2026-10-26 13:14:17'),(16,21,'2026-10-26 13:14:17'),(16,23,'2026-10-26 13:14:17'),(17,5,'2026-10-26 13:14:17'),(17,6,'2026-10-26 13:14:17'),(17,21,'2026-10-26 13:14:17'),(17,22,'2026-10-26 13:14:17'),(17,23,'2026-10-26 13:14:17');
/*!40000 ALTER TABLE `tblrolepermission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblschemamigration`
--

DROP TABLE IF EXISTS `tblschemamigration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblschemamigration` (
  `name` varchar(190) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblschemamigration`
--

LOCK TABLES `tblschemamigration` WRITE;
/*!40000 ALTER TABLE `tblschemamigration` DISABLE KEYS */;
INSERT INTO `tblschemamigration` VALUES ('001_init.sql','2026-10-01 09:47:02'),('002_extended_modules.sql','2026-10-14 11:13:04'),('003_companies.sql','2026-10-14 11:14:24'),('004_company_profile.sql','2026-10-26 13:13:54'),('004_onboarding.sql','2026-10-26 13:13:54'),('005_user_company_role.sql','2026-10-26 13:13:55'),('006_role_levels.sql','2026-10-26 13:13:55'),('007_user_company_role_pk.sql','2026-10-26 13:13:55'),('008_staff_profile.sql','2026-10-26 13:13:55'),('009_user_page_access.sql','2026-10-26 13:13:55'),('010_user_is_admin.sql','2026-10-26 13:13:56'),('011_event_workflow.sql','2026-10-26 13:13:56');
/*!40000 ALTER TABLE `tblschemamigration` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblselectionsubmission`
--

DROP TABLE IF EXISTS `tblselectionsubmission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblselectionsubmission` (
  `selectionSubmissionID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `status` enum('OPEN','SUBMITTED','CONFIRMED','REOPENED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'OPEN',
  `photo_count` int(10) unsigned NOT NULL DEFAULT '0',
  `note` text COLLATE utf8mb4_unicode_ci,
  `submitted_at` datetime DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `confirmed_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`selectionSubmissionID`),
  UNIQUE KEY `uq_selection_sub` (`event_id`,`customer_id`),
  KEY `fk_ss_customer` (`customer_id`),
  CONSTRAINT `fk_ss_customer` FOREIGN KEY (`customer_id`) REFERENCES `tblcustomer` (`customerID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_ss_event` FOREIGN KEY (`event_id`) REFERENCES `tblevent` (`eventID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblselectionsubmission`
--

LOCK TABLES `tblselectionsubmission` WRITE;
/*!40000 ALTER TABLE `tblselectionsubmission` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblselectionsubmission` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblservice`
--

DROP TABLE IF EXISTS `tblservice`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblservice` (
  `serviceID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `base_price` bigint(20) unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`serviceID`),
  UNIQUE KEY `uq_services_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblservice`
--

LOCK TABLES `tblservice` WRITE;
/*!40000 ALTER TABLE `tblservice` DISABLE KEYS */;
INSERT INTO `tblservice` VALUES (1,'Wedding Photography & Cinematography','wedding-photography','Comprehensive documentary and portrait coverage for your wedding celebrations.','From pre-wedding ceremonies to reception highlights, our team preserves each meaningful glance, heartfelt ritual, and joyful moment with cinematic artistry and unobtrusive documentary coverage.','camera',7500000,1,1,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(2,'Pre-Wedding Shoot','pre-wedding-shoot','Story-driven couple portraits at locations you love.',NULL,'sparkles',2500000,0,1,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(3,'Birthday & Milestone Celebrations','birthday-events','Vibrant event photography for birthdays, anniversaries, and personal milestones.','Capture the laughter, cake cutting, dynamic candids, and family gatherings with instant guest QR photo delivery and fast digital turnaround.','sparkles',1500000,1,2,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(4,'Corporate & Commercial Shoots','corporate-events','Executive portraits, brand launches, symposiums, and company galas.','High-impact professional photography delivering on-brand visual assets, live conference sharing, and studio-grade executive headshots.','camera',2000000,1,6,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(5,'Portrait & Studio','portrait-studio','Professional portraits, family and kids in our studio.',NULL,'camera',500000,0,4,'2026-10-01 09:47:25','2026-10-14 11:14:31',NULL),(8,'Housewarming (Griha Pravesh) Ceremony','housewarming','Sacred rituals, festive atmosphere, and warm portraits in your new home.','Documenting the traditional pooja rituals, joyous welcome of friends and family, architectural home details, and group portraits for your new beginning.','heart',1800000,1,3,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(9,'Pre-Wedding & Couple Sessions','pre-wedding','Story-driven couple portrait sessions celebrating your unique journey together.','Custom-tailored outdoor and architectural portrait sessions designed to reflect your personal romance in picturesque natural or urban settings.','heart',2500000,1,4,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(10,'Maternity & Baby Showers','maternity-baby','Tender maternity portraits and joyful baby shower celebrations.','Preserving the radiant anticipation of welcoming a new child with gentle lighting, creative styling, and heartfelt family moments.','heart',1600000,1,5,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL);
/*!40000 ALTER TABLE `tblservice` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblsetting`
--

DROP TABLE IF EXISTS `tblsetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblsetting` (
  `key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` json NOT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblsetting`
--

LOCK TABLES `tblsetting` WRITE;
/*!40000 ALTER TABLE `tblsetting` DISABLE KEYS */;
INSERT INTO `tblsetting` VALUES ('ai','{\"culling\": true, \"faceSearch\": true, \"blurThreshold\": 60}',0,1,'2026-10-01 09:47:25','2026-10-06 07:10:41'),('gallery','{\"thumbSize\": 480, \"previewSize\": 1600, \"watermarkText\": \"FlashLight Photography\", \"defaultExpiryDays\": 90}',0,1,'2026-10-01 09:47:25','2026-10-14 11:14:31'),('notifications','{\"sms\": true, \"email\": true, \"whatsapp\": true}',0,1,'2026-10-01 09:47:25','2026-10-06 07:10:37'),('pricing','{\"album\": 1499900, \"canvas\": {\"12x18\": 199900, \"16x24\": 299900}, \"frames\": {\"8x10\": 79900, \"12x18\": 149900}, \"prints\": {\"4x6\": 2500, \"5x7\": 4000, \"8x10\": 9000, \"12x18\": 25000}, \"courierFee\": 15000, \"taxPercent\": 18, \"photoDownload\": 9900}',0,NULL,'2026-10-01 09:47:25','2026-10-01 09:47:25'),('studio','{\"city\": \"Chennai\", \"name\": \"FlashLight Photography\", \"about\": \"We are a dedicated collective of photographers, visual artists, and album designers passionate about storytelling through light. We collaborate closely with you through pre-event planning, capturing timeless candids and portraits, and delivering your complete collection via private interactive online galleries with instant guest sharing.\", \"email\": \"hello@flashlightphotography.com\", \"gstin\": \"\", \"hours\": \"Monday – Saturday: 10:00 AM – 8:00 PM (By Appointment)\", \"phone\": \"+91 98765 43210\", \"mapUrl\": \"\", \"address\": \"12 FlashLight Studio Avenue, Creative District\", \"tagline\": \"Only Some Moments Become Memories\", \"youtube\": \"https://youtube.com\", \"facebook\": \"https://facebook.com\", \"whatsapp\": \"+91 98765 43210\", \"instagram\": \"https://instagram.com\"}',1,1,'2026-10-01 09:47:25','2026-10-14 11:14:31'),('subscription','{\"enabledModules\": []}',0,NULL,'2026-10-26 13:14:17','2026-10-26 13:14:17'),('website','{\"slides\": [{\"id\": \"1\", \"iso\": \"ISO 100\", \"tag\": \"Wedding & Grand Celebrations\", \"lens\": \"85mm f/1.4 GM\", \"image\": \"/images/hero-couple-petals.jpg\", \"title\": \"Only some moments\", \"shutter\": \"1/500s\", \"imageUrl\": \"/images/hero-couple-petals.jpg\", \"subtitle\": \"Some things were never meant to trend for a week but to endure for years ahead. Photography and videography across every wedding, celebration, portrait, and brand campaign.\", \"highlightText\": \"become memories...\"}, {\"id\": \"2\", \"iso\": \"ISO 200\", \"tag\": \"Couples\", \"lens\": \"70-200mm f/2.8 GM II\", \"image\": \"/images/hero-couple-outdoor.jpg\", \"title\": \"Authentic Romance &\", \"shutter\": \"1/320s\", \"imageUrl\": \"/images/hero-couple-outdoor.jpg\", \"subtitle\": \"Scenic destination sessions, natural romance, and cinematic compositions crafted to endure generations.\", \"highlightText\": \"candid chemistry...\"}, {\"id\": \"3\", \"iso\": \"ISO 160\", \"tag\": \"Milestones\", \"lens\": \"50mm f/1.2 GM\", \"image\": \"/images/login-showcase-1.jpg\", \"title\": \"Stories Told in Light,\", \"shutter\": \"1/400s\", \"imageUrl\": \"/images/login-showcase-1.jpg\", \"subtitle\": \"Capturing weddings, portraits, and milestones with instant live QR guest galleries, master downloads, and handcrafted archival albums.\", \"highlightText\": \"cherished forever...\"}], \"products\": [{\"id\": \"test\", \"name\": \"test\", \"image\": \"/images/hero-couple-petals.jpg\", \"price\": 499, \"sizes\": [\"8 × 10\", \"12 × 18\", \"16 × 24\"], \"stock\": 10, \"active\": true, \"category\": \"Photo Frames\", \"discount\": 0, \"variants\": [\"Walnut\", \"Natural oak\", \"Matte black\"], \"placement\": {\"x\": 15, \"y\": 12, \"width\": 70, \"height\": 76, \"padding\": 4, \"aspectRatio\": \"4:5\"}, \"description\": \"8 × 10 · 12 × 18 · 16 × 24 · Custom photo\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 100}, {\"id\": \"frame-classic\", \"name\": \"Classic walnut frame\", \"image\": \"/images/hero-couple-petals.jpg\", \"price\": 499, \"sizes\": [\"8 × 10\", \"12 × 18\", \"16 × 24\"], \"stock\": 24, \"active\": true, \"category\": \"Photo Frames\", \"discount\": 0, \"variants\": [\"Walnut\", \"Natural oak\", \"Matte black\"], \"placement\": {\"x\": 15, \"y\": 12, \"width\": 70, \"height\": 76, \"padding\": 4, \"aspectRatio\": \"4:5\"}, \"description\": \"A solid walnut-look frame, museum-style mat and your photograph, finished by hand.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 100}, {\"id\": \"frame-gallery\", \"name\": \"Gallery float frame\", \"image\": \"/images/hero-couple-outdoor.jpg\", \"price\": 799, \"sizes\": [\"12 × 18\", \"16 × 24\", \"20 × 30\"], \"stock\": 12, \"active\": true, \"category\": \"Photo Frames\", \"discount\": 0, \"variants\": [\"Black\", \"White\", \"Oak\"], \"placement\": {\"x\": 15, \"y\": 12, \"width\": 70, \"height\": 76, \"padding\": 4, \"aspectRatio\": \"4:5\"}, \"description\": \"A contemporary floating mount with a soft, archival finish for the moments you keep close.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 150}, {\"id\": \"album-heirloom\", \"name\": \"Heirloom photo album\", \"image\": \"/images/hero-wedding-garlands.jpg\", \"price\": 1899, \"sizes\": [\"20 pages\", \"30 pages\", \"40 pages\"], \"stock\": 15, \"active\": true, \"category\": \"Photo Albums\", \"discount\": 10, \"variants\": [\"Linen sand\", \"Linen forest\", \"Linen charcoal\"], \"placement\": {\"x\": 15, \"y\": 12, \"width\": 70, \"height\": 76, \"padding\": 4, \"aspectRatio\": \"4:5\"}, \"description\": \"Lay-flat pages, a linen cover and room for 40 of your favourite photographs.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 250}, {\"id\": \"prints-fineart\", \"name\": \"Fine art photo prints\", \"image\": \"/images/weddingphoto1.jpg\", \"price\": 299, \"sizes\": [\"5 × 7\", \"8 × 10\", \"12 × 18\"], \"stock\": 80, \"active\": true, \"category\": \"Photo Prints\", \"discount\": 0, \"variants\": [\"Matte\", \"Lustre\", \"Fine-art cotton\"], \"placement\": {\"x\": 10, \"y\": 10, \"width\": 80, \"height\": 80, \"padding\": 0, \"aspectRatio\": \"4:5\"}, \"description\": \"Rich, true-to-life colour on archival matte paper with a beautifully soft texture.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 0}, {\"id\": \"cup-photo\", \"name\": \"Personalised photo cup\", \"image\": \"/images/BabyShower.jfif\", \"price\": 449, \"sizes\": [\"11 oz\", \"15 oz\"], \"stock\": 32, \"active\": true, \"category\": \"Photo Cups\", \"discount\": 0, \"variants\": [\"White ceramic\", \"Colour inside\"], \"placement\": {\"x\": 10, \"y\": 22, \"width\": 80, \"height\": 54, \"padding\": 0, \"aspectRatio\": \"3:2\"}, \"description\": \"A glossy ceramic cup, made personal with the photograph you choose.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 75}, {\"id\": \"gift-keepsake\", \"name\": \"Printed keepsake box\", \"image\": \"/images/house warming.jfif\", \"price\": 999, \"sizes\": [\"Small\", \"Large\"], \"stock\": 9, \"active\": true, \"category\": \"Customized Gifts\", \"discount\": 5, \"variants\": [\"Ivory\", \"Midnight\"], \"placement\": {\"x\": 15, \"y\": 12, \"width\": 70, \"height\": 76, \"padding\": 4, \"aspectRatio\": \"4:5\"}, \"description\": \"A keepsake box finished with a favourite photograph and a soft-touch lid.\", \"customizable\": true, \"frameOverlay\": \"\", \"customizationPrice\": 125}], \"bannerText\": \"Bookings Open! Enjoy an exclusive 10% discount on all Wedding & Milestone packages\", \"couponCode\": \"WELCOME10\", \"historyText\": \"Established in 2014, FlashLight Photography was born out of a desire to create photographs that endure for years ahead. What began as an intimate boutique portrait atelier has grown into an acclaimed visual production house trusted by hundreds of families, couples, and creative brands.\", \"whyChooseUs\": [\"Instant Live QR Event Galleries — Guests view & download high-res photos in real time\", \"Full Master High-Resolution Digital Rights Included with Every Package\", \"Handcrafted Flush-Mount Archival Albums with Layflat Panoramic Spreads\", \"Dedicated Dual-Photographer Coverage (Candid Documentary + Portraiture)\", \"Transparent Pricing with Taxes Included & 24-Hour Availability Confirmation\"], \"bannerActive\": true, \"heroSubtitle\": \"Some things were never meant to trend for a week but to endure for years ahead. Photography and videography across every wedding, celebration, portrait, and brand campaign.\", \"bannerDiscount\": \"10% OFF\"}',1,1,'2026-10-01 16:37:12','2026-10-15 08:02:53');
/*!40000 ALTER TABLE `tblsetting` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblstaff`
--

DROP TABLE IF EXISTS `tblstaff`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblstaff` (
  `staffID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `designation` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `joined_on` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`staffID`),
  UNIQUE KEY `uq_staff_user` (`user_id`),
  CONSTRAINT `fk_staff_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblstaff`
--

LOCK TABLES `tblstaff` WRITE;
/*!40000 ALTER TABLE `tblstaff` DISABLE KEYS */;
INSERT INTO `tblstaff` VALUES (1,1,'Super Admin',NULL,'2026-10-01',1,'2026-10-01 09:47:26','2026-10-01 09:47:26'),(2,2,'Studio Owner',NULL,'2026-10-01',1,'2026-10-01 09:47:26','2026-10-01 09:47:26'),(3,3,'Manager',NULL,'2026-10-01',1,'2026-10-01 09:47:27','2026-10-01 09:47:27'),(4,4,'Photographer',NULL,'2026-10-01',1,'2026-10-01 09:47:27','2026-10-01 09:47:27'),(5,5,'Editor / Designer',NULL,'2026-10-01',1,'2026-10-01 09:47:27','2026-10-01 09:47:27'),(6,6,'Printer / Delivery Staff','Photo','2026-10-01',1,'2026-10-01 09:47:28','2026-10-06 06:35:26'),(9,8,'Company Admin',NULL,'2026-10-26',1,'2026-10-26 13:14:17','2026-10-26 13:14:17'),(13,9,'Staff',NULL,'2026-10-26',1,'2026-10-26 13:14:18','2026-10-26 13:14:18'),(15,10,'Report Manager',NULL,'2026-10-26',1,'2026-10-26 13:14:18','2026-10-26 13:14:18'),(16,11,'Finance Team',NULL,'2026-10-26',1,'2026-10-26 13:14:18','2026-10-26 13:14:18'),(21,16,NULL,NULL,'2026-10-26',1,'2026-10-26 13:23:41','2026-10-26 13:23:41');
/*!40000 ALTER TABLE `tblstaff` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tblstaffdocument`
--

DROP TABLE IF EXISTS `tblstaffdocument`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tblstaffdocument` (
  `staffDocumentID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `doc_type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_key` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` int(10) unsigned NOT NULL,
  `uploaded_by` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`staffDocumentID`),
  KEY `ix_staff_document_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tblstaffdocument`
--

LOCK TABLES `tblstaffdocument` WRITE;
/*!40000 ALTER TABLE `tblstaffdocument` DISABLE KEYS */;
/*!40000 ALTER TABLE `tblstaffdocument` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbltestimonial`
--

DROP TABLE IF EXISTS `tbltestimonial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbltestimonial` (
  `testimonialID` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_label` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quote` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` tinyint(3) unsigned NOT NULL DEFAULT '5',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`testimonialID`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbltestimonial`
--

LOCK TABLES `tbltestimonial` WRITE;
/*!40000 ALTER TABLE `tbltestimonial` DISABLE KEYS */;
INSERT INTO `tbltestimonial` VALUES (1,'Ananya & Karthik','Wedding, Chennai','The live QR gallery was a hit - our guests found and downloaded their photos during the reception itself!',5,0,0,'2026-10-01 09:47:28','2026-10-14 11:14:31','2026-10-14 11:14:31'),(2,'Rahul Menon','Corporate launch','Professional, punctual and the edited photos were delivered within three days.',5,0,1,'2026-10-01 09:47:28','2026-10-14 11:14:31','2026-10-14 11:14:31'),(3,'Divya S','Baby shower','Beautiful candid shots and the album design process was so easy with online proofs.',5,0,2,'2026-10-01 09:47:28','2026-10-14 11:14:31','2026-10-14 11:14:31'),(4,'Priya & Rahul','Wedding Celebration','Having the live QR gallery at our reception was an incredible hit! Our guests were able to see and download pictures in real time, and the quality of the final album exceeded our expectations.',5,1,1,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(5,'Ananya Deshmukh','Family Portrait Session','The team made our entire family feel comfortable from minute one. The lighting, candids, and attention to detail were world-class. We will treasure these portraits forever.',5,1,2,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL),(6,'Karthik Ramanathan','Corporate Gala & Brand Launch','Exceptionally professional execution and punctual delivery. The live event gallery allowed our attendees to immediately post highlights on social media with studio-quality imagery.',5,1,3,'2026-10-14 11:14:31','2026-10-14 11:14:31',NULL);
/*!40000 ALTER TABLE `tbltestimonial` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbluser`
--

DROP TABLE IF EXISTS `tbluser`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbluser` (
  `userID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `company_id` int(10) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','INACTIVE','LOCKED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `avatar_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `phone_verified_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `failed_logins` int(10) unsigned NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `token_version` int(10) unsigned NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `staff_profile` mediumtext COLLATE utf8mb4_unicode_ci,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`userID`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_company` (`company_id`),
  KEY `idx_users_role` (`role_id`),
  CONSTRAINT `fk_user_company` FOREIGN KEY (`company_id`) REFERENCES `tblcompany` (`companyID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `tblrole` (`roleID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbluser`
--

LOCK TABLES `tbluser` WRITE;
/*!40000 ALTER TABLE `tbluser` DISABLE KEYS */;
INSERT INTO `tbluser` VALUES (1,1,1,'Super Admin','admin@photolab.test','9000000001','$2b$12$EKIP1bDCP0xXNp2Vp3oNaOwfjruv7w2pSWJPjVsCbgeitsPyqGpw2','ACTIVE',NULL,'2026-10-01 09:47:26',NULL,'2026-10-26 15:00:29',0,NULL,1,'2026-10-01 09:47:26','2026-10-26 15:00:29',NULL,NULL,0),(2,1,2,'Studio Owner','owner@photolab.test','9000000002','$2b$12$EXf4pc8Tgbkmf2xoyvbZeuA9QXZIDgv1LJgB6dtNGII5m9oRRDyWm','ACTIVE',NULL,'2026-10-01 09:47:26',NULL,'2026-10-01 10:29:21',0,NULL,0,'2026-10-01 09:47:26','2026-10-26 13:13:54',NULL,NULL,0),(3,1,3,'Studio Manager','manager@photolab.test','9000000003','$2b$12$ZZ9D8HDg0Enw7HMWxnkoi.iUbS02k2fu6Bn2cg4VhgZnvelcpTNRO','ACTIVE',NULL,'2026-10-01 09:47:27',NULL,'2026-10-01 10:29:21',0,NULL,0,'2026-10-01 09:47:27','2026-10-26 13:13:54',NULL,NULL,0),(4,1,4,'Arjun Photographer','photographer@photolab.test','9000000004','$2b$12$k3mNZn9Hy8kfCSeYuHmS5uDetqc5Nute5d0CmxcB0e4jW1y5CwkSO','ACTIVE',NULL,'2026-10-01 09:47:27',NULL,'2026-10-01 10:29:21',0,NULL,0,'2026-10-01 09:47:27','2026-10-26 13:13:54',NULL,NULL,0),(5,1,5,'Meera Editor','editor@photolab.test','9000000005','$2b$12$8C/vqv8tL0ztPJDg6P6k2uigjKkERg.XYPvHfZ18jgxFfp.LRDuC6','ACTIVE',NULL,'2026-10-01 09:47:27',NULL,'2026-10-01 10:29:21',0,NULL,0,'2026-10-01 09:47:27','2026-10-26 13:13:54',NULL,NULL,0),(6,1,6,'Ravi Print & Delivery','delivery@photolab.test','9000000006','$2b$12$nBKPBG8b7uKIL8pfq3vSxuZv/K.jy7vzcY21Jyo2WZtN80gH8DpCO','LOCKED',NULL,'2026-10-01 09:47:28',NULL,'2026-10-01 10:29:21',0,NULL,3,'2026-10-01 09:47:28','2026-10-26 13:13:54',NULL,NULL,0),(7,1,7,'Priya Customer','customer@photolab.test','9000000007','$2b$12$ErcCQWPU9zxy.OX7X.SV5ejcYASMdv47r9Cv82LOiU4eDOFyIR3LC','ACTIVE',NULL,'2026-10-01 09:47:28',NULL,'2026-10-01 10:29:21',0,NULL,0,'2026-10-01 09:47:28','2026-10-26 13:13:54',NULL,NULL,0),(8,1,10,'Company Admin','companyadmin@photolab.test','9000000008','$2b$12$pXe4b7ueaEWRd5Dgz/eaauTSnJ4g9lg7NfHgA34fpT6.22FRb5Ama','ACTIVE',NULL,'2026-10-26 13:14:17',NULL,NULL,0,NULL,0,'2026-10-26 13:14:17','2026-10-26 13:14:17',NULL,NULL,0),(9,1,14,'Studio Staff','staff@photolab.test','9000000009','$2b$12$j7xuNGnW9c2brTcAM4YAUefjD2Hg6MvgAigGjd8vSL7UPwhpohfWi','ACTIVE',NULL,'2026-10-26 13:14:18',NULL,NULL,0,NULL,0,'2026-10-26 13:14:18','2026-10-26 13:14:18',NULL,NULL,0),(10,1,16,'Report Manager','reports@photolab.test','9000000010','$2b$12$DQmzviYTCD6DaAJXkcISO.AFrofLHgbuH06PfyDfI8GnRB988oQIu','ACTIVE',NULL,'2026-10-26 13:14:18',NULL,NULL,0,NULL,0,'2026-10-26 13:14:18','2026-10-26 13:14:18',NULL,NULL,0),(11,1,17,'Finance Team','finance@photolab.test','9000000011','$2b$12$PhhOPzNYZLddmuec3METZ.FKQZKysfSxEtYIArEvzXiJmCmXKnkm2','ACTIVE',NULL,'2026-10-26 13:14:18',NULL,NULL,0,NULL,0,'2026-10-26 13:14:18','2026-10-26 13:14:18',NULL,NULL,0),(16,1,17,'Agal','agalyakk34@gmail.com','9876543210','$2b$12$XR26hTcWqJ9NSeAz.n.AmuAIHnTkzK9d/u3Fix/cVfxakaZ5EZfxm','ACTIVE',NULL,'2026-10-26 13:23:41',NULL,NULL,0,NULL,0,'2026-10-26 13:23:41','2026-10-26 13:24:01',NULL,'{\"personal\":{},\"address\":{\"country\":\"India\"},\"permanentAddress\":{\"same\":true},\"education\":[],\"experience\":[]}',0);
/*!40000 ALTER TABLE `tbluser` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbluserpageaccess`
--

DROP TABLE IF EXISTS `tbluserpageaccess`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbluserpageaccess` (
  `user_id` int(10) unsigned NOT NULL,
  `page_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `can_view` tinyint(1) NOT NULL DEFAULT '0',
  `can_add` tinyint(1) NOT NULL DEFAULT '0',
  `can_edit` tinyint(1) NOT NULL DEFAULT '0',
  `can_delete` tinyint(1) NOT NULL DEFAULT '0',
  `updated_by` int(10) unsigned DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`page_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbluserpageaccess`
--

LOCK TABLES `tbluserpageaccess` WRITE;
/*!40000 ALTER TABLE `tbluserpageaccess` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbluserpageaccess` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbluserrole`
--

DROP TABLE IF EXISTS `tbluserrole`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tbluserrole` (
  `user_id` bigint(20) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_user_roles_role` (`role_id`),
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `tblrole` (`roleID`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `tbluser` (`userID`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbluserrole`
--

LOCK TABLES `tbluserrole` WRITE;
/*!40000 ALTER TABLE `tbluserrole` DISABLE KEYS */;
INSERT INTO `tbluserrole` VALUES (1,1,'2026-10-01 09:47:26'),(2,2,'2026-10-01 09:47:26'),(3,3,'2026-10-01 09:47:27'),(4,4,'2026-10-01 09:47:27'),(5,5,'2026-10-01 09:47:27'),(6,6,'2026-10-06 06:46:57'),(7,7,'2026-10-01 09:47:28'),(8,10,'2026-10-26 13:14:17'),(9,14,'2026-10-26 13:14:18'),(10,16,'2026-10-26 13:14:18'),(11,17,'2026-10-26 13:14:18'),(16,17,'2026-10-26 13:24:01');
/*!40000 ALTER TABLE `tbluserrole` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 12:20:03
