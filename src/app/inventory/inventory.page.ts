import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { AddProductModalComponent } from './add-product-modal/add-product-modal.component';
import { ProductDetailModalComponent } from './product-detail-modal/product-detail-modal.component';
import { DatabaseService } from '../shared/services/database.service';
import { InventoryCodeService } from '../shared/services/inventory-code.service';

interface Product {
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
  status?: string;
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: false
})
export class InventoryPage implements OnInit, OnDestroy {

  productForm!: FormGroup;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  isLoading = false;
  isCreatingProduct = false;
  
  // Filtros
  searchTerm: string = '';
  selectedCategory: string = 'all';
  
  // Array para mensajes de diagnóstico
  diagnosticMessages: Array<{type: 'error' | 'success' | 'info', text: string}> = [];
  showDiagnostics: boolean = true;


  constructor(
    private formBuilder: FormBuilder,
    private databaseService: DatabaseService,
    private inventoryCodeService: InventoryCodeService,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController
  ) {
    this.createProductForm();
  }

  async ngOnInit() {
    // Cargar categorías básicas
    this.categories = ['General', 'Electrónicos', 'Alimentación', 'Ropa', 'Hogar', 'Deportes'];
    
    // Cargar productos automáticamente
    await this.loadProductsDirect();
    
    // Iniciar auto-actualización cada 30 segundos
    this.initAutoRefresh();
  }

  ngOnDestroy() {
    // Limpiar el intervalo cuando se destruya el componente
    this.stopAutoRefresh();
  }

