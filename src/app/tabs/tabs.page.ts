import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService, User } from '../shared/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
  animations: [
    trigger('headerAnimation', [
      state('in', style({ opacity: 1, transform: 'scale(1)' })),
      transition('void => *', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('400ms ease-out')
      ])
    ])
  ]
})
export class TabsPage implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isGuest = false;
  private subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUserData();
    this.subscribeToUserChanges();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  /**
   * Cargar datos del usuario desde diferentes fuentes
   */
  private loadUserData() {
    // 1. Intentar obtener desde navigation state (cuando viene del login)
    const navigationState = this.router.getCurrentNavigation()?.extras?.state || 
                           window.history.state;
    
    if (navigationState && navigationState['usuario']) {
      this.currentUser = {
        usuario: navigationState['usuario'],
        guest: navigationState['guest'] || false,
        timestamp: Date.now()
      };
      this.isGuest = this.currentUser.guest;
      return;
    }

    // 2. Fallback: obtener desde AuthService (localStorage)
    this.currentUser = this.authService.getCurrentUser();
    this.isGuest = this.authService.isGuest();
    
    // 3. Si no hay usuario autenticado, redirigir al login
    if (!this.currentUser) {
      this.redirectToLogin();
    }
  }

  /**
   * Suscribirse a cambios en el estado de autenticación
   */
  private subscribeToUserChanges() {
    this.subscription.add(
      this.authService.currentUser$.subscribe(user => {
        if (!user) {
          this.redirectToLogin();
        } else {
          this.currentUser = user;
          this.isGuest = user.guest;
        }
      })
    );
  }

  /**
   * Obtener saludo personalizado según el tipo de usuario
   */
  getUserGreeting(): string {
    if (!this.currentUser) return 'Bienvenido';
    
    if (this.isGuest) {
      return 'Modo Invitado';
    }
    
    return `Hola, ${this.currentUser.usuario}`;
  }

  /**
   * Obtener icono según el tipo de usuario
   */
  getUserIcon(): string {
    return this.isGuest ? 'person-circle-outline' : 'person-outline';
  }

  /**
   * Cerrar sesión
   */
  logout() {
    this.authService.logout();
    // La redirección se maneja automáticamente por la suscripción
  }

  /**
   * Redirigir al login
   */
  private redirectToLogin() {
    this.router.navigate(['/login'], { 
      replaceUrl: true 
    });
  }
}
