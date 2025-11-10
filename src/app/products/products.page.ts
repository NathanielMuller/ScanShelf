import { Component, OnInit, AfterViewInit } from '@angular/core';
import { trigger, style, transition, animate, stagger, query } from '@angular/animations';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  image: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: false,
  animations: [
    trigger('cardStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(30px)' }),
          stagger(60, [
            animate('350ms ease-out', 
              style({ opacity: 1, transform: 'translateY(0)' })
            )
          ])
        ], { optional: true })
      ])
    ]),
    trigger('headerAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('400ms ease-out', 
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ])
  ]
})
export class ProductsPage implements OnInit, AfterViewInit {
  
  // Demo products data - TODO: Connect to real ProductService
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm = '';
  selectedCategory = 'all';
  categories = ['all', 'electronics', 'clothing', 'food', 'books'];
  isLoading = true;
  animationState = 'initial';

  constructor() {
    this.initializeDemoData();
  }

  ngOnInit() {
    // TODO: Replace with real API call
    // this.loadProducts();
    this.simulateDataLoad();
  }

  ngAfterViewInit() {
    // Trigger animations after view is initialized
    setTimeout(() => {
      this.animationState = 'loaded';
    }, 100);
  }

  /**
   * Initialize demo product data
   * TODO: Replace with ProductService.getProducts()
   */
  private initializeDemoData() {
    this.products = [
      {
        id: '1',
        name: 'Smartphone Samsung Galaxy',
        sku: 'SGX-2023-001',
        category: 'electronics',
        stock: 15,
        minStock: 5,
        price: 299.99,
        image: 'assets/products/smartphone.jpg',
        status: 'in_stock'
      },
      {
        id: '2',
        name: 'Laptop Dell Inspiron',
        sku: 'DLL-2023-002',
        category: 'electronics',
        stock: 3,
        minStock: 5,
        price: 749.99,
        image: 'assets/products/laptop.jpg',
        status: 'low_stock'
      },
      {
        id: '3',
        name: 'Camiseta Básica Azul',
        sku: 'CLT-2023-003',
        category: 'clothing',
        stock: 0,
        minStock: 10,
        price: 19.99,
        image: 'assets/products/tshirt.jpg',
        status: 'out_of_stock'
      },
      {
        id: '4',
        name: 'Auriculares Bluetooth',
        sku: 'AUD-2023-004',
        category: 'electronics',
        stock: 25,
        minStock: 8,
        price: 89.99,
        image: 'assets/products/headphones.jpg',
        status: 'in_stock'
      },
      {
        id: '5',
        name: 'Libro de Programación',
        sku: 'BK-2023-005',
        category: 'books',
        stock: 12,
        minStock: 3,
        price: 45.50,
        image: 'assets/products/book.jpg',
        status: 'in_stock'
      },
      {
        id: '6',
        name: 'Café Premium 500g',
        sku: 'CF-2023-006',
        category: 'food',
        stock: 8,
        minStock: 15,
        price: 24.99,
        image: 'assets/products/coffee.jpg',
        status: 'low_stock'
      }
    ];

    this.filteredProducts = [...this.products];
  }

  /**
   * Simulate data loading with delay
   */
  private simulateDataLoad() {
    setTimeout(() => {
      this.isLoading = false;
    }, 800);
  }

  /**
   * Filter products by search term
   */
  onSearchChange(event: any) {
    this.searchTerm = event.detail.value.toLowerCase();
    this.applyFilters();
  }

  /**
   * Filter products by category
   */
  onCategoryChange(event: any) {
    this.selectedCategory = event.detail.value;
    this.applyFilters();
  }

  /**
   * Apply search and category filters
   */
  private applyFilters() {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(this.searchTerm) ||
                           product.sku.toLowerCase().includes(this.searchTerm);
      const matchesCategory = this.selectedCategory === 'all' || 
                             product.category === this.selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }

  /**
   * Get status badge color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'in_stock': return 'success';
      case 'low_stock': return 'warning';
      case 'out_of_stock': return 'danger';
      default: return 'medium';
    }
  }

  /**
   * Get status text
   */
  getStatusText(status: string): string {
    switch (status) {
      case 'in_stock': return 'En Stock';
      case 'low_stock': return 'Stock Bajo';
      case 'out_of_stock': return 'Agotado';
      default: return 'Desconocido';
    }
  }

  /**
   * Get category display name
   */
  getCategoryName(category: string): string {
    const categories: { [key: string]: string } = {
      'all': 'Todas',
      'electronics': 'Electrónicos',
      'clothing': 'Ropa',
      'food': 'Alimentos',
      'books': 'Libros'
    };
    return categories[category] || category;
  }

  /**
   * Navigate to product detail
   * TODO: Implement navigation to product detail page
   */
  viewProduct(product: Product) {
    console.log('View product:', product);
    // TODO: this.router.navigate(['/products', product.id]);
  }

  /**
   * Navigate to add new product
   * TODO: Implement navigation to product form
   */
  addProduct() {
    console.log('Add new product');
    // TODO: this.router.navigate(['/products/new']);
  }

  /**
   * Refresh products list
   * TODO: Implement real data refresh from API
   */
  async refresh(event: any) {
    setTimeout(() => {
      console.log('Products refreshed');
      // TODO: Call ProductService.refreshProducts()
      event.target.complete();
    }, 1000);
  }
}
