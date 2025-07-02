-- Reset PostgreSQL database only
-- This script will delete all data from all tables

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Delete all data from tables (order matters for foreign keys)
-- Use DO blocks to handle missing tables gracefully
DO $$
BEGIN
    -- Check for both PascalCase and lowercase table names
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('DocumentAnalysis', 'documentanalysis') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentAnalysis' AND table_schema = 'public') THEN
            DELETE FROM "DocumentAnalysis";
            RAISE NOTICE 'Cleared DocumentAnalysis table';
        ELSE
            DELETE FROM documentanalysis;
            RAISE NOTICE 'Cleared documentanalysis table';
        END IF;
    ELSE
        RAISE NOTICE 'DocumentAnalysis table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('DocumentProcessingQueue', 'documentprocessingqueue') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentProcessingQueue' AND table_schema = 'public') THEN
            DELETE FROM "DocumentProcessingQueue";
            RAISE NOTICE 'Cleared DocumentProcessingQueue table';
        ELSE
            DELETE FROM documentprocessingqueue;
            RAISE NOTICE 'Cleared documentprocessingqueue table';
        END IF;
    ELSE
        RAISE NOTICE 'DocumentProcessingQueue table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('IndexingJob', 'indexingjob') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IndexingJob' AND table_schema = 'public') THEN
            DELETE FROM "IndexingJob";
            RAISE NOTICE 'Cleared IndexingJob table';
        ELSE
            DELETE FROM indexingjob;
            RAISE NOTICE 'Cleared indexingjob table';
        END IF;
    ELSE
        RAISE NOTICE 'IndexingJob table does not exist';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('Contract', 'contract') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Contract' AND table_schema = 'public') THEN
            DELETE FROM "Contract";
            RAISE NOTICE 'Cleared Contract table';
        ELSE
            DELETE FROM contract;
            RAISE NOTICE 'Cleared contract table';
        END IF;
    ELSE
        RAISE NOTICE 'Contract table does not exist';
    END IF;
END $$;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Reset sequences (auto-increment counters) if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name IN ('DocumentAnalysis_id_seq', 'documentanalysis_id_seq') AND sequence_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'DocumentAnalysis_id_seq' AND sequence_schema = 'public') THEN
            ALTER SEQUENCE "DocumentAnalysis_id_seq" RESTART WITH 1;
            RAISE NOTICE 'Reset DocumentAnalysis_id_seq';
        ELSE
            ALTER SEQUENCE documentanalysis_id_seq RESTART WITH 1;
            RAISE NOTICE 'Reset documentanalysis_id_seq';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name IN ('DocumentProcessingQueue_id_seq', 'documentprocessingqueue_id_seq') AND sequence_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'DocumentProcessingQueue_id_seq' AND sequence_schema = 'public') THEN
            ALTER SEQUENCE "DocumentProcessingQueue_id_seq" RESTART WITH 1;
            RAISE NOTICE 'Reset DocumentProcessingQueue_id_seq';
        ELSE
            ALTER SEQUENCE documentprocessingqueue_id_seq RESTART WITH 1;
            RAISE NOTICE 'Reset documentprocessingqueue_id_seq';
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name IN ('IndexingJob_id_seq', 'indexingjob_id_seq') AND sequence_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'IndexingJob_id_seq' AND sequence_schema = 'public') THEN
            ALTER SEQUENCE "IndexingJob_id_seq" RESTART WITH 1;
            RAISE NOTICE 'Reset IndexingJob_id_seq';
        ELSE
            ALTER SEQUENCE indexingjob_id_seq RESTART WITH 1;
            RAISE NOTICE 'Reset indexingjob_id_seq';
        END IF;
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('Contract', 'contract') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Contract' AND table_schema = 'public') THEN
            SELECT COUNT(*) INTO contract_count FROM "Contract";
        ELSE
            SELECT COUNT(*) INTO contract_count FROM contract;
        END IF;
        RAISE NOTICE 'Contracts: %', contract_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('IndexingJob', 'indexingjob') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IndexingJob' AND table_schema = 'public') THEN
            SELECT COUNT(*) INTO job_count FROM "IndexingJob";
        ELSE
            SELECT COUNT(*) INTO job_count FROM indexingjob;
        END IF;
        RAISE NOTICE 'IndexingJob: %', job_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('DocumentProcessingQueue', 'documentprocessingqueue') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentProcessingQueue' AND table_schema = 'public') THEN
            SELECT COUNT(*) INTO queue_count FROM "DocumentProcessingQueue";
        ELSE
            SELECT COUNT(*) INTO queue_count FROM documentprocessingqueue;
        END IF;
        RAISE NOTICE 'DocumentProcessingQueue: %', queue_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name IN ('DocumentAnalysis', 'documentanalysis') AND table_schema = 'public') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'DocumentAnalysis' AND table_schema = 'public') THEN
            SELECT COUNT(*) INTO analysis_count FROM "DocumentAnalysis";
        ELSE
            SELECT COUNT(*) INTO analysis_count FROM documentanalysis;
        END IF;
        RAISE NOTICE 'DocumentAnalysis: %', analysis_count;
    END IF;
END $$;
