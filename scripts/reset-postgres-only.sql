-- Reset PostgreSQL database only
-- This script will delete all data from all tables

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Delete all data from tables (order matters for foreign keys)
DELETE FROM "DocumentAnalysis";
DELETE FROM "DocumentProcessingQueue";
DELETE FROM "IndexingJob";
DELETE FROM "Contract";

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Reset sequences (auto-increment counters)
ALTER SEQUENCE "DocumentAnalysis_id_seq" RESTART WITH 1;
ALTER SEQUENCE "DocumentProcessingQueue_id_seq" RESTART WITH 1;
ALTER SEQUENCE "IndexingJob_id_seq" RESTART WITH 1;

-- Verify tables are empty
SELECT 'Contracts' as table_name, COUNT(*) as count FROM "Contract"
UNION ALL
SELECT 'IndexingJob' as table_name, COUNT(*) as count FROM "IndexingJob"
UNION ALL
SELECT 'DocumentProcessingQueue' as table_name, COUNT(*) as count FROM "DocumentProcessingQueue"
UNION ALL
SELECT 'DocumentAnalysis' as table_name, COUNT(*) as count FROM "DocumentAnalysis";
