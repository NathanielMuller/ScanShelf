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
        path: 'inventory',
        loadChildren: () => import('../inventory/inventory.module').then(m => m.InventoryPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'scan',
        loadChildren: () => import('../scan/scan.module').then(m => m.ScanPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'movements',
        loadChildren: () => import('../movements/movements.module').then(m => m.MovementsPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'reports',
        loadChildren: () => import('../reports/reports.module').then(m => m.ReportsPageModule),
        canActivate: [authGuard]
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule),
        canActivate: [authGuard]
      },
      {
        path: '',
        redirectTo: '/tabs/inventory',
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
