import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccessibilitySettings {
  minFontSize: number; // 12-24px
  fontScale: 'small' | 'normal' | 'large' | 'extra-large';
  reduceMotion: boolean;
  highContrast: boolean;
}

const defaultSettings: AccessibilitySettings = {
  minFontSize: 14,
  fontScale: 'normal',
  reduceMotion: false,
  highContrast: false,
};

const fontScaleMultipliers: Record<AccessibilitySettings['fontScale'], number> = {
  small: 0.875,
  normal: 1,
  large: 1.125,
  'extra-large': 1.25,
};

const STORAGE_KEY = 'accessibility-settings';
const SUPABASE_DEBOUNCE_MS = 500;

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

// Helper: Parse localStorage safely
const getLocalStorageSettings = (): AccessibilitySettings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (
        typeof parsed.minFontSize === 'number' &&
        typeof parsed.fontScale === 'string' &&
        typeof parsed.reduceMotion === 'boolean' &&
        typeof parsed.highContrast === 'boolean'
      ) {
        return parsed as AccessibilitySettings;
      }
    }
  } catch (e) {
    console.warn('Failed to parse localStorage accessibility settings:', e);
  }
  return null;
};

// Helper: Save to localStorage
const saveToLocalStorage = (settings: AccessibilitySettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save accessibility settings to localStorage:', e);
  }
};

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Initialize from localStorage immediately
    return getLocalStorageSettings() || defaultSettings;
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Debounce timer ref for Supabase updates
  const supabaseDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Apply settings to CSS variables and classes
  const applySettings = useCallback((currentSettings: AccessibilitySettings) => {
    const root = document.documentElement;
    const scale = fontScaleMultipliers[currentSettings.fontScale];
    const scaledMinFont = Math.round(currentSettings.minFontSize * scale);
    
    root.style.setProperty('--font-size-min', `${scaledMinFont}px`);
    
    // Apply reduce motion preference
    if (currentSettings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // Apply high contrast preference
    if (currentSettings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, []);

  // Save to Supabase (debounced)
  const saveToSupabase = useCallback(async (settingsToSave: AccessibilitySettings) => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ accessibility_settings: JSON.parse(JSON.stringify(settingsToSave)) })
        .eq('id', userId);
      
      if (error) {
        console.warn('Failed to save accessibility settings to Supabase:', error);
      }
    } catch (e) {
      console.warn('Error saving to Supabase:', e);
    }
  }, [userId]);

  // Debounced Supabase save
  const debouncedSupabaseSave = useCallback((settingsToSave: AccessibilitySettings) => {
    if (supabaseDebounceRef.current) {
      clearTimeout(supabaseDebounceRef.current);
    }
    
    supabaseDebounceRef.current = setTimeout(() => {
      saveToSupabase(settingsToSave);
    }, SUPABASE_DEBOUNCE_MS);
  }, [saveToSupabase]);

  // Load settings from Supabase on auth change
  useEffect(() => {
    const loadFromSupabase = async () => {
      setIsLoading(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          
          // Fetch accessibility_settings from profiles
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('accessibility_settings')
            .eq('id', user.id)
            .maybeSingle();
          
          if (!error && profile?.accessibility_settings) {
            const dbSettings = profile.accessibility_settings as unknown as AccessibilitySettings;
            // Validate and use DB settings
            if (
              typeof dbSettings.minFontSize === 'number' &&
              typeof dbSettings.fontScale === 'string' &&
              typeof dbSettings.reduceMotion === 'boolean' &&
              typeof dbSettings.highContrast === 'boolean'
            ) {
              setSettings(dbSettings);
              saveToLocalStorage(dbSettings); // Sync to localStorage
            }
          } else {
            // No DB settings, use localStorage or default
            const localSettings = getLocalStorageSettings();
            if (localSettings) {
              setSettings(localSettings);
              // Sync localStorage to Supabase
              saveToSupabase(localSettings);
            }
          }
        } else {
          setUserId(null);
          // Not logged in, use localStorage
          const localSettings = getLocalStorageSettings();
          if (localSettings) {
            setSettings(localSettings);
          }
        }
      } catch (e) {
        console.warn('Error loading accessibility settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromSupabase();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        loadFromSupabase();
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [saveToSupabase]);

  // Apply settings whenever they change
  useEffect(() => {
    applySettings(settings);
  }, [settings, applySettings]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && !settings.reduceMotion) {
        // Respect system preference if user hasn't explicitly set it
        updateSettings({ reduceMotion: true });
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.reduceMotion]);

  // Realtime sync for multi-tab support
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`accessibility-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const newSettings = payload.new.accessibility_settings as unknown as AccessibilitySettings;
          if (newSettings && 
              typeof newSettings.minFontSize === 'number' &&
              typeof newSettings.fontScale === 'string' &&
              typeof newSettings.reduceMotion === 'boolean' &&
              typeof newSettings.highContrast === 'boolean'
          ) {
            // Only update if different from current
            setSettings(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(newSettings)) {
                saveToLocalStorage(newSettings);
                return newSettings;
              }
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const updateSettings = useCallback((newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // 1. INSTANT: Update localStorage immediately (0ms delay)
      saveToLocalStorage(updated);
      
      // 2. DEBOUNCED: Update Supabase after 500ms
      if (userId) {
        debouncedSupabaseSave(updated);
      }
      
      return updated;
    });
  }, [userId, debouncedSupabaseSave]);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    saveToLocalStorage(defaultSettings);
    
    if (userId) {
      debouncedSupabaseSave(defaultSettings);
    }
  }, [userId, debouncedSupabaseSave]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (supabaseDebounceRef.current) {
        clearTimeout(supabaseDebounceRef.current);
      }
    };
  }, []);

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
