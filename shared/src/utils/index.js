"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = exports.hashString = exports.createCacheKey = exports.isNonNegativeNumber = exports.isPositiveNumber = exports.isValidNumber = exports.validateUrl = exports.validateEmail = exports.validateApiKey = exports.kebabCase = exports.camelCase = exports.capitalize = exports.truncate = exports.slugify = exports.standardDeviation = exports.median = exports.average = exports.unique = exports.sortBy = exports.groupBy = exports.chunk = exports.calculateConfidenceScore = exports.getRiskLevel = exports.calculateRiskScore = exports.calculateNetProfit = exports.calculateBrokerFees = exports.calculateTaxes = exports.calculateBreakEvenPrice = exports.calculateROI = exports.calculateProfit = exports.calculateProfitMargin = exports.addHours = exports.addDays = exports.isDateExpired = exports.formatRelativeTime = exports.formatDate = exports.sleep = exports.formatDuration = exports.formatPercentage = exports.formatNumber = exports.formatISK = exports.formatCurrency = void 0;
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(amount);
};
exports.formatCurrency = formatCurrency;
const formatISK = (amount) => {
    if (amount >= 1e12) {
        return `${(amount / 1e12).toFixed(2)}T ISK`;
    }
    else if (amount >= 1e9) {
        return `${(amount / 1e9).toFixed(2)}B ISK`;
    }
    else if (amount >= 1e6) {
        return `${(amount / 1e6).toFixed(2)}M ISK`;
    }
    else if (amount >= 1e3) {
        return `${(amount / 1e3).toFixed(2)}K ISK`;
    }
    return `${amount.toFixed(2)} ISK`;
};
exports.formatISK = formatISK;
const formatNumber = (num, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
};
exports.formatNumber = formatNumber;
const formatPercentage = (value, decimals = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
};
exports.formatPercentage = formatPercentage;
const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0)
        return `${days}d ${hours % 24}h`;
    if (hours > 0)
        return `${hours}h ${minutes % 60}m`;
    if (minutes > 0)
        return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
};
exports.formatDuration = formatDuration;
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};
exports.formatDate = formatDate;
const formatRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMinutes < 1)
        return 'just now';
    if (diffMinutes < 60)
        return `${diffMinutes}m ago`;
    if (diffHours < 24)
        return `${diffHours}h ago`;
    if (diffDays < 7)
        return `${diffDays}d ago`;
    return (0, exports.formatDate)(date);
};
exports.formatRelativeTime = formatRelativeTime;
const isDateExpired = (date) => {
    return date.getTime() < Date.now();
};
exports.isDateExpired = isDateExpired;
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
exports.addDays = addDays;
const addHours = (date, hours) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
};
exports.addHours = addHours;
const calculateProfitMargin = (buyPrice, sellPrice) => {
    if (buyPrice <= 0)
        return 0;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
};
exports.calculateProfitMargin = calculateProfitMargin;
const calculateProfit = (buyPrice, sellPrice, quantity = 1) => {
    return (sellPrice - buyPrice) * quantity;
};
exports.calculateProfit = calculateProfit;
const calculateROI = (profit, investment) => {
    if (investment <= 0)
        return 0;
    return (profit / investment) * 100;
};
exports.calculateROI = calculateROI;
const calculateBreakEvenPrice = (buyPrice, fees = 0) => {
    return buyPrice + fees;
};
exports.calculateBreakEvenPrice = calculateBreakEvenPrice;
const calculateTaxes = (amount, taxRate = 0.05) => {
    return amount * taxRate;
};
exports.calculateTaxes = calculateTaxes;
const calculateBrokerFees = (amount, feeRate = 0.03) => {
    return amount * feeRate;
};
exports.calculateBrokerFees = calculateBrokerFees;
const calculateNetProfit = (buyPrice, sellPrice, quantity, taxRate = 0.05, brokerFeeRate = 0.03) => {
    const grossProfit = (0, exports.calculateProfit)(buyPrice, sellPrice, quantity);
    const sellValue = sellPrice * quantity;
    const taxes = (0, exports.calculateTaxes)(sellValue, taxRate);
    const brokerFees = (0, exports.calculateBrokerFees)(sellValue, brokerFeeRate);
    return grossProfit - taxes - brokerFees;
};
exports.calculateNetProfit = calculateNetProfit;
const calculateRiskScore = (volatility, liquidity, marketDepth) => {
    const normalizedVolatility = Math.min(volatility / 100, 1);
    const normalizedLiquidity = Math.max(0, 1 - liquidity / 1000000);
    const normalizedDepth = Math.max(0, 1 - marketDepth / 100);
    return (normalizedVolatility * 0.4 + normalizedLiquidity * 0.3 + normalizedDepth * 0.3) * 100;
};
exports.calculateRiskScore = calculateRiskScore;
const getRiskLevel = (riskScore) => {
    if (riskScore < 30)
        return 'LOW';
    if (riskScore < 70)
        return 'MEDIUM';
    return 'HIGH';
};
exports.getRiskLevel = getRiskLevel;
const calculateConfidenceScore = (dataAge, sampleSize, volatility) => {
    const ageScore = Math.max(0, 1 - dataAge / 60);
    const sampleScore = Math.min(1, sampleSize / 100);
    const volatilityScore = Math.max(0, 1 - volatility / 50);
    return (ageScore * 0.4 + sampleScore * 0.3 + volatilityScore * 0.3) * 100;
};
exports.calculateConfidenceScore = calculateConfidenceScore;
const chunk = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};
exports.chunk = chunk;
const groupBy = (array, key) => {
    return array.reduce((groups, item) => {
        const groupKey = key(item);
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
    }, {});
};
exports.groupBy = groupBy;
const sortBy = (array, key, order = 'asc') => {
    const getValue = typeof key === 'function' ? key : (item) => item[key];
    return [...array].sort((a, b) => {
        const aVal = getValue(a);
        const bVal = getValue(b);
        if (aVal < bVal)
            return order === 'asc' ? -1 : 1;
        if (aVal > bVal)
            return order === 'asc' ? 1 : -1;
        return 0;
    });
};
exports.sortBy = sortBy;
const unique = (array, key) => {
    if (!key) {
        return [...new Set(array)];
    }
    const getValue = typeof key === 'function' ? key : (item) => item[key];
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
exports.unique = unique;
const average = (numbers) => {
    if (numbers.length === 0)
        return 0;
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
};
exports.average = average;
const median = (numbers) => {
    if (numbers.length === 0)
        return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};
exports.median = median;
const standardDeviation = (numbers) => {
    if (numbers.length === 0)
        return 0;
    const avg = (0, exports.average)(numbers);
    const squaredDiffs = numbers.map(num => Math.pow(num - avg, 2));
    return Math.sqrt((0, exports.average)(squaredDiffs));
};
exports.standardDeviation = standardDeviation;
const slugify = (text) => {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
};
exports.slugify = slugify;
const truncate = (text, length, suffix = '...') => {
    if (text.length <= length)
        return text;
    return text.substring(0, length - suffix.length) + suffix;
};
exports.truncate = truncate;
const capitalize = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};
exports.capitalize = capitalize;
const camelCase = (text) => {
    return text
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())
        .replace(/\s+/g, '');
};
exports.camelCase = camelCase;
const kebabCase = (text) => {
    return text
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
};
exports.kebabCase = kebabCase;
const validateApiKey = (key) => {
    return /^[a-zA-Z0-9_-]+$/.test(key) && key.length > 10;
};
exports.validateApiKey = validateApiKey;
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validateUrl = (url) => {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
};
exports.validateUrl = validateUrl;
const isValidNumber = (value) => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
};
exports.isValidNumber = isValidNumber;
const isPositiveNumber = (value) => {
    return (0, exports.isValidNumber)(value) && value > 0;
};
exports.isPositiveNumber = isPositiveNumber;
const isNonNegativeNumber = (value) => {
    return (0, exports.isValidNumber)(value) && value >= 0;
};
exports.isNonNegativeNumber = isNonNegativeNumber;
const createCacheKey = (...parts) => {
    return parts.map(part => String(part)).join(':');
};
exports.createCacheKey = createCacheKey;
const hashString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
};
exports.hashString = hashString;
const retry = async (fn, maxAttempts = 3, baseDelay = 1000, backoffMultiplier = 2) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts) {
                throw lastError;
            }
            const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
            await (0, exports.sleep)(delay);
        }
    }
    throw lastError;
};
exports.retry = retry;
__exportStar(require("./encryption"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./validation"), exports);
__exportStar(require("./logging"), exports);
//# sourceMappingURL=index.js.map