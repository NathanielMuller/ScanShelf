import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si hay una sesión activa
  if (authService.isAuthenticated()) {
    // Si es un usuario invitado, verificar si la ruta permite invitados
    if (authService.isGuestUser()) {
      const allowGuestAccess = route.data?.['allowGuest'] || false;
      
      if (!allowGuestAccess) {
        // Redirigir al login con mensaje de error
        router.navigate(['/login'], { 
          state: { 
            error: 'Esta página requiere una cuenta registrada. Los usuarios invitados no tienen acceso.',
            returnUrl: state.url
          }
        });
        return false;
      }
    }
    
    // Verificar si la sesión no ha expirado
    if (authService.isCurrentSessionValid()) {
      return true;
    } else {
      // Sesión expirada, limpiar y redirigir
      authService.logout();
      router.navigate(['/login'], { 
        state: { 
          error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          returnUrl: state.url
        }
      });
      return false;
    }
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
