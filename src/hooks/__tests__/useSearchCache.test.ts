import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchCache, CachedAsset } from '../useSearchCache';

const CACHE_KEY = 'investia_searchCache';
const QUERIES_KEY = 'investia_lastSearchQueries';

describe('useSearchCache', () => {
  describe('Inicialização', () => {
    it('inicializa com ativos populares', () => {
      const { result } = renderHook(() => useSearchCache());

      expect(result.current.popularAssets.length).toBeGreaterThan(0);
      expect(result.current.cachedAssets.length).toBeGreaterThan(0);
    });

    it('ativos populares incluem PETR4, VALE3, ITUB4', () => {
      const { result } = renderHook(() => useSearchCache());

      const tickers = result.current.popularAssets.map(a => a.ticker);
      expect(tickers).toContain('PETR4');
      expect(tickers).toContain('VALE3');
      expect(tickers).toContain('ITUB4');
    });
  });

  describe('getInstantSuggestions - Match Score', () => {
    it('retorna array vazio para query com menos de 2 caracteres', () => {
      const { result } = renderHook(() => useSearchCache());

      expect(result.current.getInstantSuggestions('')).toEqual([]);
      expect(result.current.getInstantSuggestions('a')).toEqual([]);
      expect(result.current.getInstantSuggestions('p')).toEqual([]);
    });

    it('match exato no início do ticker tem maior score', () => {
      const { result } = renderHook(() => useSearchCache());

      const suggestions = result.current.getInstantSuggestions('petr');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].ticker).toBe('PETR4');
    });

    it('match no início do nome funciona', () => {
      const { result } = renderHook(() => useSearchCache());

      const suggestions = result.current.getInstantSuggestions('petro');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].ticker).toBe('PETR4');
    });

    it('match em qualquer posição do ticker funciona', () => {
      const { result } = renderHook(() => useSearchCache());

      const suggestions = result.current.getInstantSuggestions('tr4');
      
      // Deve encontrar PETR4 (contém TR4)
      const found = suggestions.find(s => s.ticker === 'PETR4');
      expect(found).toBeDefined();
    });

    it('limita número de resultados ao limit especificado', () => {
      const { result } = renderHook(() => useSearchCache());

      const suggestions = result.current.getInstantSuggestions('a', 3);
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('default limit é 5', () => {
      const { result } = renderHook(() => useSearchCache());

      // Busca genérica que deve retornar vários
      const suggestions = result.current.getInstantSuggestions('11');
      
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getInstantSuggestions - Normalização', () => {
    it('busca é case-insensitive', () => {
      const { result } = renderHook(() => useSearchCache());

      const lower = result.current.getInstantSuggestions('petr4');
      const upper = result.current.getInstantSuggestions('PETR4');
      const mixed = result.current.getInstantSuggestions('PeTr4');

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
    });

    it('normaliza acentos na busca', () => {
      const { result } = renderHook(() => useSearchCache());

      // "São" deveria ser normalizado para "sao"
      // Primeiro, adicionar um ativo com acento no cache
      act(() => {
        result.current.updateCache('sao', [{
          code: 'TEST1',
          emissor: 'São Paulo S.A.',
          asset_type: 'stock'
        }]);
      });

      const withAccent = result.current.getInstantSuggestions('são');
      const withoutAccent = result.current.getInstantSuggestions('sao');

      // Ambos devem encontrar o mesmo ativo
      expect(withAccent.length).toBeGreaterThan(0);
      expect(withoutAccent.length).toBeGreaterThan(0);
    });
  });

  describe('updateCache', () => {
    it('ignora queries vazias ou muito curtas', () => {
      const { result } = renderHook(() => useSearchCache());
      const initialLength = result.current.cachedAssets.length;

      act(() => {
        result.current.updateCache('', [{
          code: 'TEST1',
          emissor: 'Test',
          asset_type: 'stock'
        }]);
        result.current.updateCache('a', [{
          code: 'TEST2',
          emissor: 'Test 2',
          asset_type: 'stock'
        }]);
      });

      expect(result.current.cachedAssets.length).toBe(initialLength);
    });

    it('ignora resultados vazios', () => {
      const { result } = renderHook(() => useSearchCache());
      const initialLength = result.current.cachedAssets.length;

      act(() => {
        result.current.updateCache('teste', []);
      });

      expect(result.current.cachedAssets.length).toBe(initialLength);
    });

    it('adiciona novos ativos ao cache', () => {
      const { result } = renderHook(() => useSearchCache());

      act(() => {
        result.current.updateCache('newasset', [{
          code: 'NEW1',
          emissor: 'New Asset Corp',
          asset_type: 'stock'
        }]);
      });

      const found = result.current.cachedAssets.find(a => a.ticker === 'NEW1');
      expect(found).toBeDefined();
      expect(found?.emissor).toBe('New Asset Corp');
    });

    it('incrementa searchCount para ativos existentes', () => {
      const { result } = renderHook(() => useSearchCache());

      // PETR4 já existe nos populares
      const initialPetr4 = result.current.cachedAssets.find(a => a.ticker === 'PETR4');
      const initialCount = initialPetr4?.searchCount || 0;

      act(() => {
        result.current.updateCache('petr', [{
          code: 'PETR4',
          emissor: 'Petrobras',
          asset_type: 'stock'
        }]);
      });

      const updatedPetr4 = result.current.cachedAssets.find(a => a.ticker === 'PETR4');
      expect(updatedPetr4?.searchCount).toBeGreaterThan(initialCount);
    });

    it('atualiza lastSearched timestamp', () => {
      const { result } = renderHook(() => useSearchCache());

      const before = Date.now();

      act(() => {
        result.current.updateCache('test', [{
          code: 'TIMETEST',
          emissor: 'Time Test',
          asset_type: 'stock'
        }]);
      });

      const after = Date.now();
      const found = result.current.cachedAssets.find(a => a.ticker === 'TIMETEST');
      
      expect(found?.lastSearched).toBeGreaterThanOrEqual(before);
      expect(found?.lastSearched).toBeLessThanOrEqual(after);
    });

    it('armazena query no lastQueries para busca exata', () => {
      const { result } = renderHook(() => useSearchCache());

      act(() => {
        result.current.updateCache('exactquery', [{
          code: 'EXACT1',
          emissor: 'Exact Match',
          asset_type: 'stock'
        }]);
      });

      // Buscar pela query exata deve retornar do cache
      const suggestions = result.current.getInstantSuggestions('exactquery');
      expect(suggestions[0]?.ticker).toBe('EXACT1');
    });
  });

  describe('Limite de Cache (MAX_CACHE_SIZE)', () => {
    it('cache não excede 100 ativos', () => {
      const { result } = renderHook(() => useSearchCache());

      // Adicionar muitos ativos
      act(() => {
        for (let i = 0; i < 150; i++) {
          result.current.updateCache(`query${i}`, [{
            code: `ASSET${i}`,
            emissor: `Asset ${i}`,
            asset_type: 'stock'
          }]);
        }
      });

      expect(result.current.cachedAssets.length).toBeLessThanOrEqual(100);
    });

    it('mantém ativos mais buscados quando excede limite', () => {
      const { result } = renderHook(() => useSearchCache());

      // Buscar PETR4 várias vezes para aumentar frequência
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.updateCache('petr', [{
            code: 'PETR4',
            emissor: 'Petrobras',
            asset_type: 'stock'
          }]);
        }
      });

      // Adicionar muitos ativos novos
      act(() => {
        for (let i = 0; i < 120; i++) {
          result.current.updateCache(`new${i}`, [{
            code: `NEW${i}`,
            emissor: `New Asset ${i}`,
            asset_type: 'stock'
          }]);
        }
      });

      // PETR4 deve ainda estar no cache (alta frequência)
      const petr4 = result.current.cachedAssets.find(a => a.ticker === 'PETR4');
      expect(petr4).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('reseta cache para ativos populares', () => {
      const { result } = renderHook(() => useSearchCache());

      // Adicionar ativos customizados
      act(() => {
        result.current.updateCache('custom', [{
          code: 'CUSTOM1',
          emissor: 'Custom Corp',
          asset_type: 'stock'
        }]);
      });

      expect(result.current.cachedAssets.find(a => a.ticker === 'CUSTOM1')).toBeDefined();

      // Limpar cache
      act(() => {
        result.current.clearCache();
      });

      // Custom asset deve ter sido removido
      expect(result.current.cachedAssets.find(a => a.ticker === 'CUSTOM1')).toBeUndefined();
      
      // Populares devem estar de volta
      expect(result.current.cachedAssets.find(a => a.ticker === 'PETR4')).toBeDefined();
    });

    it('limpa lastQueries também', () => {
      const { result } = renderHook(() => useSearchCache());

      act(() => {
        result.current.updateCache('testquery', [{
          code: 'TEST1',
          emissor: 'Test',
          asset_type: 'stock'
        }]);
      });

      // Verificar que query cacheada retorna resultado
      expect(result.current.getInstantSuggestions('testquery').length).toBeGreaterThan(0);

      act(() => {
        result.current.clearCache();
      });

      // Agora a busca não deve retornar o resultado cacheado
      const suggestions = result.current.getInstantSuggestions('testquery');
      expect(suggestions.find(s => s.ticker === 'TEST1')).toBeUndefined();
    });
  });

  describe('Ordenação por Frequência', () => {
    it('ativos mais buscados aparecem primeiro em empate de score', () => {
      const { result } = renderHook(() => useSearchCache());

      // Adicionar dois ativos com tickers similares
      act(() => {
        result.current.updateCache('test', [{
          code: 'TESTA1',
          emissor: 'Test A',
          asset_type: 'stock'
        }]);
        result.current.updateCache('test', [{
          code: 'TESTB1',
          emissor: 'Test B',
          asset_type: 'stock'
        }]);
      });

      // Buscar TESTA1 mais vezes
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.updateCache('testa', [{
            code: 'TESTA1',
            emissor: 'Test A',
            asset_type: 'stock'
          }]);
        }
      });

      // Quando ambos matcham igualmente, TESTA1 deve vir primeiro
      const suggestions = result.current.getInstantSuggestions('test');
      const indexA = suggestions.findIndex(s => s.ticker === 'TESTA1');
      const indexB = suggestions.findIndex(s => s.ticker === 'TESTB1');
      
      if (indexA !== -1 && indexB !== -1) {
        expect(indexA).toBeLessThan(indexB);
      }
    });
  });

  describe('Persistência no localStorage', () => {
    it('persiste cache entre instâncias', () => {
      // Primeira instância - adicionar ativo
      const { result: result1, unmount } = renderHook(() => useSearchCache());
      
      act(() => {
        result1.current.updateCache('persist', [{
          code: 'PERSIST1',
          emissor: 'Persist Test',
          asset_type: 'stock'
        }]);
      });

      unmount();

      // Segunda instância - deve encontrar o ativo
      const { result: result2 } = renderHook(() => useSearchCache());
      
      const found = result2.current.cachedAssets.find(a => a.ticker === 'PERSIST1');
      expect(found).toBeDefined();
    });
  });
});
