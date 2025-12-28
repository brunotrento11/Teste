import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdaptiveDebounce } from '../useAdaptiveDebounce';

const LATENCY_KEY = 'investia_apiLatencyHistory';

describe('useAdaptiveDebounce', () => {
  describe('Cálculo de P75', () => {
    it('retorna null com menos de 5 medições', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      // Registrar 4 latências (menos que o mínimo de 5)
      act(() => {
        result.current.recordLatency(100);
        result.current.recordLatency(200);
        result.current.recordLatency(150);
        result.current.recordLatency(180);
      });

      expect(result.current.p75Latency).toBeNull();
    });

    it('calcula P75 corretamente com exatamente 5 medições', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      // 5 medições: [100, 150, 180, 200, 250]
      // P75 index = floor(5 * 0.75) = 3 → valor 200
      act(() => {
        result.current.recordLatency(100);
        result.current.recordLatency(200);
        result.current.recordLatency(150);
        result.current.recordLatency(250);
        result.current.recordLatency(180);
      });

      expect(result.current.p75Latency).toBe(200);
    });

    it('calcula P75 corretamente com 10 medições', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      // 10 medições: [50, 100, 120, 150, 180, 200, 220, 250, 280, 300]
      // P75 index = floor(10 * 0.75) = 7 → valor 250
      act(() => {
        [50, 100, 120, 150, 180, 200, 220, 250, 280, 300].forEach(ms => {
          result.current.recordLatency(ms);
        });
      });

      expect(result.current.p75Latency).toBe(250);
    });
  });

  describe('Cálculo de P90', () => {
    it('retorna null com menos de 5 medições', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      act(() => {
        result.current.recordLatency(100);
        result.current.recordLatency(200);
      });

      expect(result.current.p90Latency).toBeNull();
    });

    it('calcula P90 corretamente com 10 medições', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      // 10 medições: [50, 100, 120, 150, 180, 200, 220, 250, 280, 300]
      // P90 index = floor(10 * 0.9) = 9 → valor 300
      act(() => {
        [50, 100, 120, 150, 180, 200, 220, 250, 280, 300].forEach(ms => {
          result.current.recordLatency(ms);
        });
      });

      expect(result.current.p90Latency).toBe(300);
    });
  });

  describe('Delay Adaptativo', () => {
    it('usa initialDelay quando não há medições suficientes', () => {
      const { result } = renderHook(() => 
        useAdaptiveDebounce('test', { initialDelay: 250 })
      );

      expect(result.current.currentDelay).toBe(250);
    });

    it('usa minDelay quando API é muito rápida (P75 < minDelay)', () => {
      const { result } = renderHook(() => 
        useAdaptiveDebounce('test', { minDelay: 150 })
      );
      
      // P75 = 80ms (muito rápido)
      act(() => {
        [50, 60, 70, 80, 100].forEach(ms => {
          result.current.recordLatency(ms);
        });
      });

      expect(result.current.currentDelay).toBe(150);
    });

    it('nunca excede 300ms (cap máximo)', () => {
      const { result } = renderHook(() => 
        useAdaptiveDebounce('test', { maxDelay: 400 })
      );
      
      // P75 = 500ms (API muito lenta)
      act(() => {
        [400, 450, 500, 550, 600].forEach(ms => {
          result.current.recordLatency(ms);
        });
      });

      // Mesmo com maxDelay: 400, cap é 300ms
      expect(result.current.currentDelay).toBeLessThanOrEqual(300);
    });

    it('calcula delay como P75 + 50ms para caso intermediário', () => {
      const { result } = renderHook(() => 
        useAdaptiveDebounce('test', { minDelay: 150, maxDelay: 300 })
      );
      
      // P75 = 180ms → delay = 180 + 50 = 230ms
      act(() => {
        [100, 120, 150, 180, 200].forEach(ms => {
          result.current.recordLatency(ms);
        });
      });

      expect(result.current.currentDelay).toBe(230);
    });
  });

  describe('Validação de Latência', () => {
    it('ignora latências negativas', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      act(() => {
        result.current.recordLatency(-100);
        result.current.recordLatency(-50);
      });

      // Não deve ter registrado nada
      const stored = localStorage.getItem(LATENCY_KEY);
      expect(stored).toBe('[]');
    });

    it('ignora latências maiores que 30 segundos', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      act(() => {
        result.current.recordLatency(35000); // 35s
        result.current.recordLatency(60000); // 60s
      });

      const stored = localStorage.getItem(LATENCY_KEY);
      expect(stored).toBe('[]');
    });

    it('arredonda latências para inteiro', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      act(() => {
        result.current.recordLatency(123.456);
        result.current.recordLatency(200.999);
      });

      const stored = JSON.parse(localStorage.getItem(LATENCY_KEY) || '[]');
      expect(stored).toEqual([123, 201]);
    });
  });

  describe('Histórico e Persistência', () => {
    it('mantém apenas as últimas 20 medições (MAX_HISTORY_SIZE)', () => {
      const { result } = renderHook(() => useAdaptiveDebounce('test'));
      
      // Registrar 25 latências
      act(() => {
        for (let i = 1; i <= 25; i++) {
          result.current.recordLatency(i * 10);
        }
      });

      const stored = JSON.parse(localStorage.getItem(LATENCY_KEY) || '[]');
      expect(stored.length).toBe(20);
      // Deve manter os últimos 20 (60 a 250)
      expect(stored[0]).toBe(60);
      expect(stored[19]).toBe(250);
    });

    it('persiste histórico no localStorage entre instâncias', () => {
      // Primeira instância - registrar latências
      const { result: result1, unmount } = renderHook(() => 
        useAdaptiveDebounce('test')
      );
      
      act(() => {
        [100, 150, 200, 250, 300].forEach(ms => {
          result1.current.recordLatency(ms);
        });
      });

      // Desmontar primeira instância
      unmount();

      // Segunda instância - deve ler histórico
      const { result: result2 } = renderHook(() => 
        useAdaptiveDebounce('test')
      );

      expect(result2.current.p75Latency).toBe(250);
    });
  });

  describe('Debounce do Valor', () => {
    it('debounce atualiza valor após delay', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdaptiveDebounce(value, { initialDelay: 100 }),
        { initialProps: { value: 'initial' } }
      );

      expect(result.current.debouncedValue).toBe('initial');

      // Mudar valor
      rerender({ value: 'updated' });

      // Ainda deve ter valor antigo
      expect(result.current.debouncedValue).toBe('initial');

      // Avançar o tempo
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Agora deve ter valor novo
      expect(result.current.debouncedValue).toBe('updated');
    });

    it('cancela debounce anterior quando valor muda rapidamente', async () => {
      const { result, rerender } = renderHook(
        ({ value }) => useAdaptiveDebounce(value, { initialDelay: 100 }),
        { initialProps: { value: 'a' } }
      );

      // Mudanças rápidas
      rerender({ value: 'ab' });
      act(() => { vi.advanceTimersByTime(50); });
      
      rerender({ value: 'abc' });
      act(() => { vi.advanceTimersByTime(50); });
      
      rerender({ value: 'abcd' });
      
      // Ainda deve ter valor original
      expect(result.current.debouncedValue).toBe('a');

      // Avançar tempo total
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Deve ter último valor
      expect(result.current.debouncedValue).toBe('abcd');
    });
  });
});
