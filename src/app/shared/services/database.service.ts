import { Injectable } from '@angular/core';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { Platform } from '@ionic/angular';

export interface Product {
  id?: number;
  name: string;
  barcode: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Movement {
  id?: number;
  productId: number;
  type: 'entrada' | 'salida' | 'ajuste';
  quantity: number;
  reason: string;
  userId: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private database!: SQLiteObject;
  private isReady: boolean = false;

  constructor(
    private sqlite: SQLite,
    private platform: Platform
  ) {
    this.platform.ready().then(() => {
      this.initializeDatabase();
    });
  }

  /**
   * Inicializar la base de datos SQLite
   */
  private async initializeDatabase() {
    try {
      // Crear o abrir la base de datos
      this.database = await this.sqlite.create({
        name: 'scanshelf.db',
        location: 'default'
      });

      // Crear las tablas necesarias
      await this.createTables();
      this.isReady = true;
      
      console.log('✅ Base de datos SQLite inicializada correctamente');
    } catch (error) {
      console.error('❌ Error al inicializar la base de datos:', error);
    }
  }

  /**
   * Crear las tablas de la base de datos
   */
  private async createTables() {
    try {
      // Tabla de productos
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          barcode TEXT UNIQUE NOT NULL,
          category TEXT NOT NULL,
          stock INTEGER DEFAULT 0,
          minStock INTEGER DEFAULT 0,
          price REAL DEFAULT 0,
          description TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      // Tabla de movimientos
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
          quantity INTEGER NOT NULL,
          reason TEXT NOT NULL,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (productId) REFERENCES products (id)
        )
      `, []);

      // Tabla de usuarios (para almacenamiento local)
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          isActive BOOLEAN DEFAULT 1,
          lastLogin DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      console.log('✅ Tablas de base de datos creadas correctamente');
    } catch (error) {
      console.error('❌ Error al crear las tablas:', error);
    }
  }

  /**
   * Verificar si la base de datos está lista
   */
  async isDatabaseReady(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve(true);
      } else {
        // Esperar hasta que la base de datos esté lista
        const checkInterval = setInterval(() => {
          if (this.isReady) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      }
    });
  }

  // =====================================================
  // MÉTODOS PARA PRODUCTOS
  // =====================================================

  /**
   * Obtener todos los productos
   */
  async getProducts(): Promise<Product[]> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql('SELECT * FROM products ORDER BY name', []);
      const products: Product[] = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        products.push(result.rows.item(i));
      }
      
      return products;
    } catch (error) {
      console.error('Error al obtener productos:', error);
      return [];
    }
  }

  /**
   * Obtener un producto por su ID
   */
  async getProductById(id: number): Promise<Product | null> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql('SELECT * FROM products WHERE id = ?', [id]);
      
      if (result.rows.length > 0) {
        return result.rows.item(0);
      }
      
      return null;
    } catch (error) {
      console.error('Error al obtener producto por ID:', error);
      return null;
    }
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql('SELECT * FROM products WHERE barcode = ?', [barcode]);
      
      if (result.rows.length > 0) {
        return result.rows.item(0);
      }
      
      return null;
    } catch (error) {
      console.error('Error al buscar producto por código de barras:', error);
      return null;
    }
  }

  /**
   * Agregar un nuevo producto
   */
  async addProduct(product: Omit<Product, 'id'>): Promise<number> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql(`
        INSERT INTO products (name, barcode, category, stock, minStock, price, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        product.name,
        product.barcode,
        product.category,
        product.stock || 0,
        product.minStock || 0,
        product.price || 0,
        product.description || ''
      ]);
      
      return result.insertId;
    } catch (error) {
      console.error('Error al agregar producto:', error);
      throw error;
    }
  }

  /**
   * Actualizar un producto
   */
  async updateProduct(id: number, product: Partial<Product>): Promise<boolean> {
    await this.isDatabaseReady();
    
    try {
      await this.database.executeSql(`
        UPDATE products 
        SET name = ?, category = ?, stock = ?, minStock = ?, price = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        product.name,
        product.category,
        product.stock,
        product.minStock,
        product.price,
        product.description,
        id
      ]);
      
      return true;
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      return false;
    }
  }

  /**
   * Eliminar un producto
   */
  async deleteProduct(id: number): Promise<boolean> {
    await this.isDatabaseReady();
    
    try {
      await this.database.executeSql('DELETE FROM products WHERE id = ?', [id]);
      return true;
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      return false;
    }
  }

  // =====================================================
  // MÉTODOS PARA MOVIMIENTOS
  // =====================================================

  /**
   * Obtener todos los movimientos
   */
  async getMovements(): Promise<Movement[]> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql(`
        SELECT m.*, p.name as productName 
        FROM movements m 
        JOIN products p ON m.productId = p.id 
        ORDER BY m.createdAt DESC
      `, []);
      
      const movements: Movement[] = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        movements.push(result.rows.item(i));
      }
      
      return movements;
    } catch (error) {
      console.error('Error al obtener movimientos:', error);
      return [];
    }
  }

  /**
   * Agregar un nuevo movimiento
   */
  async addMovement(movement: Omit<Movement, 'id'>): Promise<number> {
    await this.isDatabaseReady();
    
    try {
      // Agregar el movimiento
      const result = await this.database.executeSql(`
        INSERT INTO movements (productId, type, quantity, reason, userId)
        VALUES (?, ?, ?, ?, ?)
      `, [
        movement.productId,
        movement.type,
        movement.quantity,
        movement.reason,
        movement.userId
      ]);

      // Actualizar el stock del producto
      await this.updateProductStock(movement.productId, movement.type, movement.quantity);
      
      return result.insertId;
    } catch (error) {
      console.error('Error al agregar movimiento:', error);
      throw error;
    }
  }

  /**
   * Actualizar el stock de un producto según el tipo de movimiento
   */
  private async updateProductStock(productId: number, type: string, quantity: number) {
    try {
      let stockChange = 0;
      
      switch (type) {
        case 'entrada':
          stockChange = quantity;
          break;
        case 'salida':
          stockChange = -quantity;
          break;
        case 'ajuste':
          // Para ajuste, establecer el stock al valor exacto
          await this.database.executeSql('UPDATE products SET stock = ? WHERE id = ?', [quantity, productId]);
          return;
      }
      
      await this.database.executeSql('UPDATE products SET stock = stock + ? WHERE id = ?', [stockChange, productId]);
    } catch (error) {
      console.error('Error al actualizar stock:', error);
    }
  }

  // =====================================================
  // MÉTODOS PARA REPORTES
  // =====================================================

  /**
   * Obtener productos con stock bajo
   */
  async getLowStockProducts(): Promise<Product[]> {
    await this.isDatabaseReady();
    
    try {
      const result = await this.database.executeSql('SELECT * FROM products WHERE stock <= minStock', []);
      const products: Product[] = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        products.push(result.rows.item(i));
      }
      
      return products;
    } catch (error) {
      console.error('Error al obtener productos con stock bajo:', error);
      return [];
    }
  }

  /**
   * Obtener estadísticas generales
   */
  async getStats(): Promise<{
    totalProducts: number;
    lowStockProducts: number;
    totalMovements: number;
    totalValue: number;
  }> {
    await this.isDatabaseReady();
    
    try {
      const [productsResult, lowStockResult, movementsResult, valueResult] = await Promise.all([
        this.database.executeSql('SELECT COUNT(*) as count FROM products', []),
        this.database.executeSql('SELECT COUNT(*) as count FROM products WHERE stock <= minStock', []),
        this.database.executeSql('SELECT COUNT(*) as count FROM movements', []),
        this.database.executeSql('SELECT SUM(stock * price) as total FROM products', [])
      ]);

      return {
        totalProducts: productsResult.rows.item(0).count,
        lowStockProducts: lowStockResult.rows.item(0).count,
        totalMovements: movementsResult.rows.item(0).count,
        totalValue: valueResult.rows.item(0).total || 0
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalProducts: 0,
        lowStockProducts: 0,
        totalMovements: 0,
        totalValue: 0
      };
    }
  }
}