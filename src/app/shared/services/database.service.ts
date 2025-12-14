import { Injectable } from '@angular/core';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { Platform } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { InventoryCodeService } from './inventory-code.service';

// ===== INTERFACES DE DATOS =====
// Definiciones de estructuras de datos para la base de datos SQLite

export interface Product {
  id?: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  description?: string;
  brand?: string;
  image?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  status?: string;
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
  productName?: string; // Para joins
}

export interface Category {
  id?: number;
  name: string;
  code: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DatabaseStats {
  totalProducts: number;
  lowStockProducts: number;
  totalMovements: number;
  totalValue: number;
  categoriesCount: number;
  avgStockLevel: number;
}

export interface SearchOptions {
  query?: string;
  category?: string;
  minStock?: number;
  maxStock?: number;
  status?: string;
  orderBy?: 'name' | 'stock' | 'price' | 'category' | 'createdAt';
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

// ===== SISTEMA DE CACHÉ =====
// Estructura para almacenar datos en memoria temporalmente
interface CacheEntry<T> {
  data: T;
  timestamp: number; // Marca de tiempo de creación
  ttl: number; // Tiempo de vida en milisegundos
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private database!: SQLiteObject;
  private isReady: boolean = false;
  private initializationPromise?: Promise<void>;
  
  // Sistema de caché en memoria para optimizar consultas
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // Tiempo de vida del caché: 5 minutos
  
  // Observables para actualizaciones en tiempo real (patrón reactivo)
  private productsSubject = new BehaviorSubject<Product[]>([]);
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  private movementsSubject = new BehaviorSubject<Movement[]>([]);
  
  public products$ = this.productsSubject.asObservable();
  public categories$ = this.categoriesSubject.asObservable();
  public movements$ = this.movementsSubject.asObservable();

  constructor(
    private sqlite: SQLite,
    private platform: Platform,
    private inventoryCodeService: InventoryCodeService
  ) {
    // La base de datos se inicializa llamando a initializeDatabase()
  }

  /**
   * Inicializar la base de datos SQLite
   * Este método debe llamarse una vez antes de usar cualquier otra funcionalidad
   * Si ya se está inicializando, retorna la promesa existente (evita inicializaciones múltiples)
   */
  async initializeDatabase(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Proceso interno de inicialización de la base de datos
   * Crea tablas, índices y carga datos iniciales
   */
  private async performInitialization(): Promise<void> {
    try {
      console.log('🔄 Iniciando inicialización de base de datos...');
      
      await this.platform.ready();
      console.log('✅ Plataforma lista');

      // Crear o abrir la base de datos
      this.database = await this.sqlite.create({
        name: 'scanshelf.db',
        location: 'default'
      });
      console.log('✅ Base de datos creada/abierta');

      // Habilitar claves foráneas pero permitir flexibilidad
      await this.database.executeSql('PRAGMA foreign_keys = OFF', []);
      console.log('✅ Configuración PRAGMA aplicada');
      
      // Crear las tablas necesarias con índices
      await this.createTables();
      console.log('✅ Tablas creadas');
      
      await this.runMigrations();
      console.log('✅ Migraciones aplicadas');
      
      await this.createIndexes();
      console.log('✅ Índices creados');
      
      // Verificar estado de datos y cargar si es necesario
      await this.ensureDataIntegrity();
      console.log('✅ Integridad de datos verificada');
      
      // Cargar datos iniciales en caché de forma síncrona
      await this.loadInitialCacheData();
      console.log('✅ Cache inicial cargado');
      
      this.isReady = true;
      
      console.log('✅ Base de datos SQLite inicializada completamente');
    } catch (error) {
      console.error('❌ Error crítico al inicializar la base de datos:', error);
      this.isReady = false;
      
      // Intentar recuperación automática
      await this.attemptRecovery();
      throw error;
    }
  }

  /**
   * Crear las tablas de la base de datos con estructura optimizada
   */
  private async createTables(): Promise<void> {
    try {
      // Tabla de categorías (nueva)
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          code TEXT UNIQUE NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#3498db',
          icon TEXT DEFAULT 'cube-outline',
          isActive BOOLEAN DEFAULT 1,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      // Tabla de productos optimizada
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          barcode TEXT NOT NULL,
          category TEXT NOT NULL,
          stock INTEGER DEFAULT 0,
          minStock INTEGER DEFAULT 0,
          price REAL DEFAULT 0,
          description TEXT,
          brand TEXT,
          image TEXT,
          weight REAL DEFAULT 0,
          length REAL DEFAULT 0,
          width REAL DEFAULT 0,
          height REAL DEFAULT 0,
          status TEXT DEFAULT 'active',
          createdAt TEXT DEFAULT '',
          updatedAt TEXT DEFAULT ''
        )
      `, []);

      // Tabla de movimientos optimizada
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          productId INTEGER NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('entrada', 'salida', 'ajuste')),
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          previousStock INTEGER DEFAULT 0,
          newStock INTEGER DEFAULT 0,
          reason TEXT NOT NULL CHECK (reason IN ('venta', 'perdida', 'ingreso', 'devolucion')),
          notes TEXT,
          userId TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
        )
      `, []);

      // Tabla de usuarios optimizada
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'guest')),
          isActive BOOLEAN DEFAULT 1,
          lastLogin DATETIME,
          loginCount INTEGER DEFAULT 0,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      // Tabla de configuración de la aplicación
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          type TEXT DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
          description TEXT,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, []);

