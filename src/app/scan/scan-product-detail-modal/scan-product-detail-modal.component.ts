import { Component, Input, OnInit } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';

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
  @Input() product!: Product;

  constructor(
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    console.log('Producto escaneado:', this.product);
  }

  dismiss() {
    this.modalController.dismiss();
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
}
