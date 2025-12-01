import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Platform } from '@ionic/angular';
import { AuthService } from './shared/services/auth.service';
import { DatabaseService } from './shared/services/database.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  
  constructor(
    private platform: Platform,
    private authService: AuthService,
    private router: Router,
    private databaseService: DatabaseService
  ) {}

  async ngOnInit() {
    try {
      console.log('🚀 Iniciando aplicación ScanShelf...');
      await this.platform.ready();
      console.log('✅ Plataforma Ionic lista');
      
      await this.initializeApp();
    } catch (error) {
      console.error('❌ Error crítico en ngOnInit:', error);
      // Continuar con navegación por seguridad
      this.checkAuthenticationStatus();
    }
  }

  /**
   * Inicializar la aplicación de forma síncrona y robusta
   */
  private async initializeApp() {
    try {
      console.log('🔄 Iniciando inicialización completa de la aplicación...');
      
      // Paso 1: Inicializar base de datos de forma síncrona
      console.log('🔄 Paso 1: Inicializando base de datos...');
      await this.databaseService.initializeDatabase();
      console.log('✅ Paso 1 completado: Base de datos inicializada');
      
      // Paso 2: Verificar que la BD esté realmente lista
      console.log('🔄 Paso 2: Verificando estado de la base de datos...');
      const isReady = await this.databaseService.isDatabaseReady();
      if (!isReady) {
        throw new Error('Base de datos no pudo ser inicializada');
      }
      console.log('✅ Paso 2 completado: Base de datos verificada y lista');
      
      // Paso 3: Asegurar integridad de datos
      console.log('🔄 Paso 3: Verificando y asegurando datos...');
      await this.databaseService.checkAndReinitializeData();
      console.log('✅ Paso 3 completado: Integridad de datos asegurada');
      
      // Paso 4: Verificar que los productos estén disponibles
      console.log('🔄 Paso 4: Verificando disponibilidad de productos...');
      const products = await this.databaseService.getProducts();
      console.log(`✅ Paso 4 completado: ${products.length} productos disponibles`);
      
      // Si no hay productos después de todo, forzar carga
      if (products.length === 0) {
        console.log('⚠️ Forzando carga de productos de ejemplo...');
        await this.databaseService.loadSampleProducts();
        const finalProducts = await this.databaseService.getProducts();
        console.log(`🔄 Productos finales disponibles: ${finalProducts.length}`);
      }
      
      console.log('✅ Inicialización de aplicación completada exitosamente');
      
      // Navegar solo después de que todo esté listo
      this.checkAuthenticationStatus();
      
    } catch (error) {
      console.error('❌ Error crítico en inicialización de la aplicación:', error);
      
      // Intentar recuperación de emergencia
      console.log('🔧 Intentando recuperación de emergencia...');
      try {
        await this.emergencyRecovery();
        console.log('✅ Recuperación de emergencia exitosa');
      } catch (recoveryError) {
        console.error('❌ Recuperación de emergencia falló:', recoveryError);
      }
      
      // Continuar con la navegación como último recurso
      this.checkAuthenticationStatus();
    }
  }

  /**
   * Recuperación de emergencia en caso de falla crítica
   */
  private async emergencyRecovery(): Promise<void> {
    try {
      console.log('🆘 Ejecutando recuperación de emergencia...');
      
      // Reinicializar desde cero
      await this.databaseService.initializeDatabase();
      
      // Forzar carga de datos mínimos
      await this.databaseService.loadSampleProducts();
      
      console.log('✅ Recuperación de emergencia completada');
    } catch (emergencyError) {
      console.error('❌ Recuperación de emergencia falló:', emergencyError);
      throw emergencyError;
    }
  }

  /**
   * Verificar el estado de autenticación al iniciar la app
   */
  private checkAuthenticationStatus() {
    try {
      console.log('🔐 Verificando estado de autenticación...');
      
      // Verificar si hay una sesión válida
      if (this.authService.isAuthenticated() && this.authService.isCurrentSessionValid()) {
        // Hay una sesión válida, redirigir a la app principal
        console.log('✅ Sesión válida encontrada, redirigiendo a /tabs');
        this.router.navigate(['/tabs'], { replaceUrl: true });
      } else {
        // No hay sesión válida o está expirada
        if (this.authService.isAuthenticated()) {
          // Hay datos de sesión pero están expirados
          console.log('⚠️ Sesión expirada, cerrando sesión y redirigiendo a login');
          this.authService.logout();
        } else {
          console.log('ℹ️ No hay sesión activa, redirigiendo a login');
        }
        this.router.navigate(['/login'], { replaceUrl: true });
      }
      
      console.log('✅ Navegación completada');
    } catch (error) {
      console.error('❌ Error en verificación de autenticación:', error);
      // Fallback a login por seguridad
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}
