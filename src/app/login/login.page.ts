import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../shared/services/auth.service';
import { PinService } from '../shared/services/pin.service';
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

  // Estados para el flujo de PIN
  isPinConfigured = false;
  isConfiguringPin = false;
  pinToConfirm = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private pinService: PinService,
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

    // Verificar si hay PIN configurado
    this.isPinConfigured = this.pinService.isPinConfigured();
    
    // Si no hay PIN, iniciar configuración
    if (!this.isPinConfigured) {
      this.isConfiguringPin = true;
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
          Validators.minLength(3),
          Validators.maxLength(20)
        ]
      ],
      pin: [
        '', 
        [
          Validators.required,
          Validators.pattern(/^\d{6}$/), // Exactamente 6 dígitos
          this.validatePinSecurity.bind(this) // Validador de seguridad
        ]
      ],
      confirmPin: [''] // Solo para configuración inicial
    });
  }

  /**
   * Manejar envío de formulario de login/configuración
   */
  async onSubmit() {
    if (this.loginForm.invalid) {
      await this.showValidationErrors();
      this.triggerShakeAnimation();
      return;
    }

    if (this.isConfiguringPin) {
      await this.handlePinConfiguration();
    } else {
      await this.handlePinVerification();
    }
  }

  /**
   * Configurar PIN por primera vez
   */
  private async handlePinConfiguration() {
    const pin = this.loginForm.get('pin')?.value;
    const username = this.loginForm.get('username')?.value?.trim() || 'Usuario';
    const confirmPin = this.loginForm.get('confirmPin')?.value;

    // Si es el primer paso, guardar PIN y pedir confirmación
    if (!this.pinToConfirm) {
      this.pinToConfirm = pin;
      this.loginForm.patchValue({ pin: '', confirmPin: '' });
      await this.showSuccessToast('Ahora confirma tu PIN');
      return;
    }

    // Verificar que los PINs coincidan
    if (pin !== this.pinToConfirm) {
      await this.showErrorAlert('Los PINs no coinciden. Intenta de nuevo.');
      this.pinToConfirm = '';
      this.loginForm.patchValue({ pin: '', confirmPin: '' });
      this.triggerShakeAnimation();
      return;
    }

    const loading = await this.showLoading('Configurando PIN...');
    
    try {
      const result = this.pinService.configurePin(pin, username);
      
      if (result.success) {
        await this.showSuccessToast('¡PIN configurado exitosamente!');
        this.isPinConfigured = true;
        this.isConfiguringPin = false;
        this.pinToConfirm = '';
        this.loginForm.patchValue({ pin: '', confirmPin: '' });
      } else {
        await this.showErrorAlert(result.error || 'Error al configurar PIN');
        this.triggerShakeAnimation();
      }
    } catch (error) {
      await this.showErrorAlert('Error al configurar el PIN');
      this.triggerShakeAnimation();
    } finally {
      await loading.dismiss();
    }
  }

  /**
   * Verificar PIN e iniciar sesión
   */
  private async handlePinVerification() {
    const loading = await this.showLoading('Verificando PIN...');
    
    try {
      const pin = this.loginForm.get('pin')?.value;
      const result = this.pinService.verifyPin(pin);
      
      if (result.success) {
        // Obtener el nombre de usuario guardado
        const username = this.pinService.getUsername();
        
        // Crear sesión con el PIN
        await this.authService.loginWithPin(username);
        
        await this.showSuccessToast(`¡Bienvenido ${username}!`);
        
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
        await this.showErrorAlert(result.error || 'PIN incorrecto');
        this.triggerShakeAnimation();
      }
    } catch (error) {
      await this.showErrorAlert('Error al verificar el PIN');
      this.triggerShakeAnimation();
    } finally {
      await loading.dismiss();
    }
  }


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
      if (errors['minlength']) return 'Mínimo 3 caracteres';
      if (errors['maxlength']) return 'Máximo 20 caracteres';
    }
    
    if (field === 'pin') {
      if (errors['required']) return 'El PIN es requerido';
      if (errors['pattern']) return 'Debe ser exactamente 6 dígitos';
      if (errors['weakPin']) return errors['weakPin'].message;
      if (errors['consecutiveNumbers']) return errors['consecutiveNumbers'].message;
    }
    
    return '';
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

  // Validador de seguridad para PINs
  private validatePinSecurity(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    
    if (!value) return null;
    
    // Verificar patrones débiles
    const weakPatterns = [
      '000000', '111111', '222222', '333333', '444444', 
      '555555', '666666', '777777', '888888', '999999',
      '123456', '654321'
    ];
    if (weakPatterns.includes(value)) {
      return { weakPin: { message: 'PIN muy débil, evita patrones comunes' } };
    }
    
    // Verificar secuencias consecutivas
    if (this.hasConsecutiveNumbers(value)) {
      return { consecutiveNumbers: { message: 'Evita números consecutivos' } };
    }
    
    return null;
  }

  // Función auxiliar para detectar números consecutivos
  private hasConsecutiveNumbers(value: string): boolean {
    for (let i = 0; i < value.length - 2; i++) {
      const current = parseInt(value[i]);
      const next = parseInt(value[i + 1]);
      const nextNext = parseInt(value[i + 2]);
      if ((next === current + 1 && nextNext === next + 1) || 
          (next === current - 1 && nextNext === next - 1)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluar la fuerza del PIN
   */
  getPinStrength(pin: string): { level: 'weak' | 'fair' | 'good' | 'strong', percentage: number, message: string } {
    if (!pin) {
      return { level: 'weak', percentage: 0, message: 'Ingresa un PIN' };
    }

    if (pin.length < 6) {
      return { level: 'weak', percentage: 25, message: 'Muy corto' };
    }

    const weakPatterns = [
      '000000', '111111', '222222', '333333', '444444', 
      '555555', '666666', '777777', '888888', '999999',
      '123456', '654321'
    ];
    if (weakPatterns.includes(pin)) {
      return { level: 'weak', percentage: 25, message: 'Patrón muy común' };
    }

    if (this.hasConsecutiveNumbers(pin)) {
      return { level: 'fair', percentage: 50, message: 'Evita secuencias' };
    }

    // Para PINs de 6 dígitos, evaluar variedad
    const uniqueDigits = new Set(pin).size;
    if (uniqueDigits >= 5) {
      return { level: 'strong', percentage: 100, message: 'PIN fuerte' };
    } else if (uniqueDigits >= 4) {
      return { level: 'good', percentage: 75, message: 'Buen PIN' };
    } else {
      return { level: 'fair', percentage: 50, message: 'Usa más variedad' };
    }
  }

  /**
   * Mostrar mensaje de error del auth guard
   */
  private async showGuardErrorMessage(errorMessage: string) {
    // Alert removido - usuario será redirigido al login automáticamente
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
