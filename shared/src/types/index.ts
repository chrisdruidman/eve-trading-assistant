// Type definitions for EVE Trading Assistant
// Complete TypeScript interfaces and types based on design document

// ============================================================================
// User and Authentication Types
// ============================================================================

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

export interface UserCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: 'Bearer';
}

export interface EveCharacter {
  characterId: number;
  characterName: string;
  corporationId: number;
  allianceId?: number;
  apiKey: string; // Encrypted
  scopes: string[];
  lastSync: Date;
}

export interface EveApiKeyInfo {
  characterId: number;
  characterName: string;
  scopes: string[];
  expiresAt: Date;
  isValid: boolean;
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface MarketData {
  typeId: number;
  regionId: number;
  buyOrders: MarketOrder[];
  sellOrders: MarketOrder[];
  lastUpdated: Date;
  volume: number;
  averagePrice: number;
}

export interface MarketOrder {
  orderId: number;
  typeId: number;
  regionId: number;
  locationId: number;
  price: number;
  volume: number;
  minVolume: number;
  duration: number;
  issued: Date;
  isBuyOrder: boolean;
}

export interface PriceHistory {
  typeId: number;
  regionId: number;
  date: Date;
  highest: number;
  lowest: number;
  average: number;
  volume: number;
  orderCount: number;
}

export interface HistoricalData {
  typeId: number;
  regionId: number;
  date: Date;
  highest: number;
  lowest: number;
  average: number;
  volume: number;
  orderCount: number;
}

export interface CacheStrategy {
  ttl: number; // Time to live in seconds
  refreshThreshold: number; // Percentage of TTL when to refresh
  maxStaleTime: number; // Maximum time to serve stale data
}

// ============================================================================
// Trading Types
// ============================================================================

export interface TradingSuggestion {
  itemId: number;
  itemName: string;
  buyPrice: number;
  sellPrice: number;
  expectedProfit: number;
  profitMargin: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredInvestment: number;
  timeToProfit: number;
  confidence: number;
}

export interface TradingPlan {
  id: string;
  userId: string;
  budget: number;
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  suggestions: TradingSuggestion[];
  createdAt: Date;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

export interface TradingPlanParams {
  budget: number;
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  preferredRegions?: number[];
  excludedItems?: number[];
  maxInvestmentPerTrade?: number;
}

export interface ExecutedTrade {
  id: string;
  userId: string;
  suggestionId: string;
  itemId: number;
  buyPrice: number;
  sellPrice?: number;
  quantity: number;
  executedAt: Date;
  completedAt?: Date;
  actualProfit?: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItem[];
  alerts: AlertRule[];
}

export interface WatchlistItem {
  typeId: number;
  regionId: number;
  targetBuyPrice?: number;
  targetSellPrice?: number;
  addedAt: Date;
}

export interface AlertRule {
  id: string;
  typeId: number;
  regionId: number;
  condition: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'VOLUME_ABOVE' | 'VOLUME_BELOW';
  threshold: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Alert {
  id: string;
  userId: string;
  ruleId: string;
  typeId: number;
  regionId: number;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
}

// ============================================================================
// AI Agent Types
// ============================================================================

export interface AIResponse {
  content: string;
  confidence: number;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cached: boolean;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  generateResponse(prompt: string, context: any): Promise<AIResponse>;
  estimateCost(prompt: string): number;
}

export interface AIOperation {
  prompt: string;
  context: any;
  maxRetries?: number;
  timeout?: number;
}

export interface MarketAnalysis {
  summary: string;
  trends: MarketTrend[];
  opportunities: TradingOpportunity[];
  risks: RiskAssessment[];
  confidence: number;
  generatedAt: Date;
}

export interface MarketTrend {
  typeId: number;
  regionId: number;
  direction: 'UPWARD' | 'DOWNWARD' | 'STABLE';
  strength: number; // 0-1
  timeframe: string;
  description: string;
}

export interface TradingOpportunity {
  typeId: number;
  regionId: number;
  buyLocation: number;
  sellLocation: number;
  expectedProfit: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
}

export interface RiskAssessment {
  factor: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  mitigation?: string;
}

export interface AnalysisContext {
  userId: string;
  budget: number;
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  preferredRegions: number[];
  timeHorizon: 'SHORT' | 'MEDIUM' | 'LONG';
}

export interface MarketConditions {
  volatility: number;
  liquidity: number;
  trend: 'BULL' | 'BEAR' | 'SIDEWAYS';
  majorEvents: string[];
}

export interface TradingAdvice {
  recommendations: TradingSuggestion[];
  strategy: string;
  reasoning: string;
  warnings: string[];
  confidence: number;
}

export interface UserProfile {
  userId: string;
  tradingExperience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  availableBudget: number;
  preferredMarkets: number[];
  tradingGoals: string[];
}

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: 'MARKET_ALERT' | 'TRADING_OPPORTUNITY' | 'SYSTEM_UPDATE' | 'ACCOUNT_NOTICE';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  channels: NotificationChannel[];
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  data?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'EMAIL' | 'IN_APP' | 'PUSH';
  address?: string; // email address for EMAIL type
  delivered: boolean;
  deliveredAt?: Date;
  error?: string;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface ErrorResponse {
  code: string;
  message: string;
  retryable: boolean;
  fallbackAction?: string;
  userMessage: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

// ============================================================================
// Service Interface Types
// ============================================================================

export interface AuthService {
  authenticateUser(credentials: UserCredentials): Promise<AuthToken>;
  validateEveApiKey(apiKey: string): Promise<EveApiKeyInfo>;
  encryptSensitiveData(data: string): Promise<string>;
  decryptSensitiveData(encryptedData: string): Promise<string>;
  refreshToken(token: string): Promise<AuthToken>;
}

export interface MarketDataService {
  getMarketData(regionId: number, typeId: number): Promise<MarketData>;
  getHistoricalData(regionId: number, typeId: number, days: number): Promise<HistoricalData[]>;
  addToWatchlist(userId: string, items: WatchlistItem[]): Promise<void>;
  getWatchlistAlerts(userId: string): Promise<Alert[]>;
}

export interface TradingService {
  generateTradingSuggestions(userId: string, budget: number): Promise<TradingSuggestion[]>;
  createTradingPlan(userId: string, parameters: TradingPlanParams): Promise<TradingPlan>;
  updateBudget(userId: string, newBudget: number): Promise<void>;
  trackTradeExecution(userId: string, trade: ExecutedTrade): Promise<void>;
}

export interface AIAgentService {
  analyzeMarketData(marketData: MarketData[], context: AnalysisContext): Promise<MarketAnalysis>;
  generateTradingAdvice(
    userProfile: UserProfile,
    marketConditions: MarketConditions
  ): Promise<TradingAdvice>;
  explainTradingStrategy(suggestion: TradingSuggestion): Promise<string>;
}

export interface AIProviderManager {
  registerProvider(provider: AIProvider): void;
  getAvailableProvider(): Promise<AIProvider>;
  executeWithFailover(operation: AIOperation): Promise<AIResponse>;
}

export interface RateLimiter {
  checkLimit(service: string, userId?: string): Promise<boolean>;
  executeWithBackoff<T>(operation: () => Promise<T>): Promise<T>;
  getRetryDelay(attemptNumber: number): number;
}

export interface ErrorHandler {
  handleEsiError(error: EsiError): Promise<ErrorResponse>;
  handleAiProviderError(error: AiProviderError): Promise<ErrorResponse>;
  handleDatabaseError(error: DatabaseError): Promise<ErrorResponse>;
}

// ============================================================================
// External API Error Types
// ============================================================================

export interface EsiError extends Error {
  status: number;
  code: string;
  retryAfter?: number;
}

export interface AiProviderError extends Error {
  provider: string;
  code: string;
  retryable: boolean;
}

export interface DatabaseError extends Error {
  code: string;
  constraint?: string;
  table?: string;
}
