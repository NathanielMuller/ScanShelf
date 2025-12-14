import { Injectable } from '@angular/core';

export interface Movement {
  id?: number;
  productId: number;
  productName?: string; // Opcional - se obtiene del JOIN con products
  type: 'entrada' | 'salida';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: 'venta' | 'perdida' | 'ingreso' | 'devolucion';
  notes?: string;
  userId: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MovementsService {

  constructor() { }

  /**
   * Registrar un movimiento de inventario
   */
  async registerMovement(movement: Movement): Promise<boolean> {
    try {
      console.log('🔵 INTENTANDO REGISTRAR MOVIMIENTO:', movement);
      
      if (!(window as any).sqlitePlugin) {
        console.error('❌ Plugin SQLite no disponible');
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      return new Promise((resolve, reject) => {
        db.transaction((tx: any) => {
          const sql = `INSERT INTO movements (
              productId, type, quantity, previousStock, 
              newStock, reason, notes, userId, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`;
          const params = [
              movement.productId,
              movement.type,
              movement.quantity,
              movement.previousStock,
              movement.newStock,
              movement.reason,
              movement.notes || null,
              movement.userId
            ];
          
          console.log('📝 SQL INSERT:', sql);
          console.log('📝 PARAMS:', params);
          
          tx.executeSql(
            sql,
            params,
            (tx: any, results: any) => {
              console.log('✅ MOVIMIENTO REGISTRADO EXITOSAMENTE, insertId:', results.insertId);
              console.log('✅ Datos registrados:', movement);
              resolve(true);
            },
            (error: any) => {
              console.error('❌ ERROR SQL AL REGISTRAR MOVIMIENTO:', error);
              console.error('❌ SQL era:', sql);
              console.error('❌ Params eran:', params);
              reject(error);
            }
          );
        });
      });
    } catch (error) {
      console.error('❌ ERROR EN registerMovement:', error);
      return false;
    }
  }

  /**
   * Obtener todos los movimientos con filtros opcionales
   */
  async getMovements(filters?: {
    productId?: number;
    type?: string;
    reason?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Movement[]> {
    try {
      console.log('🔍 OBTENIENDO MOVIMIENTOS con filtros:', filters);
      
      if (!(window as any).sqlitePlugin) {
        console.error('❌ Plugin SQLite no disponible');
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      return new Promise((resolve, reject) => {
        // Query con JOIN para obtener el nombre del producto
        let query = `
          SELECT 
            m.id,
            m.productId,
            p.name as productName,
            m.type,
            m.quantity,
            m.previousStock,
            m.newStock,
            m.reason,
            m.notes,
            m.userId,
            m.createdAt
          FROM movements m
          INNER JOIN products p ON m.productId = p.id
          WHERE 1=1
        `;
        const params: any[] = [];

        if (filters) {
          if (filters.productId) {
            query += ' AND m.productId = ?';
            params.push(filters.productId);
          }
          if (filters.type) {
            query += ' AND m.type = ?';
            params.push(filters.type);
          }
          if (filters.reason) {
            query += ' AND m.reason = ?';
            params.push(filters.reason);
          }
          if (filters.startDate) {
            query += ' AND m.createdAt >= ?';
            params.push(filters.startDate);
          }
          if (filters.endDate) {
            query += ' AND m.createdAt <= ?';
            params.push(filters.endDate);
          }
        }

        query += ' ORDER BY m.createdAt DESC';
        
        console.log('📝 Query SQL:', query);
        console.log('📝 Params:', params);

        db.transaction((tx: any) => {
          tx.executeSql(
            query,
            params,
            (tx: any, results: any) => {
              const movements: Movement[] = [];
              for (let i = 0; i < results.rows.length; i++) {
                movements.push(results.rows.item(i));
              }
              console.log(`✅ MOVIMIENTOS OBTENIDOS: ${movements.length} registros`, movements);
              resolve(movements);
            },
            (error: any) => {
              console.error('❌ ERROR SQL AL OBTENER MOVIMIENTOS:', error);
              reject(error);
            }
          );
        });
      });
    } catch (error) {
      console.error('❌ ERROR EN getMovements:', error);
      return [];
    }
  }

  /**
   * Obtener movimientos de hoy
   */
  async getTodayMovements(): Promise<Movement[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getMovements({
      startDate: `${today} 00:00:00`,
      endDate: `${today} 23:59:59`
    });
  }

  /**
   * Obtener movimientos de esta semana
   */
  async getWeekMovements(): Promise<Movement[]> {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.getMovements({
      startDate: weekAgo.toISOString().split('T')[0] + ' 00:00:00',
      endDate: today.toISOString().split('T')[0] + ' 23:59:59'
    });
  }

  /**
   * Obtener movimientos de este mes
   */
  async getMonthMovements(): Promise<Movement[]> {
    const today = new Date();
    const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);
    return this.getMovements({
      startDate: monthAgo.toISOString().split('T')[0] + ' 00:00:00',
      endDate: today.toISOString().split('T')[0] + ' 23:59:59'
    });
  }

  /**
   * Obtener estadísticas de movimientos
   */
  async getMovementStats(): Promise<{
    totalEntradas: number;
    totalSalidas: number;
    ventasTotal: number;
    perdidasTotal: number;
    ingresosTotal: number;
    devolucionesTotal: number;
  }> {
    try {
      const movements = await this.getMovements();
      
      const stats = {
        totalEntradas: 0,
        totalSalidas: 0,
        ventasTotal: 0,
        perdidasTotal: 0,
        ingresosTotal: 0,
        devolucionesTotal: 0
      };

      movements.forEach(m => {
        if (m.type === 'entrada') {
          stats.totalEntradas += m.quantity;
          if (m.reason === 'ingreso') stats.ingresosTotal += m.quantity;
          if (m.reason === 'devolucion') stats.devolucionesTotal += m.quantity;
        } else {
          stats.totalSalidas += m.quantity;
          if (m.reason === 'venta') stats.ventasTotal += m.quantity;
          if (m.reason === 'perdida') stats.perdidasTotal += m.quantity;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalEntradas: 0,
        totalSalidas: 0,
        ventasTotal: 0,
        perdidasTotal: 0,
        ingresosTotal: 0,
        devolucionesTotal: 0
      };
    }
  }
}
