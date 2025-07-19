import { z } from 'zod';
export declare const emailSchema: z.ZodString;
export declare const passwordSchema: z.ZodString;
export declare const uuidSchema: z.ZodString;
export declare const positiveNumberSchema: z.ZodNumber;
export declare const nonNegativeNumberSchema: z.ZodNumber;
export declare const eveCharacterIdSchema: z.ZodNumber;
export declare const eveRegionIdSchema: z.ZodNumber;
export declare const eveTypeIdSchema: z.ZodNumber;
export declare const iskAmountSchema: z.ZodNumber;
export declare const userCredentialsSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export declare const userRegistrationSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    confirmPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
    username: string;
    confirmPassword: string;
}, {
    password: string;
    email: string;
    username: string;
    confirmPassword: string;
}>, {
    password: string;
    email: string;
    username: string;
    confirmPassword: string;
}, {
    password: string;
    email: string;
    username: string;
    confirmPassword: string;
}>;
export declare const userPreferencesSchema: z.ZodObject<{
    theme: z.ZodEnum<["light", "dark"]>;
    notifications: z.ZodObject<{
        email: z.ZodBoolean;
        inApp: z.ZodBoolean;
        push: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        push: boolean;
        email: boolean;
        inApp: boolean;
    }, {
        push: boolean;
        email: boolean;
        inApp: boolean;
    }>;
    trading: z.ZodObject<{
        riskTolerance: z.ZodEnum<["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]>;
        defaultBudget: z.ZodNumber;
        preferredRegions: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
        defaultBudget: number;
        preferredRegions: number[];
    }, {
        riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
        defaultBudget: number;
        preferredRegions: number[];
    }>;
}, "strip", z.ZodTypeAny, {
    theme: "light" | "dark";
    notifications: {
        push: boolean;
        email: boolean;
        inApp: boolean;
    };
    trading: {
        riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
        defaultBudget: number;
        preferredRegions: number[];
    };
}, {
    theme: "light" | "dark";
    notifications: {
        push: boolean;
        email: boolean;
        inApp: boolean;
    };
    trading: {
        riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
        defaultBudget: number;
        preferredRegions: number[];
    };
}>;
export declare const eveApiKeySchema: z.ZodString;
export declare const eveCharacterSchema: z.ZodObject<{
    characterId: z.ZodNumber;
    characterName: z.ZodString;
    corporationId: z.ZodNumber;
    allianceId: z.ZodOptional<z.ZodNumber>;
    apiKey: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    characterId: number;
    characterName: string;
    corporationId: number;
    scopes: string[];
    allianceId?: number | undefined;
}, {
    apiKey: string;
    characterId: number;
    characterName: string;
    corporationId: number;
    scopes: string[];
    allianceId?: number | undefined;
}>;
export declare const marketOrderSchema: z.ZodObject<{
    orderId: z.ZodNumber;
    typeId: z.ZodNumber;
    regionId: z.ZodNumber;
    locationId: z.ZodNumber;
    price: z.ZodNumber;
    volume: z.ZodNumber;
    minVolume: z.ZodNumber;
    duration: z.ZodNumber;
    issued: z.ZodDate;
    isBuyOrder: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    typeId: number;
    regionId: number;
    orderId: number;
    locationId: number;
    price: number;
    volume: number;
    minVolume: number;
    duration: number;
    issued: Date;
    isBuyOrder: boolean;
}, {
    typeId: number;
    regionId: number;
    orderId: number;
    locationId: number;
    price: number;
    volume: number;
    minVolume: number;
    duration: number;
    issued: Date;
    isBuyOrder: boolean;
}>;
export declare const marketDataRequestSchema: z.ZodObject<{
    regionId: z.ZodNumber;
    typeId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    typeId: number;
    regionId: number;
}, {
    typeId: number;
    regionId: number;
}>;
export declare const historicalDataRequestSchema: z.ZodObject<{
    regionId: z.ZodNumber;
    typeId: z.ZodNumber;
    days: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    typeId: number;
    regionId: number;
    days: number;
}, {
    typeId: number;
    regionId: number;
    days: number;
}>;
export declare const watchlistItemSchema: z.ZodEffects<z.ZodObject<{
    typeId: z.ZodNumber;
    regionId: z.ZodNumber;
    targetBuyPrice: z.ZodOptional<z.ZodNumber>;
    targetSellPrice: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    typeId: number;
    regionId: number;
    targetBuyPrice?: number | undefined;
    targetSellPrice?: number | undefined;
}, {
    typeId: number;
    regionId: number;
    targetBuyPrice?: number | undefined;
    targetSellPrice?: number | undefined;
}>, {
    typeId: number;
    regionId: number;
    targetBuyPrice?: number | undefined;
    targetSellPrice?: number | undefined;
}, {
    typeId: number;
    regionId: number;
    targetBuyPrice?: number | undefined;
    targetSellPrice?: number | undefined;
}>;
export declare const alertRuleSchema: z.ZodObject<{
    typeId: z.ZodNumber;
    regionId: z.ZodNumber;
    condition: z.ZodEnum<["PRICE_ABOVE", "PRICE_BELOW", "VOLUME_ABOVE", "VOLUME_BELOW"]>;
    threshold: z.ZodNumber;
    isActive: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    typeId: number;
    regionId: number;
    condition: "PRICE_ABOVE" | "PRICE_BELOW" | "VOLUME_ABOVE" | "VOLUME_BELOW";
    threshold: number;
    isActive: boolean;
}, {
    typeId: number;
    regionId: number;
    condition: "PRICE_ABOVE" | "PRICE_BELOW" | "VOLUME_ABOVE" | "VOLUME_BELOW";
    threshold: number;
    isActive: boolean;
}>;
export declare const tradingPlanParamsSchema: z.ZodEffects<z.ZodObject<{
    budget: z.ZodNumber;
    riskTolerance: z.ZodEnum<["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]>;
    preferredRegions: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    excludedItems: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    maxInvestmentPerTrade: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions?: number[] | undefined;
    excludedItems?: number[] | undefined;
    maxInvestmentPerTrade?: number | undefined;
}, {
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions?: number[] | undefined;
    excludedItems?: number[] | undefined;
    maxInvestmentPerTrade?: number | undefined;
}>, {
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions?: number[] | undefined;
    excludedItems?: number[] | undefined;
    maxInvestmentPerTrade?: number | undefined;
}, {
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions?: number[] | undefined;
    excludedItems?: number[] | undefined;
    maxInvestmentPerTrade?: number | undefined;
}>;
export declare const tradingSuggestionSchema: z.ZodEffects<z.ZodObject<{
    itemId: z.ZodNumber;
    itemName: z.ZodString;
    buyPrice: z.ZodNumber;
    sellPrice: z.ZodNumber;
    expectedProfit: z.ZodNumber;
    profitMargin: z.ZodNumber;
    riskLevel: z.ZodEnum<["LOW", "MEDIUM", "HIGH"]>;
    requiredInvestment: z.ZodNumber;
    timeToProfit: z.ZodNumber;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    itemId: number;
    buyPrice: number;
    itemName: string;
    sellPrice: number;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    requiredInvestment: number;
    timeToProfit: number;
    confidence: number;
}, {
    itemId: number;
    buyPrice: number;
    itemName: string;
    sellPrice: number;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    requiredInvestment: number;
    timeToProfit: number;
    confidence: number;
}>, {
    itemId: number;
    buyPrice: number;
    itemName: string;
    sellPrice: number;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    requiredInvestment: number;
    timeToProfit: number;
    confidence: number;
}, {
    itemId: number;
    buyPrice: number;
    itemName: string;
    sellPrice: number;
    expectedProfit: number;
    profitMargin: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    requiredInvestment: number;
    timeToProfit: number;
    confidence: number;
}>;
export declare const executedTradeSchema: z.ZodObject<{
    suggestionId: z.ZodString;
    itemId: z.ZodNumber;
    buyPrice: z.ZodNumber;
    sellPrice: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodNumber;
    status: z.ZodEnum<["PENDING", "COMPLETED", "CANCELLED"]>;
}, "strip", z.ZodTypeAny, {
    suggestionId: string;
    itemId: number;
    buyPrice: number;
    quantity: number;
    status: "COMPLETED" | "PENDING" | "CANCELLED";
    sellPrice?: number | undefined;
}, {
    suggestionId: string;
    itemId: number;
    buyPrice: number;
    quantity: number;
    status: "COMPLETED" | "PENDING" | "CANCELLED";
    sellPrice?: number | undefined;
}>;
export declare const analysisContextSchema: z.ZodObject<{
    userId: z.ZodString;
    budget: z.ZodNumber;
    riskTolerance: z.ZodEnum<["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]>;
    preferredRegions: z.ZodArray<z.ZodNumber, "many">;
    timeHorizon: z.ZodEnum<["SHORT", "MEDIUM", "LONG"]>;
}, "strip", z.ZodTypeAny, {
    userId: string;
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions: number[];
    timeHorizon: "MEDIUM" | "SHORT" | "LONG";
}, {
    userId: string;
    budget: number;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    preferredRegions: number[];
    timeHorizon: "MEDIUM" | "SHORT" | "LONG";
}>;
export declare const userProfileSchema: z.ZodObject<{
    userId: z.ZodString;
    tradingExperience: z.ZodEnum<["BEGINNER", "INTERMEDIATE", "ADVANCED"]>;
    riskTolerance: z.ZodEnum<["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]>;
    availableBudget: z.ZodNumber;
    preferredMarkets: z.ZodArray<z.ZodNumber, "many">;
    tradingGoals: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    userId: string;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    tradingExperience: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    availableBudget: number;
    preferredMarkets: number[];
    tradingGoals: string[];
}, {
    userId: string;
    riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
    tradingExperience: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    availableBudget: number;
    preferredMarkets: number[];
    tradingGoals: string[];
}>;
export declare const notificationSchema: z.ZodObject<{
    type: z.ZodEnum<["MARKET_ALERT", "TRADING_OPPORTUNITY", "SYSTEM_UPDATE", "ACCOUNT_NOTICE"]>;
    title: z.ZodString;
    message: z.ZodString;
    priority: z.ZodEnum<["LOW", "MEDIUM", "HIGH", "URGENT"]>;
    channels: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["EMAIL", "IN_APP", "PUSH"]>;
        address: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "EMAIL" | "IN_APP" | "PUSH";
        address?: string | undefined;
    }, {
        type: "EMAIL" | "IN_APP" | "PUSH";
        address?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "MARKET_ALERT" | "TRADING_OPPORTUNITY" | "SYSTEM_UPDATE" | "ACCOUNT_NOTICE";
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    channels: {
        type: "EMAIL" | "IN_APP" | "PUSH";
        address?: string | undefined;
    }[];
}, {
    message: string;
    type: "MARKET_ALERT" | "TRADING_OPPORTUNITY" | "SYSTEM_UPDATE" | "ACCOUNT_NOTICE";
    title: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    channels: {
        type: "EMAIL" | "IN_APP" | "PUSH";
        address?: string | undefined;
    }[];
}>;
export declare function validateData<T>(schema: z.ZodSchema<T>, data: unknown, requestId?: string): T;
export declare function validateDataSafe<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean;
    data?: T;
    errors?: Array<{
        field: string;
        message: string;
        code: string;
        value?: any;
    }>;
};
export declare function validateEveApiKey(apiKey: string): boolean;
export declare function validateEmail(email: string): boolean;
export declare function validatePassword(password: string): boolean;
export declare function validateIskAmount(amount: number): boolean;
export declare function validateEveCharacterId(characterId: number): boolean;
export declare function validateEveRegionId(regionId: number): boolean;
export declare function validateEveTypeId(typeId: number): boolean;
export declare function createUpdateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodObject<{ [k in keyof T]: z.ZodOptional<T[k]>; }, z.UnknownKeysParam, z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }>, any> extends infer T_1 ? { [k_1 in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }>, any>[k_1]; } : never, z.baseObjectInputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }> extends infer T_2 ? { [k_2 in keyof T_2]: z.baseObjectInputType<{ [k in keyof T]: z.ZodOptional<T[k]>; }>[k_2]; } : never>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export declare function validatePagination(params: unknown): {
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
};
//# sourceMappingURL=validation.d.ts.map