import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

export interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  ingredients_text?: string;
  ingredients_text_es?: string;
  nutrition_grades?: string;
  code?: string;
}

export interface OpenFoodFactsResponse {
  status: number;
  status_verbose: string;
  code: string;
  product?: OpenFoodFactsProduct;
}

@Injectable({
  providedIn: 'root'
})
export class UpcDatabaseService {
  
  // API de Open Food Facts - Gratuita, sin límites, sin necesidad de API Key
  private readonly API_URL = 'https://world.openfoodfacts.org/api/v2/product';
  
  constructor(private http: HttpClient) { }

  /**
   * Buscar información de un producto por su código de barras
   * Consulta la base de datos gratuita de Open Food Facts (2M+ productos alimenticios)
   * @param barcode Código de barras EAN/UPC del producto
   * @returns Observable con la información del producto o null si no se encuentra
   */
  searchByBarcode(barcode: string): Observable<OpenFoodFactsProduct | null> {
    if (!barcode || barcode.trim().length === 0) {
      console.warn('❌ Código de barras vacío');
      return of(null);
    }

    // Limpiar código de barras (remover espacios y caracteres no numéricos)
    const cleanBarcode = barcode.trim().replace(/\D/g, '');
    
    if (cleanBarcode.length < 8) {
      console.warn('❌ Código de barras inválido (muy corto):', cleanBarcode);
      return of(null);
    }

    const url = `${this.API_URL}/${cleanBarcode}`;

    console.log('🔍 Buscando producto en Open Food Facts...');
    console.log('📦 Código de barras:', cleanBarcode);
    console.log('🌐 URL completa:', url);

    return this.http.get<OpenFoodFactsResponse>(url).pipe(
      timeout(15000), // Tiempo máximo de espera: 15 segundos
      map(response => {
        console.log('✅ Respuesta recibida de Open Food Facts');
        
        if (!response) {
          console.log('⚠️ Respuesta vacía de la API');
          return null;
        }

        console.log('📊 Estado de respuesta:', response.status, '-', response.status_verbose);
        
        // Status 1 significa que el producto fue encontrado
        if (response.status === 1 && response.product) {
          const product = response.product;
          const name = product.product_name || product.product_name_es || 'Sin nombre';
          
          console.log('✅ Producto encontrado:', name);
          console.log('   Marca:', product.brands || 'Sin marca');
          console.log('   Categoría:', product.categories || 'Sin categoría');
          
          return product;
        }
        
        // Status 0 significa que el producto no existe en la base de datos
        if (response.status === 0) {
          console.log('⚠️ Producto no encontrado en la base de datos');
        } else {
          console.log('⚠️ Estado inesperado:', response.status);
        }
        
        return null;
      }),
      catchError(error => {
        console.error('❌ Error consultando Open Food Facts:', error);
        console.error('❌ Status:', error.status);
        console.error('❌ Message:', error.message);
        
        if (error.status === 0) {
          console.error('🌐 Error de red - Verifica conexión a internet');
        } else if (error.status === 404) {
          console.log('ℹ️ Producto no encontrado (404)');
        }
        
        return of(null);
      })
    );
  }

  /**
   * Mapear categorías de Open Food Facts a las 6 categorías disponibles en la app
   * Open Food Facts se especializa en productos alimenticios, por lo que la mayoría
   * de productos se mapean a la categoría "Alimentación"
   */
  mapCategory(offCategories?: string): string {
    if (!offCategories) return 'Alimentación';
    
    const categoryLower = offCategories.toLowerCase();
    
    // Mapeo de categorías de Open Food Facts a categorías de ScanShelf
    const categoryMap: { [key: string]: string } = {
      'bebida': 'Alimentación',
      'beverage': 'Alimentación',
      'drink': 'Alimentación',
      'snack': 'Alimentación',
      'chocolate': 'Alimentación',
      'dairy': 'Alimentación',
      'lácteo': 'Alimentación',
      'meat': 'Alimentación',
      'carne': 'Alimentación',
      'fish': 'Alimentación',
      'pescado': 'Alimentación',
      'fruit': 'Alimentación',
      'fruta': 'Alimentación',
      'vegetable': 'Alimentación',
      'verdura': 'Alimentación',
      'bread': 'Alimentación',
      'pan': 'Alimentación',
      'cereal': 'Alimentación',
      'pasta': 'Alimentación',
      'salsa': 'Alimentación',
      'sauce': 'Alimentación',
      'condiment': 'Alimentación',
      'sweet': 'Alimentación',
      'dulce': 'Alimentación',
      'beauty': 'Belleza',
      'cosmetic': 'Belleza',
      'health': 'Salud'
    };

    for (const [key, value] of Object.entries(categoryMap)) {
      if (categoryLower.includes(key)) {
        return value;
      }
    }

    // Por defecto, Open Food Facts = Alimentación
    return 'Alimentación';
  }

  /**
   * Obtener la URL de la mejor imagen disponible del producto
   * Prioriza la imagen frontal en alta calidad sobre las alternativas
   */
  getBestImage(product: OpenFoodFactsProduct): string | null {
    // Orden de prioridad: imagen frontal > imagen genérica > miniatura
    if (product.image_front_url && product.image_front_url.startsWith('http')) {
      console.log('✅ Usando image_front_url:', product.image_front_url);
      return product.image_front_url;
    }
    
    if (product.image_url && product.image_url.startsWith('http')) {
      console.log('✅ Usando image_url:', product.image_url);
      return product.image_url;
    }
    
    if (product.image_front_small_url && product.image_front_small_url.startsWith('http')) {
      console.log('✅ Usando image_front_small_url:', product.image_front_small_url);
      return product.image_front_small_url;
    }
    
    console.log('⚠️ No hay imagen disponible');
    return null;
  }

  /**
   * Obtener el nombre del producto, priorizando el nombre en español
   */
  getProductName(product: OpenFoodFactsProduct): string {
    return product.product_name_es || product.product_name || 'Producto sin nombre';
  }

  /**
   * Obtener la descripción o lista de ingredientes del producto
   */
  getDescription(product: OpenFoodFactsProduct): string {
    return product.ingredients_text_es || product.ingredients_text || '';
  }

  /**
   * Open Food Facts es una base de datos nutricional, no comercial
   * Por lo tanto, no contiene información de precios
   * @returns Siempre retorna 0 - el precio debe ingresarse manualmente
   */
  extractPrice(): number {
    return 0;
  }

  /**
   * Verificar si el servicio está listo para usar
   * Open Food Facts es gratuito y no requiere configuración
   */
  isConfigured(): boolean {
    return true;
  }

  /**
   * Obtener información sobre el estado del servicio
   */
  getConfigInfo(): { configured: boolean; message: string } {
    return {
      configured: true,
      message: '✅ Open Food Facts API - Servicio gratuito activo (2M+ productos alimenticios)'
    };
  }
}
