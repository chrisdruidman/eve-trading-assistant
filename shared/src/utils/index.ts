// Utility functions for EVE Trading Assistant
// Complete utility functions and exports

// ============================================================================
// Formatting Utilities
// ============================================================================

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatISK = (amount: number): string => {
  if (amount >= 1e12) {
    return `${(amount / 1e12).toFixed(2)}T ISK`;
  } else if (amount >= 1e9) {
    return `${(amount / 1e9).toFixed(2)}B ISK`;
  } else if (amount >= 1e6) {
    return `${(amount / 1e6).toFixed(2)}M ISK`;
  } else if (amount >= 1e3) {
    return `${(amount / 1e3).toFixed(2)}K ISK`;
  }
  return `${amount.toFixed(2)} ISK`;
};

export const formatNumber = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// ============================================================================
// Date and Time Utilities
// ============================================================================

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
};

export const isDateExpired = (date: Date): boolean => {
  return date.getTime() < Date.now();
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

// ============================================================================
// Trading Calculation Utilities
// ============================================================================

export const calculateProfitMargin = (buyPrice: number, sellPrice: number): number => {
  if (buyPrice <= 0) return 0;
  return ((sellPrice - buyPrice) / buyPrice) * 100;
};

export const calculateProfit = (
  buyPrice: number,
  sellPrice: number,
  quantity: number = 1
): number => {
  return (sellPrice - buyPrice) * quantity;
};

export const calculateROI = (profit: number, investment: number): number => {
  if (investment <= 0) return 0;
  return (profit / investment) * 100;
};

export const calculateBreakEvenPrice = (buyPrice: number, fees: number = 0): number => {
  return buyPrice + fees;
};

export const calculateTaxes = (amount: number, taxRate: number = 0.05): number => {
  return amount * taxRate;
};

export const calculateBrokerFees = (amount: number, feeRate: number = 0.03): number => {
  return amount * feeRate;
};

export const calculateNetProfit = (
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  taxRate: number = 0.05,
  brokerFeeRate: number = 0.03
): number => {
  const grossProfit = calculateProfit(buyPrice, sellPrice, quantity);
  const sellValue = sellPrice * quantity;
  const taxes = calculateTaxes(sellValue, taxRate);
  const brokerFees = calculateBrokerFees(sellValue, brokerFeeRate);
  return grossProfit - taxes - brokerFees;
};

// ============================================================================
// Risk Assessment Utilities
// ============================================================================

export const calculateRiskScore = (
  volatility: number,
  liquidity: number,
  marketDepth: number
): number => {
  // Normalize inputs to 0-1 scale and calculate weighted risk score
  const normalizedVolatility = Math.min(volatility / 100, 1);
  const normalizedLiquidity = Math.max(0, 1 - liquidity / 1000000); // Lower liquidity = higher risk
  const normalizedDepth = Math.max(0, 1 - marketDepth / 100); // Lower depth = higher risk

  return (normalizedVolatility * 0.4 + normalizedLiquidity * 0.3 + normalizedDepth * 0.3) * 100;
};

export const getRiskLevel = (riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (riskScore < 30) return 'LOW';
  if (riskScore < 70) return 'MEDIUM';
  return 'HIGH';
};

export const calculateConfidenceScore = (
  dataAge: number, // in minutes
  sampleSize: number,
  volatility: number
): number => {
  // Confidence decreases with data age, low sample size, and high volatility
  const ageScore = Math.max(0, 1 - dataAge / 60); // Decreases over 1 hour
  const sampleScore = Math.min(1, sampleSize / 100); // Optimal at 100+ samples
  const volatilityScore = Math.max(0, 1 - volatility / 50); // Decreases with volatility

  return (ageScore * 0.4 + sampleScore * 0.3 + volatilityScore * 0.3) * 100;
};

// ============================================================================
// Data Processing Utilities
// ============================================================================

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const groupBy = <T, K extends keyof any>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> => {
  return array.reduce(
    (groups, item) => {
      const groupKey = key(item);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<K, T[]>
  );
};

export const sortBy = <T>(
  array: T[],
  key: keyof T | ((item: T) => any),
  order: 'asc' | 'desc' = 'asc'
): T[] => {
  const getValue = typeof key === 'function' ? key : (item: T) => item[key];

  return [...array].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

export const unique = <T>(array: T[], key?: keyof T | ((item: T) => any)): T[] => {
  if (!key) {
    return [...new Set(array)];
  }

  const getValue = typeof key === 'function' ? key : (item: T) => item[key];
  const seen = new Set();

  return array.filter(item => {
    const value = getValue(item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

export const average = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
};

export const median = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};

export const standardDeviation = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  const avg = average(numbers);
  const squaredDiffs = numbers.map(num => Math.pow(num - avg, 2));
  return Math.sqrt(average(squaredDiffs));
};

// ============================================================================
// String Utilities
// ============================================================================

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const truncate = (text: string, length: number, suffix: string = '...'): string => {
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
};

export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const camelCase = (text: string): string => {
  return text
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '');
};

export const kebabCase = (text: string): string => {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

// ============================================================================
// Validation Utilities
// ============================================================================

export const validateApiKey = (key: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(key) && key.length > 10;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

export const isPositiveNumber = (value: any): value is number => {
  return isValidNumber(value) && value > 0;
};

export const isNonNegativeNumber = (value: any): value is number => {
  return isValidNumber(value) && value >= 0;
};

// ============================================================================
// Cache Key Utilities
// ============================================================================

export const createCacheKey = (...parts: (string | number)[]): string => {
  return parts.map(part => String(part)).join(':');
};

export const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

// ============================================================================
// Retry Utilities
// ============================================================================

export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError!;
};

// ============================================================================
// Export all utilities from other files
// ============================================================================

export * from './encryption';
export * from './errors';
export * from './validation';
export * from './logging';
