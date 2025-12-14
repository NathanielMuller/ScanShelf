import { Component, OnInit } from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';
import { MovementsService, Movement } from '../shared/services/movements.service';

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class MovementsPage implements OnInit {

  movements: Movement[] = [];
  filteredMovements: Movement[] = [];
  isLoading = false;
  
  // Filtros
  searchTerm: string = '';
  selectedPeriod: 'day' | 'week' | 'month' | 'all' = 'all';
  selectedType: 'all' | 'entrada' | 'salida' = 'all';
  selectedReason: 'all' | 'venta' | 'perdida' | 'ingreso' | 'devolucion' = 'all';

  constructor(
    private movementsService: MovementsService
  ) { }

  async ngOnInit() {
    await this.loadMovements();
  }

  async ionViewWillEnter() {
    await this.loadMovements();
  }

  async loadMovements() {
    this.isLoading = true;
    try {
      // Obtener movimientos del último año
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      switch (this.selectedPeriod) {
        case 'day':
          this.movements = await this.movementsService.getTodayMovements();
          break;
        case 'week':
          this.movements = await this.movementsService.getWeekMovements();
          break;
        case 'month':
          this.movements = await this.movementsService.getMonthMovements();
          break;
        default:
          this.movements = await this.movementsService.getMovements({
            startDate: oneYearAgo.toISOString().split('T')[0] + ' 00:00:00'
          });
      }
      
      this.applyFilters();
    } catch (error) {
      console.error('Error cargando movimientos:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters() {
    this.filteredMovements = this.movements.filter(movement => {
      // Filtro de búsqueda por nombre de producto
      const matchesSearch = !this.searchTerm || 
        (movement.productName?.toLowerCase() || '').includes(this.searchTerm.toLowerCase());
      
      // Filtro de tipo
      const matchesType = this.selectedType === 'all' || movement.type === this.selectedType;
      
      // Filtro de razón
      const matchesReason = this.selectedReason === 'all' || movement.reason === this.selectedReason;
      
      return matchesSearch && matchesType && matchesReason;
    });
  }

  onSearchChange(event: any) {
    this.searchTerm = event.target.value || '';
    this.applyFilters();
  }

  onPeriodChange(event: any) {
    this.selectedPeriod = event.detail.value;
    this.loadMovements();
  }

  onTypeChange(event: any) {
    this.selectedType = event.detail.value;
    this.applyFilters();
  }

  onReasonChange(event: any) {
    this.selectedReason = event.detail.value;
    this.applyFilters();
  }

  async refreshMovements(event: any) {
    await this.loadMovements();
    event.target.complete();
  }

  getMovementIcon(type: string): string {
    return type === 'entrada' ? 'arrow-down-circle' : 'arrow-up-circle';
  }

  getMovementColor(type: string): string {
    return type === 'entrada' ? 'success' : 'warning';
  }

  getReasonLabel(reason: string): string {
    const labels: any = {
      venta: 'Venta',
      perdida: 'Pérdida',
      ingreso: 'Ingreso',
      devolucion: 'Devolución'
    };
    return labels[reason] || reason;
  }

  getReasonIcon(reason: string): string {
    const icons: any = {
      venta: 'cash-outline',
      perdida: 'alert-circle-outline',
      ingreso: 'cube-outline',
      devolucion: 'return-up-back-outline'
    };
    return icons[reason] || 'help-circle-outline';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
