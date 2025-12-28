# 📚 InvestIA - Documentação do Sistema

> **Versão:** 1.0.0  
> **Última atualização:** 2025-01-19  
> **Mantido por:** Equipe InvestIA

---

## 📑 Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Boas Práticas de Desenvolvimento](#3-boas-práticas-de-desenvolvimento)
4. [Operações de Banco de Dados](#4-operações-de-banco-de-dados)
   - [4.1 Tabelas Principais](#41-tabelas-principais)
   - [4.2 Políticas RLS](#42-políticas-rls)
   - [4.3 Protocolo de Segurança para Queries Destrutivas](#43--protocolo-de-segurança-para-queries-destrutivas)
   - [4.4 Validação de Integridade](#44-validação-de-integridade)
   - [4.5 Filtro de Ativos por Risk Score](#45-filtro-de-ativos-por-risk-score)
5. [Edge Functions](#5-edge-functions)
6. [Integrações Externas](#6-integrações-externas)
7. [Histórico de Decisões](#7-histórico-de-decisões)

---

## 1. Visão Geral

O **InvestIA** é um sistema de análise de risco de investimentos que ajuda investidores a tomar decisões informadas com base em seu perfil de risco. O sistema integra dados de múltiplas fontes (ANBIMA, Brapi, CVM) para fornecer análises completas de ativos financeiros brasileiros.

### Objetivos Principais
- Classificar investimentos por nível de risco
- Compatibilizar ativos com perfis de investidor (Conservador, Moderado, Arrojado)
- Fornecer dados atualizados do mercado financeiro brasileiro
- Calcular indicadores de risco (VaR, Beta, Sharpe Ratio, etc.)

---

## 2. Arquitetura do Sistema

### Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Estilização | Tailwind CSS + shadcn/ui |
| Backend | Lovable Cloud (Supabase) |
| Banco de Dados | PostgreSQL |
| Serverless | Edge Functions (Deno) |
| State Management | TanStack Query |

### Estrutura de Pastas

```
src/
├── components/          # Componentes React reutilizáveis
│   ├── ui/             # Componentes shadcn/ui
│   ├── dashboard/      # Componentes do dashboard
│   └── add-investments/ # Componentes de adição de investimentos
├── hooks/              # Custom hooks
├── lib/                # Utilitários e funções auxiliares
├── pages/              # Páginas da aplicação
└── integrations/       # Configurações de integração (Supabase)

supabase/
└── functions/          # Edge Functions
    ├── sync-anbima-data/
    ├── sync-brapi-quotes/
    ├── calculate-investment-risk/
    └── ...
```

### Fluxo de Dados

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  APIs Externas  │────▶│  Edge Functions  │────▶│  Banco de Dados │
│ (ANBIMA, Brapi) │     │ (Sincronização)  │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Frontend     │◀────│  Supabase Client │◀────│  unified_assets │
│     (React)     │     │                  │     │   (View/Table)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 3. Boas Práticas de Desenvolvimento

### Convenções de Código

- **TypeScript**: Sempre tipar corretamente, evitar `any`
- **Componentes**: Usar componentes funcionais com hooks
- **Nomenclatura**: camelCase para variáveis, PascalCase para componentes
- **Imports**: Usar alias `@/` para imports absolutos

### Padrões de Commit

```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
refactor: refatoração sem mudança de comportamento
chore: tarefas de manutenção
```

### Tratamento de Erros

- Sempre usar try/catch em operações assíncronas
- Logar erros com contexto suficiente para debugging
- Mostrar feedback apropriado ao usuário (toast)

---

## 4. Operações de Banco de Dados

### 4.1 Tabelas Principais

#### Dados de Mercado

| Tabela | Fonte | Descrição |
|--------|-------|-----------|
| `anbima_titulos_publicos` | ANBIMA | Títulos públicos federais |
| `anbima_debentures` | ANBIMA | Debêntures corporativas |
| `anbima_cri_cra` | ANBIMA | Certificados de recebíveis |
| `anbima_fundos` | ANBIMA | Fundos de investimento |
| `anbima_fidc` | ANBIMA | FIDCs |
| `anbima_letras_financeiras` | ANBIMA | Letras financeiras |
| `brapi_market_data` | Brapi | Ações, FIIs, ETFs, BDRs |
| `brapi_historical_prices` | Brapi | Histórico de preços |
| `cvm_ofertas_publicas` | CVM | Ofertas públicas |

#### Tabelas Unificadas

| Tabela | Descrição |
|--------|-----------|
| `unified_assets` | Visão consolidada de todos os ativos |
| `mv_investment_search` | Materialized view para busca otimizada |
| `anbima_asset_risk_scores` | Scores de risco pré-calculados |

#### Dados do Usuário

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Perfil do usuário |
| `user_investments` | Investimentos do usuário |
| `user_filter_preferences` | Preferências de filtro |

### 4.2 Políticas RLS

#### Padrão para Dados Públicos (Leitura)
```sql
CREATE POLICY "Allow public read access"
ON public.tabela
FOR SELECT
USING (true);
```

#### Padrão para Dados do Usuário
```sql
CREATE POLICY "Users can manage own data"
ON public.user_investments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

### 4.3 🔴 PROTOCOLO DE SEGURANÇA PARA QUERIES DESTRUTIVAS

> ⚠️ **ATENÇÃO**: Este protocolo é **OBRIGATÓRIO** para qualquer operação que modifique ou remova dados em produção.

#### Operações Cobertas

| Comando | Risco | Descrição |
|---------|-------|-----------|
| `DELETE` | 🔴 Alto | Remove registros permanentemente |
| `UPDATE` | 🟠 Médio-Alto | Modifica dados existentes |
| `DROP` | 🔴 Crítico | Remove estruturas (tabelas, índices) |
| `TRUNCATE` | 🔴 Crítico | Remove todos os registros de uma tabela |
| `ALTER TABLE DROP COLUMN` | 🔴 Alto | Remove colunas e seus dados |

---

#### Procedimento Obrigatório: 5 Passos

##### 📋 PASSO 1: PREVIEW - Visualizar dados afetados

**Objetivo**: Entender exatamente quais dados serão afetados antes de qualquer modificação.

```sql
-- SEMPRE executar SELECT equivalente ANTES da operação destrutiva
-- Usar as MESMAS condições WHERE que serão usadas na query final

SELECT * 
FROM nome_da_tabela 
WHERE [condições_da_query_destrutiva] 
LIMIT 20;
```

**Checklist do Preview:**
- [ ] Os dados exibidos são realmente os que devem ser afetados?
- [ ] Existem dados inesperados na lista?
- [ ] As condições WHERE estão corretas?

---

##### 🔢 PASSO 2: CONTAGEM - Informar impacto numérico

**Objetivo**: Quantificar o impacto exato da operação.

```sql
-- Obter contagem EXATA de registros afetados
SELECT COUNT(*) as registros_afetados 
FROM nome_da_tabela 
WHERE [condições_da_query_destrutiva];
```

**Análise da Contagem:**
- Se o número for **maior que o esperado**: PARE e revise as condições
- Se o número for **menor que o esperado**: verifique se há dados faltantes
- Se o número for **zero**: a query pode estar incorreta ou os dados não existem

---

##### 📊 PASSO 3: EXEMPLOS - Apresentar amostra representativa

**Objetivo**: Permitir validação visual dos dados que serão afetados.

```sql
-- Selecionar amostra com colunas relevantes
SELECT 
    coluna_identificadora,
    coluna_principal_1,
    coluna_principal_2,
    created_at
FROM nome_da_tabela 
WHERE [condições_da_query_destrutiva]
ORDER BY created_at DESC
LIMIT 10;
```

**Formato de Apresentação:**
```
📊 Amostra de dados que serão afetados:

| ID | Coluna 1 | Coluna 2 | Criado em |
|----|----------|----------|-----------|
| x1 | valor_a  | valor_b  | 2025-01-01|
| x2 | valor_c  | valor_d  | 2025-01-02|
| ...| ...      | ...      | ...       |

Total: X registros serão [DELETADOS/ATUALIZADOS]
```

---

##### ✅ PASSO 4: CONFIRMAÇÃO EXPLÍCITA - Aguardar aprovação

**Objetivo**: Garantir que o usuário está ciente e aprova a operação.

⚠️ **REGRA CRÍTICA**: **NUNCA** executar a query destrutiva automaticamente ou sem confirmação.

**Formato de Solicitação de Confirmação:**
```
⚠️ CONFIRMAÇÃO NECESSÁRIA

Operação: [DELETE/UPDATE/DROP/TRUNCATE]
Tabela: nome_da_tabela
Registros afetados: X
Condições: [resumo das condições WHERE]

Esta operação é IRREVERSÍVEL. Deseja prosseguir?

Responda: "CONFIRMAR [operação]" para executar
```

**Respostas Válidas:**
- ✅ "CONFIRMAR DELETE" / "CONFIRMAR UPDATE" / etc.
- ✅ "Sim, pode prosseguir"
- ✅ "Aprovado"
- ❌ Silêncio ou resposta ambígua = NÃO EXECUTAR

---

##### 💾 PASSO 5: BACKUP - Preservar dados (quando aplicável)

**Objetivo**: Criar ponto de recuperação antes de operações críticas.

**Opção A: Exportar para arquivo**
```sql
-- Sugerir exportação via interface
COPY (SELECT * FROM tabela WHERE [condições]) 
TO '/tmp/backup_tabela_YYYYMMDD.csv' 
WITH CSV HEADER;
```

**Opção B: Tabela de backup temporária**
```sql
-- Criar cópia dos dados afetados
CREATE TABLE backup_operacao_YYYYMMDD AS
SELECT * FROM tabela WHERE [condições];
```

**Opção C: Soft delete (preferível)**
```sql
-- Em vez de DELETE, usar UPDATE com flag
UPDATE tabela 
SET deleted_at = now(), 
    is_active = false 
WHERE [condições];
```

---

#### 📌 Exemplo Prático: Caso Real dos Tickers Fracionários

Este exemplo documenta uma operação que foi executada **incorretamente** (sem protocolo) e serve como aprendizado:

##### ❌ Como FOI feito (ERRADO):
```sql
-- Query executada diretamente, sem confirmação
DELETE FROM brapi_market_data WHERE ticker LIKE '%F' AND LENGTH(ticker) >= 5;
-- Resultado: 396 registros deletados permanentemente
```

##### ✅ Como DEVERIA ter sido feito (CORRETO):

**Passo 1 - Preview:**
```sql
SELECT ticker, asset_type, short_name, dividend_yield, created_at
FROM brapi_market_data 
WHERE ticker LIKE '%F' AND LENGTH(ticker) >= 5
LIMIT 20;
```

**Passo 2 - Contagem:**
```sql
SELECT COUNT(*) as registros_afetados 
FROM brapi_market_data 
WHERE ticker LIKE '%F' AND LENGTH(ticker) >= 5;
-- Resultado: 396 registros
```

**Passo 3 - Exemplos:**
```
📊 Amostra de tickers fracionários que serão deletados:

| ticker  | asset_type | short_name        | dividend_yield |
|---------|------------|-------------------|----------------|
| PETR4F  | stock      | PETROBRAS PN      | NULL           |
| VALE3F  | stock      | VALE ON           | NULL           |
| ITUB4F  | stock      | ITAÚ UNIBANCO PN  | NULL           |
| BBDC4F  | stock      | BRADESCO PN       | NULL           |
| ABEV3F  | stock      | AMBEV ON          | NULL           |
| WEGE3F  | stock      | WEG ON            | NULL           |
| BBAS3F  | stock      | BANCO BRASIL ON   | NULL           |
| RENT3F  | stock      | LOCALIZA ON       | NULL           |
| MGLU3F  | stock      | MAGAZINE LUIZA ON | NULL           |
| LREN3F  | stock      | LOJAS RENNER ON   | NULL           |

Total: 396 registros serão DELETADOS
```

**Passo 4 - Confirmação:**
```
⚠️ CONFIRMAÇÃO NECESSÁRIA

Operação: DELETE
Tabela: brapi_market_data
Registros afetados: 396
Condições: ticker LIKE '%F' AND LENGTH(ticker) >= 5

Justificativa: Tickers fracionários são duplicatas das ações 
principais e não devem ser mantidos no sistema.

Esta operação é IRREVERSÍVEL. Deseja prosseguir?

Responda: "CONFIRMAR DELETE" para executar
```

**Passo 5 - Backup:**
```sql
-- Criar backup antes da deleção
CREATE TABLE backup_fractional_tickers_20250119 AS
SELECT * FROM brapi_market_data 
WHERE ticker LIKE '%F' AND LENGTH(ticker) >= 5;
```

---

#### 🚫 Exceções ao Protocolo

O protocolo pode ser flexibilizado **apenas** nas seguintes situações:

| Situação | Condição | Ação |
|----------|----------|------|
| Ambiente de desenvolvimento | Dados são fictícios/teste | Pode simplificar passos 4 e 5 |
| Operação solicitada explicitamente | Usuário já forneceu confirmação prévia | Pular passo 4 |
| Rollback de migração | Dados inseridos há poucos minutos | Documentar e executar |
| Limpeza de dados temporários | Tabelas marcadas como temp_ ou tmp_ | Apenas passos 1 e 2 |

**IMPORTANTE**: Mesmo nas exceções, os passos 1 (Preview) e 2 (Contagem) são **SEMPRE** obrigatórios.

---

#### ⚡ Consequências de Violação

| Consequência | Impacto | Mitigação |
|--------------|---------|-----------|
| Perda permanente de dados | 🔴 Crítico | Requer re-sincronização completa de fontes externas |
| Inconsistência entre tabelas | 🟠 Alto | Verificar foreign keys e relacionamentos |
| Quebra de integridade referencial | 🟠 Alto | Auditar tabelas dependentes |
| Perda de histórico | 🔴 Crítico | Dados históricos podem ser irrecuperáveis |

---

### 4.4 Validação de Integridade

#### Queries de Verificação Pós-Operação

```sql
-- Verificar consistência de contagens
SELECT 
    'unified_assets' as tabela,
    COUNT(*) as total,
    COUNT(DISTINCT asset_code) as unicos
FROM unified_assets
UNION ALL
SELECT 
    'brapi_market_data',
    COUNT(*),
    COUNT(DISTINCT ticker)
FROM brapi_market_data;

-- Verificar dados órfãos
SELECT ui.id, ui.investment_name
FROM user_investments ui
LEFT JOIN investment_categories ic ON ui.category_id = ic.id
WHERE ic.id IS NULL AND ui.category_id IS NOT NULL;

-- Verificar integridade de risk scores
SELECT 
    asset_type,
    COUNT(*) as total,
    COUNT(risk_score) as com_score,
    ROUND(COUNT(risk_score)::numeric / COUNT(*) * 100, 1) as cobertura_pct
FROM unified_assets
GROUP BY asset_type
ORDER BY total DESC;
```

---

### 4.5 Filtro de Ativos por Risk Score

> ⚠️ **IMPORTANTE**: Ativos sem avaliação de risco válida não são exibidos no frontend do sistema.

#### Lógica de Filtro

O sistema aplica filtros de qualidade na transformação de dados para `unified_assets`. Apenas ativos que atendam **todos** os seguintes critérios são incluídos:

| Critério | Condição | Justificativa |
|----------|----------|---------------|
| Risk Score | `risk_score > 0` | Exclui ativos não avaliados (NULL) ou com erro de cálculo (-1) |
| Risk Category | `risk_category IN ('Baixo', 'Moderado', 'Alto')` | Garante classificação válida para match com perfil do investidor |

#### Implementação

O filtro é aplicado na edge function `transform-to-unified/index.ts`:

```typescript
// Linhas 503-505 da função transformBrapi
const validAssets = brapiData.filter(asset => 
  asset.risk_score !== null && 
  asset.risk_score > 0 &&
  ['Baixo', 'Moderado', 'Alto'].includes(asset.risk_category)
);
```

#### Impacto Atual

| Tipo de Ativo | Total (brapi) | Sem Risk Score | Excluídos | Exibidos |
|---------------|---------------|----------------|-----------|----------|
| BDR | 668 | 92 (NULL) + 61 (-1) | 153 | 515 |
| FII | 400+ | ~20 | ~20 | ~380 |
| Stock | 350+ | ~15 | ~15 | ~335 |
| ETF | 115+ | ~5 | ~5 | ~110 |
| Unit | 16 | ~3 | ~3 | ~13 |
| **Total** | ~1650 | ~140 | ~140 (~8.5%) | ~1510 |

#### Queries de Monitoramento

```sql
-- 1. Ativos sem risk_score por tipo (brapi_market_data)
SELECT 
    asset_type, 
    COUNT(*) as sem_risk_score,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as pct
FROM brapi_market_data
WHERE risk_score IS NULL
GROUP BY asset_type
ORDER BY sem_risk_score DESC;

-- 2. Ativos com risk_score inválido (-1 = erro de cálculo)
SELECT 
    asset_type,
    COUNT(*) as com_erro
FROM brapi_market_data
WHERE risk_score = -1
GROUP BY asset_type
ORDER BY com_erro DESC;

-- 3. Comparativo brapi vs unified (detectar exclusões)
SELECT 
    b.asset_type,
    COUNT(b.id) as total_brapi,
    COUNT(u.id) as total_unified,
    COUNT(b.id) - COUNT(u.id) as excluidos
FROM brapi_market_data b
LEFT JOIN unified_assets u ON b.ticker = u.asset_code AND u.source = 'brapi'
GROUP BY b.asset_type
ORDER BY excluidos DESC;

-- 4. Cobertura de risk_score por fonte
SELECT 
    source,
    COUNT(*) as total,
    COUNT(risk_score) as com_score,
    ROUND(COUNT(risk_score)::numeric / COUNT(*) * 100, 1) as cobertura_pct
FROM unified_assets
GROUP BY source
ORDER BY total DESC;

-- 5. Ativos específicos sem risco (para debug)
SELECT ticker, asset_type, short_name, risk_score, risk_category
FROM brapi_market_data
WHERE risk_score IS NULL OR risk_score <= 0
ORDER BY asset_type, ticker
LIMIT 50;
```

---

## 5. Edge Functions

### Funções de Sincronização

| Função | Frequência | Descrição |
|--------|------------|-----------|
| `sync-anbima-data` | Diária (cron) | Sincroniza dados ANBIMA |
| `sync-brapi-quotes` | Diária (cron) | Sincroniza cotações Brapi |
| `sync-cvm-data` | Semanal | Sincroniza ofertas CVM |
| `transform-to-unified` | Após syncs | Consolida em unified_assets |

### Funções de Cálculo

| Função | Trigger | Descrição |
|--------|---------|-----------|
| `calculate-investment-risk` | Sob demanda | Calcula risco de investimento |
| `precalculate-anbima-risks` | Após sync ANBIMA | Pré-calcula scores |
| `calculate-brapi-risk` | Após sync Brapi | Calcula risco de ativos Brapi |

### Padrão de Logs

```typescript
console.log(`[FUNCTION_NAME] Starting execution...`);
console.log(`[FUNCTION_NAME] Processing ${count} records`);
console.error(`[FUNCTION_NAME] Error: ${error.message}`);
```

---

## 6. Integrações Externas

### ANBIMA API

- **Base URL**: `https://api.anbima.com.br`
- **Autenticação**: OAuth2 (client_credentials)
- **Secrets**: `ANBIMA_CLIENT_ID`, `ANBIMA_CLIENT_SECRET`
- **Rate Limit**: Não documentado oficialmente
- **Dados disponíveis**: Títulos públicos, debêntures, fundos, FIDCs, CRI/CRA, LFs

### Brapi API

- **Base URL**: `https://brapi.dev/api`
- **Autenticação**: API Key via query param
- **Secret**: `BRAPI_API_KEY`
- **Rate Limit**: Depende do plano
- **Limitações conhecidas**:
  - `dividend_yield` não disponível para todos os ativos
  - FIIs têm baixa cobertura de dados fundamentalistas

### CVM

- **Fonte**: Arquivos CSV/ZIP públicos
- **URL**: `dados.cvm.gov.br`
- **Autenticação**: Não requerida
- **Atualização**: Irregular

---

## 7. Histórico de Decisões

### Registro de Decisões Arquiteturais (ADR)

| Data | ID | Decisão | Contexto | Consequências |
|------|----|---------|----------|---------------|
| 2025-01-19 | ADR-001 | Implementar protocolo de segurança para queries destrutivas | Query DELETE executada sem confirmação removeu 396 registros de tickers fracionários | Prevenção de perda de dados; processo mais lento mas seguro |
| 2025-01-19 | ADR-002 | Excluir tickers fracionários (terminados em 'F') da sincronização Brapi | Tickers fracionários são duplicatas desnecessárias das ações principais | Redução de ~396 registros; dados mais limpos; melhor cobertura de dividend_yield |
| 2025-01-19 | ADR-003 | Corrigir regex de detecção de BDRs para aceitar padrões como M1TA34, P2LT34 | Regex anterior `/^[A-Z]{4,5}3[1-9]$/` não detectava BDRs com números no início | BDRs aumentaram de 322 para 585; classificação mais precisa |
| 2025-01-19 | ADR-004 | Implementar detecção de ativos por conteúdo do nome + adicionar tipo 'unit' | Units classificadas incorretamente como FIIs; ~100 ETFs como FIIs; 94 BDRs como stocks | Precisão aumentada: 16 Units, 131 ETFs, 668 BDRs corretamente classificados; novo tipo 'unit' no sistema |
| 2025-01-19 | ADR-005 | Expandir objectiveClassification.ts para suportar multi-objetivo | Units com DY>3%, ETFs de dividendos e stocks com DY>5% podem gerar renda além de acumular | Melhor recomendação de ativos para objetivo "Renda Regular"; ETFs DIVD11, NDIV11 etc aparecem em ambos objetivos |

| 2025-01-19 | ADR-006 | Ativos sem risk_score válido não são exibidos no sistema | Ativos sem avaliação de risco podem representar investimentos de risco desconhecido; usuários não devem ser expostos a recomendações não validadas | ~140 ativos (~8.5%) não aparecem; maior segurança para usuários; cobertura pode aumentar com futuros syncs e melhorias no cálculo de risco |

### Template para Novas Decisões

```markdown
| Data | ID | Decisão | Contexto | Consequências |
|------|----|---------|----------|---------------|
| YYYY-MM-DD | ADR-XXX | [Resumo da decisão] | [Por que foi necessário] | [Impacto positivo e negativo] |
```

---

## 📝 Contribuindo com a Documentação

Para adicionar ou atualizar esta documentação:

1. Manter o formato Markdown consistente
2. Atualizar o índice quando adicionar novas seções
3. Registrar decisões importantes na seção 7
4. Manter exemplos de código atualizados e funcionais

---

*Documento gerado e mantido pela equipe InvestIA*
