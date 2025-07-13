-- Enhanced AI-powered features database schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Note: vector extension may not be available in all PostgreSQL installations
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contracts table (if not exists) - extend existing if needed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts') THEN
        CREATE TABLE contracts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            notice_id VARCHAR(255) UNIQUE,
            title TEXT,
            description TEXT,
            agency VARCHAR(255),
            naics_code VARCHAR(20),
            classification_code VARCHAR(50),
            posted_date TIMESTAMP WITH TIME ZONE,
            deadline TIMESTAMP WITH TIME ZONE,
            set_aside_type VARCHAR(100),
            estimated_value DECIMAL(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- Add missing columns to contracts table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'set_aside_type') THEN
        ALTER TABLE contracts ADD COLUMN set_aside_type VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'estimated_value') THEN
        ALTER TABLE contracts ADD COLUMN estimated_value DECIMAL(15,2);
    END IF;
END $$;

-- Contract embeddings for semantic search
-- Note: Using TEXT to store embeddings as JSON array since vector extension may not be available
CREATE TABLE IF NOT EXISTS contract_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID,
    embedding TEXT, -- JSON array of floats, e.g., '[0.1, 0.2, ...]'
    content_summary TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint after ensuring contracts table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contracts') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_contract_embeddings_contract_id'
        ) THEN
            ALTER TABLE contract_embeddings 
            ADD CONSTRAINT fk_contract_embeddings_contract_id 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- Search queries for analytics and caching
CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    query_text TEXT NOT NULL,
    query_embedding TEXT, -- JSON array of floats
    results_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    query_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Business profiles for opportunity matching
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    company_name VARCHAR(255) NOT NULL,
    naics_codes JSONB,
    capabilities TEXT[],
    certifications JSONB,
    past_performance JSONB,
    geographic_preferences JSONB,
    annual_revenue DECIMAL(15,2),
    employee_count INTEGER,
    security_clearance_level VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Opportunity matches for AI recommendations
CREATE TABLE IF NOT EXISTS opportunity_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_profile_id UUID,
    contract_id UUID,
    match_score DECIMAL(3,2),
    match_factors JSONB,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (business_profile_id) REFERENCES business_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

-- RFP documents for proposal drafting
CREATE TABLE IF NOT EXISTS rfp_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    contract_id UUID,
    original_filename VARCHAR(255),
    file_path TEXT,
    parsed_content JSONB,
    requirements JSONB,
    sections JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE SET NULL
);

-- Proposal drafts
CREATE TABLE IF NOT EXISTS proposal_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfp_document_id UUID,
    user_id UUID,
    title VARCHAR(255),
    sections JSONB,
    compliance_status JSONB,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (rfp_document_id) REFERENCES rfp_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contract deadlines for compliance tracking
CREATE TABLE IF NOT EXISTS contract_deadlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID,
    deadline_type VARCHAR(100),
    deadline_date TIMESTAMP WITH TIME ZONE,
    description TEXT,
    is_critical BOOLEAN DEFAULT FALSE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

-- Compliance checklists
CREATE TABLE IF NOT EXISTS compliance_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID,
    agency VARCHAR(100),
    checklist_items JSONB,
    completion_status JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

-- Document analyses for attachment analysis
CREATE TABLE IF NOT EXISTS document_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID,
    document_type VARCHAR(100),
    file_path TEXT,
    summary TEXT,
    key_points JSONB,
    extracted_data JSONB,
    critical_clauses JSONB,
    analysis_confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

-- Bid predictions for probability scoring
CREATE TABLE IF NOT EXISTS bid_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID,
    business_profile_id UUID,
    probability_score DECIMAL(3,2),
    confidence_level VARCHAR(20),
    contributing_factors JSONB,
    improvement_suggestions JSONB,
    competitive_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (business_profile_id) REFERENCES business_profiles(id) ON DELETE CASCADE
);

-- Bid history for ML training
CREATE TABLE IF NOT EXISTS bid_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    contract_id UUID,
    bid_amount DECIMAL(15,2),
    outcome VARCHAR(50),
    win_probability DECIMAL(3,2),
    actual_result BOOLEAN,
    lessons_learned TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id ON contract_embeddings(contract_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_profile_id ON opportunity_matches(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_matches_contract_id ON opportunity_matches(contract_id);
CREATE INDEX IF NOT EXISTS idx_rfp_documents_user_id ON rfp_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_proposal_drafts_rfp_id ON proposal_drafts(rfp_document_id);
CREATE INDEX IF NOT EXISTS idx_contract_deadlines_contract_id ON contract_deadlines(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_deadlines_date ON contract_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_document_analyses_contract_id ON document_analyses(contract_id);
CREATE INDEX IF NOT EXISTS idx_bid_predictions_profile_id ON bid_predictions(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_user_id ON bid_history(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_deadline ON contracts(deadline);
CREATE INDEX IF NOT EXISTS idx_contracts_agency ON contracts(agency);
CREATE INDEX IF NOT EXISTS idx_contracts_naics_code ON contracts(naics_code);

-- Insert sample data for testing (optional)
DO $$ 
BEGIN
    -- Insert a test user if none exists
    IF NOT EXISTS (SELECT 1 FROM users LIMIT 1) THEN
        INSERT INTO users (email, password_hash, first_name, last_name) 
        VALUES ('test@example.com', '$2b$12$dummy.hash.for.testing', 'Test', 'User');
    END IF;
END $$;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'AI-powered features database schema created successfully!';
END $$;