  createProductForm() {
    this.productForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: ['General', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      stock: [0, [Validators.required, Validators.min(0)]],
      minStock: [1, [Validators.required, Validators.min(0)]],
      brand: [''],
      description: ['']
    });
  }

  async loadCategories() {
    this.categories = this.inventoryCodeService.getAvailableCategories();
  }

  async loadProducts() {
    this.isLoading = true;
    try {
      await this.databaseService.isDatabaseReady();
      this.products = await this.databaseService.getProducts();
      this.updateFilters();
    } catch (error) {
      console.error('Error al cargar productos:', error);
      this.showToast('Error al cargar productos', 'danger');
      this.filteredProducts = [];
    } finally {
      this.isLoading = false;
    }
  }

  async saveProduct() {
    if (this.productForm.valid) {
      this.isCreatingProduct = true;
      
      try {
        // Verificar con timeout para evitar colgarse
        const dbReady = await Promise.race([
          this.databaseService.isDatabaseReady(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout en verificación DB')), 5000)
          )
        ]) as boolean;
        
        if (!dbReady) {
          await Promise.race([
            this.databaseService.initializeDatabase(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout en inicialización')), 8000)
            )
          ]);
        }
        
        const formValue = this.productForm.value;
        console.log('📝 Datos del formulario:', formValue);
        
        // Generar códigos automáticamente
        console.log('🔢 Generando códigos automáticos...');
        const existingSKUs = await this.databaseService.getAllSKUs();
        const existingBarcodes = await this.databaseService.getAllBarcodes();
        
        console.log('📋 SKUs existentes:', existingSKUs);
        console.log('📋 Códigos de barras existentes:', existingBarcodes);
        
        // Usar el nuevo formato: CATEGORÍA-MARCA-NÚMERO
        const sku = this.inventoryCodeService.generateCustomSKU(
          formValue.category, 
          formValue.brand || 'Generic', 
          existingSKUs
        );
        const barcode = this.inventoryCodeService.generateAlternativeBarcode(existingBarcodes);
        
        console.log('🆔 SKU generado:', sku);
        console.log('🏷️ Código de barras generado:', barcode);
        console.log('📝 Categoría:', formValue.category);
        console.log('🏢 Marca:', formValue.brand || 'Generic');
        
        const productData: Omit<Product, 'id'> = {
          name: formValue.name,
          sku: sku,
          barcode: barcode,
          category: formValue.category,
          stock: Number(formValue.stock),
          minStock: Number(formValue.minStock),
          price: Number(formValue.price),
          description: formValue.description || '',
          brand: formValue.brand || '',
          status: 'active'
        };

        console.log('📦 Datos del producto a guardar:', productData);
        
        const productId = await this.databaseService.addProduct(productData);
        console.log('✅ Producto guardado con ID:', productId);
        
        this.showToast(`Producto creado exitosamente (ID: ${productId})`, 'success');
        this.productForm.reset({
          category: 'General',
          stock: 0,
          minStock: 1,
          price: 0
        });
        
        await this.loadProducts();
        
      } catch (error) {
        console.error('❌ ERROR DETALLADO al crear producto:', error);
        console.error('❌ Stack trace:', (error as Error).stack);
        this.showToast(`Error: ${(error as Error).message}`, 'danger');
      } finally {
        this.isCreatingProduct = false;
      }
    } else {
      console.log('⚠️ Formulario inválido:', this.productForm.errors);
      this.showToast('Por favor completa todos los campos requeridos', 'warning');
    }
  }

  // Método de diagnóstico para verificar la base de datos
  async testDatabaseConnection() {
    this.diagnosticMessages = []; // Limpiar mensajes previos
    this.addDiagnosticMessage('info', '🔍 Iniciando diagnóstico SQLite...');
    
    try {
      // Paso 1: Verificar si el servicio existe
      this.addDiagnosticMessage('info', '1. Verificando servicio de base de datos...');
      if (!this.databaseService) {
        this.addDiagnosticMessage('error', '❌ Servicio de base de datos no disponible');
        return;
      }
      this.addDiagnosticMessage('success', '✅ Servicio disponible');
      
      // Paso 2: Verificar con timeout
      this.addDiagnosticMessage('info', '2. Verificando base de datos (con timeout)...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout: Base de datos no responde en 10 segundos')), 10000);
      });
      
      const dbReadyPromise = this.databaseService.isDatabaseReady();
      
      const isReady = await Promise.race([dbReadyPromise, timeoutPromise]) as boolean;
      
      if (isReady) {
        this.addDiagnosticMessage('success', '✅ Base de datos respondió y está lista');
        
        // Paso 3: Probar operación simple
        this.addDiagnosticMessage('info', '3. Probando operación básica...');
        try {
          const dbInfo = await Promise.race([
            this.databaseService.getDatabaseInfo(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout en getDatabaseInfo')), 5000))
          ]) as any;
          this.addDiagnosticMessage('success', `📊 Info obtenida: ${dbInfo.tableCount} tablas`);
        } catch (infoError: any) {
          this.addDiagnosticMessage('error', `❌ Error en info: ${infoError.message}`);
        }
        
        // Paso 4: Probar consulta de productos
        this.addDiagnosticMessage('info', '4. Probando consulta productos...');
        try {
          const products = await Promise.race([
            this.databaseService.getProducts(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout en getProducts')), 5000))
          ]) as any;
          this.addDiagnosticMessage('success', `📦 ${products.length} productos encontrados`);
        } catch (productsError: any) {
          this.addDiagnosticMessage('error', `❌ Error en productos: ${productsError.message}`);
        }
        
        this.addDiagnosticMessage('success', '🎉 Diagnóstico completado');
        this.showToast('Diagnóstico completado - ver mensajes', 'success');
        
      } else {
        this.addDiagnosticMessage('error', '❌ Base de datos NO está lista');
        this.showToast('Base de datos no lista', 'danger');
      }
      
    } catch (error: any) {
      console.error('❌ ERROR en diagnóstico:', error);
      this.addDiagnosticMessage('error', `❌ Error: ${error.message || 'Error desconocido'}`);
      
      if (error.message?.includes('Timeout')) {
        this.addDiagnosticMessage('error', '⏰ La base de datos no responde - posible problema de inicialización');
      }
      
      if (error.message?.includes('executesql')) {
        this.addDiagnosticMessage('error', '💡 SQLite no disponible en navegador web');
        this.addDiagnosticMessage('info', '📱 Necesitas probar en dispositivo móvil');
      }
      
      this.showToast(`Error: ${error.message}`, 'danger');
    }
  }
  
  // Método auxiliar para agregar mensajes de diagnóstico
  private addDiagnosticMessage(type: 'error' | 'success' | 'info', text: string) {
    // Solo registrar en consola, no mostrar en UI
    console.log(text);
  }
  

  // Método alternativo para inicializar SQLite de forma más simple
  async initializeSimpleDatabase() {
    try {
      // Verificar si el plugin SQLite está disponible
      if (!(window as any).sqlitePlugin) {
        return false;
      }
      
      // Crear base de datos directamente con el plugin
      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });
      
      if (!db) {
        return false;
      }
      
      // Crear tabla simple con todas las columnas necesarias
      await new Promise((resolve, reject) => {
        db.executeSql(`
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
            status TEXT DEFAULT 'active',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, [], resolve, reject);
      });
      
      // Probar inserción simple
      await new Promise((resolve, reject) => {
        db.executeSql(`
          INSERT OR IGNORE INTO products (name, sku, barcode, category, stock, price, description)
          VALUES ('Producto Test', 'TEST001', '1234567890', 'Test', 10, 9.99, 'Producto de prueba')
        `, [], resolve, reject);
      });
      
      // Probar consulta
      const result = await new Promise((resolve, reject) => {
        db.executeSql('SELECT COUNT(*) as count FROM products', [], resolve, reject);
      });
      
      return true;
      
    } catch (error: any) {
      console.error('Error inicializando SQLite:', error);
      return false;
    }
  }

  // Método para guardar producto directamente con SQLite nativo
  async saveProductDirect() {
    if (!this.productForm.valid) {
      this.showToast('Formulario inválido', 'warning');
      return;
    }
    
    this.isCreatingProduct = true;
    
    try {
      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });
      
      const formValue = this.productForm.value;
      
      // Generar SKU con el nuevo formato
      const existingSKUs = await this.getExistingSKUsDirect(db);
      const sku = this.inventoryCodeService.generateCustomSKU(
        formValue.category,
        formValue.brand || 'Generic',
        existingSKUs
      );
      const barcode = this.inventoryCodeService.generateAlternativeBarcode([]);
      
      console.log('🆔 SKU generado (direct):', sku);
      console.log('🏷️ Código de barras generado (direct):', barcode);
      console.log('📝 Categoría (direct):', formValue.category);
      console.log('🏢 Marca (direct):', formValue.brand || 'Generic');
      
      await new Promise((resolve, reject) => {
        db.executeSql(`
          INSERT INTO products (name, sku, barcode, category, stock, minStock, price, description, brand, status, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          formValue.name,
          sku,
          barcode,
          formValue.category,
          parseInt(formValue.stock) || 0,
          parseInt(formValue.minStock) || 1,
          parseFloat(formValue.price) || 0,
          formValue.description || '',
          formValue.brand || '',
          'active',
          new Date().toISOString()
        ], resolve, reject);
      });
      
      this.showToast('Producto guardado exitosamente', 'success');
      this.productForm.reset();
      
      // Recargar productos después de guardar
      await this.loadProductsDirect();
      
    } catch (error: any) {
      console.error('Error guardando producto:', error);
      this.showToast('Error al guardar producto', 'danger');
    } finally {
      this.isCreatingProduct = false;
    }
  }

  // Método auxiliar para obtener SKUs existentes desde SQLite directo
  private async getExistingSKUsDirect(db: any): Promise<string[]> {
    try {
      const result = await new Promise((resolve, reject) => {
        db.executeSql('SELECT sku FROM products', [], resolve, reject);
      });
      
      const skus: string[] = [];
      const resultSet = result as any;
      
      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        skus.push(row.sku);
      }
      
      return skus;
    } catch (error) {
      console.error('Error obteniendo SKUs existentes:', error);
      return [];
    }
  }

  // Método alternativo para cargar productos directamente desde SQLite nativo
  async loadProductsDirect() {
    this.isLoading = true;
    
    try {
      // Verificar si sqlitePlugin está disponible
      if (!(window as any).sqlitePlugin) {
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
        return;
      }
      
      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });
      
      // Consultar productos
      const result = await new Promise((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM products ORDER BY createdAt DESC',
          [],
          resolve,
          reject
        );
      });
      
      // Convertir resultado a array
      const products: Product[] = [];
      const resultSet = result as any;
      
      for (let i = 0; i < resultSet.rows.length; i++) {
        const row = resultSet.rows.item(i);
        products.push({
          id: row.id,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category: row.category,
          stock: row.stock,
          minStock: row.minStock || 0,
          price: row.price,
          description: row.description,
          brand: row.brand,
          image: row.image,
          status: row.status || 'active'
        });
      }
      
      this.products = products;
      // Actualizar filtros después de cargar productos
      this.updateFilters();
      
    } catch (error: any) {
      console.error('Error cargando productos:', error);
      this.products = [];
      this.filteredProducts = [];
    } finally {
      this.isLoading = false;
    }
  }

  async deleteProduct(product: Product) {
    if (!product || !product.id) {
      this.showToast('Error: Producto no válido', 'danger');
      return;
    }

    try {
      // Crear el alert de confirmación
      const alert = await this.alertController.create({
        header: 'Confirmar Eliminación',
        message: `¿Estás seguro de que quieres eliminar el producto "${product.name}"?\n\nEsta acción no se puede deshacer.`,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            cssClass: 'secondary',
            handler: () => {
              console.log('Eliminación cancelada');
            }
          },
          {
            text: 'Eliminar',
            cssClass: 'danger',
            handler: async () => {
              await this.confirmDeleteProduct(product.id!);
            }
          }
        ]
      });

      await alert.present();
    } catch (error) {
      console.error('Error al mostrar confirmación:', error);
      this.showToast('Error al mostrar confirmación', 'danger');
    }
  }

  private async confirmDeleteProduct(id: number) {
    this.isLoading = true;
    
    try {
      // Eliminar de SQLite directamente
      if ((window as any).sqlitePlugin) {
        const db = (window as any).sqlitePlugin.openDatabase({
          name: 'scanshelf.db',
          location: 'default'
        });

        await new Promise((resolve, reject) => {
          db.executeSql(
            'DELETE FROM products WHERE id = ?',
            [id],
            resolve,
            reject
          );
        });

        this.showToast('Producto eliminado exitosamente', 'success');
        await this.loadProductsDirect();
      } else {
        // Fallback al servicio de base de datos
        await this.databaseService.deleteProduct(id);
        this.showToast('Producto eliminado', 'success');
        await this.loadProducts();
      }
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      this.showToast('No se pudo eliminar el producto', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  getStatusColor(product: Product): string {
    if (product.stock === 0) return 'danger';
    if (product.stock <= product.minStock) return 'warning';
    return 'success';
  }

  getStatusText(product: Product): string {
    if (product.stock === 0) return 'Agotado';
    if (product.stock <= product.minStock) return 'Stock Bajo';
    return 'Disponible';
  }



  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  async refresh(event: any) {
    await this.loadProducts();
    event.target.complete();
  }

  // Métodos para la nueva UI con modal
  async openAddProductModal() {
    const modal = await this.modalController.create({
      component: AddProductModalComponent
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.productAdded) {
        // Recargar productos después de agregar uno nuevo
        await this.loadProductsDirect();
        this.showToast('Producto agregado exitosamente', 'success');
      }
    });

    return await modal.present();
  }

  getTotalStock(): number {
    return this.products.reduce((total, product) => total + product.stock, 0);
  }

  getUniqueCategories(): number {
    const uniqueCategories = new Set(this.products.map(product => product.category));
    return uniqueCategories.size;
  }

  getUniqueCategoriesArray(): string[] {
    const uniqueCategories = new Set(this.products.map(product => product.category));
    return Array.from(uniqueCategories).sort();
  }

  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'General': 'medium',
      'Electrónicos': 'primary',
      'Alimentación': 'secondary',
      'Ropa': 'tertiary',
      'Hogar': 'success',
      'Deportes': 'warning',
      'Salud': 'danger',
      'Belleza': 'light',
      'Libros': 'dark'
    };
    return colors[category] || 'medium';
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'General': 'cube-outline',
      'Electrónicos': 'phone-portrait-outline',
      'Alimentación': 'restaurant-outline',
      'Ropa': 'shirt-outline',
      'Hogar': 'home-outline',
      'Deportes': 'football-outline',
      'Salud': 'medical-outline',
      'Belleza': 'rose-outline',
      'Libros': 'book-outline'
    };
    return icons[category] || 'cube-outline';
  }

  // Métodos para el sistema de estadísticas del summary
  getLowStockCount(): number {
    return this.products.filter(product => 
      product.stock > 0 && product.stock <= product.minStock
    ).length;
  }

  getOutOfStockCount(): number {
    return this.products.filter(product => product.stock === 0).length;
  }

  getTotalValue(): number {
    return this.products.reduce((total, product) => 
      total + (product.price * product.stock), 0
    );
  }

  // Método para obtener el estado del stock para la UI
  getStockStatus(product: Product): 'in-stock' | 'low-stock' | 'out-of-stock' {
    if (product.stock === 0) return 'out-of-stock';
    if (product.stock <= product.minStock) return 'low-stock';
    return 'in-stock';
  }

  // Sistema de actualización automática
  private refreshInterval: any;
  private readonly AUTO_REFRESH_INTERVAL = 30000; // 30 segundos

  initAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      this.loadProductsDirect();
    }, this.AUTO_REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Método para refrescar manualmente
  async refreshInventory() {
    await this.loadProductsDirect();
    this.showToast('Inventario actualizado', 'success');
  }

  // Métodos de filtrado
  filterProducts() {
    let filtered = [...this.products];

    // Filtrar por término de búsqueda
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.barcode.includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filtrar por categoría
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === this.selectedCategory);
    }

    this.filteredProducts = filtered;
  }

  // Actualizar filtros cuando se cargan productos
  private updateFilters() {
    this.filterProducts();
  }

  getStockColor(stock: number): string {
    if (stock === 0) return 'danger';
    if (stock < 10) return 'warning';
    return 'success';
  }

  editProduct(product: Product, index: number) {
    // Implementar edición de producto
    console.log('Editando producto:', product);
    this.showToast('Función de edición próximamente', 'tertiary');
  }

  async viewProductDetails(product: Product) {
    const modal = await this.modalController.create({
      component: ProductDetailModalComponent,
      componentProps: {
        product: product
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        if (result.data.action === 'edit') {
          // Abrir modal de edición con los datos del producto
          await this.openEditProductModal(product);
        } else if (result.data.action === 'delete') {
          // Confirmar y eliminar producto
          await this.deleteProduct(product);
        }
      }
    });

    return await modal.present();
  }

  async openEditProductModal(product: Product) {
    const modal = await this.modalController.create({
      component: AddProductModalComponent,
      componentProps: {
        editMode: true,
        product: product
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.productUpdated) {
        await this.loadProductsDirect();
        this.showToast('Producto actualizado exitosamente', 'success');
      }
    });

    return await modal.present();
  }
}
