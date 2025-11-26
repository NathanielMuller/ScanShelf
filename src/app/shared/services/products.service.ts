import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseService, Product, Movement } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$: Observable<Product[]> = this.productsSubject.asObservable();

  private movementsSubject = new BehaviorSubject<Movement[]>([]);
  public movements$: Observable<Movement[]> = this.movementsSubject.asObservable();

  constructor(private databaseService: DatabaseService) {
    this.loadProducts();
    this.loadMovements();
  }

  // =====================================================
  // MÉTODOS PARA PRODUCTOS
  // =====================================================

  /**
   * Cargar todos los productos desde la base de datos
   */
  async loadProducts(): Promise<void> {
    try {
      const products = await this.databaseService.getProducts();
      this.productsSubject.next(products);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  }

  /**
   * Obtener todos los productos (Observable)
   */
  getProducts(): Observable<Product[]> {
    return this.products$;
  }

  /**
   * Obtener todos los productos (Promesa)
   */
  async getProductsAsync(): Promise<Product[]> {
    return await this.databaseService.getProducts();
  }

  /**
   * Obtener un producto por ID
   */
  async getProduct(id: number): Promise<Product | null> {
    return await this.databaseService.getProductById(id);
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    return await this.databaseService.getProductByBarcode(barcode);
  }

  /**
   * Agregar un nuevo producto
   */
  async addProduct(productData: Omit<Product, 'id'>): Promise<number> {
    try {
      const id = await this.databaseService.addProduct(productData);
      await this.loadProducts(); // Recargar la lista
      return id;
    } catch (error) {
      console.error('Error al agregar producto:', error);
      throw error;
    }
  }

  /**
   * Actualizar un producto existente
   */
  async updateProduct(id: number, productData: Partial<Product>): Promise<boolean> {
    try {
      const success = await this.databaseService.updateProduct(id, productData);
      if (success) {
        await this.loadProducts(); // Recargar la lista
      }
      return success;
    } catch (error) {
      console.error('Error al actualizar producto:', error);
      return false;
    }
  }

  /**
   * Eliminar un producto
   */
  async deleteProduct(id: number): Promise<boolean> {
    try {
      const success = await this.databaseService.deleteProduct(id);
      if (success) {
        await this.loadProducts(); // Recargar la lista
      }
      return success;
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      return false;
    }
  }

  // =====================================================
  // MÉTODOS PARA MOVIMIENTOS
  // =====================================================

  /**
   * Cargar todos los movimientos desde la base de datos
   */
  async loadMovements(): Promise<void> {
    try {
      const movements = await this.databaseService.getMovements();
      this.movementsSubject.next(movements);
    } catch (error) {
      console.error('Error al cargar movimientos:', error);
    }
  }

  /**
   * Obtener todos los movimientos (Observable)
   */
  getMovements(): Observable<Movement[]> {
    return this.movements$;
  }

  /**
   * Obtener todos los movimientos (Promesa)
   */
  async getMovementsAsync(): Promise<Movement[]> {
    return await this.databaseService.getMovements();
  }

  /**
   * Agregar un nuevo movimiento de inventario
   */
  async addMovement(movementData: Omit<Movement, 'id'>): Promise<number> {
    try {
      const id = await this.databaseService.addMovement(movementData);
      await this.loadMovements(); // Recargar movimientos
      await this.loadProducts();  // Recargar productos (por el cambio de stock)
      return id;
    } catch (error) {
      console.error('Error al agregar movimiento:', error);
      throw error;
    }
  }

  /**
   * Registrar entrada de productos
   */
  async registerEntry(productId: number, quantity: number, reason: string, userId: string): Promise<number> {
    return await this.addMovement({
      productId,
      type: 'entrada',
      quantity,
      reason,
      userId
    });
  }

  /**
   * Registrar salida de productos
   */
  async registerExit(productId: number, quantity: number, reason: string, userId: string): Promise<number> {
    return await this.addMovement({
      productId,
      type: 'salida',
      quantity,
      reason,
      userId
    });
  }

  /**
   * Ajustar stock de un producto
   */
  async adjustStock(productId: number, newStock: number, reason: string, userId: string): Promise<number> {
    return await this.addMovement({
      productId,
      type: 'ajuste',
      quantity: newStock,
      reason,
      userId
    });
  }

  // =====================================================
  // MÉTODOS DE BÚSQUEDA Y FILTROS
  // =====================================================

  /**
   * Buscar productos por nombre o código de barras
   */
  async searchProducts(query: string): Promise<Product[]> {
    const allProducts = await this.getProductsAsync();
    
    if (!query.trim()) {
      return allProducts;
    }

    const searchTerm = query.toLowerCase();
    
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      product.barcode.toLowerCase().includes(searchTerm) ||
      product.category.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Filtrar productos por categoría
   */
  async filterByCategory(category: string): Promise<Product[]> {
    const allProducts = await this.getProductsAsync();
    
    if (!category || category === 'all') {
      return allProducts;
    }

    return allProducts.filter(product => product.category === category);
  }

  /**
   * Obtener productos con stock bajo
   */
  async getLowStockProducts(): Promise<Product[]> {
    return await this.databaseService.getLowStockProducts();
  }

  /**
   * Obtener categorías únicas de productos
   */
  async getCategories(): Promise<string[]> {
    const products = await this.getProductsAsync();
    const categories = [...new Set(products.map(p => p.category))];
    return categories.sort();
  }

  // =====================================================
  // MÉTODOS DE ESTADÍSTICAS
  // =====================================================

  /**
   * Obtener estadísticas del inventario
   */
  async getInventoryStats(): Promise<{
    totalProducts: number;
    lowStockProducts: number;
    totalMovements: number;
    totalValue: number;
    categoriesCount: number;
  }> {
    const stats = await this.databaseService.getStats();
    const categories = await this.getCategories();
    
    return {
      ...stats,
      categoriesCount: categories.length
    };
  }

  /**
   * Obtener productos más movidos (últimos 30 días)
   */
  async getMostMovedProducts(limit: number = 10): Promise<Array<{
    product: Product;
    totalMovements: number;
  }>> {
    const products = await this.getProductsAsync();
    const movements = await this.getMovementsAsync();
    
    // Calcular movimientos por producto en los últimos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const productMovements = products.map(product => {
      const productMovementCount = movements.filter(movement => 
        movement.productId === product.id &&
        new Date(movement.createdAt || '') >= thirtyDaysAgo
      ).length;
      
      return {
        product,
        totalMovements: productMovementCount
      };
    });
    
    return productMovements
      .sort((a, b) => b.totalMovements - a.totalMovements)
      .slice(0, limit);
  }

  // =====================================================
  // MÉTODOS DE VALIDACIÓN
  // =====================================================

  /**
   * Validar que un código de barras no exista
   */
  async isBarcodeUnique(barcode: string, excludeId?: number): Promise<boolean> {
    const product = await this.getProductByBarcode(barcode);
    
    if (!product) {
      return true; // No existe, es único
    }
    
    if (excludeId && product.id === excludeId) {
      return true; // Es el mismo producto que estamos editando
    }
    
    return false; // Ya existe otro producto con este código
  }

  /**
   * Validar datos del producto antes de guardar
   */
  validateProduct(product: Partial<Product>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!product.name || product.name.trim().length < 2) {
      errors.push('El nombre debe tener al menos 2 caracteres');
    }
    
    if (!product.barcode || product.barcode.trim().length < 3) {
      errors.push('El código de barras debe tener al menos 3 caracteres');
    }
    
    if (!product.category || product.category.trim().length === 0) {
      errors.push('La categoría es requerida');
    }
    
    if (product.stock !== undefined && product.stock < 0) {
      errors.push('El stock no puede ser negativo');
    }
    
    if (product.minStock !== undefined && product.minStock < 0) {
      errors.push('El stock mínimo no puede ser negativo');
    }
    
    if (product.price !== undefined && product.price < 0) {
      errors.push('El precio no puede ser negativo');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}