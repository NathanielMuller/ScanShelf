import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService, User } from '../shared/services/auth.service';
import { PinService } from '../shared/services/pin.service';
import { trigger, style, transition, animate } from '@angular/animations';

export interface AppSettings {
  notifications: boolean;
  language: string;
  autoSync: boolean;
  biometrics: boolean;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class SettingsPage implements OnInit {
  
  currentUser: User | null = null;
  isGuest = false;
  
  // User Profile (demo data)
  userProfile = {
    name: '',
    email: '',
    phone: '',
    role: 'user'
  };
  
  // App Settings (demo data)
  settings: AppSettings = {
    notifications: true,
    language: 'es',
    autoSync: true,
    biometrics: false
  };
  
  // Available languages
  languages = [
    { code: 'es', name: 'Español' },
    { code: 'en', name: 'English' },
    { code: 'pt', name: 'Português' }
  ];
  
  // App info
  appInfo = {
    version: '1.0.0',
    buildNumber: '2025.11.09',
    developer: 'ScanShelf Team'
  };

  constructor(
    private authService: AuthService,
    private pinService: PinService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.loadSettings();
  }

  /**
   * Load current user data
   */
  private loadUserData() {
    this.currentUser = this.authService.getCurrentUser();
    this.isGuest = this.authService.isGuest();
    
    if (this.currentUser) {
      // Demo user profile data
      this.userProfile = {
        name: this.currentUser.usuario,
        email: this.isGuest ? 'invitado@scanshelf.com' : `${this.currentUser.usuario.toLowerCase()}@empresa.com`,
        phone: this.isGuest ? 'N/A' : '+56 9 1234 5678',
        role: this.isGuest ? 'guest' : 'user'
      };
    }
  }

  /**
   * Load app settings from localStorage
   * TODO: Replace with SettingsService
   */
  private loadSettings() {
    try {
      const storedSettings = localStorage.getItem('scanshelf_settings');
      if (storedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
      }
    } catch (error) {
      console.warn('Error loading settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   * TODO: Replace with SettingsService.saveSettings()
   */
  private saveSettings() {
    try {
      localStorage.setItem('scanshelf_settings', JSON.stringify(this.settings));
      this.showSuccessToast('Configuración guardada');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showErrorToast('Error al guardar configuración');
    }
  }

  /**
   * Handle notification toggle
   */
  async onNotificationsChange(event: any) {
    this.settings.notifications = event.detail.checked;
    this.saveSettings();
    
    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }



  /**
   * Handle language change
   */
  async onLanguageChange(event: any) {
    this.settings.language = event.detail.value;
    this.saveSettings();
    
    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }

  /**
   * Handle auto sync toggle
   */
  async onAutoSyncChange(event: any) {
    this.settings.autoSync = event.detail.checked;
    this.saveSettings();
    
    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }

  /**
   * Handle biometrics toggle
   */
  async onBiometricsChange(event: any) {
    this.settings.biometrics = event.detail.checked;
    this.saveSettings();
    
    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }

  /**
   * Edit user profile
   */
  async editProfile() {
    if (this.isGuest) {
      const alert = await this.alertController.create({
        header: 'Función no disponible',
        message: 'Los usuarios invitados no pueden editar su perfil. Inicia sesión con una cuenta para acceder a esta función.',
        buttons: ['Entendido']
      });
      await alert.present();
      return;
    }

    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }

  /**
   * Clear app data
   */
  async clearAppData() {
    const alert = await this.alertController.create({
      header: 'Borrar Datos',
      message: '¿Estás seguro de que quieres borrar todos los datos de la aplicación? Esta acción no se puede deshacer.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: () => {
            this.performClearData();
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Perform clear data operation
   */
  private performClearData() {
    try {
      // Clear all localStorage data except current user session
      const currentUser = localStorage.getItem('scanshelf_user');
      localStorage.clear();
      if (currentUser) {
        localStorage.setItem('scanshelf_user', currentUser);
      }
      
      // Reset settings to default
      this.settings = {
        notifications: true,
        language: 'es',
        autoSync: true,
        biometrics: false
      };
      
      this.showSuccessToast('Datos de la aplicación borrados');
    } catch (error) {
      this.showErrorToast('Error al borrar datos');
    }
  }

  /**
   * Show about dialog
   */
  async showAbout() {
    const alert = await this.alertController.create({
      header: 'Acerca de ScanShelf',
      message: `
        <div style="text-align: left;">
          <p><strong>Versión:</strong> ${this.appInfo.version}</p>
          <p><strong>Build:</strong> ${this.appInfo.buildNumber}</p>
          <p><strong>Desarrollado por:</strong> ${this.appInfo.developer}</p>
          <br>
          <p>ScanShelf es una aplicación de gestión de inventario que te permite controlar tus productos de manera eficiente desde tu dispositivo móvil.</p>
        </div>
      `,
      buttons: ['Cerrar']
    });
    await alert.present();
  }

  /**
   * Contact support
   */
  async contactSupport() {
    const toast = await this.toastController.create({
      message: 'Funcionalidad en desarrollo',
      duration: 2000,
      position: 'top',
      color: 'tertiary'
    });
    await toast.present();
  }

  /**
   * Cambiar nombre de usuario
   */
  async changeUsername() {
    if (this.isGuest) {
      await this.showGuestRestrictionAlert();
      return;
    }

    const currentUsername = this.pinService.getUsername();

    const alert = await this.alertController.create({
      header: 'Cambiar Nombre de Usuario',
      message: 'Ingresa tu nuevo nombre de usuario',
      inputs: [
        {
          name: 'username',
          type: 'text',
          placeholder: 'Nuevo nombre',
          value: currentUsername,
          attributes: {
            maxlength: 20,
            minlength: 3
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cambiar',
          handler: async (data) => {
            const newUsername = data.username?.trim();
            if (!newUsername || newUsername.length < 3) {
              this.showErrorToast('El nombre debe tener al menos 3 caracteres');
              return false;
            }
            if (newUsername.length > 20) {
              this.showErrorToast('El nombre no puede superar 20 caracteres');
              return false;
            }

            const result = this.pinService.updateUsername(newUsername);
            if (result.success) {
              // Actualizar la sesión del usuario
              await this.authService.loginWithPin(newUsername);
              this.loadUserData();
              this.showSuccessToast('Nombre de usuario actualizado');
            } else {
              this.showErrorToast(result.error || 'Error al actualizar el nombre');
            }
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Cambiar PIN
   */
  async changePin() {
    if (this.isGuest) {
      await this.showGuestRestrictionAlert();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cambiar PIN',
      message: 'Ingresa tu PIN actual y el nuevo PIN',
      inputs: [
        {
          name: 'currentPin',
          type: 'password',
          placeholder: 'PIN actual (6 dígitos)',
          attributes: {
            maxlength: 6,
            inputmode: 'numeric'
          }
        },
        {
          name: 'newPin',
          type: 'password',
          placeholder: 'Nuevo PIN (6 dígitos)',
          attributes: {
            maxlength: 6,
            inputmode: 'numeric'
          }
        },
        {
          name: 'confirmPin',
          type: 'password',
          placeholder: 'Confirmar nuevo PIN',
          attributes: {
            maxlength: 6,
            inputmode: 'numeric'
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cambiar',
          handler: async (data) => {
            // Validar que todos los campos estén llenos
            if (!data.currentPin || !data.newPin || !data.confirmPin) {
              this.showErrorToast('Completa todos los campos');
              return false;
            }

            // Validar formato de PINs
            const pinPattern = /^\d{6}$/;
            if (!pinPattern.test(data.currentPin) || !pinPattern.test(data.newPin)) {
              this.showErrorToast('Los PINs deben tener exactamente 6 dígitos');
              return false;
            }

            // Validar que el nuevo PIN y la confirmación coincidan
            if (data.newPin !== data.confirmPin) {
              this.showErrorToast('Los PINs nuevos no coinciden');
              return false;
            }

            // Intentar cambiar el PIN
            const result = this.pinService.changePin(data.currentPin, data.newPin);
            if (result.success) {
              this.showSuccessToast('PIN actualizado correctamente');
            } else {
              this.showErrorToast(result.error || 'Error al cambiar el PIN');
            }
            
            return result.success;
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Mostrar alerta de restricción para invitados
   */
  private async showGuestRestrictionAlert() {
    const alert = await this.alertController.create({
      header: 'Función no disponible',
      message: 'Los usuarios invitados no pueden acceder a esta función. Inicia sesión con una cuenta para continuar.',
      buttons: ['Entendido']
    });
    await alert.present();
  }

  /**
   * Logout user
   */
  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Cerrar Sesión',
          role: 'destructive',
          handler: () => {
            this.authService.logout();
            this.router.navigate(['/login'], { replaceUrl: true });
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(): string {
    switch (this.userProfile.role) {
      case 'guest': return 'Invitado';
      case 'user': return 'Usuario';
      case 'admin': return 'Administrador';
      default: return 'Usuario';
    }
  }

  /**
   * Get language display name
   */
  getLanguageDisplayName(): string {
    const lang = this.languages.find(l => l.code === this.settings.language);
    return lang ? lang.name : 'Español';
  }

  /**
   * Show success toast
   */
  private async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  }

  /**
   * Show error toast
   */
  private async showErrorToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  }
}
