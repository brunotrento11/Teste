export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      anbima_asset_risk_scores: {
        Row: {
          asset_code: string
          asset_id: string
          asset_type: string
          calculated_at: string
          data_vencimento: string | null
          emissor: string | null
          id: string
          rentabilidade: string | null
          risk_category: string
          risk_score: number
          updated_at: string
        }
        Insert: {
          asset_code: string
          asset_id: string
          asset_type: string
          calculated_at?: string
          data_vencimento?: string | null
          emissor?: string | null
          id?: string
          rentabilidade?: string | null
          risk_category: string
          risk_score: number
          updated_at?: string
        }
        Update: {
          asset_code?: string
          asset_id?: string
          asset_type?: string
          calculated_at?: string
          data_vencimento?: string | null
          emissor?: string | null
          id?: string
          rentabilidade?: string | null
          risk_category?: string
          risk_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      anbima_cri_cra: {
        Row: {
          codigo_ativo: string
          created_at: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao: number | null
          duration: number | null
          emissao: string | null
          emissor: string
          id: string
          originador: string | null
          originador_credito: string | null
          percent_pu_par: number | null
          pu: number | null
          serie: string | null
          taxa_compra: number | null
          taxa_correcao: number | null
          taxa_indicativa: number | null
          taxa_venda: number | null
          tipo_contrato: string
          tipo_remuneracao: string | null
          updated_at: string
          vl_pu: number | null
        }
        Insert: {
          codigo_ativo: string
          created_at?: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao?: number | null
          duration?: number | null
          emissao?: string | null
          emissor: string
          id?: string
          originador?: string | null
          originador_credito?: string | null
          percent_pu_par?: number | null
          pu?: number | null
          serie?: string | null
          taxa_compra?: number | null
          taxa_correcao?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_contrato: string
          tipo_remuneracao?: string | null
          updated_at?: string
          vl_pu?: number | null
        }
        Update: {
          codigo_ativo?: string
          created_at?: string
          data_referencia?: string
          data_vencimento?: string
          desvio_padrao?: number | null
          duration?: number | null
          emissao?: string | null
          emissor?: string
          id?: string
          originador?: string | null
          originador_credito?: string | null
          percent_pu_par?: number | null
          pu?: number | null
          serie?: string | null
          taxa_compra?: number | null
          taxa_correcao?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_contrato?: string
          tipo_remuneracao?: string | null
          updated_at?: string
          vl_pu?: number | null
        }
        Relationships: []
      }
      anbima_debentures: {
        Row: {
          codigo_ativo: string
          created_at: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao: number | null
          duration: number | null
          emissor: string
          grupo: string | null
          id: string
          percent_pu_par: number | null
          percent_reune: string | null
          percentual_taxa: string | null
          pu: number | null
          taxa_compra: number | null
          taxa_indicativa: number | null
          taxa_venda: number | null
          updated_at: string
          val_max_intervalo: number | null
          val_min_intervalo: number | null
        }
        Insert: {
          codigo_ativo: string
          created_at?: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao?: number | null
          duration?: number | null
          emissor: string
          grupo?: string | null
          id?: string
          percent_pu_par?: number | null
          percent_reune?: string | null
          percentual_taxa?: string | null
          pu?: number | null
          taxa_compra?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          updated_at?: string
          val_max_intervalo?: number | null
          val_min_intervalo?: number | null
        }
        Update: {
          codigo_ativo?: string
          created_at?: string
          data_referencia?: string
          data_vencimento?: string
          desvio_padrao?: number | null
          duration?: number | null
          emissor?: string
          grupo?: string | null
          id?: string
          percent_pu_par?: number | null
          percent_reune?: string | null
          percentual_taxa?: string | null
          pu?: number | null
          taxa_compra?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          updated_at?: string
          val_max_intervalo?: number | null
          val_min_intervalo?: number | null
        }
        Relationships: []
      }
      anbima_fidc: {
        Row: {
          codigo_b3: string
          created_at: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao: number | null
          duration: number | null
          emissor: string
          id: string
          isin: string | null
          nome: string
          percent_pu_par: number | null
          pu: number | null
          referencia_ntnb: string | null
          serie: string | null
          taxa_compra: number | null
          taxa_correcao: number | null
          taxa_indicativa: number | null
          taxa_venda: number | null
          tipo_remuneracao: string | null
          updated_at: string
        }
        Insert: {
          codigo_b3: string
          created_at?: string
          data_referencia: string
          data_vencimento: string
          desvio_padrao?: number | null
          duration?: number | null
          emissor: string
          id?: string
          isin?: string | null
          nome: string
          percent_pu_par?: number | null
          pu?: number | null
          referencia_ntnb?: string | null
          serie?: string | null
          taxa_compra?: number | null
          taxa_correcao?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_remuneracao?: string | null
          updated_at?: string
        }
        Update: {
          codigo_b3?: string
          created_at?: string
          data_referencia?: string
          data_vencimento?: string
          desvio_padrao?: number | null
          duration?: number | null
          emissor?: string
          id?: string
          isin?: string | null
          nome?: string
          percent_pu_par?: number | null
          pu?: number | null
          referencia_ntnb?: string | null
          serie?: string | null
          taxa_compra?: number | null
          taxa_correcao?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_remuneracao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      anbima_fundos: {
        Row: {
          classes: Json | null
          codigo_fundo: string
          created_at: string
          data_atualizacao: string | null
          data_encerramento_fundo: string | null
          data_vigencia: string | null
          id: string
          identificador_fundo: string
          nome_comercial_fundo: string | null
          razao_social_fundo: string
          tipo_fundo: string
          tipo_identificador_fundo: string
          updated_at: string
        }
        Insert: {
          classes?: Json | null
          codigo_fundo: string
          created_at?: string
          data_atualizacao?: string | null
          data_encerramento_fundo?: string | null
          data_vigencia?: string | null
          id?: string
          identificador_fundo: string
          nome_comercial_fundo?: string | null
          razao_social_fundo: string
          tipo_fundo: string
          tipo_identificador_fundo: string
          updated_at?: string
        }
        Update: {
          classes?: Json | null
          codigo_fundo?: string
          created_at?: string
          data_atualizacao?: string | null
          data_encerramento_fundo?: string | null
          data_vigencia?: string | null
          id?: string
          identificador_fundo?: string
          nome_comercial_fundo?: string | null
          razao_social_fundo?: string
          tipo_fundo?: string
          tipo_identificador_fundo?: string
          updated_at?: string
        }
        Relationships: []
      }
      anbima_letras_financeiras: {
        Row: {
          cnpj_emissor: string
          created_at: string
          data_referencia: string
          emissor: string
          fluxo: string | null
          id: string
          indexador: string | null
          letra_financeira: string
          updated_at: string
          vertices: Json | null
        }
        Insert: {
          cnpj_emissor: string
          created_at?: string
          data_referencia: string
          emissor: string
          fluxo?: string | null
          id?: string
          indexador?: string | null
          letra_financeira: string
          updated_at?: string
          vertices?: Json | null
        }
        Update: {
          cnpj_emissor?: string
          created_at?: string
          data_referencia?: string
          emissor?: string
          fluxo?: string | null
          id?: string
          indexador?: string | null
          letra_financeira?: string
          updated_at?: string
          vertices?: Json | null
        }
        Relationships: []
      }
      anbima_titulos_publicos: {
        Row: {
          codigo_isin: string
          codigo_selic: string
          created_at: string
          data_base: string | null
          data_referencia: string
          data_vencimento: string
          desvio_padrao: number | null
          expressao: string | null
          id: string
          intervalo_max_d0: number | null
          intervalo_max_d1: number | null
          intervalo_min_d0: number | null
          intervalo_min_d1: number | null
          pu: number | null
          taxa_compra: number | null
          taxa_indicativa: number | null
          taxa_venda: number | null
          tipo_titulo: string
          updated_at: string
        }
        Insert: {
          codigo_isin: string
          codigo_selic: string
          created_at?: string
          data_base?: string | null
          data_referencia: string
          data_vencimento: string
          desvio_padrao?: number | null
          expressao?: string | null
          id?: string
          intervalo_max_d0?: number | null
          intervalo_max_d1?: number | null
          intervalo_min_d0?: number | null
          intervalo_min_d1?: number | null
          pu?: number | null
          taxa_compra?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_titulo: string
          updated_at?: string
        }
        Update: {
          codigo_isin?: string
          codigo_selic?: string
          created_at?: string
          data_base?: string | null
          data_referencia?: string
          data_vencimento?: string
          desvio_padrao?: number | null
          expressao?: string | null
          id?: string
          intervalo_max_d0?: number | null
          intervalo_max_d1?: number | null
          intervalo_min_d0?: number | null
          intervalo_min_d1?: number | null
          pu?: number | null
          taxa_compra?: number | null
          taxa_indicativa?: number | null
          taxa_venda?: number | null
          tipo_titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_validation_history: {
        Row: {
          bdrs: number
          bdrs_with_marker: number
          created_at: string | null
          critical_divergences: number
          etfs: number
          executed_at: string | null
          executed_by: string
          fiis: number
          full_result: Json | null
          id: string
          quality_score: number
          status: string
          stocks: number
          total_assets: number
          units: number
        }
        Insert: {
          bdrs: number
          bdrs_with_marker: number
          created_at?: string | null
          critical_divergences: number
          etfs: number
          executed_at?: string | null
          executed_by: string
          fiis: number
          full_result?: Json | null
          id?: string
          quality_score: number
          status: string
          stocks: number
          total_assets: number
          units: number
        }
        Update: {
          bdrs?: number
          bdrs_with_marker?: number
          created_at?: string | null
          critical_divergences?: number
          etfs?: number
          executed_at?: string | null
          executed_by?: string
          fiis?: number
          full_result?: Json | null
          id?: string
          quality_score?: number
          status?: string
          stocks?: number
          total_assets?: number
          units?: number
        }
        Relationships: []
      }
      brapi_historical_prices: {
        Row: {
          adjusted_close: number | null
          close_price: number | null
          created_at: string
          high_price: number | null
          id: string
          low_price: number | null
          open_price: number | null
          price_date: string
          ticker: string
          volume: number | null
        }
        Insert: {
          adjusted_close?: number | null
          close_price?: number | null
          created_at?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          price_date: string
          ticker: string
          volume?: number | null
        }
        Update: {
          adjusted_close?: number | null
          close_price?: number | null
          created_at?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          price_date?: string
          ticker?: string
          volume?: number | null
        }
        Relationships: []
      }
      brapi_market_data: {
        Row: {
          asset_type: string
          average_daily_volume: number | null
          beta: number | null
          created_at: string
          debt_to_equity: number | null
          dividend_yield: number | null
          id: string
          industry: string | null
          last_quote_update: string | null
          last_risk_calculation: string | null
          long_name: string | null
          market_cap: number | null
          max_drawdown: number | null
          price_earnings: number | null
          price_to_book: number | null
          profit_margins: number | null
          regular_market_change_percent: number | null
          regular_market_price: number | null
          return_on_equity: number | null
          risk_category: string | null
          risk_score: number | null
          sector: string | null
          sharpe_ratio: number | null
          short_name: string | null
          ticker: string
          updated_at: string
          var_95: number | null
          volatility_1y: number | null
        }
        Insert: {
          asset_type: string
          average_daily_volume?: number | null
          beta?: number | null
          created_at?: string
          debt_to_equity?: number | null
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          last_quote_update?: string | null
          last_risk_calculation?: string | null
          long_name?: string | null
          market_cap?: number | null
          max_drawdown?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profit_margins?: number | null
          regular_market_change_percent?: number | null
          regular_market_price?: number | null
          return_on_equity?: number | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          short_name?: string | null
          ticker: string
          updated_at?: string
          var_95?: number | null
          volatility_1y?: number | null
        }
        Update: {
          asset_type?: string
          average_daily_volume?: number | null
          beta?: number | null
          created_at?: string
          debt_to_equity?: number | null
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          last_quote_update?: string | null
          last_risk_calculation?: string | null
          long_name?: string | null
          market_cap?: number | null
          max_drawdown?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profit_margins?: number | null
          regular_market_change_percent?: number | null
          regular_market_price?: number | null
          return_on_equity?: number | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          short_name?: string | null
          ticker?: string
          updated_at?: string
          var_95?: number | null
          volatility_1y?: number | null
        }
        Relationships: []
      }
      brapi_market_data_backup_20250119: {
        Row: {
          asset_type: string | null
          average_daily_volume: number | null
          beta: number | null
          created_at: string | null
          debt_to_equity: number | null
          dividend_yield: number | null
          id: string | null
          industry: string | null
          last_quote_update: string | null
          last_risk_calculation: string | null
          long_name: string | null
          market_cap: number | null
          max_drawdown: number | null
          price_earnings: number | null
          price_to_book: number | null
          profit_margins: number | null
          regular_market_change_percent: number | null
          regular_market_price: number | null
          return_on_equity: number | null
          risk_category: string | null
          risk_score: number | null
          sector: string | null
          sharpe_ratio: number | null
          short_name: string | null
          ticker: string | null
          updated_at: string | null
          var_95: number | null
          volatility_1y: number | null
        }
        Insert: {
          asset_type?: string | null
          average_daily_volume?: number | null
          beta?: number | null
          created_at?: string | null
          debt_to_equity?: number | null
          dividend_yield?: number | null
          id?: string | null
          industry?: string | null
          last_quote_update?: string | null
          last_risk_calculation?: string | null
          long_name?: string | null
          market_cap?: number | null
          max_drawdown?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profit_margins?: number | null
          regular_market_change_percent?: number | null
          regular_market_price?: number | null
          return_on_equity?: number | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          short_name?: string | null
          ticker?: string | null
          updated_at?: string | null
          var_95?: number | null
          volatility_1y?: number | null
        }
        Update: {
          asset_type?: string | null
          average_daily_volume?: number | null
          beta?: number | null
          created_at?: string | null
          debt_to_equity?: number | null
          dividend_yield?: number | null
          id?: string | null
          industry?: string | null
          last_quote_update?: string | null
          last_risk_calculation?: string | null
          long_name?: string | null
          market_cap?: number | null
          max_drawdown?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profit_margins?: number | null
          regular_market_change_percent?: number | null
          regular_market_price?: number | null
          return_on_equity?: number | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          short_name?: string | null
          ticker?: string | null
          updated_at?: string | null
          var_95?: number | null
          volatility_1y?: number | null
        }
        Relationships: []
      }
      cvm_ofertas_publicas: {
        Row: {
          atualizacao_monetaria: string | null
          cnpj_emissor: string
          created_at: string
          data_emissao: string | null
          data_inicio_rentabilidade: string | null
          data_vencimento: string | null
          id: string
          is_active: boolean | null
          juros: string | null
          nome_emissor: string
          publico_alvo: string | null
          serie: string | null
          tipo_ativo: string
          updated_at: string
          valor_total_emissao: number | null
        }
        Insert: {
          atualizacao_monetaria?: string | null
          cnpj_emissor: string
          created_at?: string
          data_emissao?: string | null
          data_inicio_rentabilidade?: string | null
          data_vencimento?: string | null
          id?: string
          is_active?: boolean | null
          juros?: string | null
          nome_emissor: string
          publico_alvo?: string | null
          serie?: string | null
          tipo_ativo: string
          updated_at?: string
          valor_total_emissao?: number | null
        }
        Update: {
          atualizacao_monetaria?: string | null
          cnpj_emissor?: string
          created_at?: string
          data_emissao?: string | null
          data_inicio_rentabilidade?: string | null
          data_vencimento?: string | null
          id?: string
          is_active?: boolean | null
          juros?: string | null
          nome_emissor?: string
          publico_alvo?: string | null
          serie?: string | null
          tipo_ativo?: string
          updated_at?: string
          valor_total_emissao?: number | null
        }
        Relationships: []
      }
      economic_indicators: {
        Row: {
          accumulated_12m: number | null
          created_at: string
          id: string
          indicator_type: string
          reference_date: string
          updated_at: string
          value: number
        }
        Insert: {
          accumulated_12m?: number | null
          created_at?: string
          id?: string
          indicator_type: string
          reference_date: string
          updated_at?: string
          value: number
        }
        Update: {
          accumulated_12m?: number | null
          created_at?: string
          id?: string
          indicator_type?: string
          reference_date?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      financial_institutions: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          short_name: string | null
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          short_name?: string | null
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          short_name?: string | null
          type?: string
        }
        Relationships: []
      }
      investment_categories: {
        Row: {
          anbima_asset_type: string | null
          created_at: string
          description: string | null
          estimated_annual_return_max: number | null
          estimated_annual_return_min: number | null
          id: string
          keywords: string[] | null
          name: string
          risk_level: string
          type: string
        }
        Insert: {
          anbima_asset_type?: string | null
          created_at?: string
          description?: string | null
          estimated_annual_return_max?: number | null
          estimated_annual_return_min?: number | null
          id?: string
          keywords?: string[] | null
          name: string
          risk_level: string
          type: string
        }
        Update: {
          anbima_asset_type?: string | null
          created_at?: string
          description?: string | null
          estimated_annual_return_max?: number | null
          estimated_annual_return_min?: number | null
          id?: string
          keywords?: string[] | null
          name?: string
          risk_level?: string
          type?: string
        }
        Relationships: []
      }
      investment_risk_indicators: {
        Row: {
          beta: number | null
          calculated_at: string
          data_source: string | null
          id: string
          sharpe_ratio: number | null
          std_deviation: number | null
          user_investment_id: string
          var_95: number | null
        }
        Insert: {
          beta?: number | null
          calculated_at?: string
          data_source?: string | null
          id?: string
          sharpe_ratio?: number | null
          std_deviation?: number | null
          user_investment_id: string
          var_95?: number | null
        }
        Update: {
          beta?: number | null
          calculated_at?: string
          data_source?: string | null
          id?: string
          sharpe_ratio?: number | null
          std_deviation?: number | null
          user_investment_id?: string
          var_95?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_risk_indicators_user_investment_id_fkey"
            columns: ["user_investment_id"]
            isOneToOne: false
            referencedRelation: "user_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_profile_ranges: {
        Row: {
          created_at: string
          description: string | null
          id: string
          max_score: number
          min_score: number
          profile_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_score: number
          min_score: number
          profile_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_score?: number
          min_score?: number
          profile_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accessibility_settings: Json | null
          birth_date: string
          cpf: string
          created_at: string
          email: string | null
          email_verified: boolean
          financial_goal: string | null
          full_name: string
          goal_amount: number | null
          goal_timeframe: number | null
          has_investments: boolean
          id: string
          investor_profile: string | null
          phone: string
          phone_verified: boolean
          updated_at: string
        }
        Insert: {
          accessibility_settings?: Json | null
          birth_date: string
          cpf: string
          created_at?: string
          email?: string | null
          email_verified?: boolean
          financial_goal?: string | null
          full_name: string
          goal_amount?: number | null
          goal_timeframe?: number | null
          has_investments?: boolean
          id: string
          investor_profile?: string | null
          phone: string
          phone_verified?: boolean
          updated_at?: string
        }
        Update: {
          accessibility_settings?: Json | null
          birth_date?: string
          cpf?: string
          created_at?: string
          email?: string | null
          email_verified?: boolean
          financial_goal?: string | null
          full_name?: string
          goal_amount?: number | null
          goal_timeframe?: number | null
          has_investments?: boolean
          id?: string
          investor_profile?: string | null
          phone?: string
          phone_verified?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      risk_score_history: {
        Row: {
          compatible_with_arrojado: boolean
          compatible_with_conservador: boolean
          compatible_with_moderado: boolean
          created_at: string
          id: string
          investment_id: string
          justification: string | null
          risk_category: string | null
          risk_indicators_id: string | null
          score: number
        }
        Insert: {
          compatible_with_arrojado?: boolean
          compatible_with_conservador?: boolean
          compatible_with_moderado?: boolean
          created_at?: string
          id?: string
          investment_id: string
          justification?: string | null
          risk_category?: string | null
          risk_indicators_id?: string | null
          score: number
        }
        Update: {
          compatible_with_arrojado?: boolean
          compatible_with_conservador?: boolean
          compatible_with_moderado?: boolean
          created_at?: string
          id?: string
          investment_id?: string
          justification?: string | null
          risk_category?: string | null
          risk_indicators_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_score_history_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "user_investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_score_history_risk_indicators_id_fkey"
            columns: ["risk_indicators_id"]
            isOneToOne: false
            referencedRelation: "investment_risk_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_anomaly_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_value: number | null
          alert_type: string
          created_at: string
          deviation_percent: number | null
          execution_id: string | null
          expected_value: number | null
          id: string
          is_acknowledged: boolean | null
          message: string | null
          metric_name: string
          resolution_notes: string | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          alert_type: string
          created_at?: string
          deviation_percent?: number | null
          execution_id?: string | null
          expected_value?: number | null
          id?: string
          is_acknowledged?: boolean | null
          message?: string | null
          metric_name: string
          resolution_notes?: string | null
          severity?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_value?: number | null
          alert_type?: string
          created_at?: string
          deviation_percent?: number | null
          execution_id?: string | null
          expected_value?: number | null
          id?: string
          is_acknowledged?: boolean | null
          message?: string | null
          metric_name?: string
          resolution_notes?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_anomaly_alerts_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "sync_execution_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_execution_stats: {
        Row: {
          avg_risk_score: number | null
          completed_at: string | null
          created_at: string
          distribution_by_risk_category: Json | null
          distribution_by_type: Json | null
          duration_ms: number | null
          error_details: Json | null
          execution_type: string
          function_name: string
          id: string
          max_risk_score: number | null
          metadata: Json | null
          min_risk_score: number | null
          started_at: string
          status: string
          total_assets_processed: number | null
          total_assets_skipped: number | null
          total_errors: number | null
          triggered_by: string | null
        }
        Insert: {
          avg_risk_score?: number | null
          completed_at?: string | null
          created_at?: string
          distribution_by_risk_category?: Json | null
          distribution_by_type?: Json | null
          duration_ms?: number | null
          error_details?: Json | null
          execution_type: string
          function_name: string
          id?: string
          max_risk_score?: number | null
          metadata?: Json | null
          min_risk_score?: number | null
          started_at?: string
          status?: string
          total_assets_processed?: number | null
          total_assets_skipped?: number | null
          total_errors?: number | null
          triggered_by?: string | null
        }
        Update: {
          avg_risk_score?: number | null
          completed_at?: string | null
          created_at?: string
          distribution_by_risk_category?: Json | null
          distribution_by_type?: Json | null
          duration_ms?: number | null
          error_details?: Json | null
          execution_type?: string
          function_name?: string
          id?: string
          max_risk_score?: number | null
          metadata?: Json | null
          min_risk_score?: number | null
          started_at?: string
          status?: string
          total_assets_processed?: number | null
          total_assets_skipped?: number | null
          total_errors?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      unified_assets: {
        Row: {
          asset_code: string
          asset_type: string
          average_volume: number | null
          beta: number | null
          contract_indexer: string | null
          contract_rate_type: string | null
          contract_spread_percent: number | null
          created_at: string
          current_price: number | null
          display_name: string
          dividend_yield: number | null
          id: string
          industry: string | null
          issuer: string | null
          issuer_cnpj: string | null
          liquidity: string | null
          market_cap: number | null
          market_rate_buy_percent: number | null
          market_rate_indicative_percent: number | null
          market_rate_sell_percent: number | null
          market_source: string | null
          maturity_date: string | null
          max_drawdown: number | null
          price_change_percent: number | null
          price_earnings: number | null
          price_to_book: number | null
          profitability: string | null
          risk_calculated_at: string | null
          risk_category: string | null
          risk_score: number | null
          sector: string | null
          sharpe_ratio: number | null
          source: string
          source_id: string
          source_table: string
          source_updated_at: string | null
          std_deviation: number | null
          updated_at: string
          var_95: number | null
          volatility_1y: number | null
          yield_profile: string | null
        }
        Insert: {
          asset_code: string
          asset_type: string
          average_volume?: number | null
          beta?: number | null
          contract_indexer?: string | null
          contract_rate_type?: string | null
          contract_spread_percent?: number | null
          created_at?: string
          current_price?: number | null
          display_name: string
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          issuer?: string | null
          issuer_cnpj?: string | null
          liquidity?: string | null
          market_cap?: number | null
          market_rate_buy_percent?: number | null
          market_rate_indicative_percent?: number | null
          market_rate_sell_percent?: number | null
          market_source?: string | null
          maturity_date?: string | null
          max_drawdown?: number | null
          price_change_percent?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profitability?: string | null
          risk_calculated_at?: string | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          source: string
          source_id: string
          source_table: string
          source_updated_at?: string | null
          std_deviation?: number | null
          updated_at?: string
          var_95?: number | null
          volatility_1y?: number | null
          yield_profile?: string | null
        }
        Update: {
          asset_code?: string
          asset_type?: string
          average_volume?: number | null
          beta?: number | null
          contract_indexer?: string | null
          contract_rate_type?: string | null
          contract_spread_percent?: number | null
          created_at?: string
          current_price?: number | null
          display_name?: string
          dividend_yield?: number | null
          id?: string
          industry?: string | null
          issuer?: string | null
          issuer_cnpj?: string | null
          liquidity?: string | null
          market_cap?: number | null
          market_rate_buy_percent?: number | null
          market_rate_indicative_percent?: number | null
          market_rate_sell_percent?: number | null
          market_source?: string | null
          maturity_date?: string | null
          max_drawdown?: number | null
          price_change_percent?: number | null
          price_earnings?: number | null
          price_to_book?: number | null
          profitability?: string | null
          risk_calculated_at?: string | null
          risk_category?: string | null
          risk_score?: number | null
          sector?: string | null
          sharpe_ratio?: number | null
          source?: string
          source_id?: string
          source_table?: string
          source_updated_at?: string | null
          std_deviation?: number | null
          updated_at?: string
          var_95?: number | null
          volatility_1y?: number | null
          yield_profile?: string | null
        }
        Relationships: []
      }
      user_filter_preferences: {
        Row: {
          asset_type: string | null
          created_at: string | null
          id: string
          maturity_filter: string | null
          profitability_filter: string | null
          risk_filter: string | null
          sort_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          maturity_filter?: string | null
          profitability_filter?: string | null
          risk_filter?: string | null
          sort_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          id?: string
          maturity_filter?: string | null
          profitability_filter?: string | null
          risk_filter?: string | null
          sort_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_investments: {
        Row: {
          amount: number | null
          category_id: string | null
          created_at: string
          id: string
          institution_id: string | null
          investment_name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          investment_name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          category_id?: string | null
          created_at?: string
          id?: string
          institution_id?: string | null
          investment_name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_investments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "investment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_investments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "financial_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          type: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          type: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_investment_search: {
        Row: {
          asset_code: string | null
          asset_type: string | null
          beta: number | null
          contract_indexer: string | null
          contract_rate_type: string | null
          contract_spread_percent: number | null
          current_price: number | null
          display_name: string | null
          dividend_yield: number | null
          id: string | null
          issuer: string | null
          liquidity: string | null
          market_rate_indicative_percent: number | null
          market_source: string | null
          maturity_date: string | null
          profitability: string | null
          risk_category: string | null
          risk_score: number | null
          search_vector: unknown
          sector: string | null
          sharpe_ratio: number | null
          source: string | null
          source_id: string | null
          updated_at: string | null
          var_95: number | null
          volatility_1y: number | null
          yield_profile: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_mv_investment_search: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
