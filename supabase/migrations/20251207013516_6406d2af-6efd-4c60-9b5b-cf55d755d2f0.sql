-- Criar função para refresh da view materializada (chamável via RPC)
CREATE OR REPLACE FUNCTION public.refresh_mv_investment_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_investment_search;
END;
$$;

-- Dar permissão para service role executar
GRANT EXECUTE ON FUNCTION public.refresh_mv_investment_search() TO service_role;