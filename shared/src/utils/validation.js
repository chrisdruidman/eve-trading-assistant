"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationSchema = exports.notificationSchema = exports.userProfileSchema = exports.analysisContextSchema = exports.executedTradeSchema = exports.tradingSuggestionSchema = exports.tradingPlanParamsSchema = exports.alertRuleSchema = exports.watchlistItemSchema = exports.historicalDataRequestSchema = exports.marketDataRequestSchema = exports.marketOrderSchema = exports.eveCharacterSchema = exports.eveApiKeySchema = exports.userPreferencesSchema = exports.userRegistrationSchema = exports.userCredentialsSchema = exports.iskAmountSchema = exports.eveTypeIdSchema = exports.eveRegionIdSchema = exports.eveCharacterIdSchema = exports.nonNegativeNumberSchema = exports.positiveNumberSchema = exports.uuidSchema = exports.passwordSchema = exports.emailSchema = void 0;
exports.validateData = validateData;
exports.validateDataSafe = validateDataSafe;
exports.validateEveApiKey = validateEveApiKey;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateIskAmount = validateIskAmount;
exports.validateEveCharacterId = validateEveCharacterId;
exports.validateEveRegionId = validateEveRegionId;
exports.validateEveTypeId = validateEveTypeId;
exports.createUpdateSchema = createUpdateSchema;
exports.validatePagination = validatePagination;
const zod_1 = require("zod");
const errors_1 = require("./errors");
exports.emailSchema = zod_1.z.string().email('Invalid email format');
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number');
exports.uuidSchema = zod_1.z.string().uuid('Invalid UUID format');
exports.positiveNumberSchema = zod_1.z.number().positive('Must be a positive number');
exports.nonNegativeNumberSchema = zod_1.z.number().nonnegative('Must be non-negative');
exports.eveCharacterIdSchema = zod_1.z.number().int().positive('Invalid EVE character ID');
exports.eveRegionIdSchema = zod_1.z.number().int().positive('Invalid EVE region ID');
exports.eveTypeIdSchema = zod_1.z.number().int().positive('Invalid EVE type ID');
exports.iskAmountSchema = zod_1.z.number().nonnegative('ISK amount must be non-negative');
exports.userCredentialsSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: exports.passwordSchema,
});
exports.userRegistrationSchema = zod_1.z
    .object({
    email: exports.emailSchema,
    username: zod_1.z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username must be at most 50 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
    password: exports.passwordSchema,
    confirmPassword: zod_1.z.string(),
})
    .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});
exports.userPreferencesSchema = zod_1.z.object({
    theme: zod_1.z.enum(['light', 'dark']),
    notifications: zod_1.z.object({
        email: zod_1.z.boolean(),
        inApp: zod_1.z.boolean(),
        push: zod_1.z.boolean(),
    }),
    trading: zod_1.z.object({
        riskTolerance: zod_1.z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
        defaultBudget: exports.iskAmountSchema,
        preferredRegions: zod_1.z.array(exports.eveRegionIdSchema).max(10, 'Maximum 10 preferred regions allowed'),
    }),
});
exports.eveApiKeySchema = zod_1.z
    .string()
    .min(1, 'API key is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format');
