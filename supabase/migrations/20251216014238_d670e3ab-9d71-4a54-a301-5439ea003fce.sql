-- Criar índice único para permitir refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS mv_investment_search_unique_idx ON mv_investment_search (id);

-- Agora fazer o refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_investment_search;