// Validation utilities using Zod schemas for EVE Trading Assistant

import { z } from 'zod';
import { ValidationErrorClass, createValidationError } from './errors';

// ============================================================================
// Base Validation Schemas
// ============================================================================

// Common field validations
export const emailSchema = z.string().email('Invalid email format');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  );

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const positiveNumberSchema = z.number().positive('Must be a positive number');
export const nonNegativeNumberSchema = z.number().nonnegative('Must be non-negative');

// EVE Online specific validations
export const eveCharacterIdSchema = z.number().int().positive('Invalid EVE character ID');
export const eveRegionIdSchema = z.number().int().positive('Invalid EVE region ID');
export const eveTypeIdSchema = z.number().int().positive('Invalid EVE type ID');
export const iskAmountSchema = z.number().nonnegative('ISK amount must be non-negative');

// ============================================================================
// User and Authentication Schemas
// ============================================================================

export const userCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const userRegistrationSchema = z
  .object({
    email: emailSchema,
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(50, 'Username must be at most 50 characters')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, underscores, and hyphens'
      ),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark']),
  notifications: z.object({
    email: z.boolean(),
    inApp: z.boolean(),
    push: z.boolean(),
  }),
  trading: z.object({
    riskTolerance: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    defaultBudget: iskAmountSchema,
    preferredRegions: z.array(eveRegionIdSchema).max(10, 'Maximum 10 preferred regions allowed'),
  }),
});

export const eveApiKeySchema = z
  .string()
  .min(1, 'API key is required')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format');

