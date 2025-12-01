import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController, ActionSheetController, LoadingController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { UpcDatabaseService } from '../../shared/services/upc-database.service';
import { InventoryCodeService } from '../../shared/services/inventory-code.service';

@Component({
  selector: 'app-add-product-modal',
  templateUrl: './add-product-modal.component.html',
  styleUrls: ['./add-product-modal.component.scss'],
  standalone: false
})
export class AddProductModalComponent implements OnInit {

  @Input() barcode?: string; // Código de barras pre-rellenado desde scanner

  productForm!: FormGroup;
  categories: string[] = ['General', 'Electrónicos', 'Alimentación', 'Ropa', 'Hogar', 'Deportes'];
  isLoading = false;
  statusMessage: {type: 'success' | 'primary' | 'warning', text: string} | null = null;
  productImage: string | null = null;
  isScanning = false;

  constructor(
    private formBuilder: FormBuilder,
    private modalController: ModalController,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController,
    private upcDatabaseService: UpcDatabaseService,
    private inventoryCodeService: InventoryCodeService
  ) {
    this.createProductForm();
  }

  ngOnInit() {
    // Si hay un código de barras desde el scanner, pre-rellenarlo y buscar info
    if (this.barcode) {
      this.productForm.patchValue({ barcode: this.barcode });
      this.searchProductInfo(this.barcode);
    }
  }

