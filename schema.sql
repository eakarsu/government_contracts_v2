-- Users table (if not exists)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add role column if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- RFP Documents table
CREATE TABLE IF NOT EXISTS rfp_documents (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    contract_id VARCHAR(255),
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    parsed_content JSONB,
    requirements JSONB,
    sections JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    rfp_document_id INTEGER REFERENCES rfp_documents(id),
    title VARCHAR(255) NOT NULL,
    sections_data JSONB,
    status VARCHAR(50) DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    compliance_score INTEGER DEFAULT 0,
    estimated_value DECIMAL(15,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bid Predictions table
CREATE TABLE IF NOT EXISTS bid_predictions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    contract_id VARCHAR(255) NOT NULL,
    contract_title VARCHAR(255),
    agency VARCHAR(255),
    probability INTEGER,
    confidence INTEGER,
    factors JSONB,
    recommendations JSONB,
    competitive_analysis JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bid History table
CREATE TABLE IF NOT EXISTS bid_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    contract_id VARCHAR(255) NOT NULL,
    bid_amount DECIMAL(15,2),
    outcome VARCHAR(50), -- 'won', 'lost', 'pending'
    submitted_at TIMESTAMP,
    result_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company Profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    company_name VARCHAR(255) NOT NULL,
    basic_info JSONB,
    capabilities JSONB,
    past_performance JSONB,
    certifications JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- RFP Templates table
CREATE TABLE IF NOT EXISTS rfp_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    agency VARCHAR(255),
    description TEXT,
    sections JSONB,
    evaluation_criteria JSONB,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts table (existing)
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    notice_id VARCHAR(255) UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    agency VARCHAR(255),
    naics_code VARCHAR(10),
    classification_code VARCHAR(50),
    posted_date DATE,
    response_deadline TIMESTAMP,
    set_aside_code VARCHAR(50),
    contract_value DECIMAL(15,2),
    place_of_performance TEXT,
    contact_info JSONB,
    requirements TEXT,
    indexed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rfp_documents_user_id ON rfp_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_bid_predictions_user_id ON bid_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_user_id ON bid_history(user_id);
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_notice_id ON contracts(notice_id);
CREATE INDEX IF NOT EXISTS idx_contracts_agency ON contracts(agency);
CREATE INDEX IF NOT EXISTS idx_contracts_naics_code ON contracts(naics_code);

-- Insert default user for development
INSERT INTO users (email, first_name, last_name, role) 
VALUES ('test@example.com', 'Test', 'User', 'user')
ON CONFLICT (email) DO NOTHING;

-- Insert sample RFP templates
INSERT INTO rfp_templates (name, agency, description, sections, evaluation_criteria, updated_at) VALUES
('DOD Standard RFP Template', 'Department of Defense', 'Standard template for DOD contract proposals including security requirements', 
 '[
   {"id": "exec", "title": "Executive Summary", "wordLimit": 1000, "required": true},
   {"id": "tech", "title": "Technical Approach", "wordLimit": 5000, "required": true},
   {"id": "mgmt", "title": "Management Plan", "wordLimit": 3000, "required": true},
   {"id": "past", "title": "Past Performance", "wordLimit": 2000, "required": true},
   {"id": "cost", "title": "Cost Proposal", "wordLimit": 1500, "required": true}
 ]',
 '{"technical": 60, "cost": 25, "pastPerformance": 15}',
 CURRENT_TIMESTAMP
),
('NASA Research & Development Template', 'NASA', 'Template for NASA R&D contracts with emphasis on innovation',
 '[
   {"id": "innovation", "title": "Innovation Approach", "wordLimit": 4000, "required": true},
   {"id": "technical", "title": "Technical Merit", "wordLimit": 3500, "required": true},
   {"id": "team", "title": "Team Qualifications", "wordLimit": 2000, "required": true},
   {"id": "timeline", "title": "Project Timeline", "wordLimit": 1500, "required": true}
 ]',
 '{"technical": 70, "innovation": 20, "team": 10}',
 CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
