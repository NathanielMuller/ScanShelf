import { Component, Input, OnInit } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';

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
  selector: 'app-scan-product-detail-modal',
  templateUrl: './scan-product-detail-modal.component.html',
  styleUrls: ['./scan-product-detail-modal.component.scss'],
  standalone: false
})
export class ScanProductDetailModalComponent implements OnInit {
  @Input() product!: Product | null;
  @Input() scannedCode?: string;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('Producto escaneado:', this.product);
    console.log('Código escaneado:', this.scannedCode);
  }

  dismiss() {
    this.modalController.dismiss();
  }

  getStockStatus(): string {
    if (!this.product) return 'Desconocido';
    
    if (this.product.stock === 0) {
      return 'Sin stock';
    } else if (this.product.stock <= this.product.minStock) {
      return 'Stock bajo';
    } else if (this.product.stock <= this.product.minStock * 2) {
      return 'Stock medio';
    } else {
      return 'Stock alto';
    }
  }

  getStockColor(): string {
    if (!this.product) return 'medium';
    
    if (this.product.stock === 0) {
      return 'danger';
    } else if (this.product.stock <= this.product.minStock) {
      return 'warning';
    } else if (this.product.stock <= this.product.minStock * 2) {
      return 'primary';
    } else {
      return 'success';
    }
  }

  /**
   * Mostrar diálogo para añadir stock al producto
   */
  async addStock() {
    const alert = await this.alertController.create({
      header: 'Añadir Stock',
      message: `Stock actual: ${this.product?.stock} unidades`,
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          placeholder: 'Cantidad a añadir',
          min: 1,
          value: 1
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Añadir',
          handler: async (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity > 0) {
              await this.updateStock(quantity);
            } else {
              await this.showToast('Cantidad inválida', 'warning');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Mostrar diálogo para reducir stock (registrar salida)
   */
  async reduceStock() {
    const alert = await this.alertController.create({
      header: 'Registrar Salida',
      message: `Stock actual: ${this.product?.stock} unidades`,
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          placeholder: 'Cantidad de salida',
          min: 1,
          value: 1
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Registrar',
          handler: async (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity > 0) {
              if (this.product && quantity > this.product.stock) {
                await this.showToast('No hay suficiente stock disponible', 'warning');
                return false;
              }
              await this.updateStock(-quantity);
              return true;
            } else {
              await this.showToast('Cantidad inválida', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Actualizar el stock del producto en la base de datos
   */
  async updateStock(quantity: number) {
    try {
      if (!this.product || !this.product.id) return;

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      const newStock = this.product.stock + quantity;

      await new Promise((resolve, reject) => {
        db.executeSql(
          'UPDATE products SET stock = ? WHERE id = ?',
          [newStock, this.product!.id],
          resolve,
          reject
        );
      });

      // Actualizar el producto en la vista
      this.product.stock = newStock;

      if (quantity > 0) {
        await this.showToast(`Se agregaron ${quantity} unidades. Stock: ${newStock}`, 'success');
      } else {
        await this.showToast(`Se registró salida de ${Math.abs(quantity)} unidades. Stock: ${newStock}`, 'success');
      }
    } catch (error) {
      console.error('Error actualizando stock:', error);
      await this.showToast('Error al actualizar stock', 'danger');
    }
  }

  /**
   * Navegar a la página de inventario para crear un nuevo producto
   */
  async createNewProduct() {
    await this.modalController.dismiss({
      action: 'create',
      scannedCode: this.scannedCode
    });

    // Navegar a la página de inventario
    this.router.navigate(['/tabs/inventory'], {
      state: {
        openModal: true,
        barcode: this.scannedCode
      }
    });
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
