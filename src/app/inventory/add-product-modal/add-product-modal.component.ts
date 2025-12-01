import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, ToastController, ActionSheetController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

@Component({
  selector: 'app-add-product-modal',
  templateUrl: './add-product-modal.component.html',
  styleUrls: ['./add-product-modal.component.scss'],
  standalone: false
})
export class AddProductModalComponent implements OnInit {

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
    private actionSheetController: ActionSheetController
  ) {
    this.createProductForm();
  }

  ngOnInit() {}

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

  async saveProduct() {
    if (!this.productForm.valid) {
      this.setStatusMessage('warning', 'Por favor completa todos los campos requeridos');
      return;
    }

    this.isLoading = true;
    this.setStatusMessage('primary', 'Guardando producto...');

    try {
      // Verificar SQLite plugin
      if (!(window as any).sqlitePlugin) {
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      const formValue = this.productForm.value;
      const sku = `SKU${Date.now()}`;
      const barcode = formValue.barcode || `BAR${Date.now()}`;

      await new Promise((resolve, reject) => {
        db.executeSql(`
          INSERT INTO products (name, sku, barcode, category, stock, price, description, brand, image, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          formValue.name,
          sku,
          barcode,
          formValue.category,
          parseInt(formValue.stock) || 0,
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

  async scanBarcode() {
    try {
      // Verificar permisos
      const status = await BarcodeScanner.checkPermission({ force: true });
      
      if (!status.granted) {
        await this.showToast('Permiso de cámara denegado', 'danger');
        return;
      }

      this.isScanning = true;
      
      // Ocultar elementos de fondo
      document.body.classList.add('scanner-active');
      
      // Iniciar escaneo
      const result = await BarcodeScanner.startScan();
      
      // Mostrar elementos de fondo
      document.body.classList.remove('scanner-active');
      this.isScanning = false;

      if (result.hasContent) {
        this.productForm.patchValue({
          barcode: result.content
        });
        await this.showToast(`Código escaneado: ${result.content}`, 'success');
      }
    } catch (error) {
      console.error('Error al escanear código:', error);
      document.body.classList.remove('scanner-active');
      this.isScanning = false;
      await this.showToast('Error al escanear código', 'danger');
    }
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