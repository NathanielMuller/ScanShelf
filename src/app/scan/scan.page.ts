import { Component, OnInit, OnDestroy } from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { ModalController, ToastController } from '@ionic/angular';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { ScanProductDetailModalComponent } from './scan-product-detail-modal/scan-product-detail-modal.component';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('pulse', [
      transition('* => *', [
        animate('2s ease-in-out', style({ transform: 'scale(1.05)' })),
        animate('2s ease-in-out', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class ScanPage implements OnInit, OnDestroy {
  isScanning = false;
  scannedCode: string = '';

  constructor(
    private modalController: ModalController,
    private toastController: ToastController
  ) { }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.stopScan();
  }

  async startScan() {
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
        this.scannedCode = result.content;
        await this.showToast(`Código escaneado: ${result.content}`, 'success');
        
        // Buscar producto por barcode o SKU
        await this.searchProduct(result.content);
      }
    } catch (error) {
      console.error('Error al escanear código:', error);
      document.body.classList.remove('scanner-active');
      this.isScanning = false;
      await this.showToast('Error al escanear código', 'danger');
    }
  }

  stopScan() {
    if (this.isScanning) {
      BarcodeScanner.stopScan();
      document.body.classList.remove('scanner-active');
      this.isScanning = false;
    }
  }

  async searchProduct(code: string) {
    try {
      // Verificar SQLite plugin
      if (!(window as any).sqlitePlugin) {
        await this.showToast('Base de datos no disponible', 'warning');
        return;
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      // Buscar producto por barcode o SKU
      const result = await new Promise((resolve, reject) => {
        db.executeSql(
          'SELECT * FROM products WHERE barcode = ? OR sku = ? LIMIT 1',
          [code, code],
          resolve,
          reject
        );
      });

      const resultSet = result as any;
      
      if (resultSet.rows.length > 0) {
        const row = resultSet.rows.item(0);
        const product = {
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
        };

        // Mostrar modal con detalles del producto
        await this.showProductDetails(product);
      } else {
        // Producto no encontrado - mostrar modal para crear
        await this.showProductNotFoundModal(code);
      }
    } catch (error) {
      console.error('Error buscando producto:', error);
      await this.showToast('Error al buscar producto', 'danger');
    }
  }

  /**
   * Mostrar modal cuando el producto no existe
   * Ofrece la opción de crear un nuevo producto
   */
  async showProductNotFoundModal(code: string) {
    const modal = await this.modalController.create({
      component: ScanProductDetailModalComponent,
      componentProps: {
        product: null,
        scannedCode: code
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data && result.data.action === 'create') {
        // Navegar a la página de inventario para crear producto
        // Por ahora mostrar mensaje
        await this.showToast('Redirigiendo a crear producto...', 'primary');
      }
    });

    return await modal.present();
  }

  async showProductDetails(product: any) {
    const modal = await this.modalController.create({
      component: ScanProductDetailModalComponent,
      componentProps: {
        product: product
      }
    });

    return await modal.present();
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
