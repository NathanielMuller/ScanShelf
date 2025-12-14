import { Component, OnInit } from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { ReportsService } from '../shared/services/reports.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-30px)' }),
        animate('500ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class ReportsPage implements OnInit {

  reports = [
    {
      id: 'inventory',
      title: 'Inventario Actual',
      description: 'Listado completo de productos',
      icon: 'list-outline',
      color: 'primary'
    },
    {
      id: 'movements',
      title: 'Movimientos de Inventario',
      description: 'Historial de entradas y salidas',
      icon: 'swap-horizontal-outline',
      color: 'secondary'
    },
    {
      id: 'stats',
      title: 'Estadísticas de Movimientos',
      description: 'Resumen de ventas, pérdidas y devoluciones',
      icon: 'stats-chart-outline',
      color: 'tertiary'
    }
  ];

  constructor(
    private reportsService: ReportsService,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) { }

  ngOnInit() {
  }

  async generateReport(reportId: string) {
    // Mostrar diálogo para seleccionar formato
    const alert = await this.alertCtrl.create({
      header: 'Seleccionar Formato',
      message: '¿En qué formato deseas exportar el reporte?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'CSV',
          handler: () => {
            if (reportId === 'movements') {
              this.showMovementsFilterDialog('csv');
            } else if (reportId === 'stats') {
              this.generateStatsReport('csv');
            } else {
              this.exportReport(reportId, 'csv');
            }
          }
        },
        {
          text: 'PDF',
          handler: () => {
            if (reportId === 'movements') {
              this.showMovementsFilterDialog('pdf');
            } else if (reportId === 'stats') {
              this.generateStatsReport('pdf');
            } else {
              this.exportReport(reportId, 'pdf');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async exportReport(reportId: string, format: 'csv' | 'pdf') {
    const loading = await this.loadingCtrl.create({
      message: 'Generando reporte...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      if (format === 'csv') {
        const csvContent = await this.reportsService.generateInventoryReport();
        const fileName = this.reportsService.generateFileName('inventario', 'csv');
        await this.reportsService.exportAndShareCSV(csvContent, fileName);
      } else {
        // PDF
        const pdfBase64 = await this.reportsService.generateInventoryPDF();
        const fileName = this.reportsService.generateFileName('inventario', 'pdf');
        await this.reportsService.exportAndSharePDF(pdfBase64, fileName);
      }

      await loading.dismiss();
      this.showSuccessToast('Reporte generado exitosamente');

    } catch (error) {
      await loading.dismiss();
      console.error('Error generando reporte:', error);
      this.showErrorToast('Error al generar el reporte');
    }
  }

  async showMovementsFilterDialog(format: 'csv' | 'pdf') {
    const alert = await this.alertCtrl.create({
      header: 'Filtrar Movimientos',
      message: 'Selecciona el período del reporte',
      inputs: [
        {
          name: 'period',
          type: 'radio',
          label: 'Hoy',
          value: 'today',
          checked: true
        },
        {
          name: 'period',
          type: 'radio',
          label: 'Última semana',
          value: 'week'
        },
        {
          name: 'period',
          type: 'radio',
          label: 'Último mes',
          value: 'month'
        },
        {
          name: 'period',
          type: 'radio',
          label: 'Último año',
          value: 'year'
        },
        {
          name: 'period',
          type: 'radio',
          label: 'Todo',
          value: 'all'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Generar',
          handler: async (period) => {
            await this.generateMovementsReport(period, format);
          }
        }
      ]
    });

    await alert.present();
  }

  async generateMovementsReport(period: string, format: 'csv' | 'pdf') {
    const loading = await this.loadingCtrl.create({
      message: 'Generando reporte de movimientos...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const filters = this.getDateFilters(period);
      
      if (format === 'csv') {
        const csvContent = await this.reportsService.generateMovementsReport(filters);
        const fileName = this.reportsService.generateFileName(`movimientos_${period}`, 'csv');
        await this.reportsService.exportAndShareCSV(csvContent, fileName);
      } else {
        const pdfBase64 = await this.reportsService.generateMovementsPDF(filters);
        const fileName = this.reportsService.generateFileName(`movimientos_${period}`, 'pdf');
        await this.reportsService.exportAndSharePDF(pdfBase64, fileName);
      }

      await loading.dismiss();
      this.showSuccessToast('Reporte de movimientos generado');

    } catch (error) {
      await loading.dismiss();
      console.error('Error generando reporte de movimientos:', error);
      this.showErrorToast('Error al generar el reporte');
    }
  }

  async generateStatsReport(format: 'csv' | 'pdf') {
    const loading = await this.loadingCtrl.create({
      message: 'Generando estadísticas...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      if (format === 'csv') {
        const csvContent = await this.reportsService.generateMovementStatsReport();
        const fileName = this.reportsService.generateFileName('estadisticas', 'csv');
        await this.reportsService.exportAndShareCSV(csvContent, fileName);
      } else {
        const pdfBase64 = await this.reportsService.generateStatsPDF();
        const fileName = this.reportsService.generateFileName('estadisticas', 'pdf');
        await this.reportsService.exportAndSharePDF(pdfBase64, fileName);
      }

      await loading.dismiss();
      this.showSuccessToast('Estadísticas generadas exitosamente');

    } catch (error) {
      await loading.dismiss();
      console.error('Error generando estadísticas:', error);
      this.showErrorToast('Error al generar el reporte');
    }
  }

  getDateFilters(period: string): { startDate?: string; endDate?: string } {
    const now = new Date();
    const filters: any = {};

    switch (period) {
      case 'today':
        filters.startDate = now.toISOString().split('T')[0] + ' 00:00:00';
        filters.endDate = now.toISOString().split('T')[0] + ' 23:59:59';
        break;

      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filters.startDate = weekAgo.toISOString().split('T')[0] + ' 00:00:00';
        filters.endDate = now.toISOString().split('T')[0] + ' 23:59:59';
        break;

      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        filters.startDate = monthAgo.toISOString().split('T')[0] + ' 00:00:00';
        filters.endDate = now.toISOString().split('T')[0] + ' 23:59:59';
        break;

      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        filters.startDate = yearAgo.toISOString().split('T')[0] + ' 00:00:00';
        filters.endDate = now.toISOString().split('T')[0] + ' 23:59:59';
        break;

      case 'all':
      default:
        // Sin filtros
        break;
    }

    return filters;
  }

  async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color: 'success',
      position: 'bottom',
      icon: 'checkmark-circle-outline'
    });
    await toast.present();
  }

  async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'danger',
      position: 'bottom',
      icon: 'alert-circle-outline'
    });
    await toast.present();
  }

}

