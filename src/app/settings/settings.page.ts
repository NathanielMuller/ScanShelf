import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService, User } from '../shared/services/auth.service';
import { trigger, style, transition, animate } from '@angular/animations';

export interface AppSettings {
  notifications: boolean;
  darkMode: boolean;
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
    darkMode: false,
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
  onNotificationsChange(event: any) {
    this.settings.notifications = event.detail.checked;
    this.saveSettings();
    // TODO: Configure push notifications
  }

  /**
   * Handle dark mode toggle
   */
  onDarkModeChange(event: any) {
    this.settings.darkMode = event.detail.checked;
    this.saveSettings();
    // TODO: Apply dark mode theme
    console.log('Dark mode:', this.settings.darkMode ? 'enabled' : 'disabled');
  }

  /**
   * Handle language change
   */
  onLanguageChange(event: any) {
    this.settings.language = event.detail.value;
    this.saveSettings();
    // TODO: Change app language
    console.log('Language changed to:', this.settings.language);
  }

  /**
   * Handle auto sync toggle
   */
  onAutoSyncChange(event: any) {
    this.settings.autoSync = event.detail.checked;
    this.saveSettings();
    // TODO: Configure auto sync
  }

  /**
   * Handle biometrics toggle
   */
  onBiometricsChange(event: any) {
    this.settings.biometrics = event.detail.checked;
    this.saveSettings();
    // TODO: Configure biometric authentication
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

    const alert = await this.alertController.create({
      header: 'Editar Perfil',
      message: 'Función en desarrollo. Próximamente podrás editar tu información personal.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'OK',
          handler: () => {
            // TODO: Navigate to profile edit page
            console.log('Navigate to profile edit');
          }
        }
      ]
    });
    await alert.present();
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
        darkMode: false,
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
    const alert = await this.alertController.create({
      header: 'Soporte Técnico',
      message: 'Función en desarrollo. Próximamente podrás contactar al soporte técnico directamente desde la aplicación.',
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
