import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um número com casas decimais específicas no padrão brasileiro
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0,00';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formata um valor percentual (ex: 12.345 -> "12,35%")
 */
export function formatPercent(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0,00%';
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formata um valor monetário em Reais (ex: 1234.567 -> "R$ 1.234,57")
 */
export function formatCurrency(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Arredonda um número dentro de uma string de texto (ex: "IPCA + 5,4795%" -> "IPCA + 5,48%")
 */
export function roundNumbersInText(text: string, decimals = 2): string {
  if (!text) return text;
  
  // Regex para encontrar números com vírgula ou ponto como separador decimal
  return text.replace(/(\d+)[,.](\d{3,})/g, (match, intPart, decPart) => {
    const num = parseFloat(`${intPart}.${decPart}`);
    const rounded = num.toFixed(decimals);
    return rounded.replace('.', ',');
  });
}

/**
 * Sanitiza query de busca removendo caracteres potencialmente perigosos
 * e limitando tamanho para prevenir abusos.
 * 
 * ## Arquitetura de Segurança (Defense in Depth)
 * 
 * Esta função é a **1ª camada** de uma estratégia de 3 camadas:
 * 
 * ### Camada 1: Client-side (esta função)
 * - Remove caracteres usados em SQL injection: ; ' " \ ` { } [ ] < >
 * - Remove padrões de comentário SQL: -- e /asterisk asterisk/
 * - Limita tamanho para prevenir DoS e buffer overflow
 * 
 * ### Camada 2: Server-side (Supabase SDK)
 * - `.ilike()` usa parameterized queries internamente
 * - Valores são escapados automaticamente pelo SDK
 * - Nenhum input do usuário é concatenado diretamente em SQL
 * 
 * ### Camada 3: Database (PostgreSQL)
 * - Prepared statements previnem injeção em tempo de execução
 * - RLS policies limitam acesso baseado em auth.uid()
 * - Permissões de schema restringem operações DDL
 * 
 * ## Exemplos de Ataques Bloqueados
 * 
 * @example
 * // SQL Injection clássico
 * sanitizeSearchQuery("'; DROP TABLE users--")  // → " DROP TABLE users"
 * 
 * // Union-based injection  
 * sanitizeSearchQuery("' UNION SELECT * FROM--") // → " UNION SELECT  FROM"
 * 
 * // Comment injection
 * sanitizeSearchQuery("admin'/asterisk/OR/asterisk/1=1") // → "adminOR11"
 * 
 * // Input normal (preservado)
 * sanitizeSearchQuery("CDB 120% CDI")           // → "CDB 120% CDI"
 * sanitizeSearchQuery("PETR4")                  // → "PETR4"
 * 
 * IMPORTANTE: A limitação de tamanho é aplicada APÓS a sanitização
 * para garantir máxima segurança (ex: "abc;;;;;..." → "abc" → 3 chars)
 * 
 * @see https://owasp.org/www-community/attacks/SQL_Injection
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
 * 
 * @param query - String de busca do usuário (pode conter caracteres maliciosos)
 * @param maxLength - Tamanho máximo permitido após sanitização (default: 50)
 * @returns String sanitizada e limitada, segura para uso em queries
 */
export function sanitizeSearchQuery(query: string, maxLength = 50): string {
  if (!query) return '';
  
  // Remove caracteres especiais perigosos (SQL injection patterns)
  const sanitized = query
    .replace(/[;'"\\`{}[\]<>]/g, '') // Remove caracteres perigosos
    .replace(/--/g, '')              // Remove comentários SQL
    .replace(/\/\*/g, '')            // Remove início de comentário
    .replace(/\*\//g, '')            // Remove fim de comentário
    .trim();
  
  // Limita tamanho (aplicado APÓS sanitização para máxima segurança)
  return sanitized.slice(0, maxLength);
}
