import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valores - evita chamadas excessivas
 * @param value - Valor a ser debounced
 * @param delay - Tempo de espera em ms (padrão: 300ms)
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
