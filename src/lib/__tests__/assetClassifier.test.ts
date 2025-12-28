import { describe, it, expect } from 'vitest';
import { classifyAssetType, KNOWN_ETFS, KNOWN_UNITS } from '../assetClassifier';

describe('Asset Classification', () => {
  describe('Stock variants', () => {
    it('should classify PETR4F as stock_fractional', () => {
      expect(classifyAssetType('PETR4F')).toBe('stock_fractional');
    });

    it('should classify BEEF3 as stock (F in middle, not suffix)', () => {
      expect(classifyAssetType('BEEF3')).toBe('stock');
    });

    it('should classify PETR4 as stock', () => {
      expect(classifyAssetType('PETR4')).toBe('stock');
    });

    it('should classify VALE3 as stock', () => {
      expect(classifyAssetType('VALE3')).toBe('stock');
    });

    it('should classify VALE3F as stock_fractional', () => {
      expect(classifyAssetType('VALE3F')).toBe('stock_fractional');
    });
  });

  describe('Units vs FIIs', () => {
    it('should classify SANB11 as unit (not FII)', () => {
      expect(classifyAssetType('SANB11')).toBe('unit');
    });

    it('should classify TAEE11 as unit', () => {
      expect(classifyAssetType('TAEE11')).toBe('unit');
    });

    it('should classify KLBN11 as unit', () => {
      expect(classifyAssetType('KLBN11')).toBe('unit');
    });

    it('should classify BPAC11 as unit', () => {
      expect(classifyAssetType('BPAC11')).toBe('unit');
    });

    it('should classify HGLG11 as FII (not unit)', () => {
      expect(classifyAssetType('HGLG11')).toBe('fii');
    });

    it('should classify MXRF11 as FII', () => {
      expect(classifyAssetType('MXRF11')).toBe('fii');
    });

    it('should classify XPLG11 as FII', () => {
      expect(classifyAssetType('XPLG11')).toBe('fii');
    });
  });

  describe('BDR variants', () => {
    it('should classify GOGL35 as bdr (suffix 35)', () => {
      expect(classifyAssetType('GOGL35')).toBe('bdr');
    });

    it('should classify M1TA34 as bdr (with numbers in body)', () => {
      expect(classifyAssetType('M1TA34')).toBe('bdr');
    });

    it('should classify XPBR31 as bdr (suffix 31)', () => {
      expect(classifyAssetType('XPBR31')).toBe('bdr');
    });

    it('should classify AAPL34 as bdr (standard)', () => {
      expect(classifyAssetType('AAPL34')).toBe('bdr');
    });

    it('should classify P2LT34 as bdr (digit in middle)', () => {
      expect(classifyAssetType('P2LT34')).toBe('bdr');
    });

    it('should classify ABGD39 as bdr (suffix 39)', () => {
      expect(classifyAssetType('ABGD39')).toBe('bdr');
    });
  });

  describe('ETFs', () => {
    it('should classify BOVA11 as etf', () => {
      expect(classifyAssetType('BOVA11')).toBe('etf');
    });

    it('should classify HASH11 as etf', () => {
      expect(classifyAssetType('HASH11')).toBe('etf');
    });

    it('should classify IVVB11 as etf', () => {
      expect(classifyAssetType('IVVB11')).toBe('etf');
    });

    it('should classify IMAB11 as etf', () => {
      expect(classifyAssetType('IMAB11')).toBe('etf');
    });
  });

  describe('Invalid tickers', () => {
    it('should classify numeric ticker as invalid', () => {
      expect(classifyAssetType('123434')).toBe('invalid');
    });

    it('should classify short numeric ticker as invalid', () => {
      expect(classifyAssetType('11')).toBe('invalid');
    });

    it('should classify empty string as invalid', () => {
      expect(classifyAssetType('')).toBe('invalid');
    });
  });

  describe('Name-based classification', () => {
    it('should classify as ETF when name contains ETF', () => {
      expect(classifyAssetType('XYZZ11', { shortName: 'XYZ ETF FUND' })).toBe('etf');
    });

    it('should classify as unit when name contains UNT', () => {
      expect(classifyAssetType('XYZZ11', { shortName: 'XYZ UNT' })).toBe('unit');
    });

    it('should classify as FII when name contains FII', () => {
      expect(classifyAssetType('XYZZ11', { shortName: 'FII XYZ LOGISTICA' })).toBe('fii');
    });

    it('should classify as FII when name contains FIAGRO', () => {
      expect(classifyAssetType('XYZZ11', { longName: 'FIAGRO XYZ' })).toBe('fii');
    });
  });

  describe('Known lists integrity', () => {
    it('KNOWN_ETFS should contain major ETFs', () => {
      expect(KNOWN_ETFS).toContain('BOVA11');
      expect(KNOWN_ETFS).toContain('IVVB11');
      expect(KNOWN_ETFS).toContain('HASH11');
    });

    it('KNOWN_UNITS should contain major units', () => {
      expect(KNOWN_UNITS).toContain('SANB11');
      expect(KNOWN_UNITS).toContain('TAEE11');
      expect(KNOWN_UNITS).toContain('KLBN11');
    });

    it('KNOWN_UNITS and KNOWN_ETFS should not overlap', () => {
      const overlap = KNOWN_UNITS.filter(u => KNOWN_ETFS.includes(u));
      expect(overlap).toHaveLength(0);
    });
  });
});
