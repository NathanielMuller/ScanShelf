import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InventoryCodeService {

  private readonly CATEGORY_CODES: { [key: string]: string } = {
    'Electrónicos': 'ELE',
    'Alimentación': 'ALI', 
    'Ropa': 'ROP',
    'Hogar': 'HOG',
    'Deportes': 'DEP',
    'Salud': 'SAL',
    'Belleza': 'BEL',
    'Libros': 'LIB',
    'Juguetes': 'JUG',
    'Automóvil': 'AUT',
    'Jardín': 'JAR',
    'Herramientas': 'HER',
    'Oficina': 'OFI',
    'Mascotas': 'MAS',
    'Bebés': 'BEB',
    'Música': 'MUS',
    'Otros': 'OTR'
  };

  constructor() { }

  /**
   * Generar código SKU único para un producto
   * Formato simple: CAT + contador de 3 dígitos
   * Ejemplos: ELE001, ALI002, ROP015
   * @param category Nombre de la categoría del producto
   * @param existingSKUs Lista de SKUs ya existentes para evitar duplicados
   * @returns SKU generado en formato CAT###
   */
  generateSKU(category: string, existingSKUs: string[] = []): string {
    // Convertir categoría a código de 3 letras
    const categoryCode = this.getCategoryCode(category);
    
    // Buscar el siguiente número disponible para esta categoría
    const categorySKUs = existingSKUs.filter(sku => sku.startsWith(categoryCode));
    
    let nextNumber = 1;
    if (categorySKUs.length > 0) {
      // Extraer números existentes y encontrar el siguiente
      const existingNumbers = categorySKUs
        .map(sku => parseInt(sku.substring(3))) // Tomar los últimos 3 dígitos
        .filter(num => !isNaN(num))
        .sort((a, b) => a - b);
      
      nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    }
    
    // Formatear con ceros a la izquierda (3 dígitos)
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return `${categoryCode}${formattedNumber}`;
  }

  /**
   * Generar código SKU personalizado con categoría, marca y número
   * Formato: [CATEGORÍA]-[MARCA]-[NÚMERO]
   * Ejemplos:
   *   - ELE-SAM-001 (Electrónicos - Samsung - 001)
   *   - ALI-NES-005 (Alimentación - Nestlé - 005)
   *   - ROP-NIK-012 (Ropa - Nike - 012)
   * @param category Nombre de la categoría (ej: "Electrónicos")
   * @param brand Nombre de la marca (ej: "Samsung")
   * @param existingSKUs Lista de SKUs existentes para evitar duplicados
   * @returns SKU en formato CAT-MAR-###
   */
  generateCustomSKU(category: string, brand: string, existingSKUs: string[] = []): string {
    // Convertir categoría a código de 3 letras (ej: Electrónicos -> ELE)
    const categoryCode = this.getCategoryCode(category);
    
    // Convertir marca a código de 3 letras (ej: Samsung -> SAM)
    const brandCode = this.generateBrandCode(brand);
    
    // Construir el prefijo del SKU
    const skuPrefix = `${categoryCode}-${brandCode}-`;
    
    // Buscar SKUs existentes con el mismo prefijo
    const matchingSKUs = existingSKUs.filter(sku => sku.startsWith(skuPrefix));
    
    // Encontrar el siguiente número disponible
    let nextNumber = 1;
    if (matchingSKUs.length > 0) {
      const existingNumbers = matchingSKUs
        .map(sku => {
          const numberPart = sku.split('-')[2]; // Obtener la parte numérica
          return parseInt(numberPart);
        })
        .filter(num => !isNaN(num))
        .sort((a, b) => a - b);
      
      nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    }
    
    // Formatear número con ceros a la izquierda (3 dígitos)
    const formattedNumber = nextNumber.toString().padStart(3, '0');
    
    return `${categoryCode}-${brandCode}-${formattedNumber}`;
  }

  /**
   * Generar código de marca abreviado (3 letras)
   */
  private generateBrandCode(brand: string): string {
    if (!brand || brand.trim().length === 0) {
      return 'GEN'; // Generic por defecto
    }
    
    const cleanBrand = brand.trim().toUpperCase();
    
    // Si la marca tiene 3 letras o menos, usarla completa
    if (cleanBrand.length <= 3) {
      return cleanBrand.padEnd(3, 'X');
    }
    
    // Remover espacios y caracteres especiales
    const alphaOnly = cleanBrand.replace(/[^A-Z]/g, '');
    
    if (alphaOnly.length >= 3) {
      // Tomar primeras 3 letras
      return alphaOnly.substring(0, 3);
    }
    
    // Si no hay suficientes letras, usar las primeras 3 del texto original
    return cleanBrand.replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X');
  }

  /**
   * Generar código de barras único (formato EAN-13 simulado)
   * Formato: 789 + timestamp reducido + dígito verificador
   */
  generateBarcode(): string {
    const prefix = '789'; // Prefijo para productos locales
    const timestamp = Date.now().toString().slice(-8); // Últimos 8 dígitos del timestamp
    const randomSuffix = Math.floor(Math.random() * 10).toString(); // 1 dígito aleatorio
    
    const baseCode = prefix + timestamp + randomSuffix;
    const checkDigit = this.calculateEAN13CheckDigit(baseCode);
    
    return baseCode + checkDigit;
  }

  /**
   * Obtener código de categoría de 3 letras
   */
  private getCategoryCode(category: string): string {
    return this.CATEGORY_CODES[category] || 'OTR';
  }

  /**
   * Calcular dígito verificador para código EAN-13
   */
  private calculateEAN13CheckDigit(code: string): string {
    let sum = 0;
    
    for (let i = 0; i < code.length; i++) {
      const digit = parseInt(code[i]);
      // Multiplicar por 1 o 3 alternadamente
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Validar si un SKU tiene el formato correcto
   * Formato válido: 3 letras (código categoría) + 3 dígitos (número)
   * Ejemplo válido: ELE001, ALI025, ROP100
   */
  validateSKUFormat(sku: string): boolean {
    if (!sku || sku.length !== 6) return false;
    
    const categoryCode = sku.substring(0, 3);
    const number = sku.substring(3);
    
    // Verificar que el código de categoría es válido
    const validCategoryCodes = Object.values(this.CATEGORY_CODES);
    if (!validCategoryCodes.includes(categoryCode)) return false;
    
    // Verificar que la parte numérica tiene 3 dígitos
    return /^\d{3}$/.test(number);
  }

  /**
   * Validar si un código de barras EAN-13 es válido
   * Verifica longitud, formato numérico y dígito verificador
   */
  validateBarcodeFormat(barcode: string): boolean {
    if (!barcode || barcode.length !== 13) return false;
    
    // Verificar que contiene solo números
    if (!/^\d{13}$/.test(barcode)) return false;
    
    // Verificar dígito verificador
    const code = barcode.substring(0, 12);
    const checkDigit = barcode.substring(12);
    const calculatedCheckDigit = this.calculateEAN13CheckDigit(code);
    
    return checkDigit === calculatedCheckDigit;
  }

  /**
   * Obtener lista de categorías disponibles
   */
  getAvailableCategories(): string[] {
    return Object.keys(this.CATEGORY_CODES).sort();
  }

  /**
   * Obtener código de categoría por nombre
   */
  getCategoryCodeByName(categoryName: string): string {
    return this.CATEGORY_CODES[categoryName] || 'OTR';
  }

  /**
   * Generar SKU alternativo si el generado ya existe
   */
  generateAlternativeSKU(category: string, existingSKUs: string[], attempt: number = 1): string {
    const baseSKU = this.generateSKU(category, existingSKUs);
    
    if (attempt === 1) {
      return baseSKU;
    }
    
    // Para intentos adicionales, agregar sufijo
    const categoryCode = this.getCategoryCode(category);
    const baseNumber = parseInt(baseSKU.substring(3));
    const newNumber = (baseNumber + attempt - 1).toString().padStart(3, '0');
    
    return `${categoryCode}${newNumber}`;
  }

  /**
   * Generar código de barras alternativo
   */
  generateAlternativeBarcode(existingBarcodes: string[] = []): string {
    let attempts = 0;
    let barcode: string;
    
    do {
      barcode = this.generateBarcode();
      attempts++;
    } while (existingBarcodes.includes(barcode) && attempts < 10);
    
    return barcode;
  }

  /**
   * Generar múltiples SKUs para diferentes categorías
   */
  generateMultipleSKUs(categories: string[], existingSKUs: string[] = []): { [category: string]: string } {
    const result: { [category: string]: string } = {};
    
    categories.forEach(category => {
      result[category] = this.generateSKU(category, existingSKUs);
      // Agregar el SKU generado a la lista para evitar duplicados
      existingSKUs.push(result[category]);
    });
    
    return result;
  }

  /**
   * Extraer información de un SKU simple (formato CAT###)
   * Devuelve la categoría y el número secuencial
   * @param sku Código SKU a analizar (ej: "ELE001")
   * @returns Objeto con categoría, número y validez del SKU
   */
  parseSKU(sku: string): { category: string; number: number; isValid: boolean } {
    if (!this.validateSKUFormat(sku)) {
      return { category: '', number: 0, isValid: false };
    }
    
    const categoryCode = sku.substring(0, 3);
    const number = parseInt(sku.substring(3));
    
    // Encontrar nombre de categoría por código
    const categoryName = Object.keys(this.CATEGORY_CODES).find(
      key => this.CATEGORY_CODES[key] === categoryCode
    ) || 'Desconocida';
    
    return {
      category: categoryName,
      number: number,
      isValid: true
    };
  }

  /**
   * Extraer información de un SKU personalizado (formato CAT-MAR-###)
   * Devuelve la categoría, marca y número secuencial
   * @param sku Código SKU a analizar (ej: "ELE-SAM-001")
   * @returns Objeto con categoría, marca, número y validez del SKU
   */
  parseCustomSKU(sku: string): { category: string; brand: string; number: number; isValid: boolean } {
    // Validar formato esperado: XXX-XXX-000
    const skuPattern = /^([A-Z]{3})-([A-Z]{3})-(\d{3})$/;
    const match = sku.match(skuPattern);
    
    if (!match) {
      return { category: '', brand: '', number: 0, isValid: false };
    }
    
    const [, categoryCode, brandCode, numberStr] = match;
    
    // Encontrar nombre de categoría por código
    const categoryName = Object.keys(this.CATEGORY_CODES).find(
      key => this.CATEGORY_CODES[key] === categoryCode
    ) || 'Desconocida';
    
    return {
      category: categoryName,
      brand: brandCode,
      number: parseInt(numberStr),
      isValid: true
    };
  }

  /**
   * Validar formato de SKU personalizado (XXX-XXX-000)
   */
  validateCustomSKUFormat(sku: string): boolean {
    const skuPattern = /^[A-Z]{3}-[A-Z]{3}-\d{3}$/;
    return skuPattern.test(sku);
  }

  /**
   * Generar datos de productos de ejemplo con SKUs y códigos de barras
   * Útil para pruebas y demostraciones de la aplicación
   */
  generateDemoData(): Array<{
    category: string;
    sku: string;
    barcode: string;
    productName: string;
  }> {
    const demoProducts = [
      { category: 'Electrónicos', productName: 'Smartphone Samsung Galaxy' },
      { category: 'Alimentación', productName: 'Arroz Integral 1kg' },
      { category: 'Ropa', productName: 'Camiseta Algodón Talla M' },
      { category: 'Hogar', productName: 'Lámpara de Mesa LED' },
      { category: 'Deportes', productName: 'Pelota de Fútbol Profesional' }
    ];

    const existingSKUs: string[] = [];
    const existingBarcodes: string[] = [];

    return demoProducts.map(product => {
      const sku = this.generateSKU(product.category, existingSKUs);
      const barcode = this.generateAlternativeBarcode(existingBarcodes);
      
      existingSKUs.push(sku);
      existingBarcodes.push(barcode);
      
      return {
        category: product.category,
        sku: sku,
        barcode: barcode,
        productName: product.productName
      };
    });
  }
}