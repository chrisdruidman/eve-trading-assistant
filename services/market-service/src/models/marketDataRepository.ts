import { FastifyInstance } from 'fastify';
import { MarketData, PriceHistory, HistoricalData } from '../../../../shared/src/types';

export class MarketDataRepository {
  constructor(private fastify: FastifyInstance) {}

  async saveMarketData(marketData: MarketData): Promise<void> {
    const client = await this.fastify.db.getClient();

    try {
      await client.query('BEGIN');

      // Insert or update market data summary
      await client.query(
        `
        INSERT INTO market_data (type_id, region_id, last_updated, volume, average_price)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (type_id, region_id)
        DO UPDATE SET
          last_updated = EXCLUDED.last_updated,
          volume = EXCLUDED.volume,
          average_price = EXCLUDED.average_price
      `,
        [
          marketData.typeId,
          marketData.regionId,
          marketData.lastUpdated,
          marketData.volume,
          marketData.averagePrice,
        ]
      );

      // Delete existing orders for this type/region
      await client.query(
        `
        DELETE FROM market_orders 
        WHERE type_id = $1 AND region_id = $2
      `,
        [marketData.typeId, marketData.regionId]
      );

      // Insert new orders
      const allOrders = [...marketData.buyOrders, ...marketData.sellOrders];

      for (const order of allOrders) {
        await client.query(
          `
          INSERT INTO market_orders (
            order_id, type_id, region_id, location_id, price, volume, 
            min_volume, duration, issued, is_buy_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
          [
            order.orderId,
            order.typeId,
            order.regionId,
            order.locationId,
            order.price,
            order.volume,
            order.minVolume,
            order.duration,
            order.issued,
            order.isBuyOrder,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMarketData(regionId: number, typeId: number): Promise<MarketData | null> {
    const marketDataResult = await this.fastify.db.query(
      `
      SELECT * FROM market_data 
      WHERE type_id = $1 AND region_id = $2
    `,
      [typeId, regionId]
    );

    if (marketDataResult.rows.length === 0) {
      return null;
    }

    const ordersResult = await this.fastify.db.query(
      `
      SELECT * FROM market_orders 
      WHERE type_id = $1 AND region_id = $2
      ORDER BY price ASC
    `,
      [typeId, regionId]
    );

    const marketDataRow = marketDataResult.rows[0];
    const orders = ordersResult.rows.map((row: any) => ({
      orderId: row.order_id,
      typeId: row.type_id,
      regionId: row.region_id,
      locationId: row.location_id,
      price: parseFloat(row.price),
      volume: row.volume,
      minVolume: row.min_volume,
      duration: row.duration,
      issued: row.issued,
      isBuyOrder: row.is_buy_order,
    }));

    const buyOrders = orders.filter((order: any) => order.isBuyOrder);
    const sellOrders = orders.filter((order: any) => !order.isBuyOrder);

    return {
      typeId: marketDataRow.type_id,
      regionId: marketDataRow.region_id,
      buyOrders,
      sellOrders,
      lastUpdated: marketDataRow.last_updated,
      volume: marketDataRow.volume,
      averagePrice: parseFloat(marketDataRow.average_price),
    };
  }

  async savePriceHistory(priceHistory: PriceHistory): Promise<void> {
    await this.fastify.db.query(
      `
      INSERT INTO price_history (
        type_id, region_id, date, highest, lowest, average, volume, order_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (type_id, region_id, date)
      DO UPDATE SET
        highest = EXCLUDED.highest,
        lowest = EXCLUDED.lowest,
        average = EXCLUDED.average,
        volume = EXCLUDED.volume,
        order_count = EXCLUDED.order_count
    `,
      [
        priceHistory.typeId,
        priceHistory.regionId,
        priceHistory.date,
        priceHistory.highest,
        priceHistory.lowest,
        priceHistory.average,
        priceHistory.volume,
        priceHistory.orderCount,
      ]
    );
  }

  async getHistoricalData(
    regionId: number,
    typeId: number,
    days: number
  ): Promise<HistoricalData[]> {
    const result = await this.fastify.db.query(
      `
      SELECT * FROM price_history 
      WHERE type_id = $1 AND region_id = $2 
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `,
      [typeId, regionId]
    );

    return result.rows.map((row: any) => ({
      typeId: row.type_id,
      regionId: row.region_id,
      date: row.date,
      highest: parseFloat(row.highest),
      lowest: parseFloat(row.lowest),
      average: parseFloat(row.average),
      volume: row.volume,
      orderCount: row.order_count,
    }));
  }

  async getMarketDataAge(regionId: number, typeId: number): Promise<number | null> {
    const result = await this.fastify.db.query(
      `
      SELECT last_updated FROM market_data 
      WHERE type_id = $1 AND region_id = $2
    `,
      [typeId, regionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const lastUpdated = new Date(result.rows[0].last_updated);
    return Date.now() - lastUpdated.getTime();
  }

  async getStaleMarketData(
    maxAgeMinutes: number
  ): Promise<Array<{ typeId: number; regionId: number }>> {
    const result = await this.fastify.db.query(`
      SELECT type_id, region_id FROM market_data 
      WHERE last_updated < NOW() - INTERVAL '${maxAgeMinutes} minutes'
    `);

    return result.rows.map((row: any) => ({
      typeId: row.type_id,
      regionId: row.region_id,
    }));
  }
}
