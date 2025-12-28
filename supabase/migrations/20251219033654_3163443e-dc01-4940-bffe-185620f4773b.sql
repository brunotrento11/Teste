-- Refresh da materialized view após correções de classificação de ativos
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_investment_search;