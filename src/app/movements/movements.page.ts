import { Component, OnInit } from '@angular/core';
import { trigger, style, transition, animate, stagger, query } from '@angular/animations';

export interface Movement {
  id: string;
  type: 'entrada' | 'salida' | 'ajuste' | 'transferencia';
  product: string;
  sku: string;
  quantity: number;
  reason: string;
  user: string;
  timestamp: Date;
  location?: string;
}

@Component({
  selector: 'app-movements',
  templateUrl: './movements.page.html',
  styleUrls: ['./movements.page.scss'],
  standalone: false,
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateX(-20px)' }),
          stagger(80, [
            animate('300ms ease-out', 
              style({ opacity: 1, transform: 'translateX(0)' })
            )
          ])
        ], { optional: true })
      ])
    ])
  ]
})
export class MovementsPage implements OnInit {
  
  movements: Movement[] = [];
  filteredMovements: Movement[] = [];
  selectedFilter = 'today';
  isLoading = true;
  animationState = 'initial';
  
  filters = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: 'all', label: 'Todo' }
  ];

  constructor() {
    this.initializeDemoData();
  }

  ngOnInit() {
    this.simulateDataLoad();
  }

  /**
   * Initialize demo movements data
   * TODO: Replace with MovementService.getMovements()
   */
  private initializeDemoData() {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(now.setDate(now.getDate() - 1));
    const lastWeek = new Date(now.setDate(now.getDate() - 6));
    
    this.movements = [
      {
        id: '1',
        type: 'entrada',
        product: 'Smartphone Samsung Galaxy',
        sku: 'SGX-2023-001',
        quantity: 10,
        reason: 'Compra a proveedor',
        user: 'Ana García',
        timestamp: today,
        location: 'Almacén Principal'
      },
      {
        id: '2',
        type: 'salida',
        product: 'Laptop Dell Inspiron',
        sku: 'DLL-2023-002',
        quantity: 2,
        reason: 'Venta al cliente',
        user: 'Carlos López',
        timestamp: today
      },
      {
        id: '3',
        type: 'ajuste',
        product: 'Auriculares Bluetooth',
        sku: 'AUD-2023-004',
        quantity: -3,
        reason: 'Inventario físico - producto dañado',
        user: 'María Rodríguez',
        timestamp: yesterday
      },
      {
        id: '4',
        type: 'transferencia',
        product: 'Camiseta Básica Azul',
        sku: 'CLT-2023-003',
        quantity: 15,
        reason: 'Transferencia entre sucursales',
        user: 'José Martín',
        timestamp: yesterday,
        location: 'Sucursal Centro → Sucursal Norte'
      },
      {
        id: '5',
        type: 'entrada',
        product: 'Libro de Programación',
        sku: 'BK-2023-005',
        quantity: 20,
        reason: 'Reposición de stock',
        user: 'Ana García',
        timestamp: lastWeek,
        location: 'Almacén Principal'
      },
      {
        id: '6',
        type: 'salida',
        product: 'Café Premium 500g',
        sku: 'CF-2023-006',
        quantity: 5,
        reason: 'Venta mayorista',
        user: 'Luis Fernández',
        timestamp: lastWeek
      }
    ];

    this.applyFilter();
  }

  /**
   * Simulate data loading
   */
  private simulateDataLoad() {
    setTimeout(() => {
      this.isLoading = false;
      this.animationState = 'loaded';
    }, 600);
  }

  /**
   * Handle filter change
   */
  onFilterChange(event: any) {
    this.selectedFilter = event.detail.value;
    this.applyFilter();
  }

  /**
   * Apply date filter to movements
   */
  private applyFilter() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    this.filteredMovements = this.movements.filter(movement => {
      const movementDate = new Date(movement.timestamp);
      
      switch (this.selectedFilter) {
        case 'today':
          return movementDate >= today;
        case 'week':
          return movementDate >= weekAgo;
        case 'month':
          return movementDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });

    // Sort by timestamp (newest first)
    this.filteredMovements.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get movement type icon
   */
  getMovementIcon(type: string): string {
    const icons = {
      'entrada': 'arrow-down-circle',
      'salida': 'arrow-up-circle',
      'ajuste': 'create-outline',
      'transferencia': 'swap-horizontal'
    };
    return icons[type as keyof typeof icons] || 'help-circle';
  }

  /**
   * Get movement type color
   */
  getMovementColor(type: string): string {
    const colors = {
      'entrada': 'success',
      'salida': 'primary',
      'ajuste': 'warning',
      'transferencia': 'tertiary'
    };
    return colors[type as keyof typeof colors] || 'medium';
  }

  /**
   * Format relative time
   */
  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `Hace ${days} día${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    } else {
      return 'Hace unos minutos';
    }
  }

  /**
   * Format quantity with sign
   */
  getQuantityDisplay(movement: Movement): string {
    const sign = movement.type === 'salida' ? '-' : '+';
    return `${sign}${movement.quantity}`;
  }

  /**
   * Refresh movements list
   * TODO: Implement real data refresh
   */
  async refresh(event: any) {
    setTimeout(() => {
      console.log('Movements refreshed');
      // TODO: Call MovementService.refreshMovements()
      this.applyFilter();
      event.target.complete();
    }, 1000);
  }

  /**
   * Get summary stats for current filter
   */
  getSummaryStats() {
    const entries = this.filteredMovements.filter(m => m.type === 'entrada').length;
    const exits = this.filteredMovements.filter(m => m.type === 'salida').length;
    const adjustments = this.filteredMovements.filter(m => m.type === 'ajuste').length;
    const transfers = this.filteredMovements.filter(m => m.type === 'transferencia').length;

    return { entries, exits, adjustments, transfers };
  }
}
