import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const LATENCY_KEY = 'investia_apiLatencyHistory';
const MAX_HISTORY_SIZE = 20;

interface AdaptiveDebounceOptions {
  /** Delay mínimo em ms (default: 150) */
  minDelay: number;
  /** Delay máximo em ms (default: 400) */
  maxDelay: number;
  /** Delay inicial antes de ter dados suficientes (default: 300) */
  initialDelay: number;
}

interface AdaptiveDebounceResult<T> {
  /** Valor após o debounce */
  debouncedValue: T;
  /** Registrar latência de uma requisição */
  recordLatency: (ms: number) => void;
  /** Delay atual sendo usado */
  currentDelay: number;
  /** P75 calculado das últimas requisições (usado para cálculo) */
  p75Latency: number | null;
  /** P90 calculado das últimas requisições (para debug) */
  p90Latency: number | null;
}

/**
 * Hook de debounce adaptativo que ajusta o delay baseado na latência real da API.
 * 
 * Funcionalidades:
 * - Armazena histórico de latências no localStorage
 * - Calcula P75 das últimas 20 requisições (mais robusto a outliers que P90)
 * - Ajusta delay automaticamente:
 *   - P75 < 150ms → usa minDelay (150ms)
 *   - P75 > 250ms → usa cap de 300ms (nunca mais que isso)
 *   - Caso intermediário → P75 + margem de 50ms
 * 
 * @example
 * const { debouncedValue, recordLatency, currentDelay } = useAdaptiveDebounce(searchQuery, {
 *   minDelay: 150,
 *   maxDelay: 300,
 *   initialDelay: 250
 * });
 * 
 * // Na função de busca:
 * const start = performance.now();
 * const data = await fetchData();
 * recordLatency(performance.now() - start);
 * 
 * @param value - Valor a ser debounced
 * @param options - Configurações do debounce
 * @returns Objeto com valor debounced e funções utilitárias
 */
export function useAdaptiveDebounce<T>(
  value: T,
  options: Partial<AdaptiveDebounceOptions> = {}
): AdaptiveDebounceResult<T> {
  const { 
    minDelay = 150, 
    maxDelay = 300,  // Cap reduzido de 400 → 300
    initialDelay = 250 
  } = options;
  
  const [latencyHistory, setLatencyHistory] = useLocalStorage<number[]>(LATENCY_KEY, []);
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  /**
   * Calcula o percentil 75 do histórico de latências
   * P75 é mais robusto a outliers que P90
   */
  const calculateP75 = useCallback((): number | null => {
    if (latencyHistory.length < 5) return null;
    
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const p75Index = Math.floor(sorted.length * 0.75);
    return sorted[p75Index];
  }, [latencyHistory]);

  /**
   * Calcula o percentil 90 do histórico de latências (para debug)
   */
  const calculateP90 = useCallback((): number | null => {
    if (latencyHistory.length < 5) return null;
    
    const sorted = [...latencyHistory].sort((a, b) => a - b);
    const p90Index = Math.floor(sorted.length * 0.9);
    return sorted[p90Index];
  }, [latencyHistory]);

  /**
   * Calcula o delay ótimo baseado no P75 com cap de 300ms
   * - P75 < 150ms → usa delay mínimo (API rápida)
   * - P75 > 250ms → usa cap de 300ms
   * - Intermediário → P75 + 50ms de margem
   */
  const calculateOptimalDelay = useCallback((): number => {
    const p75 = calculateP75();
    
    // Sem dados suficientes, usar delay inicial
    if (p75 === null) return initialDelay;
    
    // API muito rápida: usar delay mínimo
    if (p75 < minDelay) return minDelay;
    
    // Cap máximo mais agressivo: nunca passar de 300ms
    const targetDelay = p75 + 50;
    return Math.min(targetDelay, Math.min(maxDelay, 300));
  }, [calculateP75, minDelay, maxDelay, initialDelay]);

  const currentDelay = calculateOptimalDelay();

  // Efeito de debounce com delay dinâmico
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, currentDelay);

    return () => clearTimeout(timer);
  }, [value, currentDelay]);

  /**
   * Registra a latência de uma requisição para ajuste adaptativo
   * Mantém apenas as últimas MAX_HISTORY_SIZE medições
   * 
   * @param ms - Latência em milissegundos
   */
  const recordLatency = useCallback((ms: number) => {
    if (ms < 0 || ms > 30000) return; // Ignorar valores inválidos (> 30s)
    
    setLatencyHistory(prev => {
      const newHistory = [...prev, Math.round(ms)];
      // Manter apenas as últimas N medições
      return newHistory.slice(-MAX_HISTORY_SIZE);
    });
  }, [setLatencyHistory]);

  return {
    debouncedValue,
    recordLatency,
    currentDelay,
    p75Latency: calculateP75(),
    p90Latency: calculateP90()
  };
}
