import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { authGuard } from '../guard/auth-guard';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'products',
        loadChildren: () => import('../products/products.module').then(m => m.ProductsPageModule),
        data: { allowGuest: true } // Los invitados pueden ver productos
      },
      {
        path: 'scan',
        loadChildren: () => import('../scan/scan.module').then(m => m.ScanPageModule),
        canActivate: [authGuard],
        data: { allowGuest: false } // Solo usuarios registrados pueden escanear
      },
      {
        path: 'movements',
        loadChildren: () => import('../movements/movements.module').then(m => m.MovementsPageModule),
        canActivate: [authGuard],
        data: { allowGuest: false } // Solo usuarios registrados pueden ver movimientos
      },
      {
        path: 'reports',
        loadChildren: () => import('../reports/reports.module').then(m => m.ReportsPageModule),
        canActivate: [authGuard],
        data: { allowGuest: false } // Solo usuarios registrados pueden ver reportes
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule),
        data: { allowGuest: true } // Los invitados pueden acceder a configuraciones básicas
      },
      {
        path: '',
        redirectTo: '/tabs/products',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
