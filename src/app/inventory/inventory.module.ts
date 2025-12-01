import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InventoryPageRoutingModule } from './inventory-routing.module';

import { InventoryPage } from './inventory.page';
import { AddProductModalComponent } from './add-product-modal/add-product-modal.component';
import { ProductDetailModalComponent } from './product-detail-modal/product-detail-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    InventoryPageRoutingModule
  ],
  declarations: [
    InventoryPage,
    AddProductModalComponent,
    ProductDetailModalComponent
  ],
  exports: [
    ProductDetailModalComponent
  ]
})
export class InventoryPageModule {}
