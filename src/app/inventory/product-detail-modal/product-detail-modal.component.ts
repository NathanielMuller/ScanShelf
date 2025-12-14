import { Component, Input, OnInit } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';

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
  selector: 'app-product-detail-modal',
  templateUrl: './product-detail-modal.component.html',
  styleUrls: ['./product-detail-modal.component.scss'],
  standalone: false
})
export class ProductDetailModalComponent implements OnInit {
  @Input() product!: Product;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    console.log('Producto recibido:', this.product);
  }

  dismiss() {
    this.modalController.dismiss();
  }

  async editProduct() {
    const alert = await this.alertController.create({
      header: 'Editar Producto',
      inputs: [
        {
          name: 'name',
          type: 'text',
          label: 'Nombre del producto',
          placeholder: 'Ej: Coca Cola 2L',
          value: this.product.name
        },
        {
          name: 'category',
          type: 'text',
          label: 'Categoría',
          placeholder: 'Ej: Bebidas',
          value: this.product.category
        },
        {
          name: 'brand',
          type: 'text',
          label: 'Marca',
          placeholder: 'Ej: Coca Cola',
          value: this.product.brand || ''
        },
        {
          name: 'price',
          type: 'number',
          label: 'Precio ($)',
          placeholder: '0',
          value: this.product.price
        },
        {
          name: 'minStock',
          type: 'number',
          label: 'Stock mínimo (unidades)',
          placeholder: '0',
          value: this.product.minStock,
          min: 0
        },
        {
          name: 'stock',
          type: 'number',
          label: 'Stock actual (unidades)',
          placeholder: '0',
          value: this.product.stock,
          min: 0
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Descripción',
          placeholder: 'Descripción opcional del producto',
          value: this.product.description || ''
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: (data) => {
            if (!data.name || !data.category || !data.price) {
              this.showToast('Por favor completa los campos obligatorios', 'warning');
              return false;
            }
            
            const price = parseFloat(data.price);
            const minStock = parseInt(data.minStock) || 0;
            const stock = parseInt(data.stock) || 0;
            
            if (price <= 0) {
              this.showToast('El precio debe ser mayor a 0', 'warning');
              return false;
            }
            
            if (minStock < 0 || stock < 0) {
              this.showToast('El stock no puede ser negativo', 'warning');
              return false;
            }
            
            this.saveProductChanges(data);
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Guardar cambios del producto editado
   */
  async saveProductChanges(data: any) {
    try {
      if (!(window as any).sqlitePlugin) {
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      db.transaction((tx: any) => {
        tx.executeSql(
          `UPDATE products SET 
            name = ?, 
            category = ?, 
            brand = ?, 
            price = ?, 
            minStock = ?, 
            stock = ?, 
            description = ? 
          WHERE id = ?`,
          [
            data.name,
            data.category,
            data.brand || null,
            parseFloat(data.price),
            parseInt(data.minStock) || 0,
            parseInt(data.stock) || 0,
            data.description || null,
            this.product.id
          ],
          () => {
            // Actualizar el producto en la vista
            this.product.name = data.name;
            this.product.category = data.category;
            this.product.brand = data.brand || '';
            this.product.price = parseFloat(data.price);
            this.product.minStock = parseInt(data.minStock) || 0;
            this.product.stock = parseInt(data.stock) || 0;
            this.product.description = data.description || '';
            
            this.showToast('Producto actualizado correctamente', 'success');
          },
          (error: any) => {
            console.error('Error actualizando producto:', error);
            this.showToast('Error al actualizar el producto', 'danger');
          }
        );
      });
    } catch (error) {
      console.error('Error:', error);
      this.showToast('Error al actualizar el producto', 'danger');
    }
  }

  async deleteProduct() {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: `¿Estás seguro de eliminar "${this.product.name}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.modalController.dismiss({
              action: 'delete',
              product: this.product
            });
          }
        }
      ]
    });

    await alert.present();
  }

  getStockStatus(): string {
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
      message: `Stock actual: ${this.product.stock} unidades`,
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
          handler: (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity && quantity > 0) {
              this.updateStock(quantity);
              return true;
            } else {
              this.showToast('Por favor ingresa una cantidad válida', 'warning');
              return false;
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
      message: `Stock actual: ${this.product.stock} unidades`,
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
          handler: (data) => {
            const quantity = parseInt(data.quantity);
            if (quantity && quantity > 0) {
              if (quantity > this.product.stock) {
                this.showToast('No hay suficiente stock disponible', 'warning');
                return false;
              }
              this.updateStock(-quantity);
              return true;
            } else {
              this.showToast('Por favor ingresa una cantidad válida', 'warning');
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
      if (!(window as any).sqlitePlugin) {
        throw new Error('Plugin SQLite no disponible');
      }

      const db = (window as any).sqlitePlugin.openDatabase({
        name: 'scanshelf.db',
        location: 'default'
      });

      const newStock = this.product.stock + quantity;

      db.transaction((tx: any) => {
        tx.executeSql(
          'UPDATE products SET stock = ? WHERE id = ?',
          [newStock, this.product.id],
          () => {
            const oldStock = this.product.stock;
            this.product.stock = newStock;
            
            if (quantity > 0) {
              this.showToast(`Se agregaron ${quantity} unidades. Stock actual: ${newStock}`, 'success');
            } else {
              this.showToast(`Se registró salida de ${Math.abs(quantity)} unidades. Stock actual: ${newStock}`, 'success');
            }
          },
          (error: any) => {
            console.error('Error actualizando stock:', error);
            this.showToast('Error al actualizar el stock', 'danger');
          }
        );
      });
    } catch (error) {
      console.error('Error:', error);
      this.showToast('Error al actualizar el stock', 'danger');
    }
  }

  /**
   * Mostrar mensaje toast
   */
  async showToast(message: string, color: string = 'dark') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    toast.present();
  }
}
