-- Reset PostgreSQL database only
-- This script will delete all data from all tables

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Delete all data from tables (order matters for foreign keys)
-- Use DO blocks to handle missing tables gracefully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentAnalysis') THEN
        DELETE FROM "DocumentAnalysis";
        RAISE NOTICE 'Cleared DocumentAnalysis table';
    ELSE
        RAISE NOTICE 'DocumentAnalysis table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentProcessingQueue') THEN
        DELETE FROM "DocumentProcessingQueue";
        RAISE NOTICE 'Cleared DocumentProcessingQueue table';
    ELSE
        RAISE NOTICE 'DocumentProcessingQueue table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IndexingJob') THEN
        DELETE FROM "IndexingJob";
        RAISE NOTICE 'Cleared IndexingJob table';
    ELSE
        RAISE NOTICE 'IndexingJob table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Contract') THEN
        DELETE FROM "Contract";
        RAISE NOTICE 'Cleared Contract table';
    ELSE
        RAISE NOTICE 'Contract table does not exist';
    END IF;
END $$;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Reset sequences (auto-increment counters) if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'DocumentAnalysis_id_seq') THEN
        ALTER SEQUENCE "DocumentAnalysis_id_seq" RESTART WITH 1;
        RAISE NOTICE 'Reset DocumentAnalysis_id_seq';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'DocumentProcessingQueue_id_seq') THEN
        ALTER SEQUENCE "DocumentProcessingQueue_id_seq" RESTART WITH 1;
        RAISE NOTICE 'Reset DocumentProcessingQueue_id_seq';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'IndexingJob_id_seq') THEN
        ALTER SEQUENCE "IndexingJob_id_seq" RESTART WITH 1;
        RAISE NOTICE 'Reset IndexingJob_id_seq';
    END IF;
END $$;

-- Verify tables are empty (only check existing tables)
SELECT 'Database Reset Summary' as info;

DO $$
DECLARE
    contract_count INTEGER := 0;
    job_count INTEGER := 0;
    queue_count INTEGER := 0;
    analysis_count INTEGER := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Contract') THEN
        SELECT COUNT(*) INTO contract_count FROM "Contract";
        RAISE NOTICE 'Contracts: %', contract_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IndexingJob') THEN
        SELECT COUNT(*) INTO job_count FROM "IndexingJob";
        RAISE NOTICE 'IndexingJob: %', job_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentProcessingQueue') THEN
        SELECT COUNT(*) INTO queue_count FROM "DocumentProcessingQueue";
        RAISE NOTICE 'DocumentProcessingQueue: %', queue_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentAnalysis') THEN
        SELECT COUNT(*) INTO analysis_count FROM "DocumentAnalysis";
        RAISE NOTICE 'DocumentAnalysis: %', analysis_count;
    END IF;
END $$;
