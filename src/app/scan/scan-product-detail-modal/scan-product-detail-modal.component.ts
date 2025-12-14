import { Component, Input, OnInit } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MovementsService } from '../../shared/services/movements.service';

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
    private router: Router,
    private movementsService: MovementsService
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
    // Primer alert: cantidad y notas
    const alert1 = await this.alertController.create({
      header: 'Añadir Stock',
      message: `Stock actual: ${this.product?.stock} unidades`,
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          placeholder: 'Cantidad a añadir',
          min: 1,
          value: 1
        },
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Notas (opcional)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Siguiente',
          handler: async (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity > 0) {
              // Segundo alert: seleccionar razón
              const alert2 = await this.alertController.create({
                header: 'Razón de la entrada',
                message: 'Selecciona el motivo:',
                inputs: [
                  {
                    name: 'reason',
                    type: 'radio',
                    label: 'Ingreso de mercancía',
                    value: 'ingreso',
                    checked: true
                  },
                  {
                    name: 'reason',
                    type: 'radio',
                    label: 'Devolución de cliente',
                    value: 'devolucion'
                  }
                ],
                buttons: [
                  {
                    text: 'Atrás',
                    role: 'cancel',
                    handler: () => {
                      this.addStock();
                    }
                  },
                  {
                    text: 'Confirmar',
                    handler: async (reasonData) => {
                      await this.updateStock(quantity, 'entrada', reasonData as any, data.notes);
                    }
                  }
                ]
              });
              await alert2.present();
              return true;
            } else {
              await this.showToast('Cantidad inválida', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert1.present();
  }

  /**
   * Mostrar diálogo para reducir stock (registrar salida)
   */
  async reduceStock() {
    // Primer alert: cantidad y notas
    const alert1 = await this.alertController.create({
      header: 'Registrar Salida',
      message: `Stock actual: ${this.product?.stock} unidades`,
      inputs: [
        {
          name: 'quantity',
          type: 'number',
          placeholder: 'Cantidad de salida',
          min: 1,
          value: 1
        },
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Notas (opcional)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Siguiente',
          handler: async (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity > 0) {
              if (this.product && quantity > this.product.stock) {
                await this.showToast('No hay suficiente stock disponible', 'warning');
                return false;
              }
              // Segundo alert: seleccionar razón
              const alert2 = await this.alertController.create({
                header: 'Razón de la salida',
                message: 'Selecciona el motivo:',
                inputs: [
                  {
                    name: 'reason',
                    type: 'radio',
                    label: 'Venta',
                    value: 'venta',
                    checked: true
                  },
                  {
                    name: 'reason',
                    type: 'radio',
                    label: 'Pérdida/Merma',
                    value: 'perdida'
                  }
                ],
                buttons: [
                  {
                    text: 'Atrás',
                    role: 'cancel',
                    handler: () => {
                      this.reduceStock();
                    }
                  },
                  {
                    text: 'Confirmar',
                    handler: async (reasonData) => {
                      await this.updateStock(-quantity, 'salida', reasonData as any, data.notes);
                    }
                  }
                ]
              });
              await alert2.present();
              return true;
            } else {
              await this.showToast('Cantidad inválida', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert1.present();
  }

  /**
   * Actualizar el stock del producto en la base de datos y registrar movimiento
   */
  async updateStock(
    quantity: number,
    type: 'entrada' | 'salida',
    reason: 'venta' | 'perdida' | 'ingreso' | 'devolucion',
    notes?: string
  ) {
    try {
      if (!this.product || !this.product.id) return;

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      const previousStock = this.product.stock;
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

      // Registrar el movimiento
      await this.movementsService.registerMovement({
        productId: this.product.id!,
        productName: this.product.name,
        type: type,
        quantity: Math.abs(quantity),
        previousStock: previousStock,
        newStock: newStock,
        reason: reason,
        notes: notes,
        userId: localStorage.getItem('currentUser') || 'user'
      });

      if (quantity > 0) {
        await this.showToast(`Se agregaron ${quantity} unidades. Stock: ${newStock}`, 'success');
      } else {
        await this.showToast(`Salida registrada: ${Math.abs(quantity)} unidades. Stock: ${newStock}`, 'success');
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
