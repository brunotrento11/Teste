-- Update the check constraint on risk_score_history.score column to 1-20 range
-- First update existing scores from 0-100 scale to 1-20 scale

-- Update existing scores to new scale (0-100 -> 1-20)
UPDATE risk_score_history
SET score = GREATEST(1, LEAST(20, ROUND(score * 0.2)));

-- Drop the existing check constraint
ALTER TABLE risk_score_history 
DROP CONSTRAINT IF EXISTS risk_score_history_score_check;

-- Add new check constraint for 1-20 range
ALTER TABLE risk_score_history 
ADD CONSTRAINT risk_score_history_score_check 
CHECK (score >= 1 AND score <= 20);