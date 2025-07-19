import { Pool } from 'pg';
import { Watchlist, WatchlistItem, AlertRule, Alert } from '../../../shared/src/types';

export class WatchlistRepository {
  constructor(private db: Pool) {}

  async createWatchlist(userId: string, name: string): Promise<Watchlist> {
    const query = `
      INSERT INTO watchlists (id, user_id, name, created_at)
      VALUES (gen_random_uuid(), $1, $2, NOW())
      RETURNING id, user_id, name, created_at
    `;

    const result = await this.db.query(query, [userId, name]);
    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      items: [],
      alerts: [],
    };
  }

  async getUserWatchlists(userId: string): Promise<Watchlist[]> {
    const watchlistsQuery = `
      SELECT id, user_id, name, created_at
      FROM watchlists
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const watchlistsResult = await this.db.query(watchlistsQuery, [userId]);
    const watchlists: Watchlist[] = [];

    for (const row of watchlistsResult.rows) {
      const items = await this.getWatchlistItems(row.id);
      const alerts = await this.getWatchlistAlerts(row.id);

      watchlists.push({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        items,
        alerts,
      });
    }

    return watchlists;
  }

  async getWatchlist(watchlistId: string, userId: string): Promise<Watchlist | null> {
    const query = `
      SELECT id, user_id, name, created_at
      FROM watchlists
      WHERE id = $1 AND user_id = $2
    `;

    const result = await this.db.query(query, [watchlistId, userId]);
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const items = await this.getWatchlistItems(watchlistId);
    const alerts = await this.getWatchlistAlerts(watchlistId);

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      items,
      alerts,
    };
  }

  async addItemToWatchlist(
    watchlistId: string,
    item: Omit<WatchlistItem, 'addedAt'>
  ): Promise<void> {
    const query = `
      INSERT INTO watchlist_items (watchlist_id, type_id, region_id, target_buy_price, target_sell_price, added_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (watchlist_id, type_id, region_id) DO UPDATE SET
        target_buy_price = EXCLUDED.target_buy_price,
        target_sell_price = EXCLUDED.target_sell_price
    `;

    await this.db.query(query, [
      watchlistId,
      item.typeId,
      item.regionId,
      item.targetBuyPrice,
      item.targetSellPrice,
    ]);
  }

  async removeItemFromWatchlist(
    watchlistId: string,
    typeId: number,
    regionId: number
  ): Promise<void> {
    const query = `
      DELETE FROM watchlist_items
      WHERE watchlist_id = $1 AND type_id = $2 AND region_id = $3
    `;

    await this.db.query(query, [watchlistId, typeId, regionId]);
  }

  async getWatchlistItems(watchlistId: string): Promise<WatchlistItem[]> {
    const query = `
      SELECT type_id, region_id, target_buy_price, target_sell_price, added_at
      FROM watchlist_items
      WHERE watchlist_id = $1
      ORDER BY added_at DESC
    `;

    const result = await this.db.query(query, [watchlistId]);

    return result.rows.map(row => ({
      typeId: row.type_id,
      regionId: row.region_id,
      targetBuyPrice: row.target_buy_price,
      targetSellPrice: row.target_sell_price,
      addedAt: row.added_at,
    }));
  }

  async createAlertRule(
    watchlistId: string,
    rule: Omit<AlertRule, 'id' | 'createdAt'>
  ): Promise<AlertRule> {
    const query = `
      INSERT INTO alert_rules (id, watchlist_id, type_id, region_id, condition, threshold, is_active, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, type_id, region_id, condition, threshold, is_active, created_at
    `;

    const result = await this.db.query(query, [
      watchlistId,
      rule.typeId,
      rule.regionId,
      rule.condition,
      rule.threshold,
      rule.isActive,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      typeId: row.type_id,
      regionId: row.region_id,
      condition: row.condition,
      threshold: row.threshold,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }

  async updateAlertRule(
    ruleId: string,
    updates: Partial<Pick<AlertRule, 'threshold' | 'isActive'>>
  ): Promise<void> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.threshold !== undefined) {
      setParts.push(`threshold = $${paramIndex++}`);
      values.push(updates.threshold);
    }

    if (updates.isActive !== undefined) {
      setParts.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (setParts.length === 0) return;

    const query = `
      UPDATE alert_rules
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
    `;

    values.push(ruleId);
    await this.db.query(query, values);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    const query = `DELETE FROM alert_rules WHERE id = $1`;
    await this.db.query(query, [ruleId]);
  }

  async getWatchlistAlerts(watchlistId: string): Promise<AlertRule[]> {
    const query = `
      SELECT id, type_id, region_id, condition, threshold, is_active, created_at
      FROM alert_rules
      WHERE watchlist_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [watchlistId]);

    return result.rows.map(row => ({
      id: row.id,
      typeId: row.type_id,
      regionId: row.region_id,
      condition: row.condition,
      threshold: row.threshold,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));
  }

  async getActiveAlertRules(): Promise<(AlertRule & { watchlistId: string; userId: string })[]> {
    const query = `
      SELECT ar.id, ar.type_id, ar.region_id, ar.condition, ar.threshold, ar.is_active, ar.created_at,
             ar.watchlist_id, w.user_id
      FROM alert_rules ar
      JOIN watchlists w ON ar.watchlist_id = w.id
      WHERE ar.is_active = true
      ORDER BY ar.created_at DESC
    `;

    const result = await this.db.query(query);

    return result.rows.map(row => ({
      id: row.id,
      typeId: row.type_id,
      regionId: row.region_id,
      condition: row.condition,
      threshold: row.threshold,
      isActive: row.is_active,
      createdAt: row.created_at,
      watchlistId: row.watchlist_id,
      userId: row.user_id,
    }));
  }

  async createAlert(alert: Omit<Alert, 'id' | 'triggeredAt'>): Promise<Alert> {
    const query = `
      INSERT INTO alerts (id, user_id, rule_id, type_id, region_id, message, triggered_at, acknowledged)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), false)
      RETURNING id, user_id, rule_id, type_id, region_id, message, triggered_at, acknowledged
    `;

    const result = await this.db.query(query, [
      alert.userId,
      alert.ruleId,
      alert.typeId,
      alert.regionId,
      alert.message,
    ]);

    const row = result.rows[0];

    return {
      id: row.id,
      userId: row.user_id,
      ruleId: row.rule_id,
      typeId: row.type_id,
      regionId: row.region_id,
      message: row.message,
      triggeredAt: row.triggered_at,
      acknowledged: row.acknowledged,
    };
  }

  async getUserAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
    const query = `
      SELECT id, user_id, rule_id, type_id, region_id, message, triggered_at, acknowledged
      FROM alerts
      WHERE user_id = $1
      ORDER BY triggered_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [userId, limit]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      ruleId: row.rule_id,
      typeId: row.type_id,
      regionId: row.region_id,
      message: row.message,
      triggeredAt: row.triggered_at,
      acknowledged: row.acknowledged,
    }));
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const query = `
      UPDATE alerts
      SET acknowledged = true
      WHERE id = $1 AND user_id = $2
    `;

    await this.db.query(query, [alertId, userId]);
  }

  async deleteWatchlist(watchlistId: string, userId: string): Promise<void> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Delete alerts first (foreign key constraint)
      await client.query(
        'DELETE FROM alerts WHERE rule_id IN (SELECT id FROM alert_rules WHERE watchlist_id = $1)',
        [watchlistId]
      );

      // Delete alert rules
      await client.query('DELETE FROM alert_rules WHERE watchlist_id = $1', [watchlistId]);

      // Delete watchlist items
      await client.query('DELETE FROM watchlist_items WHERE watchlist_id = $1', [watchlistId]);

      // Delete watchlist
      await client.query('DELETE FROM watchlists WHERE id = $1 AND user_id = $2', [
        watchlistId,
        userId,
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
