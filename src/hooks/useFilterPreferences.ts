import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FilterPreferences {
  riskFilter: 'all' | 'low' | 'medium' | 'high';
  profitabilityFilter: 'all' | 'cdi' | 'ipca' | 'prefixado' | 'variavel' | 'fundos';
  maturityFilter: 'all' | '6m' | '1y' | '3y' | '5y' | '5y+';
  sortBy: 'risk_asc' | 'risk_desc' | 'name' | 'maturity' | 'spread_asc' | 'spread_desc';
}

const defaultPreferences: FilterPreferences = {
  riskFilter: 'all',
  profitabilityFilter: 'all',
  maturityFilter: 'all',
  sortBy: 'risk_asc'
};

export function useFilterPreferences(assetType?: string) {
  const [preferences, setPreferences] = useState<FilterPreferences>(defaultPreferences);
  const [hasSavedPreference, setHasSavedPreference] = useState<'specific' | 'global' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check auth state
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load preferences (specific > global priority)
  const loadPreferences = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // First try to get specific preference for this asset type
      if (assetType) {
        const { data: specific } = await supabase
          .from('user_filter_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('asset_type', assetType)
          .maybeSingle();

        if (specific) {
          setPreferences({
            riskFilter: (specific.risk_filter as FilterPreferences['riskFilter']) || 'all',
            profitabilityFilter: (specific.profitability_filter as FilterPreferences['profitabilityFilter']) || 'all',
            maturityFilter: (specific.maturity_filter as FilterPreferences['maturityFilter']) || 'all',
            sortBy: (specific.sort_by as FilterPreferences['sortBy']) || 'risk_asc'
          });
          setHasSavedPreference('specific');
          return;
        }
      }

      // Fallback to global preference
      const { data: global } = await supabase
        .from('user_filter_preferences')
        .select('*')
        .eq('user_id', userId)
        .is('asset_type', null)
        .maybeSingle();

      if (global) {
        setPreferences({
          riskFilter: (global.risk_filter as FilterPreferences['riskFilter']) || 'all',
          profitabilityFilter: (global.profitability_filter as FilterPreferences['profitabilityFilter']) || 'all',
          maturityFilter: (global.maturity_filter as FilterPreferences['maturityFilter']) || 'all',
          sortBy: (global.sort_by as FilterPreferences['sortBy']) || 'risk_asc'
        });
        setHasSavedPreference('global');
      } else {
        setPreferences(defaultPreferences);
        setHasSavedPreference(null);
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, assetType]);

  useEffect(() => {
    if (userId) {
      loadPreferences();
    }
  }, [userId, loadPreferences]);

  // Save preferences
  const savePreferences = async (
    prefs: FilterPreferences,
    saveType: 'specific' | 'global'
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      const assetTypeValue = saveType === 'specific' ? assetType : null;

      const { error } = await supabase
        .from('user_filter_preferences')
        .upsert({
          user_id: userId,
          asset_type: assetTypeValue,
          risk_filter: prefs.riskFilter,
          profitability_filter: prefs.profitabilityFilter,
          maturity_filter: prefs.maturityFilter,
          sort_by: prefs.sortBy,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,asset_type'
        });

      if (error) throw error;

      setHasSavedPreference(saveType);
      return true;
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      return false;
    }
  };

  // Delete preferences
  const deletePreferences = async (deleteType: 'specific' | 'global' | 'both'): Promise<boolean> => {
    if (!userId) return false;

    try {
      if (deleteType === 'specific' || deleteType === 'both') {
        await supabase
          .from('user_filter_preferences')
          .delete()
          .eq('user_id', userId)
          .eq('asset_type', assetType);
      }

      if (deleteType === 'global' || deleteType === 'both') {
        await supabase
          .from('user_filter_preferences')
          .delete()
          .eq('user_id', userId)
          .is('asset_type', null);
      }

      setHasSavedPreference(null);
      return true;
    } catch (error) {
      console.error('Erro ao deletar preferências:', error);
      return false;
    }
  };

  return {
    preferences,
    setPreferences,
    hasSavedPreference,
    isLoading,
    savePreferences,
    deletePreferences,
    loadPreferences,
    isAuthenticated: !!userId
  };
}
