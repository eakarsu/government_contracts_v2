-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Contract embeddings table
CREATE TABLE contract_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    embedding VECTOR(1536),
    content_summary TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search queries table
CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    query_text TEXT NOT NULL,
    query_embedding VECTOR(1536),
    results_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business profiles table
CREATE TABLE business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opportunity matches table
CREATE TABLE opportunity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    match_score DECIMAL(3,2),
    match_factors JSONB,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RFP documents table
CREATE TABLE rfp_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id),
    original_filename VARCHAR(255),
    file_path TEXT,
    parsed_content JSONB,
    requirements JSONB,
    sections JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Proposal drafts table
CREATE TABLE proposal_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfp_document_id UUID REFERENCES rfp_documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    sections JSONB,
    compliance_status JSONB,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract deadlines table
CREATE TABLE contract_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    deadline_type VARCHAR(100),
    deadline_date TIMESTAMP WITH TIME ZONE,
    description TEXT,
    is_critical BOOLEAN DEFAULT FALSE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance checklists table
CREATE TABLE compliance_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    agency VARCHAR(100),
    checklist_items JSONB,
    completion_status JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document analyses table
CREATE TABLE document_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    document_type VARCHAR(100),
    file_path TEXT,
    summary TEXT,
    key_points JSONB,
    extracted_data JSONB,
    critical_clauses JSONB,
    analysis_confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bid predictions table
CREATE TABLE bid_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    business_profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
    probability_score DECIMAL(3,2),
    confidence_level VARCHAR(20),
    contributing_factors JSONB,
    improvement_suggestions JSONB,
    competitive_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bid history table
CREATE TABLE bid_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    bid_amount DECIMAL(15,2),
    outcome VARCHAR(50),
    win_probability DECIMAL(3,2),
    actual_result BOOLEAN,
    lessons_learned TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contract_embeddings_contract_id ON contract_embeddings(contract_id);
CREATE INDEX idx_contract_embeddings_embedding ON contract_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX idx_opportunity_matches_business_profile_id ON opportunity_matches(business_profile_id);
CREATE INDEX idx_opportunity_matches_contract_id ON opportunity_matches(contract_id);
CREATE INDEX idx_opportunity_matches_score ON opportunity_matches(match_score DESC);
CREATE INDEX idx_rfp_documents_user_id ON rfp_documents(user_id);
CREATE INDEX idx_proposal_drafts_user_id ON proposal_drafts(user_id);
CREATE INDEX idx_contract_deadlines_contract_id ON contract_deadlines(contract_id);
CREATE INDEX idx_contract_deadlines_date ON contract_deadlines(deadline_date);
CREATE INDEX idx_compliance_checklists_contract_id ON compliance_checklists(contract_id);
CREATE INDEX idx_document_analyses_contract_id ON document_analyses(contract_id);
CREATE INDEX idx_bid_predictions_contract_id ON bid_predictions(contract_id);
CREATE INDEX idx_bid_predictions_business_profile_id ON bid_predictions(business_profile_id);
CREATE INDEX idx_bid_history_user_id ON bid_history(user_id);
