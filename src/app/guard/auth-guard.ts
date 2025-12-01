import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si hay una sesión activa y válida
  if (authService.isAuthenticated() && authService.isCurrentSessionValid()) {
    return true;
  }

  // Si la sesión está expirada, limpiar datos
  if (authService.isAuthenticated() && !authService.isCurrentSessionValid()) {
    authService.logout();
    router.navigate(['/login'], { 
      state: { 
        error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        returnUrl: state.url
      }
    });
    return false;
  }

  // No hay sesión activa, redirigir al login
  router.navigate(['/login'], { 
    state: { 
      error: 'Debes iniciar sesión para acceder a esta página.',
      returnUrl: state.url
    }
  });
  return false;
};