exports.eveCharacterSchema = zod_1.z.object({
    characterId: exports.eveCharacterIdSchema,
    characterName: zod_1.z.string().min(1, 'Character name is required'),
    corporationId: zod_1.z.number().int().positive('Invalid corporation ID'),
    allianceId: zod_1.z.number().int().positive('Invalid alliance ID').optional(),
    apiKey: exports.eveApiKeySchema,
    scopes: zod_1.z.array(zod_1.z.string()).min(1, 'At least one scope is required'),
});
exports.marketOrderSchema = zod_1.z.object({
    orderId: zod_1.z.number().int().positive('Invalid order ID'),
    typeId: exports.eveTypeIdSchema,
    regionId: exports.eveRegionIdSchema,
    locationId: zod_1.z.number().int().positive('Invalid location ID'),
    price: exports.positiveNumberSchema,
    volume: zod_1.z.number().int().positive('Volume must be positive'),
    minVolume: zod_1.z.number().int().positive('Minimum volume must be positive'),
    duration: zod_1.z.number().int().positive('Duration must be positive'),
    issued: zod_1.z.date(),
    isBuyOrder: zod_1.z.boolean(),
});
exports.marketDataRequestSchema = zod_1.z.object({
    regionId: exports.eveRegionIdSchema,
    typeId: exports.eveTypeIdSchema,
});
exports.historicalDataRequestSchema = zod_1.z.object({
    regionId: exports.eveRegionIdSchema,
    typeId: exports.eveTypeIdSchema,
    days: zod_1.z.number().int().min(1, 'Days must be at least 1').max(365, 'Days cannot exceed 365'),
});
exports.watchlistItemSchema = zod_1.z
    .object({
    typeId: exports.eveTypeIdSchema,
    regionId: exports.eveRegionIdSchema,
    targetBuyPrice: exports.positiveNumberSchema.optional(),
    targetSellPrice: exports.positiveNumberSchema.optional(),
})
    .refine(data => {
    if (data.targetBuyPrice && data.targetSellPrice) {
        return data.targetSellPrice > data.targetBuyPrice;
    }
    return true;
}, {
    message: 'Target sell price must be higher than target buy price',
    path: ['targetSellPrice'],
});
exports.alertRuleSchema = zod_1.z.object({
    typeId: exports.eveTypeIdSchema,
    regionId: exports.eveRegionIdSchema,
    condition: zod_1.z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_ABOVE', 'VOLUME_BELOW']),
    threshold: exports.positiveNumberSchema,
    isActive: zod_1.z.boolean(),
});
exports.tradingPlanParamsSchema = zod_1.z
    .object({
    budget: exports.iskAmountSchema.min(1000, 'Minimum budget is 1,000 ISK'),
    riskTolerance: zod_1.z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    preferredRegions: zod_1.z
        .array(exports.eveRegionIdSchema)
        .max(10, 'Maximum 10 preferred regions allowed')
        .optional(),
    excludedItems: zod_1.z
        .array(exports.eveTypeIdSchema)
        .max(100, 'Maximum 100 excluded items allowed')
        .optional(),
    maxInvestmentPerTrade: exports.iskAmountSchema.optional(),
})
    .refine(data => {
    if (data.maxInvestmentPerTrade) {
        return data.maxInvestmentPerTrade <= data.budget;
    }
    return true;
}, {
    message: 'Maximum investment per trade cannot exceed total budget',
    path: ['maxInvestmentPerTrade'],
});
exports.tradingSuggestionSchema = zod_1.z
    .object({
    itemId: exports.eveTypeIdSchema,
    itemName: zod_1.z.string().min(1, 'Item name is required'),
    buyPrice: exports.positiveNumberSchema,
    sellPrice: exports.positiveNumberSchema,
    expectedProfit: zod_1.z.number(),
    profitMargin: zod_1.z.number().min(0, 'Profit margin must be non-negative'),
    riskLevel: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']),
    requiredInvestment: exports.positiveNumberSchema,
    timeToProfit: zod_1.z.number().int().positive('Time to profit must be positive'),
    confidence: zod_1.z
        .number()
        .min(0, 'Confidence must be at least 0')
        .max(1, 'Confidence cannot exceed 1'),
})
    .refine(data => data.sellPrice > data.buyPrice, {
    message: 'Sell price must be higher than buy price',
    path: ['sellPrice'],
});
exports.executedTradeSchema = zod_1.z.object({
    suggestionId: exports.uuidSchema,
    itemId: exports.eveTypeIdSchema,
    buyPrice: exports.positiveNumberSchema,
    sellPrice: exports.positiveNumberSchema.optional(),
    quantity: zod_1.z.number().int().positive('Quantity must be positive'),
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'CANCELLED']),
});
exports.analysisContextSchema = zod_1.z.object({
    userId: exports.uuidSchema,
    budget: exports.iskAmountSchema,
    riskTolerance: zod_1.z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    preferredRegions: zod_1.z.array(exports.eveRegionIdSchema),
    timeHorizon: zod_1.z.enum(['SHORT', 'MEDIUM', 'LONG']),
});
exports.userProfileSchema = zod_1.z.object({
    userId: exports.uuidSchema,
    tradingExperience: zod_1.z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
    riskTolerance: zod_1.z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
    availableBudget: exports.iskAmountSchema,
    preferredMarkets: zod_1.z.array(exports.eveRegionIdSchema),
    tradingGoals: zod_1.z.array(zod_1.z.string()).max(10, 'Maximum 10 trading goals allowed'),
});
exports.notificationSchema = zod_1.z.object({
    type: zod_1.z.enum(['MARKET_ALERT', 'TRADING_OPPORTUNITY', 'SYSTEM_UPDATE', 'ACCOUNT_NOTICE']),
    title: zod_1.z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
    message: zod_1.z
        .string()
        .min(1, 'Message is required')
        .max(1000, 'Message must be at most 1000 characters'),
    priority: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    channels: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.enum(['EMAIL', 'IN_APP', 'PUSH']),
        address: zod_1.z.string().optional(),
    }))
        .min(1, 'At least one notification channel is required'),
});
function validateData(schema, data, requestId) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const fieldErrors = result.error.errors.map(error => ({
            field: error.path.join('.'),
            message: error.message,
            code: error.code,
            value: error.path.reduce((obj, key) => obj?.[key], data),
        }));
        throw (0, errors_1.createValidationError)(fieldErrors, requestId);
    }
    return result.data;
}
function validateDataSafe(schema, data) {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors = result.error.errors.map(error => ({
        field: error.path.join('.'),
        message: error.message,
        code: error.code,
        value: error.path.reduce((obj, key) => obj?.[key], data),
    }));
    return { success: false, errors };
}
function validateEveApiKey(apiKey) {
    return exports.eveApiKeySchema.safeParse(apiKey).success;
}
function validateEmail(email) {
    return exports.emailSchema.safeParse(email).success;
}
function validatePassword(password) {
    return exports.passwordSchema.safeParse(password).success;
}
function validateIskAmount(amount) {
    return exports.iskAmountSchema.safeParse(amount).success;
}
function validateEveCharacterId(characterId) {
    return exports.eveCharacterIdSchema.safeParse(characterId).success;
}
function validateEveRegionId(regionId) {
    return exports.eveRegionIdSchema.safeParse(regionId).success;
}
function validateEveTypeId(typeId) {
    return exports.eveTypeIdSchema.safeParse(typeId).success;
}
function createUpdateSchema(schema) {
    return schema.partial();
}
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().min(1, 'Page must be at least 1').default(1),
    limit: zod_1.z
        .number()
        .int()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit cannot exceed 100')
        .default(20),
    sortBy: zod_1.z.string().optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
function validatePagination(params) {
    return validateData(exports.paginationSchema, params);
}
//# sourceMappingURL=validation.js.map