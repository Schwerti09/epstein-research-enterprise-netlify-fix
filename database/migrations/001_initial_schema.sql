-- Neon PostgreSQL Schema (Template) + pgvector
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_vector vector(1536),
  document_type VARCHAR(50),
  source_url TEXT,
  page_count INTEGER,
  release_date DATE,
  redaction_level VARCHAR(20) DEFAULT 'partial',
  metadata JSONB DEFAULT '{}'::jsonb,
  ethical_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_vector ON documents
  USING ivfflat (content_vector vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS document_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  analysis_version VARCHAR(20) DEFAULT 'v2.0',
  summary TEXT,
  key_entities JSONB DEFAULT '[]'::jsonb,
  relationships JSONB DEFAULT '[]'::jsonb,
  timeline_events JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  sentiment_analysis JSONB DEFAULT '{}'::jsonb,
  legal_references JSONB DEFAULT '[]'::jsonb,
  model_used VARCHAR(100),
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, analysis_version)
);

CREATE INDEX IF NOT EXISTS idx_analyses_document ON document_analyses(document_id);

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255),
  entity_type VARCHAR(50),
  category VARCHAR(100),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(normalized_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_entities_embedding ON entities
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID REFERENCES entities(id),
  target_entity_id UUID REFERENCES entities(id),
  relationship_type VARCHAR(100),
  strength FLOAT DEFAULT 0.5,
  evidence_count INTEGER DEFAULT 1,
  first_seen DATE,
  last_seen DATE,
  documents JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key VARCHAR(255),
  endpoint VARCHAR(255),
  request_count INTEGER DEFAULT 1,
  tokens_used INTEGER DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  tier VARCHAR(50) DEFAULT 'free',
  usage_day DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_unique ON api_usage(api_key, endpoint, usage_day);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON api_usage(api_key, timestamp DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100),
  user_id VARCHAR(255),
  session_id VARCHAR(255),
  document_id UUID REFERENCES documents(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS analytics_events_2025_01 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS api_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tier VARCHAR(50) NOT NULL,
  monthly_price DECIMAL(10,2),
  limits JSONB NOT NULL DEFAULT '{
    "monthly_requests": 1000,
    "concurrent_requests": 5,
    "document_limit": 100,
    "ai_analysis": false,
    "api_access": false,
    "webhooks": false
  }'::jsonb,
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON api_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON api_subscriptions(tier);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id VARCHAR(255) NOT NULL,
  referral_code VARCHAR(100),
  customer_email VARCHAR(255),
  product VARCHAR(100),
  amount DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_code ON affiliate_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_product ON affiliate_referrals(product, status);
