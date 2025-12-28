-- Fix the check constraint on risk_score_history.score column
-- The score is calculated as 0-100, but the constraint expects 0-1

-- Drop the existing check constraint
ALTER TABLE risk_score_history 
DROP CONSTRAINT IF EXISTS risk_score_history_score_check;

-- Add new check constraint for 0-100 range
ALTER TABLE risk_score_history 
ADD CONSTRAINT risk_score_history_score_check 
CHECK (score >= 0 AND score <= 100);