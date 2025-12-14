import { Injectable } from '@angular/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { DatabaseService } from './database.service';
import { MovementsService } from './movements.service';
import jsPDF from 'jspdf';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {

  constructor(
    private databaseService: DatabaseService,
    private movementsService: MovementsService
  ) { }

  /**
   * Generar reporte de inventario actual en CSV
   */
  async generateInventoryReport(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const db = (window as any).sqlitePlugin.openDatabase({
          name: 'scanshelf.db',
          location: 'default'
        });

        db.transaction((tx: any) => {
          tx.executeSql(
            'SELECT name, category, stock, price, sku FROM products ORDER BY name ASC',
            [],
            (tx: any, results: any) => {
              let csv = 'Nombre,Categoría,Stock,Precio,SKU\n';
              
              for (let i = 0; i < results.rows.length; i++) {
                const p = results.rows.item(i);
                csv += `"${p.name}","${p.category || ''}",${p.stock || 0},${p.price || 0},"${p.sku || ''}"\n`;
              }
              
              resolve(csv);
            },
            (error: any) => {
              console.error('Error generando reporte inventario:', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        reject(error);
      }
    });
  }



  /**
   * Generar reporte de movimientos
   */
  async generateMovementsReport(filters?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    reason?: string;
  }): Promise<string> {
    const movements = await this.movementsService.getMovements(filters);
    
    let csv = 'Fecha,Hora,Producto,Tipo,Cantidad,Stock Anterior,Stock Nuevo,Razón,Notas,Usuario\n';
    
    movements.forEach((movement: any) => {
      const date = new Date(movement.createdAt!);
      const dateStr = date.toLocaleDateString('es-ES');
      const timeStr = date.toLocaleTimeString('es-ES');
      const typeStr = movement.type === 'entrada' ? 'Entrada' : 'Salida';
      const reasonStr = this.getReasonLabel(movement.reason);
      
      csv += `"${dateStr}","${timeStr}","${movement.productName || ''}","${typeStr}",${movement.quantity},${movement.previousStock},${movement.newStock},"${reasonStr}","${movement.notes || ''}","${movement.userId || ''}"\n`;
    });
    
    return csv;
  }



  /**
   * Generar reporte de estadísticas de movimientos
   */
  async generateMovementStatsReport(startDate?: string, endDate?: string): Promise<string> {
    const stats = await this.movementsService.getMovementStats();
    const movements = await this.movementsService.getMovements({
      startDate,
      endDate
    });
    
    let csv = 'Concepto,Cantidad,Observaciones\n';
    
    csv += `"Total Entradas",${stats.totalEntradas},""\n`;
    csv += `"Total Salidas",${stats.totalSalidas},""\n`;
    csv += `"Balance",${stats.totalEntradas - stats.totalSalidas},""\n`;
    csv += '\n';
    csv += `"Ventas",${stats.ventasTotal},""\n`;
    csv += `"Pérdidas",${stats.perdidasTotal},""\n`;
    csv += `"Ingresos",${stats.ingresosTotal},""\n`;
    csv += `"Devoluciones",${stats.devolucionesTotal},""\n`;
    csv += '\n';
    csv += `"Total Movimientos",${movements.length},""\n`;
    
    const period = startDate && endDate 
      ? `Período: ${new Date(startDate).toLocaleDateString('es-ES')} - ${new Date(endDate).toLocaleDateString('es-ES')}`
      : 'Todos los movimientos';
    csv += `"Período","${period}",""\n`;
    
    return csv;
  }

  /**
   * Exportar CSV a archivo y compartir
   */
  async exportAndShareCSV(csvContent: string, fileName: string): Promise<void> {
    try {
      console.log('=== Exportando CSV ===');
      console.log('Nombre archivo:', fileName);
      console.log('Tamaño contenido:', csvContent?.length || 0, 'caracteres');
      
      // Crear archivo
      const result = await Filesystem.writeFile({
        path: fileName,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8
      });
      
      console.log('Archivo CSV creado:', result.uri);
      
      // Compartir archivo
      await Share.share({
        title: 'Exportar Reporte',
        text: `Reporte: ${fileName}`,
        url: result.uri,
        dialogTitle: 'Compartir reporte'
      });
      
      console.log('Compartir CSV completado exitosamente');
      
    } catch (error) {
      console.error('Error al exportar y compartir CSV:', error);
      throw error;
    }
  }

  /**
   * Obtener etiqueta de razón de movimiento
   */
  private getReasonLabel(reason: string): string {
    const labels: any = {
      venta: 'Venta',
      perdida: 'Pérdida',
      ingreso: 'Ingreso',
      devolucion: 'Devolución'
    };
    return labels[reason] || reason;
  }

  /**
   * Generar nombre de archivo con fecha
   */
  generateFileName(reportType: string, extension: string = 'csv'): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `${reportType}_${dateStr}_${timeStr}.${extension}`;
  }

  /**
   * Generar PDF de inventario actual
   */
  async generateInventoryPDF(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const db = (window as any).sqlitePlugin.openDatabase({
          name: 'scanshelf.db',
          location: 'default'
        });

        db.transaction((tx: any) => {
          tx.executeSql(
            'SELECT name, category, stock, price FROM products ORDER BY name ASC',
            [],
            (tx: any, results: any) => {
              const doc = new jsPDF();

              doc.setFontSize(18);
              doc.text('Inventario', 14, 20);
              
              doc.setFontSize(10);
              doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);
              doc.text(`Total: ${results.rows.length} productos`, 14, 34);

              let y = 45;
              doc.setFontSize(8);
              
              for (let i = 0; i < results.rows.length; i++) {
                if (y > 280) {
                  doc.addPage();
                  y = 20;
                }
                const p = results.rows.item(i);
                doc.text(`${i + 1}. ${p.name} | ${p.category || ''} | Stock: ${p.stock || 0} | $${p.price || 0}`, 14, y);
                y += 5;
              }

              const base64 = doc.output('datauristring').split(',')[1];
              resolve(base64);
            },
            (error: any) => {
              console.error('Error generando PDF inventario:', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        reject(error);
      }
    });
  }



  /**
   * Generar PDF de movimientos
   */
  async generateMovementsPDF(filters?: any): Promise<string> {
    const movements = await this.movementsService.getMovements(filters);
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Reporte de Movimientos', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);
    doc.text(`Total: ${movements.length} movimientos`, 14, 34);

    let y = 45;
    doc.setFontSize(8);
    
    movements.forEach((m: any, index: number) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      
      const date = new Date(m.createdAt);
      const tipo = m.type === 'entrada' ? 'E' : 'S';
      const line = `${index + 1}. [${tipo}] ${m.productName || ''} | Cant: ${m.quantity} | ${this.getReasonLabel(m.reason)} | ${date.toLocaleDateString('es-ES')}`;
      doc.text(line, 14, y);
      y += 5;
    });

    return doc.output('datauristring').split(',')[1];
  }



  /**
   * Generar PDF de estadísticas
   */
  async generateStatsPDF(startDate?: string, endDate?: string): Promise<string> {
    const stats = await this.movementsService.getMovementStats();
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Estadísticas de Movimientos', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

    let y = 45;
    doc.setFontSize(12);

    doc.text(`Total Entradas: ${stats.totalEntradas}`, 14, y);
    y += 8;
    doc.text(`Total Salidas: ${stats.totalSalidas}`, 14, y);
    y += 8;
    doc.text(`Balance: ${stats.totalEntradas - stats.totalSalidas}`, 14, y);
    y += 15;

    doc.text(`Ventas: ${stats.ventasTotal}`, 14, y);
    y += 8;
    doc.text(`Pérdidas: ${stats.perdidasTotal}`, 14, y);
    y += 8;
    doc.text(`Ingresos: ${stats.ingresosTotal}`, 14, y);
    y += 8;
    doc.text(`Devoluciones: ${stats.devolucionesTotal}`, 14, y);

    return doc.output('datauristring').split(',')[1];
  }

  /**
   * Exportar PDF y compartir
   */
  async exportAndSharePDF(base64Data: string, fileName: string): Promise<void> {
    try {
      console.log('Exportando PDF:', fileName);
      
      // Guardar archivo
      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache
      });

      console.log('PDF creado:', result.uri);

      // Compartir
      await Share.share({
        title: 'Exportar Reporte PDF',
        text: `Reporte: ${fileName}`,
        url: result.uri,
        dialogTitle: 'Compartir reporte PDF'
      });

    } catch (error) {
      console.error('Error al exportar PDF:', error);
      throw error;
    }
  }
}

