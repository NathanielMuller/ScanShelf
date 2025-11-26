import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class AccessControlService {

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController
  ) { }

  /**
   * Verificar si el usuario actual puede acceder a una función específica
   */
  canAccessFeature(featureName: string): boolean {
    if (!this.authService.isAuthenticated()) {
      return false;
    }

    // Si es usuario invitado, tiene restricciones
    if (this.authService.isGuestUser()) {
      const restrictedFeatures = ['scan', 'movements', 'reports', 'advanced-settings'];
      return !restrictedFeatures.includes(featureName);
    }

    // Usuario registrado tiene acceso completo
    return true;
  }

  /**
   * Mostrar mensaje informativo sobre restricción de acceso
   */
  async showAccessRestrictionMessage(featureName: string) {
    const featureNames: { [key: string]: string } = {
      scan: 'Escaneo de Productos',
      movements: 'Historial de Movimientos',
      reports: 'Reportes Detallados',
      'advanced-settings': 'Configuraciones Avanzadas'
    };

    const toast = await this.toastController.create({
      message: `⚠️ ${featureNames[featureName] || 'Esta función'} requiere una cuenta registrada`,
      duration: 3000,
      position: 'bottom',
      color: 'warning',
      buttons: [
        {
          text: 'Registrarse',
          role: 'button',
          handler: () => {
            // Aquí podrías navegar a una página de registro
            console.log('Navegar a registro');
          }
        }
      ],
      cssClass: 'access-restriction-toast'
    });

    await toast.present();
  }

  /**
   * Mostrar información detallada sobre los beneficios de registrarse
   */
  async showRegistrationBenefits() {
    const alert = await this.alertController.create({
      header: '🔓 Desbloquea Todas las Funciones',
      message: `
        <div style="text-align: left;">
          <p><strong>Con una cuenta registrada podrás:</strong></p>
          <br>
          <p>📱 <strong>Escanear productos</strong> con la cámara</p>
          <p>📊 <strong>Ver historial completo</strong> de movimientos</p>
          <p>📈 <strong>Generar reportes</strong> detallados</p>
          <p>⚙️ <strong>Acceder a configuraciones</strong> avanzadas</p>
          <p>💾 <strong>Guardar tus preferencias</strong> personalizadas</p>
          <br>
          <p style="color: var(--ion-color-medium); font-size: 0.9em;">
            ¡Registrarte es rápido y gratuito!
          </p>
        </div>
      `,
      buttons: [
        {
          text: 'Más tarde',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Registrarse',
          handler: () => {
            // Navegar a registro o mostrar formulario
            console.log('Iniciar proceso de registro');
          }
        }
      ],
      cssClass: 'registration-benefits-alert'
    });

    await alert.present();
  }

  /**
   * Verificar y manejar acceso a función restringida
   */
  async checkAndHandleAccess(featureName: string): Promise<boolean> {
    if (this.canAccessFeature(featureName)) {
      return true;
    }

    // Mostrar mensaje de restricción
    await this.showAccessRestrictionMessage(featureName);
    return false;
  }

  /**
   * Obtener lista de funciones disponibles para el usuario actual
   */
  getAvailableFeatures(): string[] {
    if (!this.authService.isAuthenticated()) {
      return [];
    }

    if (this.authService.isGuestUser()) {
      return ['products', 'basic-settings'];
    }

    return ['products', 'scan', 'movements', 'reports', 'settings'];
  }

  /**
   * Obtener información del nivel de acceso actual
   */
  getAccessLevel(): {
    type: 'guest' | 'registered' | 'unauthenticated';
    label: string;
    color: string;
    features: number;
  } {
    if (!this.authService.isAuthenticated()) {
      return {
        type: 'unauthenticated',
        label: 'Sin acceso',
        color: 'danger',
        features: 0
      };
    }

    if (this.authService.isGuestUser()) {
      return {
        type: 'guest',
        label: 'Acceso limitado',
        color: 'warning',
        features: 2
      };
    }

    return {
      type: 'registered',
      label: 'Acceso completo',
      color: 'success',
      features: 5
    };
  }
}