export const eveCharacterSchema = z.object({
  characterId: eveCharacterIdSchema,
  characterName: z.string().min(1, 'Character name is required'),
  corporationId: z.number().int().positive('Invalid corporation ID'),
  allianceId: z.number().int().positive('Invalid alliance ID').optional(),
  apiKey: eveApiKeySchema,
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

// ============================================================================
// Market Data Schemas
// ============================================================================

export const marketOrderSchema = z.object({
  orderId: z.number().int().positive('Invalid order ID'),
  typeId: eveTypeIdSchema,
  regionId: eveRegionIdSchema,
  locationId: z.number().int().positive('Invalid location ID'),
  price: positiveNumberSchema,
  volume: z.number().int().positive('Volume must be positive'),
  minVolume: z.number().int().positive('Minimum volume must be positive'),
  duration: z.number().int().positive('Duration must be positive'),
  issued: z.date(),
  isBuyOrder: z.boolean(),
});

export const marketDataRequestSchema = z.object({
  regionId: eveRegionIdSchema,
  typeId: eveTypeIdSchema,
});

export const historicalDataRequestSchema = z.object({
  regionId: eveRegionIdSchema,
  typeId: eveTypeIdSchema,
  days: z.number().int().min(1, 'Days must be at least 1').max(365, 'Days cannot exceed 365'),
});

export const watchlistItemSchema = z
  .object({
    typeId: eveTypeIdSchema,
    regionId: eveRegionIdSchema,
    targetBuyPrice: positiveNumberSchema.optional(),
    targetSellPrice: positiveNumberSchema.optional(),
  })
  .refine(
    data => {
      if (data.targetBuyPrice && data.targetSellPrice) {
        return data.targetSellPrice > data.targetBuyPrice;
      }
      return true;
    },
    {
      message: 'Target sell price must be higher than target buy price',
      path: ['targetSellPrice'],
    }
  );

export const alertRuleSchema = z.object({
  typeId: eveTypeIdSchema,
  regionId: eveRegionIdSchema,
  condition: z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_ABOVE', 'VOLUME_BELOW']),
  threshold: positiveNumberSchema,
  isActive: z.boolean(),
});

// ============================================================================
// Trading Schemas
// ============================================================================

export const tradingPlanParamsSchema = z
  .object({
    budget: iskAmountSchema.min(1000, 'Minimum budget is 1,000 ISK'),
    riskTolerance: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    preferredRegions: z
      .array(eveRegionIdSchema)
      .max(10, 'Maximum 10 preferred regions allowed')
      .optional(),
    excludedItems: z
      .array(eveTypeIdSchema)
      .max(100, 'Maximum 100 excluded items allowed')
      .optional(),
    maxInvestmentPerTrade: iskAmountSchema.optional(),
  })
  .refine(
    data => {
      if (data.maxInvestmentPerTrade) {
        return data.maxInvestmentPerTrade <= data.budget;
      }
      return true;
    },
    {
      message: 'Maximum investment per trade cannot exceed total budget',
      path: ['maxInvestmentPerTrade'],
    }
  );

export const tradingSuggestionSchema = z
  .object({
    itemId: eveTypeIdSchema,
    itemName: z.string().min(1, 'Item name is required'),
    buyPrice: positiveNumberSchema,
    sellPrice: positiveNumberSchema,
    expectedProfit: z.number(),
    profitMargin: z.number().min(0, 'Profit margin must be non-negative'),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    requiredInvestment: positiveNumberSchema,
    timeToProfit: z.number().int().positive('Time to profit must be positive'),
    confidence: z
      .number()
      .min(0, 'Confidence must be at least 0')
      .max(1, 'Confidence cannot exceed 1'),
  })
  .refine(data => data.sellPrice > data.buyPrice, {
    message: 'Sell price must be higher than buy price',
    path: ['sellPrice'],
  });

export const executedTradeSchema = z.object({
  suggestionId: uuidSchema,
  itemId: eveTypeIdSchema,
  buyPrice: positiveNumberSchema,
  sellPrice: positiveNumberSchema.optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']),
});

// ============================================================================
// AI and Analysis Schemas
// ============================================================================

export const analysisContextSchema = z.object({
  userId: uuidSchema,
  budget: iskAmountSchema,
  riskTolerance: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
  preferredRegions: z.array(eveRegionIdSchema),
  timeHorizon: z.enum(['SHORT', 'MEDIUM', 'LONG']),
});

export const userProfileSchema = z.object({
  userId: uuidSchema,
  tradingExperience: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  riskTolerance: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
  availableBudget: iskAmountSchema,
  preferredMarkets: z.array(eveRegionIdSchema),
  tradingGoals: z.array(z.string()).max(10, 'Maximum 10 trading goals allowed'),
});

// ============================================================================
// Notification Schemas
// ============================================================================

export const notificationSchema = z.object({
  type: z.enum(['MARKET_ALERT', 'TRADING_OPPORTUNITY', 'SYSTEM_UPDATE', 'ACCOUNT_NOTICE']),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be at most 1000 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  channels: z
    .array(
      z.object({
        type: z.enum(['EMAIL', 'IN_APP', 'PUSH']),
        address: z.string().optional(),
      })
    )
    .min(1, 'At least one notification channel is required'),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate data against a Zod schema and throw ValidationError if invalid
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown, requestId?: string): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors = result.error.errors.map(error => ({
      field: error.path.join('.'),
      message: error.message,
      code: error.code,
      value: error.path.reduce((obj: any, key) => obj?.[key], data),
    }));

    throw createValidationError(fieldErrors, requestId);
  }

  return result.data;
}

/**
 * Validate data and return result without throwing
 */
export function validateDataSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string; code: string; value?: any }>;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(error => ({
    field: error.path.join('.'),
    message: error.message,
    code: error.code,
    value: error.path.reduce((obj: any, key) => obj?.[key], data),
  }));

  return { success: false, errors };
}

/**
 * Validate EVE Online API key format
 */
export function validateEveApiKey(apiKey: string): boolean {
  return eveApiKeySchema.safeParse(apiKey).success;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

/**
 * Validate ISK amount
 */
export function validateIskAmount(amount: number): boolean {
  return iskAmountSchema.safeParse(amount).success;
}

/**
 * Validate EVE character ID
 */
export function validateEveCharacterId(characterId: number): boolean {
  return eveCharacterIdSchema.safeParse(characterId).success;
}

/**
 * Validate EVE region ID
 */
export function validateEveRegionId(regionId: number): boolean {
  return eveRegionIdSchema.safeParse(regionId).success;
}

/**
 * Validate EVE type ID
 */
export function validateEveTypeId(typeId: number): boolean {
  return eveTypeIdSchema.safeParse(typeId).success;
}

/**
 * Create a partial schema for updates (all fields optional)
 */
export function createUpdateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Validate pagination parameters
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export function validatePagination(params: unknown) {
  return validateData(paginationSchema, params);
}
