-- Add unique constraint on personal_email for redefine_data_repository
-- This ensures no duplicate emails per organization
ALTER TABLE redefine_data_repository 
ADD CONSTRAINT unique_personal_email_per_org 
UNIQUE (org_id, personal_email);

-- Add index for better performance on duplicate checks
CREATE INDEX IF NOT EXISTS idx_redefine_repository_personal_email 
ON redefine_data_repository(org_id, personal_email);