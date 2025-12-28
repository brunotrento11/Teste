import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { AccessibilityProvider, useAccessibility } from '../AccessibilityContext';

// Mock Supabase client
const mockUnsubscribe = vi.fn();
const mockSupabaseChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
  channel: vi.fn().mockReturnValue(mockSupabaseChannel),
  removeChannel: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

// Test component that uses the hook
function TestConsumer({ 
  onSettingsChange 
}: { 
  onSettingsChange?: (settings: ReturnType<typeof useAccessibility>['settings']) => void 
}) {
  const { settings, updateSettings, resetSettings, isLoading } = useAccessibility();
  
  React.useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
  }, [settings, onSettingsChange]);

  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="minFontSize">{settings.minFontSize}</span>
      <span data-testid="fontScale">{settings.fontScale}</span>
      <span data-testid="reduceMotion">{settings.reduceMotion.toString()}</span>
      <span data-testid="highContrast">{settings.highContrast.toString()}</span>
      <button onClick={() => updateSettings({ minFontSize: 18 })} data-testid="updateFont">
        Update Font
      </button>
      <button onClick={() => updateSettings({ reduceMotion: true })} data-testid="toggleMotion">
        Toggle Motion
      </button>
      <button onClick={resetSettings} data-testid="reset">
        Reset
      </button>
    </div>
  );
}

// Helper to get element by testid
const getTestElement = (container: HTMLElement, testId: string): HTMLElement => {
  const el = container.querySelector(`[data-testid="${testId}"]`);
  if (!el) throw new Error(`Element with testid "${testId}" not found`);
  return el as HTMLElement;
};

describe('AccessibilityContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    document.documentElement.classList.remove('reduce-motion', 'high-contrast');
    document.documentElement.style.removeProperty('--font-size-min');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default settings when localStorage is empty', () => {
      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      expect(getTestElement(container, 'minFontSize').textContent).toBe('14');
      expect(getTestElement(container, 'fontScale').textContent).toBe('normal');
      expect(getTestElement(container, 'reduceMotion').textContent).toBe('false');
      expect(getTestElement(container, 'highContrast').textContent).toBe('false');
    });

    it('should initialize from localStorage when available', () => {
      const savedSettings = {
        minFontSize: 20,
        fontScale: 'large',
        reduceMotion: true,
        highContrast: false,
      };
      localStorage.setItem('accessibility-settings', JSON.stringify(savedSettings));

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      expect(getTestElement(container, 'minFontSize').textContent).toBe('20');
      expect(getTestElement(container, 'fontScale').textContent).toBe('large');
      expect(getTestElement(container, 'reduceMotion').textContent).toBe('true');
    });

    it('should fallback to defaults when localStorage has invalid data', () => {
      localStorage.setItem('accessibility-settings', 'invalid-json');

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      expect(getTestElement(container, 'minFontSize').textContent).toBe('14');
    });
  });

  describe('localStorage Synchronization', () => {
    it('should save to localStorage immediately when settings change', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      const button = getTestElement(container, 'updateFont');
      
      await act(async () => {
        button.click();
      });

      // localStorage should be updated immediately (0ms)
      const stored = JSON.parse(localStorage.getItem('accessibility-settings') || '{}');
      expect(stored.minFontSize).toBe(18);
    });

    it('should persist reduceMotion setting to localStorage', async () => {
      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      const button = getTestElement(container, 'toggleMotion');
      
      await act(async () => {
        button.click();
      });

      const stored = JSON.parse(localStorage.getItem('accessibility-settings') || '{}');
      expect(stored.reduceMotion).toBe(true);
    });

    it('should reset localStorage when resetSettings is called', async () => {
      // Start with custom settings
      localStorage.setItem('accessibility-settings', JSON.stringify({
        minFontSize: 24,
        fontScale: 'extra-large',
        reduceMotion: true,
        highContrast: true,
      }));

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      const button = getTestElement(container, 'reset');
      
      await act(async () => {
        button.click();
      });

      const stored = JSON.parse(localStorage.getItem('accessibility-settings') || '{}');
      expect(stored.minFontSize).toBe(14);
      expect(stored.fontScale).toBe('normal');
      expect(stored.reduceMotion).toBe(false);
    });
  });

  describe('CSS Application', () => {
    it('should apply --font-size-min CSS variable', async () => {
      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      const fontSizeMin = document.documentElement.style.getPropertyValue('--font-size-min');
      expect(fontSizeMin).toBe('14px');
    });

    it('should add reduce-motion class when enabled', async () => {
      localStorage.setItem('accessibility-settings', JSON.stringify({
        minFontSize: 14,
        fontScale: 'normal',
        reduceMotion: true,
        highContrast: false,
      }));

      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    });

    it('should add high-contrast class when enabled', async () => {
      localStorage.setItem('accessibility-settings', JSON.stringify({
        minFontSize: 14,
        fontScale: 'normal',
        reduceMotion: false,
        highContrast: true,
      }));

      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    });

    it('should scale font size based on fontScale multiplier', async () => {
      localStorage.setItem('accessibility-settings', JSON.stringify({
        minFontSize: 16,
        fontScale: 'large', // 1.125 multiplier
        reduceMotion: false,
        highContrast: false,
      }));

      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      const fontSizeMin = document.documentElement.style.getPropertyValue('--font-size-min');
      // 16 * 1.125 = 18
      expect(fontSizeMin).toBe('18px');
    });
  });

  describe('Supabase Synchronization', () => {
    it('should call auth.onAuthStateChange on mount', async () => {
      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
    });

    it('should cleanup auth subscription on unmount', async () => {
      const { unmount } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 10));
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Realtime Sync', () => {
    it('should setup realtime channel when user is logged in', async () => {
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        setTimeout(() => {
          callback('SIGNED_IN', { user: { id: 'user-456' } });
        }, 0);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      expect(mockSupabase.channel).toHaveBeenCalledWith('accessibility-user-456');
    });

    it('should cleanup realtime channel on unmount', async () => {
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        setTimeout(() => {
          callback('SIGNED_IN', { user: { id: 'user-789' } });
        }, 0);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const { unmount } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      unmount();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle useAccessibility outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAccessibility must be used within an AccessibilityProvider');
      
      consoleError.mockRestore();
    });

    it('should handle localStorage parse errors gracefully', () => {
      localStorage.setItem('accessibility-settings', '{ broken json');
      
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      // Should fall back to defaults
      expect(getTestElement(container, 'minFontSize').textContent).toBe('14');
      
      consoleWarn.mockRestore();
    });

    it('should handle partial/invalid localStorage data', () => {
      // Missing required fields
      localStorage.setItem('accessibility-settings', JSON.stringify({
        minFontSize: 16,
        // missing other fields
      }));

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      // Should fall back to defaults due to validation
      expect(getTestElement(container, 'minFontSize').textContent).toBe('14');
    });
  });

  describe('Debounce Behavior', () => {
    it('should debounce Supabase updates by 500ms', async () => {
      vi.useFakeTimers();
      
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback: Function) => {
        callback('SIGNED_IN', { user: { id: 'user-debounce' } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: mockUpdate,
      });

      const { container } = render(
        <AccessibilityProvider>
          <TestConsumer />
        </AccessibilityProvider>
      );

      // Wait for initial setup
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Simulate update
      const button = getTestElement(container, 'updateFont');
      
      await act(async () => {
        button.click();
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Supabase should not be called yet (within debounce window)
      expect(mockUpdate).not.toHaveBeenCalled();

      // Advance past debounce time
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Now Supabase should be called
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
