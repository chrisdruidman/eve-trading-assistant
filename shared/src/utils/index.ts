// Utility functions for EVE Trading Assistant
// Placeholder file for shared utility functions

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

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Placeholder exports - will be expanded in later tasks
export const validateApiKey = (key: string): boolean => {
  return key.length > 0;
};

export const calculateProfitMargin = (buyPrice: number, sellPrice: number): number => {
  return ((sellPrice - buyPrice) / buyPrice) * 100;
};
