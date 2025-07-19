import { TradingPlanRepository } from '../../models/tradingPlanRepository';
import { TradingPlanParams, TradingSuggestion, ExecutedTrade } from '@shared/types';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    end: jest.fn(),
  })),
}));

describe('TradingPlanRepository', () => {
  let repository: TradingPlanRepository;
  let mockClient: any;

  beforeEach(() => {
    repository = new TradingPlanRepository();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    // Mock pool.connect to return our mock client
    (repository as any).pool.connect = jest.fn().mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTradingPlan', () => {
    it('should create a trading plan with suggestions', async () => {
      const userId = 'user-123';
      const params: TradingPlanParams & { name: string } = {
        name: 'Test Plan',
        budget: 1000000,
        riskTolerance: 'MODERATE',
        preferredRegions: [10000002],
        maxInvestmentPerTrade: 250000,
      };

      const suggestions: TradingSuggestion[] = [
        {
          itemId: 34,
          itemName: 'Tritanium',
          buyPrice: 5.0,
          sellPrice: 6.0,
          expectedProfit: 1000,
          profitMargin: 0.2,
          riskLevel: 'LOW',
          requiredInvestment: 5000,
          timeToProfit: 24,
          confidence: 0.85,
        },
      ];

      const mockPlanRecord = {
        id: 'plan-123',
        user_id: userId,
        name: params.name,
        budget: params.budget,
        allocated_budget: 0,
        available_budget: params.budget,
        risk_tolerance: params.riskTolerance,
        preferred_regions: params.preferredRegions,
        excluded_items: [],
        max_investment_per_trade: params.maxInvestmentPerTrade,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
        total_trades: 0,
        successful_trades: 0,
        total_profit: 0,
        total_investment: 0,
      };

      const mockSuggestionRecord = {
        id: 'suggestion-123',
        plan_id: 'plan-123',
        item_id: suggestions[0]!.itemId,
        item_name: suggestions[0]!.itemName,
        buy_price: suggestions[0]!.buyPrice,
        sell_price: suggestions[0]!.sellPrice,
        expected_profit: suggestions[0]!.expectedProfit,
        profit_margin: suggestions[0]!.profitMargin,
        risk_level: suggestions[0]!.riskLevel,
        required_investment: suggestions[0]!.requiredInvestment,
        time_to_profit: suggestions[0]!.timeToProfit,
        confidence: suggestions[0]!.confidence,
        buy_region_id: 10000002,
        sell_region_id: 10000002,
        quantity: 1,
        status: 'PENDING',
        created_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockPlanRecord] }) // Plan creation
        .mockResolvedValueOnce({ rows: [mockSuggestionRecord] }) // Suggestion creation
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await repository.createTradingPlan(userId, params, suggestions);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result.id).toBe('plan-123');
      expect(result.userId).toBe(userId);
      expect(result.budget).toBe(params.budget);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!.itemId).toBe(suggestions[0]!.itemId);
    });

    it('should rollback on error', async () => {
      const userId = 'user-123';
      const params: TradingPlanParams & { name: string } = {
        name: 'Test Plan',
        budget: 1000000,
        riskTolerance: 'MODERATE',
      };
      const suggestions: TradingSuggestion[] = [];

      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.createTradingPlan(userId, params, suggestions)).rejects.toThrow(
        'Database error'
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getTradingPlanById', () => {
    it('should return trading plan with suggestions', async () => {
      const planId = 'plan-123';
      const mockPlanRecord = {
        id: planId,
        user_id: 'user-123',
        name: 'Test Plan',
        budget: 1000000,
        allocated_budget: 0,
        available_budget: 1000000,
        risk_tolerance: 'MODERATE',
        preferred_regions: [10000002],
        excluded_items: [],
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
        total_trades: 0,
        successful_trades: 0,
        total_profit: 0,
        total_investment: 0,
      };

      const mockSuggestionRecord = {
        id: 'suggestion-123',
        plan_id: planId,
        item_id: 34,
        item_name: 'Tritanium',
        buy_price: 5.0,
        sell_price: 6.0,
        expected_profit: 1000,
        profit_margin: 0.2,
        risk_level: 'LOW',
        required_investment: 5000,
        time_to_profit: 24,
        confidence: 0.85,
        buy_region_id: 10000002,
        sell_region_id: 10000002,
        quantity: 1,
        status: 'PENDING',
        created_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockPlanRecord] })
        .mockResolvedValueOnce({ rows: [mockSuggestionRecord] });

      const result = await repository.getTradingPlanById(planId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(planId);
      expect(result!.suggestions).toHaveLength(1);
      expect(result!.suggestions[0]!.itemId).toBe(34);
    });

    it('should return null if plan not found', async () => {
      const planId = 'nonexistent-plan';
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getTradingPlanById(planId);

      expect(result).toBeNull();
    });
  });

  describe('allocateBudget', () => {
    it('should allocate budget successfully', async () => {
      const planId = 'plan-123';
      const suggestionId = 'suggestion-123';
      const amount = 5000;

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ available_budget: 10000 }] }) // Budget check
        .mockResolvedValueOnce({ rows: [] }) // Budget allocation insert
        .mockResolvedValueOnce({ rows: [] }) // Update allocated budget
        .mockResolvedValueOnce({ rows: [] }) // Update suggestion status
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await repository.allocateBudget(planId, suggestionId, amount);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if insufficient budget', async () => {
      const planId = 'plan-123';
      const suggestionId = 'suggestion-123';
      const amount = 15000;

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ available_budget: 10000 }] }); // Budget check

      await expect(repository.allocateBudget(planId, suggestionId, amount)).rejects.toThrow(
        'Insufficient budget available'
      );
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('recordTradeExecution', () => {
    it('should record trade execution successfully', async () => {
      const trade: ExecutedTrade = {
        id: 'trade-123',
        userId: 'user-123',
        suggestionId: 'suggestion-123',
        itemId: 34,
        buyPrice: 5.0,
        sellPrice: 6.0,
        quantity: 1000,
        executedAt: new Date(),
        actualProfit: 1000,
        status: 'COMPLETED',
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'trade-123' }] }) // Insert trade
        .mockResolvedValueOnce({ rows: [{ plan_id: 'plan-123', required_investment: 5000 }] }) // Get suggestion
        .mockResolvedValueOnce({ rows: [] }) // Update trade with plan_id
        .mockResolvedValueOnce({ rows: [] }) // Update suggestion status
        .mockResolvedValueOnce({ rows: [] }) // Update budget allocation
        .mockResolvedValueOnce({ rows: [] }) // Update plan statistics
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await repository.recordTradeExecution(trade);

      expect(result).toBe('trade-123');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getTradingPlanMetrics', () => {
    it('should return trading plan metrics', async () => {
      const planId = 'plan-123';
      const mockMetrics = {
        total_trades: 5,
        successful_trades: 4,
        total_profit: 5000,
        total_investment: 20000,
      };

      mockClient.query.mockResolvedValueOnce({ rows: [mockMetrics] });

      const result = await repository.getTradingPlanMetrics(planId);

      expect(result.totalTrades).toBe(5);
      expect(result.successfulTrades).toBe(4);
      expect(result.totalProfit).toBe(5000);
      expect(result.totalInvestment).toBe(20000);
      expect(result.successRate).toBe(0.8);
      expect(result.roi).toBe(0.25);
    });

    it('should throw error if plan not found', async () => {
      const planId = 'nonexistent-plan';
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(repository.getTradingPlanMetrics(planId)).rejects.toThrow(
        'Trading plan not found'
      );
    });
  });
});
