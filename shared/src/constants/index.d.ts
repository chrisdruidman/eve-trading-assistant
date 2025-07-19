export declare const API_ENDPOINTS: {
    readonly ESI_BASE: "https://esi.evetech.net";
    readonly AUTH_SERVICE: "http://localhost:3001";
    readonly MARKET_SERVICE: "http://localhost:3002";
    readonly TRADING_SERVICE: "http://localhost:3003";
    readonly AI_SERVICE: "http://localhost:3004";
    readonly NOTIFICATION_SERVICE: "http://localhost:3005";
    readonly USER_SERVICE: "http://localhost:3006";
};
export declare const ESI_ENDPOINTS: {
    readonly MARKET_ORDERS: "/v1/markets/{region_id}/orders/";
    readonly MARKET_HISTORY: "/v1/markets/{region_id}/history/";
    readonly MARKET_TYPES: "/v1/markets/types/";
    readonly CHARACTER_INFO: "/v5/characters/{character_id}/";
    readonly CORPORATION_INFO: "/v5/corporations/{corporation_id}/";
    readonly ALLIANCE_INFO: "/v4/alliances/{alliance_id}/";
    readonly TOKEN_VERIFY: "/v2/oauth/verify/";
};
export declare const CACHE_TTL: {
    readonly MARKET_DATA: number;
    readonly MARKET_HISTORY: number;
    readonly AI_RESPONSES: number;
    readonly USER_SESSION: number;
    readonly CHARACTER_INFO: number;
    readonly CORPORATION_INFO: number;
    readonly TYPE_INFO: number;
};
export declare const CACHE_KEYS: {
    readonly MARKET_DATA: "market:data";
    readonly MARKET_HISTORY: "market:history";
    readonly AI_RESPONSE: "ai:response";
    readonly USER_SESSION: "user:session";
    readonly CHARACTER_INFO: "character:info";
    readonly TRADING_SUGGESTIONS: "trading:suggestions";
    readonly WATCHLIST_ALERTS: "watchlist:alerts";
};
export declare const EVE_REGIONS: {
    readonly THE_FORGE: 10000002;
    readonly DOMAIN: 10000043;
    readonly SINQ_LAISON: 10000032;
    readonly HEIMATAR: 10000030;
    readonly METROPOLIS: 10000042;
    readonly DELVE: 10000060;
    readonly PROVIDENCE: 10000047;
    readonly CATCH: 10000014;
    readonly CURSE: 10000012;
    readonly GREAT_WILDLANDS: 10000011;
};
export declare const EVE_STATIONS: {
    readonly JITA_4_4: 60003760;
    readonly AMARR_VIII: 60008494;
    readonly DODIXIE_IX: 60011866;
    readonly HEK_VIII: 60005686;
    readonly RENS_VI: 60004588;
};
export declare const EVE_SCOPES: {
    readonly READ_CHARACTER_ASSETS: "esi-assets.read_assets.v1";
    readonly READ_CHARACTER_WALLET: "esi-wallet.read_character_wallet.v1";
    readonly READ_CHARACTER_ORDERS: "esi-markets.read_character_orders.v1";
    readonly READ_CORPORATION_ASSETS: "esi-assets.read_corporation_assets.v1";
    readonly READ_CORPORATION_WALLET: "esi-wallet.read_corporation_wallets.v1";
};
export declare const RISK_LEVELS: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
};
export declare const RISK_TOLERANCE: {
    readonly CONSERVATIVE: "CONSERVATIVE";
    readonly MODERATE: "MODERATE";
    readonly AGGRESSIVE: "AGGRESSIVE";
};
export declare const TRADING_PLAN_STATUS: {
    readonly ACTIVE: "ACTIVE";
    readonly PAUSED: "PAUSED";
    readonly COMPLETED: "COMPLETED";
};
export declare const TRADE_STATUS: {
    readonly PENDING: "PENDING";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export declare const TIME_HORIZONS: {
    readonly SHORT: "SHORT";
    readonly MEDIUM: "MEDIUM";
    readonly LONG: "LONG";
};
export declare const TRADING_EXPERIENCE: {
    readonly BEGINNER: "BEGINNER";
    readonly INTERMEDIATE: "INTERMEDIATE";
    readonly ADVANCED: "ADVANCED";
};
export declare const MARKET_TRENDS: {
    readonly UPWARD: "UPWARD";
    readonly DOWNWARD: "DOWNWARD";
    readonly STABLE: "STABLE";
};
export declare const MARKET_CONDITIONS: {
    readonly BULL: "BULL";
    readonly BEAR: "BEAR";
    readonly SIDEWAYS: "SIDEWAYS";
};
export declare const ALERT_CONDITIONS: {
    readonly PRICE_ABOVE: "PRICE_ABOVE";
    readonly PRICE_BELOW: "PRICE_BELOW";
    readonly VOLUME_ABOVE: "VOLUME_ABOVE";
    readonly VOLUME_BELOW: "VOLUME_BELOW";
};
export declare const AI_PROVIDERS: {
    readonly ANTHROPIC: "anthropic";
    readonly OPENAI: "openai";
    readonly FALLBACK: "fallback";
};
export declare const AI_MODELS: {
    readonly CLAUDE_3_SONNET: "claude-3-sonnet-20240229";
    readonly CLAUDE_3_HAIKU: "claude-3-haiku-20240307";
    readonly GPT_4_TURBO: "gpt-4-turbo-preview";
    readonly GPT_3_5_TURBO: "gpt-3.5-turbo";
};
export declare const NOTIFICATION_TYPES: {
    readonly MARKET_ALERT: "MARKET_ALERT";
    readonly TRADING_OPPORTUNITY: "TRADING_OPPORTUNITY";
    readonly SYSTEM_UPDATE: "SYSTEM_UPDATE";
    readonly ACCOUNT_NOTICE: "ACCOUNT_NOTICE";
};
export declare const NOTIFICATION_PRIORITIES: {
    readonly LOW: "LOW";
    readonly MEDIUM: "MEDIUM";
    readonly HIGH: "HIGH";
    readonly URGENT: "URGENT";
};
export declare const NOTIFICATION_CHANNELS: {
    readonly EMAIL: "EMAIL";
    readonly IN_APP: "IN_APP";
    readonly PUSH: "PUSH";
};
export declare const ERROR_CODES: {
    readonly AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED";
    readonly AUTHORIZATION_FAILED: "AUTHORIZATION_FAILED";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly INVALID_API_KEY: "INVALID_API_KEY";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND";
    readonly RESOURCE_CONFLICT: "RESOURCE_CONFLICT";
    readonly ESI_API_ERROR: "ESI_API_ERROR";
    readonly AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly UNKNOWN_ERROR: "UNKNOWN_ERROR";
};
export declare const HTTP_STATUS_CODES: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly BAD_GATEWAY: 502;
    readonly SERVICE_UNAVAILABLE: 503;
};
export declare const RATE_LIMITS: {
    readonly ESI_REQUESTS_PER_SECOND: 150;
    readonly ESI_ERROR_LIMIT_REMAIN: 100;
    readonly AI_REQUESTS_PER_MINUTE: 60;
    readonly API_REQUESTS_PER_MINUTE: 1000;
    readonly USER_REQUESTS_PER_MINUTE: 100;
};
export declare const BACKOFF_CONFIG: {
    readonly BASE_DELAY: 1000;
    readonly MAX_DELAY: 16000;
    readonly MULTIPLIER: 2;
    readonly MAX_ATTEMPTS: 5;
};
export declare const SUBSCRIPTION_TIERS: {
    readonly FREE: "FREE";
    readonly PREMIUM: "PREMIUM";
};
export declare const SUBSCRIPTION_LIMITS: {
    readonly FREE: {
        readonly WATCHLIST_ITEMS: 10;
        readonly TRADING_SUGGESTIONS_PER_DAY: 50;
        readonly AI_REQUESTS_PER_DAY: 100;
        readonly ALERTS: 5;
    };
    readonly PREMIUM: {
        readonly WATCHLIST_ITEMS: 100;
        readonly TRADING_SUGGESTIONS_PER_DAY: 500;
        readonly AI_REQUESTS_PER_DAY: 1000;
        readonly ALERTS: 50;
    };
};
export declare const APP_CONFIG: {
    readonly NAME: "EVE Trading Assistant";
    readonly VERSION: "1.0.0";
    readonly DESCRIPTION: "AI-powered trading assistant for EVE Online";
    readonly AUTHOR: "EVE Trading Assistant Team";
    readonly HOMEPAGE: "https://eve-trading-assistant.com";
    readonly SUPPORT_EMAIL: "support@eve-trading-assistant.com";
};
export declare const PAGINATION_DEFAULTS: {
    readonly PAGE: 1;
    readonly LIMIT: 20;
    readonly MAX_LIMIT: 100;
    readonly SORT_ORDER: "asc";
};
export declare const VALIDATION_LIMITS: {
    readonly USERNAME_MIN_LENGTH: 3;
    readonly USERNAME_MAX_LENGTH: 50;
    readonly PASSWORD_MIN_LENGTH: 8;
    readonly EMAIL_MAX_LENGTH: 255;
    readonly TRADING_GOALS_MAX: 10;
    readonly PREFERRED_REGIONS_MAX: 10;
    readonly EXCLUDED_ITEMS_MAX: 100;
    readonly NOTIFICATION_TITLE_MAX: 100;
    readonly NOTIFICATION_MESSAGE_MAX: 1000;
    readonly MINIMUM_BUDGET_ISK: 1000;
};
export declare const FEATURE_FLAGS: {
    readonly ENABLE_AI_ANALYSIS: true;
    readonly ENABLE_PUSH_NOTIFICATIONS: true;
    readonly ENABLE_ADVANCED_CHARTS: true;
    readonly ENABLE_PORTFOLIO_TRACKING: false;
    readonly ENABLE_SOCIAL_FEATURES: false;
    readonly ENABLE_MOBILE_APP: false;
};
export declare const ENVIRONMENTS: {
    readonly DEVELOPMENT: "development";
    readonly STAGING: "staging";
    readonly PRODUCTION: "production";
    readonly TEST: "test";
};
export declare const LOG_LEVELS: {
    readonly TRACE: "trace";
    readonly DEBUG: "debug";
    readonly INFO: "info";
    readonly WARN: "warn";
    readonly ERROR: "error";
    readonly FATAL: "fatal";
};
//# sourceMappingURL=index.d.ts.map