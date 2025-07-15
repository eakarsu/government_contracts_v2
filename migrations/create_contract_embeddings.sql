-- Create contract_embeddings table for vector search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS contract_embeddings (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES "Contract"(id) ON DELETE CASCADE,
    embedding vector(384), -- Using 384-dimensional vectors for Hugging Face models
    content_summary TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_contract_embeddings_embedding ON contract_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create unique index on contract_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_embeddings_contract_id ON contract_embeddings(contract_id);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_contract_embeddings_updated_at BEFORE UPDATE ON contract_embeddings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();