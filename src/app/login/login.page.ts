import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../shared/services/auth.service';
import { Subscription } from 'rxjs';

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
        ]
      ],
      password: [
        '', 
        [
          Validators.required,
          Validators.pattern(/^\d{4}$/) // Exactamente 4 dígitos
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
   * Login como invitado
   */
  async onGuestLogin() {
    const loading = await this.showLoading('Ingresando como invitado...');
    
    try {
      const success = await this.authService.guestLogin();
      
      if (success) {
        await this.showSuccessToast('¡Bienvenido, Invitado!');
        this.router.navigate(['/tabs'], { 
          state: { 
            usuario: 'Invitado', 
            guest: true 
          } 
        });
      }
    } catch (error) {
      await this.showErrorAlert('Error al ingresar como invitado');
    } finally {
      loading.dismiss();
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
      if (errors['required']) return 'El usuario es requerido';
      if (errors['minlength']) return 'Mínimo 3 caracteres';
      if (errors['maxlength']) return 'Máximo 8 caracteres';
      if (errors['pattern']) return 'Solo letras y números permitidos';
    }
    
    if (field === 'password') {
      if (errors['required']) return 'La contraseña es requerida';
      if (errors['pattern']) return 'Debe ser exactamente 4 dígitos';
    }
    
    return '';
  }

  private async performLogin() {
    const loading = await this.showLoading('Iniciando sesión...');
    
    try {
      const { username, password } = this.loginForm.value;
      const success = await this.authService.login(username, password);
      
      if (success) {
        await this.showSuccessToast(`¡Bienvenido, ${username}!`);
        this.router.navigate(['/tabs'], { 
          state: { 
            usuario: username,
            guest: false
          } 
        });
      } else {
        await this.showErrorAlert('Credenciales inválidas');
        this.triggerShakeAnimation();
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
}