      console.log('✅ Tablas de base de datos creadas correctamente');
    } catch (error) {
      console.error('❌ Error al crear las tablas:', error);
      throw error;
    }
  }

  /**
   * Ejecutar migraciones de base de datos
   */
  private async runMigrations(): Promise<void> {
    try {
      // Migración: Agregar columna image a products si no existe
      try {
        await this.database.executeSql(`
          ALTER TABLE products ADD COLUMN image TEXT
        `, []);
        console.log('✅ Columna image agregada a products');
      } catch (error) {
        console.log('ℹ️ Columna image ya existe en products');
      }

      // Migración: Agregar columna brand a products si no existe
      try {
        await this.database.executeSql(`
          ALTER TABLE products ADD COLUMN brand TEXT
        `, []);
        console.log('✅ Columna brand agregada a products');
      } catch (error) {
        console.log('ℹ️ Columna brand ya existe en products');
      }
    } catch (error) {
      console.warn('⚠️ Error al ejecutar migraciones:', error);
    }
  }

  /**
   * Crear índices para optimizar consultas
   */
  private async createIndexes(): Promise<void> {
    try {
      const indexes = [
        // Índices para productos
        'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
        'CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId)',
        'CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)',
        'CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock)',
        'CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)',
        'CREATE INDEX IF NOT EXISTS idx_products_created ON products(createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock, minStock)',
        
        // Índices para movimientos
        'CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(productId)',
        'CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type)',
        'CREATE INDEX IF NOT EXISTS idx_movements_user ON movements(userId)',
        'CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(createdAt)',
        'CREATE INDEX IF NOT EXISTS idx_movements_product_date ON movements(productId, createdAt)',
        
        // Índices para categorías
        'CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name)',
        'CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code)',
        'CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(isActive)',
        
        // Índices para usuarios
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_active ON users(isActive)',
        'CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(lastLogin)'
      ];

      for (const indexSql of indexes) {
        await this.database.executeSql(indexSql, []);
      }

      console.log('✅ Índices de base de datos creados correctamente');
    } catch (error) {
      console.error('❌ Error al crear índices:', error);
      throw error;
    }
  }

  /**
   * Verificar si la base de datos está lista
   */
  async isDatabaseReady(): Promise<boolean> {
    if (!this.isReady && !this.initializationPromise) {
      await this.initializeDatabase();
    } else if (this.initializationPromise) {
      await this.initializationPromise;
    }
    return this.isReady;
  }

  // ===== SISTEMA DE CACHÉ =====
  
  /**
   * Cargar datos iniciales en caché de forma robusta
   */
  private async loadInitialCacheData(): Promise<void> {
    try {
      console.log('🔄 Cargando datos iniciales en caché...');
      
      // Cargar datos de forma secuencial para evitar race conditions
      const products = await this.getProductsFromDB();
      console.log(`📦 ${products.length} productos cargados`);
      
      const categories = await this.getCategoriesFromDB();
      console.log(`🏷️ ${categories.length} categorías cargadas`);
      
      const movements = await this.getMovementsFromDB();
      console.log(`📊 ${movements.length} movimientos cargados`);

      // Actualizar BehaviorSubjects de forma síncrona
      this.productsSubject.next(products);
      this.categoriesSubject.next(categories);
      this.movementsSubject.next(movements);

      // Actualizar caché
      this.setCache('all_products', products);
      this.setCache('all_categories', categories);
      this.setCache('recent_movements', movements.slice(0, 100));
      
      console.log('✅ Cache inicial cargado correctamente');
    } catch (error) {
      console.error('❌ Error crítico al cargar cache inicial:', error);
      
      // Proporcionar valores por defecto para evitar arrays vacíos
      this.productsSubject.next([]);
      this.categoriesSubject.next([]);
      this.movementsSubject.next([]);
      
      throw error;
    }
  }

  /**
   * Refrescar el caché con datos actuales (método mejorado)
   */
  private async refreshCache(): Promise<void> {
    try {
      await this.loadInitialCacheData();
    } catch (error) {
      console.error('Error al refrescar caché:', error);
    }
  }

  /**
   * Establecer entrada en caché
   */
  private setCache<T>(key: string, data: T, ttl: number = this.DEFAULT_CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Obtener entrada del caché
   */
  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar si ha expirado
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Limpiar caché
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Invalidar caché relacionado con productos
   */
  private invalidateProductCache(): void {
    const productKeys = ['all_products', 'low_stock_products', 'product_stats'];
    productKeys.forEach(key => this.cache.delete(key));
  }

  // ===== UTILIDADES DE TRANSACCIONES =====

  /**
   * Ejecutar múltiples operaciones en una transacción
   */
  async executeTransaction(operations: Array<{ sql: string; params: any[] }>): Promise<boolean> {
    await this.isDatabaseReady();
    
    try {
      await this.database.executeSql('BEGIN TRANSACTION', []);
      
      for (const operation of operations) {
        await this.database.executeSql(operation.sql, operation.params);
      }
      
      await this.database.executeSql('COMMIT', []);
      return true;
    } catch (error) {
      console.error('Error en transacción:', error);
      try {
        await this.database.executeSql('ROLLBACK', []);
      } catch (rollbackError) {
        console.error('Error en rollback:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Manejo robusto de errores para consultas
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    await this.isDatabaseReady();
    
    try {
      return await this.database.executeSql(sql, params);
    } catch (error: any) {
      console.error(`Error en consulta SQL: ${sql}`, error);
      
      // Manejo específico de errores comunes
      if (error.message?.includes('no such table')) {
        console.warn('Tabla no existe, reintentando inicialización...');
        await this.performInitialization();
        return await this.database.executeSql(sql, params);
      }
      
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PARA PRODUCTOS
  // =====================================================

  /**
   * Obtener productos desde la base de datos (método interno)
   */
  private async getProductsFromDB(): Promise<Product[]> {
    const result = await this.executeQuery(`
      SELECT * FROM products 
      ORDER BY name ASC
    `);
    
    const products: Product[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      products.push(result.rows.item(i));
    }
    
    return products;
  }

  /**
   * Obtener categorías desde la base de datos (método interno)
   */
  private async getCategoriesFromDB(): Promise<Category[]> {
    const result = await this.executeQuery(`
      SELECT * FROM categories 
      WHERE isActive = 1 
      ORDER BY name ASC
    `);
    
    const categories: Category[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      categories.push(result.rows.item(i));
    }
    
    return categories;
  }

  /**
   * Obtener movimientos desde la base de datos (método interno)
   */
  private async getMovementsFromDB(): Promise<Movement[]> {
    const result = await this.executeQuery(`
      SELECT m.*, p.name as productName 
      FROM movements m 
      LEFT JOIN products p ON m.productId = p.id 
      ORDER BY m.createdAt DESC 
      LIMIT 100
    `);
    
    const movements: Movement[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      movements.push(result.rows.item(i));
    }
    
    return movements;
  }

  // ===== MÉTODOS PARA CATEGORÍAS =====

  /**
   * Obtener todas las categorías activas
   */
  async getCategories(): Promise<Category[]> {
    const cached = this.getCache<Category[]>('all_categories');
    if (cached) {
      return cached;
    }

    const categories = await this.getCategoriesFromDB();
    this.setCache('all_categories', categories);
    
    return categories;
  }

  /**
   * Obtener categoría por ID
   */
  async getCategoryById(id: number): Promise<Category | null> {
    const cacheKey = `category_${id}`;
    const cached = this.getCache<Category>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery('SELECT * FROM categories WHERE id = ?', [id]);
      
      if (result.rows.length > 0) {
        const category = result.rows.item(0);
        this.setCache(cacheKey, category);
        return category;
      }
      
      return null;
    } catch (error) {
      console.error('Error al obtener categoría por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener ID de categoría por nombre
   */
  async getCategoryIdByName(name: string): Promise<number | null> {
    try {
      const result = await this.executeQuery('SELECT id FROM categories WHERE name = ? AND isActive = 1', [name]);
      
      if (result.rows.length > 0) {
        return result.rows.item(0).id;
      }
      
      return null;
    } catch (error) {
      console.error('Error al obtener ID de categoría:', error);
      return null;
    }
  }

  /**
   * Crear una nueva categoría
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<number> {
    if (!category.name?.trim()) {
      throw new Error('El nombre de la categoría es requerido');
    }
    if (!category.code?.trim()) {
      throw new Error('El código de la categoría es requerido');
    }

    try {
      const result = await this.executeQuery(`
        INSERT INTO categories (name, code, description, color, icon, isActive)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        category.name.trim(),
        category.code.trim(),
        category.description?.trim() || '',
        category.color || '#3498db',
        category.icon || 'cube-outline',
        category.isActive !== false ? 1 : 0
      ]);

      // Invalidar caché de categorías
      this.clearCache('all_categories');
      await this.refreshCache();

      return result.insertId;
    } catch (error: any) {
      console.error('Error al crear categoría:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        if (error.message.includes('name')) {
          throw new Error(`Ya existe una categoría con el nombre: ${category.name}`);
        }
        if (error.message.includes('code')) {
          throw new Error(`Ya existe una categoría con el código: ${category.code}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Actualizar una categoría
   */
  async updateCategory(id: number, category: Partial<Category>): Promise<boolean> {
    if (!id || id <= 0) {
      throw new Error('ID de categoría inválido');
    }

    // Verificar que la categoría existe
    const existing = await this.getCategoryById(id);
    if (!existing) {
      throw new Error(`Categoría con ID ${id} no encontrada`);
    }

    try {
      const updateData = { ...existing, ...category };
      
      const result = await this.executeQuery(`
        UPDATE categories 
        SET name = ?, code = ?, description = ?, color = ?, icon = ?, 
            isActive = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        updateData.name?.trim(),
        updateData.code?.trim(), 
        updateData.description?.trim() || '',
        updateData.color || '#3498db',
        updateData.icon || 'cube-outline',
        updateData.isActive !== false ? 1 : 0,
        id
      ]);

      // Invalidar caché
      this.clearCache('all_categories');
      this.clearCache(`category_${id}`);
      await this.refreshCache();

      return result.rowsAffected > 0;
    } catch (error: any) {
      console.error('Error al actualizar categoría:', error);
      
      if (error.message?.includes('UNIQUE constraint failed')) {
        if (error.message.includes('name')) {
          throw new Error(`Ya existe otra categoría con el nombre: ${category.name}`);
        }
        if (error.message.includes('code')) {
          throw new Error(`Ya existe otra categoría con el código: ${category.code}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Eliminar una categoría (soft delete)
   */
  async deleteCategory(id: number): Promise<boolean> {
    if (!id || id <= 0) {
      throw new Error('ID de categoría inválido');
    }

    // Verificar si hay productos usando esta categoría
    const productsCount = await this.executeQuery(
      'SELECT COUNT(*) as count FROM products WHERE categoryId = ?', 
      [id]
    );
    
    if (productsCount.rows.item(0).count > 0) {
      throw new Error('No se puede eliminar una categoría que tiene productos asociados');
    }

    try {
      // Soft delete
      const result = await this.executeQuery(`
        UPDATE categories 
        SET isActive = 0, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [id]);

      // Invalidar caché
      this.clearCache('all_categories');
      this.clearCache(`category_${id}`);
      await this.refreshCache();

      return result.rowsAffected > 0;
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los productos con caché
   */
  async getProducts(): Promise<Product[]> {
    // Intentar obtener del caché primero
    const cached = this.getCache<Product[]>('all_products');
    if (cached) {
      return cached;
    }

    // Si no está en caché, obtener de BD
    const products = await this.getProductsFromDB();
    this.setCache('all_products', products);
    
    return products;
  }

  /**
   * Obtener productos con búsqueda avanzada y paginación
   */
  async searchProducts(options: SearchOptions = {}): Promise<PaginatedResult<Product>> {
    await this.isDatabaseReady();
    
    const {
      query = '',
      category = '',
      minStock,
      maxStock,
      status = 'active',
      orderBy = 'name',
      orderDirection = 'ASC',
      limit = 20,
      offset = 0
    } = options;

    // Construir cláusula WHERE dinámicamente
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.trim()) {
      conditions.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR description LIKE ?)');
      const searchTerm = `%${query.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (minStock !== undefined) {
      conditions.push('stock >= ?');
      params.push(minStock);
    }

    if (maxStock !== undefined) {
      conditions.push('stock <= ?');
      params.push(maxStock);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = `ORDER BY ${orderBy} ${orderDirection}`;
    const limitClause = `LIMIT ? OFFSET ?`;

    // Consulta para obtener datos
    const dataQuery = `
      SELECT * FROM products 
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `;
    
    // Consulta para contar total
    const countQuery = `
      SELECT COUNT(*) as total FROM products 
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        this.executeQuery(dataQuery, [...params, limit, offset]),
        this.executeQuery(countQuery, params)
      ]);

      const products: Product[] = [];
      for (let i = 0; i < dataResult.rows.length; i++) {
        products.push(dataResult.rows.item(i));
      }

      const totalCount = countResult.rows.item(0).total;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasMore = (offset + limit) < totalCount;

      return {
        data: products,
        totalCount,
        hasMore,
        currentPage,
        totalPages
      };
    } catch (error) {
      console.error('Error en búsqueda de productos:', error);
      throw error;
    }
  }

  /**
   * Obtener un producto por su ID
   */
  async getProductById(id: number): Promise<Product | null> {
    // Verificar caché primero
    const cacheKey = `product_${id}`;
    const cached = this.getCache<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery(`
        SELECT * FROM products WHERE id = ?
      `, [id]);
      
      if (result.rows.length > 0) {
        const product = result.rows.item(0);
        this.setCache(cacheKey, product);
        return product;
      }
      
      return null;
    } catch (error) {
      console.error('Error al obtener producto por ID:', error);
      throw error;
    }
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode?.trim()) {
      throw new Error('Código de barras requerido');
    }

    // Verificar caché
    const cacheKey = `barcode_${barcode}`;
    const cached = this.getCache<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery(`
        SELECT * FROM products WHERE barcode = ?
      `, [barcode]);
      
      if (result.rows.length > 0) {
        const product = result.rows.item(0);
        this.setCache(cacheKey, product, 10 * 60 * 1000); // Cache por 10 minutos
        return product;
      }
      
      return null;
    } catch (error) {
      console.error('Error al buscar producto por código de barras:', error);
      throw error;
    }
  }

  /**
   * Agregar un nuevo producto con validaciones completas
   */
  async addProduct(product: Omit<Product, 'id'>): Promise<number> {
    try {
      console.log('💾 Guardando producto:', product);
      
      const result = await this.executeQuery(`
        INSERT INTO products (
          name, sku, barcode, category, stock, minStock, price, 
          description, brand, weight, length, width, height, status, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        product.name || '',
        product.sku || '',
        product.barcode || '',
        product.category || '',
        product.stock || 0,
        product.minStock || 0,
        product.price || 0,
        product.description || '',
        product.brand || '',
        product.weight || 0,
        product.length || 0,
        product.width || 0,
        product.height || 0,
        product.status || 'active',
        product.createdAt || new Date().toISOString(),
        product.updatedAt || new Date().toISOString()
      ]);
      
      console.log('✅ Producto guardado con ID:', result.insertId);
      
      // Actualizar caché simple
      this.invalidateProductCache();
      await this.refreshCache();
      
      return result.insertId;
    } catch (error: any) {
      console.error('❌ Error al guardar producto:', error);
      throw new Error('No se pudo guardar el producto');
    }
  }

  /**
   * Actualizar un producto con validaciones completas
   */
  async updateProduct(id: number, product: Partial<Product>): Promise<boolean> {
    if (!id || id <= 0) {
      throw new Error('ID de producto inválido');
    }

    // Verificar que el producto existe
    const existingProduct = await this.getProductById(id);
    if (!existingProduct) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }

    // Validar unicidad de SKU y código de barras si se están cambiando
    if (product.sku && product.sku !== existingProduct.sku) {
      const existingSKU = await this.getProductBySKU(product.sku);
      if (existingSKU && existingSKU.id !== id) {
        throw new Error(`Ya existe otro producto con el SKU: ${product.sku}`);
      }
    }

    if (product.barcode && product.barcode !== existingProduct.barcode) {
      const existingBarcode = await this.getProductByBarcode(product.barcode);
      if (existingBarcode && existingBarcode.id !== id) {
        throw new Error(`Ya existe otro producto con el código de barras: ${product.barcode}`);
      }
    }

    try {
      // Preparar datos para actualización
      const updateData = { ...existingProduct, ...product };
      
      // Obtener categoryId si la categoría cambió
      let categoryId = (existingProduct as any).categoryId || null;
      if (product.category && product.category !== existingProduct.category) {
        categoryId = await this.getCategoryIdByName(product.category);
        if (!categoryId) {
          categoryId = await this.createCategory({
            name: product.category,
            code: this.inventoryCodeService.getCategoryCodeByName(product.category)
          });
        }
      }

      const result = await this.executeQuery(`
        UPDATE products 
        SET name = ?, sku = ?, barcode = ?, category = ?, 
            stock = ?, minStock = ?, price = ?, description = ?,
            brand = ?, weight = ?, length = ?, width = ?, height = ?, 
            status = ?, updatedAt = ?
        WHERE id = ?
      `, [
        updateData.name || '',
        updateData.sku || '',
        updateData.barcode || '',
        updateData.category || '',
        updateData.stock || 0,
        updateData.minStock || 0,
        updateData.price || 0,
        updateData.description || '',
        updateData.brand || '',
        updateData.weight || 0,
        updateData.length || 0,
        updateData.width || 0,
        updateData.height || 0,
        updateData.status || 'active',
        new Date().toISOString(),
        id
      ]);
      
      // Invalidar caché
      this.invalidateProductCache();
      this.clearCache(`product_${id}`);
      
      // Actualizar observables
      await this.refreshCache();
      
      return result.rowsAffected > 0;
    } catch (error: any) {
      console.error('Error al actualizar producto:', error);
      
      // Manejo específico de errores
      if (error.message?.includes('UNIQUE constraint failed')) {
        if (error.message.includes('sku')) {
          throw new Error(`El SKU ${product.sku} ya existe en otro producto`);
        }
        if (error.message.includes('barcode')) {
          throw new Error(`El código de barras ${product.barcode} ya existe en otro producto`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Eliminar un producto con validaciones
   */
  async deleteProduct(id: number): Promise<boolean> {
    if (!id || id <= 0) {
      throw new Error('ID de producto inválido');
    }

    // Verificar que el producto existe
    const existingProduct = await this.getProductById(id);
    if (!existingProduct) {
      throw new Error(`Producto con ID ${id} no encontrado`);
    }

    try {
      // Usar transacción para eliminar producto y sus movimientos
      const operations = [
        { sql: 'DELETE FROM movements WHERE productId = ?', params: [id] },
        { sql: 'DELETE FROM products WHERE id = ?', params: [id] }
      ];

      await this.executeTransaction(operations);

      // Invalidar caché
      this.invalidateProductCache();
      this.clearCache(`product_${id}`);
      
      // Actualizar observables
      await this.refreshCache();
      
      return true;
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PARA MOVIMIENTOS
  // =====================================================

  /**
   * Obtener todos los movimientos con caché
   */
  async getMovements(): Promise<Movement[]> {
    // Verificar caché
    const cached = this.getCache<Movement[]>('recent_movements');
    if (cached) {
      return cached;
    }

    const movements = await this.getMovementsFromDB();
    this.setCache('recent_movements', movements);
    
    return movements;
  }

  /**
   * Obtener movimientos con paginación y filtros
   */
  async getMovementsPaginated(options: {
    productId?: number;
    type?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<PaginatedResult<Movement>> {
    const {
      productId,
      type,
      userId,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = options;

    const conditions: string[] = [];
    const params: any[] = [];

    if (productId) {
      conditions.push('m.productId = ?');
      params.push(productId);
    }

    if (type && type !== 'all') {
      conditions.push('m.type = ?');
      params.push(type);
    }

    if (userId) {
      conditions.push('m.userId = ?');
      params.push(userId);
    }

    if (startDate) {
      conditions.push('m.createdAt >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('m.createdAt <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      const [dataResult, countResult] = await Promise.all([
        this.executeQuery(`
          SELECT m.*, p.name as productName, p.sku as productSku
          FROM movements m 
          LEFT JOIN products p ON m.productId = p.id 
          ${whereClause}
          ORDER BY m.createdAt DESC
          LIMIT ? OFFSET ?
        `, [...params, limit, offset]),
        
        this.executeQuery(`
          SELECT COUNT(*) as total 
          FROM movements m 
          LEFT JOIN products p ON m.productId = p.id 
          ${whereClause}
        `, params)
      ]);

      const movements: Movement[] = [];
      for (let i = 0; i < dataResult.rows.length; i++) {
        movements.push(dataResult.rows.item(i));
      }

      const totalCount = countResult.rows.item(0).total;
      const totalPages = Math.ceil(totalCount / limit);
      const currentPage = Math.floor(offset / limit) + 1;
      const hasMore = (offset + limit) < totalCount;

      return {
        data: movements,
        totalCount,
        hasMore,
        currentPage,
        totalPages
      };
    } catch (error) {
      console.error('Error en consulta de movimientos paginada:', error);
      throw error;
    }
  }

  /**
   * Agregar un nuevo movimiento con validaciones completas
   */
  async addMovement(movement: Omit<Movement, 'id'>): Promise<number> {
    // Validaciones
    if (!movement.productId || movement.productId <= 0) {
      throw new Error('ID de producto inválido');
    }
    if (!movement.type || !['entrada', 'salida', 'ajuste'].includes(movement.type)) {
      throw new Error('Tipo de movimiento inválido');
    }
    if (!movement.quantity || movement.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }
    if (!movement.reason?.trim()) {
      throw new Error('La razón del movimiento es requerida');
    }
    if (!movement.userId?.trim()) {
      throw new Error('El usuario es requerido');
    }

    // Verificar que el producto existe y obtener stock actual
    const product = await this.getProductById(movement.productId);
    if (!product) {
      throw new Error(`Producto con ID ${movement.productId} no encontrado`);
    }

    // Validar que no se genere stock negativo en salidas
    if (movement.type === 'salida' && product.stock < movement.quantity) {
      throw new Error(`Stock insuficiente. Stock actual: ${product.stock}, cantidad solicitada: ${movement.quantity}`);
    }

    try {
      // Calcular nuevo stock
      const previousStock = product.stock;
      let newStock = previousStock;
      
      switch (movement.type) {
        case 'entrada':
          newStock = previousStock + movement.quantity;
          break;
        case 'salida':
          newStock = previousStock - movement.quantity;
          break;
        case 'ajuste':
          newStock = movement.quantity; // Para ajustes, quantity es el stock final
          break;
      }

      // Usar transacción para consistencia
      const operations = [
        {
          sql: `
            INSERT INTO movements (productId, type, quantity, previousStock, newStock, reason, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          params: [
            movement.productId,
            movement.type,
            movement.quantity,
            previousStock,
            newStock,
            movement.reason.trim(),
            movement.userId.trim()
          ]
        },
        {
          sql: 'UPDATE products SET stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          params: [newStock, movement.productId]
        }
      ];

      // Ejecutar transacción
      await this.executeTransaction(operations);

      // Obtener el ID del movimiento insertado
      const result = await this.executeQuery(
        'SELECT last_insert_rowid() as id'
      );
      const movementId = result.rows.item(0).id;

      // Invalidar cachés relacionados
      this.clearCache('recent_movements');
      this.clearCache(`product_${movement.productId}`);
      this.invalidateProductCache();
      
      // Actualizar observables
      await this.refreshCache();
      
      return movementId;
    } catch (error: any) {
      console.error('Error al agregar movimiento:', error);
      throw error;
    }
  }



  // =====================================================
  // MÉTODOS PARA REPORTES
  // =====================================================

  /**
   * Obtener productos con stock bajo
   */
  async getLowStockProducts(): Promise<Product[]> {
    // Verificar caché
    const cached = this.getCache<Product[]>('low_stock_products');
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery(`
        SELECT p.*, c.name as categoryName, c.color as categoryColor
        FROM products p 
        LEFT JOIN categories c ON p.categoryId = c.id 
        WHERE p.stock <= p.minStock AND p.status = 'active'
        ORDER BY (p.stock - p.minStock) ASC, p.name ASC
      `);
      
      const products: Product[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        products.push(result.rows.item(i));
      }
      
      // Cache por menos tiempo ya que el stock cambia frecuentemente
      this.setCache('low_stock_products', products, 2 * 60 * 1000); // 2 minutos
      
      return products;
    } catch (error) {
      console.error('Error al obtener productos con stock bajo:', error);
      throw error;
    }
  }

  /**
   * Obtener productos sin stock
   */
  async getOutOfStockProducts(): Promise<Product[]> {
    try {
      const result = await this.executeQuery(`
        SELECT * FROM products 
        WHERE stock = 0 AND status = 'active'
        ORDER BY name ASC
      `);
      
      const products: Product[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        products.push(result.rows.item(i));
      }
      
      return products;
    } catch (error) {
      console.error('Error al obtener productos sin stock:', error);
      throw error;
    }
  }

  /**
   * Obtener productos próximos a vencer
   */
  async getExpiringProducts(days: number = 30): Promise<Product[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const result = await this.executeQuery(`
        SELECT p.*, c.name as categoryName, c.color as categoryColor
        FROM products p 
        LEFT JOIN categories c ON p.categoryId = c.id 
        WHERE p.expirationDate IS NOT NULL 
          AND p.expirationDate <= ? 
          AND p.status = 'active'
        ORDER BY p.expirationDate ASC
      `, [futureDateStr]);
      
      const products: Product[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        products.push(result.rows.item(i));
      }
      
      return products;
    } catch (error) {
      console.error('Error al obtener productos próximos a vencer:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas completas del inventario
   */
  async getStats(): Promise<DatabaseStats> {
    // Verificar caché
    const cached = this.getCache<DatabaseStats>('inventory_stats');
    if (cached) {
      return cached;
    }

    try {
      const [statsResult, categoriesResult] = await Promise.all([
        this.executeQuery(`
          SELECT 
            COUNT(*) as totalProducts,
            COUNT(CASE WHEN stock <= minStock THEN 1 END) as lowStockProducts,
            COUNT(CASE WHEN stock = 0 THEN 1 END) as outOfStockProducts,
            COALESCE(SUM(stock * price), 0) as totalValue,
            COALESCE(AVG(stock), 0) as avgStockLevel,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as activeProducts,
            COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactiveProducts,
            COUNT(CASE WHEN status = 'discontinued' THEN 1 END) as discontinuedProducts
          FROM products
        `),
        this.executeQuery('SELECT COUNT(*) as count FROM categories WHERE isActive = 1'),
        this.executeQuery('SELECT COUNT(*) as count FROM movements')
      ]);

      const stats = statsResult.rows.item(0);
      const categoriesCount = categoriesResult.rows.item(0).count;
      const [movementsResult] = await Promise.all([
        this.executeQuery('SELECT COUNT(*) as count FROM movements')
      ]);
      const totalMovements = movementsResult.rows.item(0).count;

      const result: DatabaseStats = {
        totalProducts: stats.totalProducts,
        lowStockProducts: stats.lowStockProducts,
        totalMovements: totalMovements,
        totalValue: stats.totalValue,
        categoriesCount: categoriesCount,
        avgStockLevel: Math.round(stats.avgStockLevel * 100) / 100
      };

      // Cache por 5 minutos
      this.setCache('inventory_stats', result, 5 * 60 * 1000);
      
      return result;
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      return {
        totalProducts: 0,
        lowStockProducts: 0,
        totalMovements: 0,
        totalValue: 0,
        categoriesCount: 0,
        avgStockLevel: 0
      };
    }
  }

  /**
   * Obtener estadísticas por categoría
   */
  async getCategoryStats(): Promise<Array<{
    categoryName: string;
    productCount: number;
    totalValue: number;
    lowStockCount: number;
    avgStock: number;
  }>> {
    try {
      const result = await this.executeQuery(`
        SELECT 
          c.name as categoryName,
          COUNT(p.id) as productCount,
          COALESCE(SUM(p.stock * p.price), 0) as totalValue,
          COUNT(CASE WHEN p.stock <= p.minStock THEN 1 END) as lowStockCount,
          COALESCE(AVG(p.stock), 0) as avgStock
        FROM categories c
        LEFT JOIN products p ON c.id = p.categoryId AND p.status = 'active'
        WHERE c.isActive = 1
        GROUP BY c.id, c.name
        ORDER BY productCount DESC
      `);
      
      const stats = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        stats.push({
          categoryName: row.categoryName,
          productCount: row.productCount,
          totalValue: row.totalValue,
          lowStockCount: row.lowStockCount,
          avgStock: Math.round(row.avgStock * 100) / 100
        });
      }
      
      return stats;
    } catch (error) {
      console.error('Error al obtener estadísticas por categoría:', error);
      return [];
    }
  }

  /**
   * Obtener reporte de movimientos por período
   */
  async getMovementStats(startDate: string, endDate: string): Promise<{
    totalMovements: number;
    entradas: number;
    salidas: number;
    ajustes: number;
    mostActiveProducts: Array<{ productName: string; movementCount: number; }>;
  }> {
    try {
      const [movementSummary, activeProducts] = await Promise.all([
        this.executeQuery(`
          SELECT 
            COUNT(*) as totalMovements,
            COUNT(CASE WHEN type = 'entrada' THEN 1 END) as entradas,
            COUNT(CASE WHEN type = 'salida' THEN 1 END) as salidas,
            COUNT(CASE WHEN type = 'ajuste' THEN 1 END) as ajustes
          FROM movements
          WHERE createdAt BETWEEN ? AND ?
        `, [startDate, endDate]),
        
        this.executeQuery(`
          SELECT p.name as productName, COUNT(m.id) as movementCount
          FROM movements m
          JOIN products p ON m.productId = p.id
          WHERE m.createdAt BETWEEN ? AND ?
          GROUP BY m.productId, p.name
          ORDER BY movementCount DESC
          LIMIT 5
        `, [startDate, endDate])
      ]);

      const summary = movementSummary.rows.item(0);
      const mostActive = [];
      for (let i = 0; i < activeProducts.rows.length; i++) {
        mostActive.push(activeProducts.rows.item(i));
      }

      return {
        totalMovements: summary.totalMovements,
        entradas: summary.entradas,
        salidas: summary.salidas,
        ajustes: summary.ajustes,
        mostActiveProducts: mostActive
      };
    } catch (error) {
      console.error('Error al obtener estadísticas de movimientos:', error);
      return {
        totalMovements: 0,
        entradas: 0,
        salidas: 0,
        ajustes: 0,
        mostActiveProducts: []
      };
    }
  }

  // =====================================================
  // MÉTODOS DE INICIALIZACIÓN
  // =====================================================

  /**
   * Asegurar integridad de datos y cargar ejemplos si es necesario
   */
  private async ensureDataIntegrity(): Promise<void> {
    try {
      console.log('🔍 Verificando integridad de datos...');
      
      // Verificar si ya hay datos de forma más robusta
      let productsCount = 0;
      let categoriesCount = 0;
      
      try {
        const [prodResult, catResult] = await Promise.all([
          this.executeQuery('SELECT COUNT(*) as count FROM products'),
          this.executeQuery('SELECT COUNT(*) as count FROM categories')
        ]);
        productsCount = prodResult.rows.item(0).count;
        categoriesCount = catResult.rows.item(0).count;
      } catch (countError) {
        console.warn('⚠️ Error al contar registros, asumiendo BD vacía:', countError);
      }

      const hasProducts = productsCount > 0;
      const hasCategories = categoriesCount > 0;

      if (hasProducts && hasCategories) {
        console.log(`📦 Datos existentes encontrados: ${productsCount} productos, ${categoriesCount} categorías`);
        return;
      }

      console.log('🏗️ Cargando datos de ejemplo requeridos...');

      // Cargar datos de ejemplo de forma síncrona y confiable
      await this.forceLoadSampleData();

      console.log('✅ Integridad de datos asegurada');

    } catch (error) {
      console.error('❌ Error crítico en verificación de datos:', error);
      // No lanzar error para permitir que la app continúe
      console.log('🔧 Continuando sin datos de ejemplo...');
    }
  }

  /**
   * Inicializar la base de datos con datos de ejemplo (método legacy)
   */
  private async initializeDefaultData(): Promise<void> {
    await this.ensureDataIntegrity();
  }

  /**
   * Inicializar categorías por defecto
   */
  private async initializeDefaultCategories(): Promise<void> {
    const categories = this.inventoryCodeService.getAvailableCategories();
    
    for (const categoryName of categories) {
      try {
        await this.createCategory({
          name: categoryName,
          code: this.inventoryCodeService.getCategoryCodeByName(categoryName),
          description: `Categoría para productos de ${categoryName.toLowerCase()}`,
          isActive: true
        });
      } catch (error) {
        console.warn(`Error al crear categoría ${categoryName}:`, error);
      }
    }
    
    console.log(`✅ ${categories.length} categorías creadas`);
  }

  /**
   * Inicializar productos de ejemplo
   */
  private async initializeDefaultProducts(): Promise<void> {
    const demoData = this.inventoryCodeService.generateDemoData();
    
    const defaultProducts: Omit<Product, 'id'>[] = [
      {
        name: 'iPhone 15 Pro 128GB',
        sku: demoData[0].sku,
        barcode: demoData[0].barcode,
        category: 'Electrónicos',
        stock: 15,
        minStock: 5,
        price: 999.99,
        description: 'Smartphone Apple iPhone 15 Pro con 128GB de almacenamiento, cámara profesional y chip A17 Pro',
        brand: 'Apple'
      },
      {
        name: 'Arroz Integral Premium 1kg',
        sku: demoData[1].sku,
        barcode: demoData[1].barcode,
        category: 'Alimentación',
        stock: 50,
        minStock: 10,
        price: 4.99,
        description: 'Arroz integral de grano largo, rico en fibra y nutrientes',
        weight: 1000
      },
      {
        name: 'Camiseta Polo Algodón Orgánico',
        sku: demoData[2].sku,
        barcode: demoData[2].barcode,
        category: 'Ropa',
        stock: 30,
        minStock: 8,
        price: 29.99,
        description: 'Camiseta polo de algodón orgánico 100%',
        // color removido - ya no está en la interfaz
      },
      {
        name: 'Lámpara LED Inteligente',
        sku: demoData[3].sku,
        barcode: demoData[3].barcode,
        category: 'Hogar',
        stock: 12,
        minStock: 3,
        price: 89.99,
        description: 'Lámpara LED con control WiFi y múltiples colores'
      },
      {
        name: 'Pelota Fútbol FIFA Profesional',
        sku: demoData[4].sku,
        barcode: demoData[4].barcode,
        category: 'Deportes',
        stock: 8,
        minStock: 2,
        price: 59.99,
        description: 'Pelota de fútbol oficial FIFA, cuero sintético de alta calidad'
      }
    ];

    // Insertar productos usando el método optimizado
    for (const product of defaultProducts) {
      try {
        await this.addProduct(product);
      } catch (error) {
        console.warn(`Error al crear producto ${product.name}:`, error);
      }
    }

    console.log(`✅ ${defaultProducts.length} productos de ejemplo creados`);
  }

  // ===== MÉTODOS UTILITARIOS =====

  /**
   * Exportar base de datos a JSON
   */
  async exportToJSON(): Promise<{
    products: Product[];
    categories: Category[];
    movements: Movement[];
    exportDate: string;
  }> {
    try {
      const [products, categories, movements] = await Promise.all([
        this.getProducts(),
        this.getCategories(),
        this.getMovements()
      ]);

      return {
        products,
        categories,
        movements,
        exportDate: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error al exportar datos:', error);
      throw error;
    }
  }

  /**
   * Limpiar todos los datos (para resetear la aplicación)
   */
  async clearAllData(): Promise<void> {
    try {
      const operations = [
        { sql: 'DELETE FROM movements', params: [] },
        { sql: 'DELETE FROM products', params: [] },
        { sql: 'DELETE FROM categories', params: [] },
        { sql: 'DELETE FROM users', params: [] },
        { sql: 'DELETE FROM app_settings', params: [] }
      ];

      await this.executeTransaction(operations);
      
      // Limpiar todo el caché
      this.clearCache();
      
      // Reinicializar datos por defecto
      await this.initializeDefaultData();
      
      // Refrescar observables
      await this.refreshCache();
      
      console.log('✅ Todos los datos han sido limpiados y reinicializados');
    } catch (error) {
      console.error('Error al limpiar datos:', error);
      throw error;
    }
  }

  /**
   * Intentar recuperación automática en caso de error
   */
  private async attemptRecovery(): Promise<void> {
    try {
      console.log('🔧 Intentando recuperación automática...');
      
      // Intentar recrear tablas si es necesario
      await this.createTables();
      
      // Intentar cargar datos mínimos
      await this.forceLoadSampleData();
      
      // Intentar cargar cache
      await this.loadInitialCacheData();
      
      this.isReady = true;
      console.log('✅ Recuperación automática exitosa');
    } catch (recoveryError) {
      console.error('❌ Recuperación automática falló:', recoveryError);
    }
  }

  /**
   * Verificar y reinicializar datos si es necesario (método público mejorado)
   */
  async checkAndReinitializeData(): Promise<void> {
    try {
      await this.isDatabaseReady();
      
      // Verificar si hay productos de forma más robusta
      let productCount = 0;
      try {
        const result = await this.executeQuery('SELECT COUNT(*) as count FROM products');
        productCount = result.rows.item(0).count;
      } catch (countError) {
        console.warn('⚠️ Error al contar productos, forzando reinicialización');
        await this.forceLoadSampleData();
        await this.loadInitialCacheData();
        return;
      }
      
      if (productCount === 0) {
        console.log('🔄 No hay productos, reinicializando datos...');
        await this.forceLoadSampleData();
        await this.loadInitialCacheData();
      }
      
      console.log(`📊 Base de datos verificada: ${productCount} productos encontrados`);
    } catch (error) {
      console.error('❌ Error crítico al verificar datos:', error);
      await this.attemptRecovery();
    }
  }

  /**
   * Forzar carga de datos de ejemplo de forma robusta
   */
  private async forceLoadSampleData(): Promise<void> {
    try {
      console.log('🔄 Forzando carga de datos de ejemplo...');
      
      // Productos de ejemplo con validación previa
      const sampleProducts = [
        {
          name: 'iPhone 15 Pro',
          sku: 'IPH15PRO001',
          barcode: '1234567890123',
          category: 'Electrónicos',
          stock: 10,
          minStock: 2,
          price: 999.99,
          description: 'Smartphone Apple última generación',
          brand: 'Apple',
          status: 'active'
        },
        {
          name: 'Arroz Integral 1kg',
          sku: 'ARZ001',
          barcode: '9876543210987',
          category: 'Alimentación',
          stock: 50,
          minStock: 10,
          price: 4.99,
          description: 'Arroz integral premium',
          brand: 'Nutri',
          status: 'active'
        },
        {
          name: 'Camiseta Básica',
          sku: 'CAM001',
          barcode: '5555666677778',
          category: 'Ropa',
          stock: 25,
          minStock: 5,
          price: 19.99,
          description: 'Camiseta de algodón básica',
          brand: 'BasicWear',
          status: 'active'
        }
      ];

      let insertedCount = 0;
      
      // Insertar cada producto con manejo robusto de errores
      for (const product of sampleProducts) {
        try {
          // Verificar si ya existe
          const existingCheck = await this.executeQuery(
            'SELECT COUNT(*) as count FROM products WHERE sku = ? OR barcode = ?', 
            [product.sku, product.barcode]
          );
          
          if (existingCheck.rows.item(0).count === 0) {
            await this.executeQuery(`
              INSERT INTO products (name, sku, barcode, category, stock, minStock, price, description, brand, status, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              product.name,
              product.sku,
              product.barcode,
              product.category,
              product.stock,
              product.minStock,
              product.price,
              product.description,
              product.brand,
              product.status,
              new Date().toISOString(),
              new Date().toISOString()
            ]);
            insertedCount++;
            console.log(`✅ Producto insertado: ${product.name}`);
          } else {
            console.log(`ℹ️ Producto ya existe: ${product.name}`);
          }
        } catch (insertError) {
          console.warn(`⚠️ Error al insertar ${product.name}:`, insertError);
          // Continuar con el siguiente producto
        }
      }
      
      console.log(`✅ Proceso completado: ${insertedCount} productos insertados`);
      
    } catch (error) {
      console.error('❌ Error en carga forzada de datos:', error);
      // No lanzar error para permitir continuar
    }
  }

  /**
   * Cargar productos de ejemplo en la base de datos
   * Útil para pruebas y demostraciones
   */
  async loadSampleProducts(): Promise<void> {
    if (!this.isReady) {
      await this.isDatabaseReady();
    }
    
    try {
      await this.forceLoadSampleData();
      await this.loadInitialCacheData();
    } catch (error) {
      console.error('❌ Error cargando productos de ejemplo:', error);
    }
  }

  /**
   * Obtener información sobre el estado actual de la base de datos
   * Incluye: estado de preparación, versión, número de tablas y tamaño del caché
   */
  async getDatabaseInfo(): Promise<{
    isReady: boolean;
    version: string;
    size: number;
    tableCount: number;
    cacheSize: number;
  }> {
    try {
      const tablesResult = await this.executeQuery(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
      );
      
      return {
        isReady: this.isReady,
        version: '1.0.0',
        size: 0, // SQLite no proporciona tamaño fácilmente
        tableCount: tablesResult.rows.item(0).count,
        cacheSize: this.cache.size
      };
    } catch (error) {
      console.error('Error al obtener información de BD:', error);
      return {
        isReady: this.isReady,
        version: '1.0.0',
        size: 0,
        tableCount: 0,
        cacheSize: this.cache.size
      };
    }
  }

  /**
   * Buscar un producto por su código SKU
   * Utiliza caché para optimizar búsquedas repetidas
   * @param sku Código SKU del producto a buscar
   * @returns Producto encontrado o null si no existe
   */
  async getProductBySKU(sku: string): Promise<Product | null> {
    if (!sku?.trim()) {
      return null;
    }

    // Primero intentar obtener del caché
    const cacheKey = `sku_${sku}`;
    const cached = this.getCache<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery(`
        SELECT * FROM products WHERE sku = ?
      `, [sku]);
      
      if (result.rows.length > 0) {
        const product = result.rows.item(0);
        this.setCache(cacheKey, product, 10 * 60 * 1000); // Guardar en caché por 10 minutos
        return product;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error buscando producto por SKU:', error);
      throw error;
    }
  }

  /**
   * Obtener lista de todos los SKUs registrados en la base de datos
   * Usado para evitar duplicados al generar nuevos SKUs
   */
  async getAllSKUs(): Promise<string[]> {
    const cached = this.getCache<string[]>('all_skus');
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery('SELECT sku FROM products WHERE sku IS NOT NULL AND sku != ""');
      const skus: string[] = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        skus.push(result.rows.item(i).sku);
      }
      
      this.setCache('all_skus', skus, 10 * 60 * 1000); // Cache por 10 minutos
      return skus;
    } catch (error) {
      console.error('Error al obtener SKUs:', error);
      return [];
    }
  }

  /**
   * Obtener todos los códigos de barras existentes
   */
  async getAllBarcodes(): Promise<string[]> {
    const cached = this.getCache<string[]>('all_barcodes');
    if (cached) {
      return cached;
    }

    try {
      const result = await this.executeQuery('SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ""');
      const barcodes: string[] = [];
      
      for (let i = 0; i < result.rows.length; i++) {
        barcodes.push(result.rows.item(i).barcode);
      }
      
      this.setCache('all_barcodes', barcodes, 10 * 60 * 1000); // Cache por 10 minutos
      return barcodes;
    } catch (error) {
      console.error('Error al obtener códigos de barras:', error);
      return [];
    }
  }
}