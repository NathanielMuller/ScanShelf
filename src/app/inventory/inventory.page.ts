import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
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
export class InventoryPage implements OnInit {

  productForm!: FormGroup;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  isLoading = false;
  isCreatingProduct = false;
  
  // Filtros
  searchTerm: string = '';
  selectedCategory: string = 'all';


  constructor(
    private formBuilder: FormBuilder,
    private databaseService: DatabaseService,
    private inventoryCodeService: InventoryCodeService,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController,
    private router: Router
  ) {
    this.createProductForm();
  }

  async ngOnInit() {
    // Cargar categorías básicas
    this.categories = ['General', 'Electrónicos', 'Alimentación', 'Ropa', 'Hogar', 'Deportes'];
    
    // Cargar productos automáticamente
    await this.loadProductsDirect();
  }

  /**
   * Se ejecuta cada vez que la página se va a mostrar
   * Verifica si se viene del scanner con un código de barras
   */
  ionViewWillEnter() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || (history.state || {});
    
    // Si hay un código de barras en el estado, abrir modal de creación
    if (state['barcode']) {
      setTimeout(() => {
        this.openAddProductModal(state['barcode']);
      }, 300);
    }
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





  /**
   * Cargar productos directamente desde SQLite nativo
   * Este método se usa porque es más rápido y confiable que DatabaseService
   */
  async loadProductsDirect() {
    this.isLoading = true;
    
    try {
      // Verificar disponibilidad del plugin SQLite
      if (!(window as any).sqlitePlugin) {
        this.products = [];
        this.filteredProducts = [];
        this.isLoading = false;
        return;
      }
      
      // Abrir conexión a la base de datos
      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });
      
      // Consultar todos los productos ordenados por fecha de creación
      const result = await new Promise((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM products ORDER BY createdAt DESC',
          [],
          resolve,
          reject
        );
      });
      
      // Convertir resultado de SQLite a array de productos
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
      this.updateFilters();
      
    } catch (error: any) {
      console.error('❌ Error cargando productos:', error);
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

  /**
   * Abrir modal para agregar nuevo producto
   * @param barcode - Código de barras pre-rellenado (opcional, desde scanner)
   */
  async openAddProductModal(barcode?: string) {
    const modal = await this.modalController.create({
      component: AddProductModalComponent,
      componentProps: {
        barcode: barcode
      }
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

  /**
   * Obtener cantidad de productos con stock bajo
   */
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

  /**
   * Obtener estado del stock de un producto (para badges de color)
   */
  getStockStatus(product: Product): 'in-stock' | 'low-stock' | 'out-of-stock' {
    if (product.stock === 0) return 'out-of-stock';
    if (product.stock <= product.minStock) return 'low-stock';
    return 'in-stock';
  }

  /**
   * Refrescar inventario manualmente (pull-to-refresh)
   */
  async refreshInventory() {
    await this.loadProductsDirect();
    this.showToast('Inventario actualizado', 'success');
  }

  /**
   * Filtrar productos por término de búsqueda y categoría
   */
  filterProducts() {
    let filtered = [...this.products];

    // Aplicar filtro de búsqueda
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.barcode.includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      );
    }

    // Aplicar filtro de categoría
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === this.selectedCategory);
    }

    this.filteredProducts = filtered;
  }

  /**
   * Actualizar filtros después de cargar productos
   */
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
        } else if (result.data.action === 'update') {
          // Stock actualizado, recargar productos
          await this.loadProductsDirect();
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
