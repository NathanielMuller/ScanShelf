import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  usuario: string;
  guest: boolean;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'scanshelf_user';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  constructor() {
    // Cargar usuario desde localStorage al inicializar
    this.loadUserFromStorage();
  }

  /**
   * Simula login con credenciales
   * TODO: Conectar con backend real - endpoint POST /auth/login
   * @param username - Usuario (3-8 caracteres alfanuméricos)
   * @param password - Contraseña (4 dígitos)
   * @returns Promise<boolean> - true si login exitoso
   */
  async login(username: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Simular delay de red (700ms)
      setTimeout(() => {
        // TODO: Reemplazar con llamada HTTP real
        // const response = await this.http.post('/api/auth/login', { username, password });
        
        // Demo: acepta cualquier credencial con formato válido
        const isValidFormat = this.validateCredentials(username, password);
        
        if (isValidFormat) {
          const user: User = {
            usuario: username,
            guest: false,
            timestamp: Date.now()
          };
          
          this.setCurrentUser(user);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 700);
    });
  }

  /**
   * Login como invitado
   * @returns Promise<boolean> - siempre true para demo
   */
  async guestLogin(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const guestUser: User = {
          usuario: 'Invitado',
          guest: true,
          timestamp: Date.now()
        };
        
        this.setCurrentUser(guestUser);
        resolve(true);
      }, 600);
    });
  }

  /**
   * Cerrar sesión
   * TODO: Notificar al backend para invalidar token
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
  }

  /**
   * Obtener usuario actual
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Verificar si usuario está autenticado
   */
  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return user !== null;
  }

  /**
   * Verificar si es usuario invitado
   */
  isGuest(): boolean {
    const user = this.getCurrentUser();
    return user?.guest === true;
  }

  private validateCredentials(username: string, password: string): boolean {
    // Validar formato usuario (3-8 caracteres alfanuméricos)
    const usernamePattern = /^[a-zA-Z0-9]{3,8}$/;
    // Validar formato contraseña (exactamente 4 dígitos)
    const passwordPattern = /^\d{4}$/;
    
    return usernamePattern.test(username) && passwordPattern.test(password);
  }

  private setCurrentUser(user: User): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    try {
      const storedUser = localStorage.getItem(this.STORAGE_KEY);
      if (storedUser) {
        const user = JSON.parse(storedUser) as User;
        this.currentUserSubject.next(user);
      }
    } catch (error) {
      console.warn('Error loading user from storage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}