  createProductForm() {
    this.productForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      category: ['General', [Validators.required]],
      stock: [0, [Validators.required, Validators.min(0)]],
      minStock: [1, [Validators.required, Validators.min(0)]],
      price: [0, [Validators.required, Validators.min(0)]],
      description: [''],
      brand: [''],
      barcode: ['']
    });
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  /**
   * Guardar nuevo producto en la base de datos
   */
  async saveProduct() {
    if (!this.productForm.valid) {
      this.setStatusMessage('warning', 'Por favor completa todos los campos requeridos');
      return;
    }

    this.isLoading = true;
    this.setStatusMessage('primary', 'Guardando producto...');

    try {
      // Verificar disponibilidad del plugin SQLite
      if (!(window as any).sqlitePlugin) {
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      const formValue = this.productForm.value;
      
      // Obtener códigos existentes para evitar duplicados
      const existingSKUs = await this.getExistingSKUs(db);
      const existingBarcodes = await this.getExistingBarcodes(db);
      
      // Generar SKU con formato: CATEGORÍA-MARCA-NÚMERO (ej: ELE-SAM-001)
      const sku = this.inventoryCodeService.generateCustomSKU(
        formValue.category,
        formValue.brand || 'Generic',
        existingSKUs
      );
      
      // Generar código de barras si no se escaneó uno
      const barcode = formValue.barcode || this.inventoryCodeService.generateAlternativeBarcode(existingBarcodes);
      
      console.log('🆔 SKU generado (modal):', sku);
      console.log('🏷️ Código de barras (modal):', barcode);
      console.log('📝 Categoría (modal):', formValue.category);
      console.log('🏢 Marca (modal):', formValue.brand || 'Generic');

      await new Promise((resolve, reject) => {
        db.executeSql(`
          INSERT INTO products (name, sku, barcode, category, stock, minStock, price, description, brand, image, createdAt)
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
          this.productImage || '',
          new Date().toISOString()
        ], resolve, reject);
      });

      this.setStatusMessage('success', `Producto guardado: ${formValue.name}`);
      await this.showToast('Producto guardado exitosamente', 'success');
      
      // Cerrar modal y notificar éxito
      await this.modalController.dismiss({ productAdded: true, product: formValue });

    } catch (error: any) {
      this.setStatusMessage('warning', `Error: ${error.message}`);
      await this.showToast('Error al guardar producto', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async selectImageSource() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Seleccionar imagen',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.takePicture(CameraSource.Camera);
          }
        },
        {
          text: 'Seleccionar de galería',
          icon: 'images',
          handler: () => {
            this.takePicture(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async takePicture(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });

      this.productImage = image.dataUrl || null;
      await this.showToast('Imagen agregada correctamente', 'success');
    } catch (error) {
      console.error('Error al capturar imagen:', error);
      await this.showToast('Error al capturar imagen', 'danger');
    }
  }

  removeImage() {
    this.productImage = null;
  }

  /**
   * Escanear código de barras con la cámara del dispositivo
   */
  async scanBarcode() {
    try {
      // Solicitar permisos de cámara
      const status = await BarcodeScanner.checkPermission({ force: true });
      
      if (!status.granted) {
        await this.showToast('Permiso de cámara denegado', 'danger');
        return;
      }

      this.isScanning = true;
      
      // Ocultar UI de la app para mostrar vista de cámara
      document.body.classList.add('scanner-active');
      
      // Iniciar escaneo de código de barras
      const result = await BarcodeScanner.startScan();
      
      // Restaurar UI de la app
      document.body.classList.remove('scanner-active');
      this.isScanning = false;

      if (result.hasContent) {
        this.productForm.patchValue({
          barcode: result.content
        });
        await this.showToast(`Código escaneado: ${result.content}`, 'success');
        
        // Buscar información del producto en Open Food Facts
        await this.searchProductInfo(result.content);
      }
    } catch (error) {
      console.error('Error al escanear código:', error);
      document.body.classList.remove('scanner-active');
      this.isScanning = false;
      await this.showToast('Error al escanear código', 'danger');
    }
  }

  /**
   * Buscar información del producto en Open Food Facts API
   * Autocompleta el formulario si encuentra datos
   */
  async searchProductInfo(barcode: string) {
    const loading = await this.loadingController.create({
      message: 'Buscando información del producto...',
      spinner: 'crescent'
    });
    await loading.present();

    console.log('🔎 Buscando producto con código:', barcode);

    this.upcDatabaseService.searchByBarcode(barcode).subscribe({
      next: async (product) => {
        await loading.dismiss();

        if (product) {
          // Producto encontrado - autocompletar formulario con datos de la API
          console.log('✅ Producto encontrado en Open Food Facts');
          
          const name = this.upcDatabaseService.getProductName(product);
          const brand = product.brands || '';
          const category = this.upcDatabaseService.mapCategory(product.categories);
          const description = this.upcDatabaseService.getDescription(product);
          const imageUrl = this.upcDatabaseService.getBestImage(product);

          console.log('📝 Datos obtenidos:');
          console.log('   Nombre:', name);
          console.log('   Marca:', brand);
          console.log('   Categoría:', category);

          this.productForm.patchValue({
            name: name,
            brand: brand,
            category: category,
            description: description,
            price: 0 // Open Food Facts no incluye precios
          });

          // Descargar imagen del producto si está disponible
          if (imageUrl) {
            await this.downloadAndSetImage(imageUrl);
          }

          await this.showToast('✅ Información cargada. Ajusta precio y stock.', 'success');
        } else {
          // Producto no encontrado en la API
          console.log('⚠️ Producto no encontrado en Open Food Facts');
          await this.showToast(`Código ${barcode} no encontrado. Completa manualmente.`, 'warning');
        }
      },
      error: async (error) => {
        await loading.dismiss();
        console.error('❌ Modal: Error buscando producto:', error);
        await this.showToast('❌ Error de conexión con UPC Database. Verifica internet.', 'danger');
      }
    });
  }

  async downloadAndSetImage(imageUrl: string) {
    try {
      console.log('🖼️ Descargando imagen desde:', imageUrl);
      // Convertir URL de imagen a base64
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      console.log('📦 Blob recibido, tamaño:', blob.size, 'bytes');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        this.productImage = reader.result as string;
        console.log('✅ Imagen descargada y convertida a base64');
        console.log('📏 Tamaño base64:', this.productImage.length, 'caracteres');
      };
      reader.onerror = (error) => {
        console.error('❌ Error en FileReader:', error);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('❌ Error descargando imagen:', error);
      await this.showToast('⚠️ No se pudo descargar la imagen del producto', 'warning');
    }
  }

  /**
   * Obtener todos los SKUs existentes en la base de datos
   * Usado para evitar duplicados al generar nuevos SKUs
   */
  private async getExistingSKUs(db: any): Promise<string[]> {
    return new Promise((resolve, reject) => {
      db.executeSql(
        'SELECT sku FROM products',
        [],
        (resultSet: any) => {
          const skus: string[] = [];
          for (let i = 0; i < resultSet.rows.length; i++) {
            skus.push(resultSet.rows.item(i).sku);
          }
          resolve(skus);
        },
        (error: any) => {
          console.error('Error al obtener SKUs:', error);
          resolve([]); // En caso de error, devolver array vacío
        }
      );
    });
  }

  // Obtener códigos de barras existentes de la base de datos
  private async getExistingBarcodes(db: any): Promise<string[]> {
    return new Promise((resolve, reject) => {
      db.executeSql(
        'SELECT barcode FROM products',
        [],
        (resultSet: any) => {
          const barcodes: string[] = [];
          for (let i = 0; i < resultSet.rows.length; i++) {
            barcodes.push(resultSet.rows.item(i).barcode);
          }
          resolve(barcodes);
        },
        (error: any) => {
          console.error('Error al obtener códigos de barras:', error);
          resolve([]); // En caso de error, devolver array vacío
        }
      );
    });
  }

  stopScan() {
    BarcodeScanner.stopScan();
    document.body.classList.remove('scanner-active');
    this.isScanning = false;
  }

  private setStatusMessage(type: 'success' | 'primary' | 'warning', text: string) {
    this.statusMessage = { type, text };
    console.log(text);
    
    // Limpiar mensaje después de 3 segundos
    setTimeout(() => {
      this.statusMessage = null;
    }, 3000);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}