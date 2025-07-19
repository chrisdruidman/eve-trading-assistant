import { Pool } from 'pg';
import { TradingPlan, TradingPlanParams, TradingSuggestion, ExecutedTrade } from '@shared/types';

interface TradingPlanRecord {
  id: string;
  user_id: string;
  name: string;
  budget: number;
  allocated_budget: number;
  available_budget: number;
  risk_tolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  preferred_regions: number[];
  excluded_items: number[];
  max_investment_per_trade?: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  total_trades: number;
  successful_trades: number;
  total_profit: number;
  total_investment: number;
}

interface TradingSuggestionRecord {
  id: string;
  plan_id: string;
  item_id: number;
  item_name: string;
  buy_price: number;
  sell_price: number;
  expected_profit: number;
  profit_margin: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  required_investment: number;
  time_to_profit: number;
  confidence: number;
  buy_region_id: number;
  sell_region_id: number;
  buy_location_id?: number;
  sell_location_id?: number;
  quantity: number;
  status: 'PENDING' | 'ALLOCATED' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  created_at: Date;
  allocated_at?: Date;
  executed_at?: Date;
}

export class TradingPlanRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Create a new trading plan
   */
  async createTradingPlan(
    userId: string,
    params: TradingPlanParams & { name: string },
    suggestions: TradingSuggestion[]
  ): Promise<TradingPlan> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert trading plan
      const planResult = await client.query(
        `
        INSERT INTO trading_plans (
          user_id, name, budget, risk_tolerance, preferred_regions, 
          excluded_items, max_investment_per_trade
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
        [
          userId,
          params.name,
          params.budget,
          params.riskTolerance,
          params.preferredRegions || [10000002],
          params.excludedItems || [],
          params.maxInvestmentPerTrade,
        ]
      );

      const planRecord = planResult.rows[0] as TradingPlanRecord;

      // Insert suggestions
      const suggestionPromises = suggestions.map(suggestion =>
        client.query(
          `
          INSERT INTO trading_suggestions (
            plan_id, item_id, item_name, buy_price, sell_price, expected_profit,
            profit_margin, risk_level, required_investment, time_to_profit,
            confidence, buy_region_id, sell_region_id, quantity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `,
          [
            planRecord.id,
            suggestion.itemId,
            suggestion.itemName,
            suggestion.buyPrice,
            suggestion.sellPrice,
            suggestion.expectedProfit,
            suggestion.profitMargin,
            suggestion.riskLevel,
            suggestion.requiredInvestment,
            suggestion.timeToProfit,
            suggestion.confidence,
            10000002, // Default to The Forge for now
            10000002,
            1, // Default quantity
          ]
        )
      );

      const suggestionResults = await Promise.all(suggestionPromises);
      const suggestionRecords = suggestionResults.map(
        result => result.rows[0] as TradingSuggestionRecord
      );

      await client.query('COMMIT');

      return this.mapRecordToTradingPlan(planRecord, suggestionRecords);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get trading plan by ID
   */
  async getTradingPlanById(planId: string): Promise<TradingPlan | null> {
    const client = await this.pool.connect();

    try {
      // Get plan
      const planResult = await client.query('SELECT * FROM trading_plans WHERE id = $1', [planId]);

      if (planResult.rows.length === 0) {
        return null;
      }

      const planRecord = planResult.rows[0] as TradingPlanRecord;

      // Get suggestions
      const suggestionsResult = await client.query(
        'SELECT * FROM trading_suggestions WHERE plan_id = $1 ORDER BY created_at',
        [planId]
      );

      const suggestionRecords = suggestionsResult.rows as TradingSuggestionRecord[];

      return this.mapRecordToTradingPlan(planRecord, suggestionRecords);
    } finally {
      client.release();
    }
  }

  /**
   * Get all trading plans for a user
   */
  async getTradingPlansByUserId(userId: string): Promise<TradingPlan[]> {
    const client = await this.pool.connect();

    try {
      const planResult = await client.query(
        `
        SELECT * FROM trading_plans 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `,
        [userId]
      );

      const planRecords = planResult.rows as TradingPlanRecord[];

      if (planRecords.length === 0) {
        return [];
      }

      // Get all suggestions for these plans
      const planIds = planRecords.map(plan => plan.id);
      const suggestionsResult = await client.query(
        `
        SELECT * FROM trading_suggestions 
        WHERE plan_id = ANY($1) 
        ORDER BY plan_id, created_at
      `,
        [planIds]
      );

      const suggestionRecords = suggestionsResult.rows as TradingSuggestionRecord[];

      // Group suggestions by plan ID
      const suggestionsByPlan = suggestionRecords.reduce(
        (acc, suggestion) => {
          if (!acc[suggestion.plan_id]) {
            acc[suggestion.plan_id] = [];
          }
          acc[suggestion.plan_id]!.push(suggestion);
          return acc;
        },
        {} as Record<string, TradingSuggestionRecord[]>
      );

      return planRecords.map(planRecord =>
        this.mapRecordToTradingPlan(planRecord, suggestionsByPlan[planRecord.id] || [])
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update trading plan status
   */
  async updateTradingPlanStatus(
    planId: string,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE trading_plans 
        SET status = $1, completed_at = CASE WHEN $1 IN ('COMPLETED', 'CANCELLED') THEN NOW() ELSE completed_at END
        WHERE id = $2
      `,
        [status, planId]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Update trading plan budget
   */
  async updateTradingPlanBudget(planId: string, newBudget: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        UPDATE trading_plans 
        SET budget = $1
        WHERE id = $2 AND allocated_budget <= $1
      `,
        [newBudget, planId]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Allocate budget for a suggestion
   */
  async allocateBudget(planId: string, suggestionId: string, amount: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if enough budget is available
      const budgetCheck = await client.query(
        `
        SELECT available_budget FROM trading_plans WHERE id = $1
      `,
        [planId]
      );

      if (budgetCheck.rows.length === 0) {
        throw new Error('Trading plan not found');
      }

      const availableBudget = parseFloat(budgetCheck.rows[0].available_budget);
      if (availableBudget < amount) {
        throw new Error('Insufficient budget available');
      }

      // Create budget allocation
      await client.query(
        `
        INSERT INTO budget_allocations (plan_id, suggestion_id, allocated_amount)
        VALUES ($1, $2, $3)
      `,
        [planId, suggestionId, amount]
      );

      // Update allocated budget
      await client.query(
        `
        UPDATE trading_plans 
        SET allocated_budget = allocated_budget + $1
        WHERE id = $2
      `,
        [amount, planId]
      );

      // Update suggestion status
      await client.query(
        `
        UPDATE trading_suggestions 
        SET status = 'ALLOCATED', allocated_at = NOW()
        WHERE id = $1
      `,
        [suggestionId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Release allocated budget
   */
  async releaseBudget(suggestionId: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get allocation details
      const allocationResult = await client.query(
        `
        SELECT plan_id, allocated_amount FROM budget_allocations 
        WHERE suggestion_id = $1 AND status = 'ACTIVE'
      `,
        [suggestionId]
      );

      if (allocationResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const { plan_id, allocated_amount } = allocationResult.rows[0];

      // Release allocation
      await client.query(
        `
        UPDATE budget_allocations 
        SET status = 'RELEASED', released_at = NOW()
        WHERE suggestion_id = $1
      `,
        [suggestionId]
      );

      // Update allocated budget
      await client.query(
        `
        UPDATE trading_plans 
        SET allocated_budget = allocated_budget - $1
        WHERE id = $2
      `,
        [allocated_amount, plan_id]
      );

      // Update suggestion status
      await client.query(
        `
        UPDATE trading_suggestions 
        SET status = 'CANCELLED'
        WHERE id = $1
      `,
        [suggestionId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record trade execution
   */
  async recordTradeExecution(trade: ExecutedTrade): Promise<string> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert executed trade
      const tradeResult = await client.query(
        `
        INSERT INTO executed_trades (
          user_id, plan_id, suggestion_id, item_id, item_name, buy_price, 
          sell_price, quantity, investment_amount, actual_profit, profit_margin, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
        [
          trade.userId,
          null, // Will be set if linked to a plan
          trade.suggestionId,
          trade.itemId,
          `Item_${trade.itemId}`, // TODO: Get actual item name
          trade.buyPrice,
          trade.sellPrice,
          trade.quantity,
          trade.buyPrice * trade.quantity,
          trade.actualProfit,
          trade.actualProfit ? trade.actualProfit / (trade.buyPrice * trade.quantity) : null,
          trade.status,
        ]
      );

      const tradeId = tradeResult.rows[0].id;

      // If this trade is linked to a suggestion, update the suggestion and plan
      if (trade.suggestionId) {
        // Get suggestion details
        const suggestionResult = await client.query(
          `
          SELECT plan_id, required_investment FROM trading_suggestions 
          WHERE id = $1
        `,
          [trade.suggestionId]
        );

        if (suggestionResult.rows.length > 0) {
          const { plan_id, required_investment } = suggestionResult.rows[0];

          // Update the trade record with plan_id
          await client.query(
            `
            UPDATE executed_trades SET plan_id = $1 WHERE id = $2
          `,
            [plan_id, tradeId]
          );

          // Update suggestion status
          await client.query(
            `
            UPDATE trading_suggestions 
            SET status = 'EXECUTED', executed_at = NOW()
            WHERE id = $1
          `,
            [trade.suggestionId]
          );

          // Update budget allocation status
          await client.query(
            `
            UPDATE budget_allocations 
            SET status = 'EXECUTED'
            WHERE suggestion_id = $1
          `,
            [trade.suggestionId]
          );

          // Update plan statistics
          await client.query(
            `
            UPDATE trading_plans 
            SET total_trades = total_trades + 1,
                total_investment = total_investment + $1
            WHERE id = $2
          `,
            [required_investment, plan_id]
          );
        }
      }

      await client.query('COMMIT');
      return tradeId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update trade completion
   */
  async updateTradeCompletion(
    tradeId: string,
    sellPrice: number,
    actualProfit: number
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update trade
      const result = await client.query(
        `
        UPDATE executed_trades 
        SET sell_price = $1, actual_profit = $2, 
            profit_margin = $2 / investment_amount,
            status = 'COMPLETED', completed_at = NOW()
        WHERE id = $3
        RETURNING plan_id
      `,
        [sellPrice, actualProfit, tradeId]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const planId = result.rows[0].plan_id;

      // Update plan statistics if linked to a plan
      if (planId) {
        await client.query(
          `
          UPDATE trading_plans 
          SET successful_trades = successful_trades + 1,
              total_profit = total_profit + $1
          WHERE id = $2
        `,
          [actualProfit, planId]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get trading plan performance metrics
   */
  async getTradingPlanMetrics(planId: string): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    totalInvestment: number;
    successRate: number;
    averageProfit: number;
    roi: number;
  }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT total_trades, successful_trades, total_profit, total_investment
        FROM trading_plans WHERE id = $1
      `,
        [planId]
      );

      if (result.rows.length === 0) {
        throw new Error('Trading plan not found');
      }

      const { total_trades, successful_trades, total_profit, total_investment } = result.rows[0];

      return {
        totalTrades: total_trades,
        successfulTrades: successful_trades,
        totalProfit: parseFloat(total_profit),
        totalInvestment: parseFloat(total_investment),
        successRate: total_trades > 0 ? successful_trades / total_trades : 0,
        averageProfit: successful_trades > 0 ? parseFloat(total_profit) / successful_trades : 0,
        roi: total_investment > 0 ? parseFloat(total_profit) / parseFloat(total_investment) : 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Map database record to TradingPlan
   */
  private mapRecordToTradingPlan(
    planRecord: TradingPlanRecord,
    suggestionRecords: TradingSuggestionRecord[]
  ): TradingPlan {
    const suggestions: TradingSuggestion[] = suggestionRecords.map(record => ({
      itemId: record.item_id,
      itemName: record.item_name,
      buyPrice: parseFloat(record.buy_price.toString()),
      sellPrice: parseFloat(record.sell_price.toString()),
      expectedProfit: parseFloat(record.expected_profit.toString()),
      profitMargin: parseFloat(record.profit_margin.toString()),
      riskLevel: record.risk_level,
      requiredInvestment: parseFloat(record.required_investment.toString()),
      timeToProfit: record.time_to_profit,
      confidence: parseFloat(record.confidence.toString()),
    }));

    return {
      id: planRecord.id,
      userId: planRecord.user_id,
      budget: parseFloat(planRecord.budget.toString()),
      riskTolerance: planRecord.risk_tolerance,
      suggestions,
      createdAt: planRecord.created_at,
      status: planRecord.status,
    };
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}
