-- Adicionar campos de objetivo financeiro na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS financial_goal text,
ADD COLUMN IF NOT EXISTS goal_amount numeric,
ADD COLUMN IF NOT EXISTS goal_timeframe integer;