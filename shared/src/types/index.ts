// Type definitions for EVE Trading Assistant
// Placeholder file for shared TypeScript interfaces and types

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  preferences: UserPreferences;
  subscription: SubscriptionInfo;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: NotificationPreferences;
  trading: TradingPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  push: boolean;
}

export interface TradingPreferences {
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  defaultBudget: number;
  preferredRegions: number[];
}

export interface SubscriptionInfo {
  tier: 'FREE' | 'PREMIUM';
  expiresAt?: Date;
}

// Placeholder exports - will be expanded in later tasks
export type MarketData = Record<string, unknown>;
export type TradingSuggestion = Record<string, unknown>;
export type EveCharacter = Record<string, unknown>;
