import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../shared/services/auth.service';
import { Subscription, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
  animations: [
    trigger('heroAnimation', [
      state('in', style({ opacity: 1, transform: 'translateY(0)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(-14px)' }),
        animate('450ms ease-out')
      ])
    ]),
    trigger('shakeAnimation', [
      transition('* => shake', [
        animate('450ms ease-in-out', style({
          transform: 'translateX(0)'
        }))
      ])
    ])
  ]
})
export class LoginPage implements OnInit, OnDestroy {
  @ViewChild('loginCard', { static: false }) loginCard!: ElementRef;

  loginForm: FormGroup;
  isLoading = false;
  shakeState = 'normal';
  private subscription = new Subscription();

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.loginForm = this.createLoginForm();
  }

  ngOnInit() {
    // Verificar si ya está autenticado
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tabs']);
      return;
    }

    // Manejar mensajes del auth guard
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;
    
    if (state?.['error']) {
      this.showGuardErrorMessage(state['error']);
      
      // Guardar URL de retorno para después del login exitoso
      if (state['returnUrl']) {
        sessionStorage.setItem('returnUrl', state['returnUrl']);
      }
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private createLoginForm(): FormGroup {
    return this.formBuilder.group({
      username: [
        '', 
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(8),
          Validators.pattern(/^[a-zA-Z0-9]+$/) // Solo alfanuméricos
        ],
        [this.validateUsernameSecurityAsync.bind(this)] // Validador asíncrono
      ],
      password: [
        '', 
        [
          Validators.required,
          Validators.pattern(/^\d{4}$/), // Exactamente 4 dígitos
          this.validatePasswordSecurity.bind(this) // Validador de seguridad
        ]
      ]
    });
  }

  /**
   * Manejar envío de formulario de login
   */
  async onSubmit() {
    if (this.loginForm.invalid) {
      await this.showValidationErrors();
      this.triggerShakeAnimation();
      return;
    }

    await this.performLogin();
  }

  /**
   * Login como invitado con sesión limitada
   */


  /**
   * Verificar si el formulario tiene errores específicos
   */
  hasError(field: string, error: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.hasError(error) && (control.dirty || control.touched));
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (!control || !control.errors) return '';

    const errors = control.errors;
    
    if (field === 'username') {
      if (errors['required']) return 'El usuario es requerido';
      if (errors['minlength']) return 'Mínimo 3 caracteres';
      if (errors['maxlength']) return 'Máximo 8 caracteres';
      if (errors['pattern']) return 'Solo letras y números permitidos';
      if (errors['unsafeUsername']) return errors['unsafeUsername'].message;
    }
    
    if (field === 'password') {
      if (errors['required']) return 'La contraseña es requerida';
      if (errors['pattern']) return 'Debe ser exactamente 4 dígitos';
      if (errors['weakPassword']) return errors['weakPassword'].message;
      if (errors['consecutiveNumbers']) return errors['consecutiveNumbers'].message;
    }
    
    return '';
  }

  private async performLogin() {
    const loading = await this.showLoading('Iniciando sesión...');
    
    try {
      const { username, password } = this.loginForm.value;
      const result = await this.authService.login(username, password);
      
      if (result.success) {
        await this.showSuccessToast(`¡Bienvenido, ${username}!`);
        
        // Redirigir a la URL original si existe, sino a tabs
        const returnUrl = sessionStorage.getItem('returnUrl');
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
          this.router.navigateByUrl(returnUrl);
        } else {
          this.router.navigate(['/tabs'], { 
            state: { 
              usuario: username,
              guest: false
            } 
          });
        }
      } else {
        // Mostrar error específico del sistema de seguridad
        await this.showErrorAlert(result.error || 'Credenciales inválidas');
        this.triggerShakeAnimation();
        
        // Si el usuario está bloqueado, mostrar información adicional
        if (result.error?.includes('bloqueado')) {
          await this.showSecurityAlert();
        }
      }
    } catch (error) {
      await this.showErrorAlert('Error de conexión. Inténtalo de nuevo.');
      this.triggerShakeAnimation();
    } finally {
      loading.dismiss();
    }
  }

  private async showValidationErrors() {
    const errors: string[] = [];
    
    Object.keys(this.loginForm.controls).forEach(field => {
      const control = this.loginForm.get(field);
      if (control && control.invalid && (control.dirty || control.touched)) {
        errors.push(this.getErrorMessage(field));
      }
    });

    if (errors.length > 0) {
      const alert = await this.alertController.create({
        header: 'Errores de validación',
        message: errors.join('<br>'),
        buttons: ['OK'],
        cssClass: 'alert-error'
      });
      await alert.present();
    }
  }

  private triggerShakeAnimation() {
    this.shakeState = 'shake';
    setTimeout(() => {
      this.shakeState = 'normal';
    }, 450);
  }

  private async showLoading(message: string) {
    const loading = await this.loadingController.create({
      message,
      spinner: 'crescent',
      duration: 5000 // Máximo 5 segundos
    });
    await loading.present();
    return loading;
  }

  private async showSuccessToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'top',
      color: 'success',
      cssClass: 'toast-success'
    });
    await toast.present();
  }

  private async showErrorAlert(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK'],
      cssClass: 'alert-error'
    });
    await alert.present();
  }

  // Validador de seguridad para contraseñas
  private validatePasswordSecurity(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    
    if (!value) return null;
    
    // Verificar patrones débiles
    const weakPatterns = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];
    if (weakPatterns.includes(value)) {
      return { weakPassword: { message: 'Contraseña muy débil, evita patrones comunes' } };
    }
    
    // Verificar secuencias consecutivas
    if (this.hasConsecutiveNumbers(value)) {
      return { consecutiveNumbers: { message: 'Evita números consecutivos' } };
    }
    
    return null;
  }

  // Validador asíncrono para nombres de usuario
  private validateUsernameSecurityAsync(control: AbstractControl): Observable<ValidationErrors | null> {
    const value = control.value;
    
    if (!value || value.length < 3) {
      return of(null);
    }
    
    // Simular verificación de patrones inseguros
    const unsafePatterns = ['admin', 'test', 'user', 'guest', '123'];
    const containsUnsafePattern = unsafePatterns.some(pattern => 
      value.toLowerCase().includes(pattern)
    );
    
    return of(
      containsUnsafePattern 
        ? { unsafeUsername: { message: 'El nombre de usuario contiene patrones inseguros' } }
        : null
    ).pipe(delay(300)); // Simular latencia de verificación
  }

  // Función auxiliar para detectar números consecutivos
  private hasConsecutiveNumbers(value: string): boolean {
    for (let i = 0; i < value.length - 1; i++) {
      const current = parseInt(value[i]);
      const next = parseInt(value[i + 1]);
      if (next === current + 1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluar la seguridad del nombre de usuario en tiempo real
   */
  getUsernameSecurity(username: string): { level: 'safe' | 'warning' | 'danger', message: string, icon: string } {
    if (!username || username.length < 3) {
      return { level: 'danger', message: 'Muy corto', icon: 'alert-circle-outline' };
    }

    const unsafePatterns = ['admin', 'test', 'user', 'guest', '123'];
    const hasUnsafePattern = unsafePatterns.some(pattern => 
      username.toLowerCase().includes(pattern)
    );

    if (hasUnsafePattern) {
      return { level: 'warning', message: 'Contiene patrones comunes', icon: 'warning-outline' };
    }

    if (username.length >= 6) {
      return { level: 'safe', message: 'Nombre seguro', icon: 'shield-checkmark-outline' };
    }

    return { level: 'warning', message: 'Podría ser más seguro', icon: 'shield-outline' };
  }

  /**
   * Evaluar la fuerza de la contraseña
   */
  getPasswordStrength(password: string): { level: 'weak' | 'fair' | 'good' | 'strong', percentage: number, message: string } {
    if (!password) {
      return { level: 'weak', percentage: 0, message: 'Ingresa una contraseña' };
    }

    if (password.length < 4) {
      return { level: 'weak', percentage: 25, message: 'Muy débil' };
    }

    const weakPatterns = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321'];
    if (weakPatterns.includes(password)) {
      return { level: 'weak', percentage: 25, message: 'Patrón muy común' };
    }

    if (this.hasConsecutiveNumbers(password)) {
      return { level: 'fair', percentage: 50, message: 'Evita secuencias' };
    }

    // Para contraseñas de 4 dígitos, evaluar variedad
    const uniqueDigits = new Set(password).size;
    if (uniqueDigits >= 4) {
      return { level: 'strong', percentage: 100, message: 'Contraseña fuerte' };
    } else if (uniqueDigits >= 3) {
      return { level: 'good', percentage: 75, message: 'Buena contraseña' };
    } else {
      return { level: 'fair', percentage: 50, message: 'Usa más variedad' };
    }
  }

  /**
   * Mostrar mensaje de error del auth guard
   */
  private async showGuardErrorMessage(errorMessage: string) {
    const alert = await this.alertController.create({
      header: 'Acceso Restringido',
      message: `
        <div style="text-align: left;">
          <p><ion-icon name="lock-closed-outline"></ion-icon> <strong>${errorMessage}</strong></p>
          <br>
          <p style="color: var(--ion-color-medium); font-size: 0.9em;">
            Por favor, inicia sesión con una cuenta registrada para acceder a esta funcionalidad.
          </p>
        </div>
      `,
      buttons: ['Entendido'],
      cssClass: 'auth-guard-alert'
    });
    
    await alert.present();
  }

  /**
   * Mostrar alerta de seguridad para usuarios bloqueados
   */
  private async showSecurityAlert() {
    const alert = await this.alertController.create({
      header: 'Cuenta Bloqueada',
      message: `
        <div style="text-align: left;">
          <p><strong>Tu cuenta ha sido bloqueada temporalmente por seguridad.</strong></p>
          <br>
          <p><ion-icon name="shield-outline"></ion-icon> <strong>Motivo:</strong> Múltiples intentos de login fallidos</p>
          <p><ion-icon name="time-outline"></ion-icon> <strong>Duración:</strong> 15 minutos</p>
          <p><ion-icon name="key-outline"></ion-icon> <strong>Recomendación:</strong> Verifica tus credenciales</p>
          <br>
          <p style="color: var(--ion-color-medium); font-size: 0.9em;">
            Si continúas teniendo problemas, contacta al administrador del sistema.
          </p>
        </div>
      `,
      buttons: [
        {
          text: 'Entendido',
          role: 'confirm',
          handler: () => {
            console.log('Usuario informado sobre bloqueo de seguridad');
          }
        }
      ],
      cssClass: 'security-alert'
    });
    await alert.present();
  }
}
