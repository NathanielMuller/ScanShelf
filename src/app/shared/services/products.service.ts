import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseService, Product, Movement } from './database.service';
import { InventoryCodeService } from './inventory-code.service';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  
  // Estados de carga
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.loadingSubject.asObservable();

  constructor(
    private databaseService: DatabaseService,
    private inventoryCodeService: InventoryCodeService
  ) {
    this.initializeService();
  }

  /**
   * Inicializar el servicio con manejo robusto
   */
  private async initializeService(): Promise<void> {
    try {
      console.log('🔄 Inicializando ProductsService...');
      
      // Inicializar base de datos de forma síncrona
      await this.databaseService.initializeDatabase();
      console.log('✅ DatabaseService inicializado');
      
      // Verificar que los datos estén cargados
      await this.ensureDataAvailability();
      console.log('✅ Disponibilidad de datos asegurada');
      
      console.log('✅ ProductsService inicializado completamente');
    } catch (error) {
      console.error('❌ Error crítico al inicializar ProductsService:', error);
      // Intentar recuperación
      await this.attemptServiceRecovery();
    }
  }

  /**
   * Asegurar que los datos estén disponibles
   */
  private async ensureDataAvailability(): Promise<void> {
    try {
      // Verificar que hay productos disponibles
      const products = await this.databaseService.getProducts();
      if (products.length === 0) {
        console.log('⚠️ No hay productos, cargando datos de ejemplo...');
        await this.databaseService.loadSampleProducts();
      }
      console.log(`📦 ${products.length} productos disponibles`);
    } catch (error) {
      console.warn('⚠️ Error al verificar disponibilidad de datos:', error);
    }
  }

  /**
   * Intentar recuperación del servicio
   */
  private async attemptServiceRecovery(): Promise<void> {
    try {
      console.log('🔧 Intentando recuperación del ProductsService...');
      
      // Esperar un poco y reintentar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar estado de la base de datos
      const isReady = await this.databaseService.isDatabaseReady();
      if (isReady) {
        await this.populateTestData();
        console.log('✅ Recuperación exitosa');
      }
    } catch (recoveryError) {
      console.error('❌ Recuperación del servicio falló:', recoveryError);
    }
  }

  // ===== OBSERVABLES =====

  /**
   * Obtener productos como Observable
   */
  getProducts(): Observable<Product[]> {
    return this.databaseService.products$;
  }

  /**
   * Obtener movimientos como Observable
   */
  getMovements(): Observable<Movement[]> {
    return this.databaseService.movements$;
  }

  // ===== MÉTODOS DE PRODUCTOS =====

  /**
   * Obtener todos los productos (Promesa) con recuperación automática
   */
  async getProductsAsync(): Promise<Product[]> {
    this.loadingSubject.next(true);
    try {
      let products = await this.databaseService.getProducts();
      
      // Si no hay productos, intentar cargar datos de ejemplo
      if (products.length === 0) {
        console.log('⚠️ No hay productos, intentando recuperación...');
        await this.databaseService.checkAndReinitializeData();
        products = await this.databaseService.getProducts();
      }
      
      return products;
    } catch (error) {
      console.error('❌ Error al obtener productos:', error);
      
      // Intentar recuperación
      try {
        await this.populateTestData();
        return await this.databaseService.getProducts();
      } catch (recoveryError) {
        console.error('❌ Recuperación falló:', recoveryError);
        return [];
      }
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Obtener producto por ID
   */
  async getProduct(id: number): Promise<Product | null> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.getProductById(id);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode?.trim()) {
      throw new Error('Código de barras requerido');
    }
    
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.getProductByBarcode(barcode);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Agregar producto
   */
  async addProduct(productData: Omit<Product, 'id'>): Promise<number> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.addProduct(productData);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Crear producto con códigos automáticos
   */
  async createProductWithAutoGeneratedCodes(productData: {
    name: string;
    category: string;
    stock: number;
    minStock: number;
    price: number;
    description?: string;
  }): Promise<number> {
    this.loadingSubject.next(true);
    try {
      const [existingSKUs, existingBarcodes] = await Promise.all([
        this.databaseService.getAllSKUs(),
        this.databaseService.getAllBarcodes()
      ]);

      const sku = this.inventoryCodeService.generateSKU(productData.category, existingSKUs);
      const barcode = this.inventoryCodeService.generateAlternativeBarcode(existingBarcodes);

      const newProduct: Omit<Product, 'id'> = {
        ...productData,
        sku,
        barcode,
        status: 'active'
      };

      return await this.addProduct(newProduct);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Actualizar producto
   */
  async updateProduct(id: number, productData: Partial<Product>): Promise<boolean> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.updateProduct(id, productData);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Eliminar producto
   */
  async deleteProduct(id: number): Promise<boolean> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.deleteProduct(id);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  // ===== MÉTODOS DE MOVIMIENTOS =====

  /**
   * Agregar movimiento
   */
  async addMovement(movementData: Omit<Movement, 'id'>): Promise<number> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.addMovement(movementData);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Registrar entrada
   */
  async registerEntry(productId: number, quantity: number, reason: string, userId: string): Promise<number> {
    return await this.addMovement({
      productId,
      type: 'entrada',
      quantity,
      reason: reason || 'Entrada de inventario',
      userId
    });
  }

  /**
   * Registrar salida
   */
  async registerExit(productId: number, quantity: number, reason: string, userId: string): Promise<number> {
    const product = await this.getProduct(productId);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    if (product.stock < quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
    }
    
    return await this.addMovement({
      productId,
      type: 'salida',
      quantity,
      reason: reason || 'Salida de inventario',
      userId
    });
  }

  /**
   * Ajustar stock
   */
  async adjustStock(productId: number, newStock: number, reason: string, userId: string): Promise<number> {
    return await this.addMovement({
      productId,
      type: 'ajuste',
      quantity: newStock,
      reason: reason || 'Ajuste de inventario',
      userId
    });
  }

  // ===== MÉTODOS DE ESTADÍSTICAS =====

  /**
   * Obtener productos con stock bajo
   */
  async getLowStockProducts(): Promise<Product[]> {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.getLowStockProducts();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Obtener estadísticas
   */
  async getInventoryStats() {
    this.loadingSubject.next(true);
    try {
      return await this.databaseService.getStats();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Obtener categorías
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await this.databaseService.getCategories();
      return categories.map(cat => cat.name).sort();
    } catch (error) {
      console.error('Error al cargar categorías, usando fallback:', error);
      return this.inventoryCodeService.getAvailableCategories();
    }
  }

  /**
   * Poblar base de datos con datos de prueba de forma robusta
   */
  async populateTestData(): Promise<void> {
    try {
      console.log('🔧 Poblando base de datos con datos de prueba...');
      
      // Asegurar que la base de datos esté lista
      const isReady = await this.databaseService.isDatabaseReady();
      if (!isReady) {
        throw new Error('Base de datos no está lista');
      }
      
      // Cargar productos de ejemplo directamente
      await this.databaseService.loadSampleProducts();
      
      // Verificar que los productos se cargaron
      const products = await this.databaseService.getProducts();
      if (products.length === 0) {
        throw new Error('No se pudieron cargar los productos de ejemplo');
      }
      
      console.log(`✅ Datos de prueba poblados correctamente: ${products.length} productos`);
    } catch (error) {
      console.error('❌ Error al poblar datos de prueba:', error);
      
      // Intentar método de recuperación alternativo
      try {
        await this.databaseService.checkAndReinitializeData();
        console.log('✅ Recuperación alternativa exitosa');
      } catch (recoveryError) {
        console.error('❌ Recuperación alternativa falló:', recoveryError);
        throw error;
      }
    }
  }
}