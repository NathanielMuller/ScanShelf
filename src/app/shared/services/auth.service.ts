import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  usuario: string;
  guest: boolean;
  timestamp?: number;
  sessionId?: string;
  lastActivity?: number;
}

export interface LoginAttempt {
  username: string;
  timestamp: number;
  successful: boolean;
  ip?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'scanshelf_user';
  private readonly LOGIN_ATTEMPTS_KEY = 'scanshelf_login_attempts';
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
  private readonly MAX_LOGIN_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  
  private sessionTimer?: any;
  private activityTimer?: any;

  constructor() {
    // Cargar usuario desde localStorage al inicializar
    this.loadUserFromStorage();
    this.setupActivityMonitoring();
    this.validateActiveSession();
  }

  /**
   * Login con múltiples capas de seguridad
   * @param username - Usuario (3-8 caracteres alfanuméricos)
   * @param password - Contraseña (4 dígitos)
   * @returns Promise<{success: boolean, error?: string}> - resultado del login
   */
  async login(username: string, password: string): Promise<{success: boolean, error?: string}> {
    return new Promise((resolve) => {
      // Simular delay de red (700ms)
      setTimeout(() => {
        // 1. Validar si el usuario está bloqueado
        if (this.isUserLocked(username)) {
          this.recordLoginAttempt(username, false);
          resolve({
            success: false,
            error: 'Usuario bloqueado temporalmente. Intenta en 15 minutos.'
          });
          return;
        }

        // 2. Validar formato de credenciales
        if (!this.validateCredentials(username, password)) {
          this.recordLoginAttempt(username, false);
          resolve({
            success: false,
            error: 'Formato de credenciales inválido'
          });
          return;
        }

        // 3. Validar fuerza de la contraseña
        if (!this.validatePasswordStrength(password)) {
          this.recordLoginAttempt(username, false);
          resolve({
            success: false,
            error: 'La contraseña no cumple con los requisitos de seguridad'
          });
          return;
        }

        // 4. Sanitizar entrada para prevenir inyecciones
        const sanitizedUsername = this.sanitizeInput(username);
        const sanitizedPassword = this.sanitizeInput(password);

        // 5. Verificar credenciales (demo - acepta formato válido)
        if (this.verifyCredentials(sanitizedUsername, sanitizedPassword)) {
          // 6. Generar sesión segura
          const sessionId = this.generateSecureSessionId();
          const user: User = {
            usuario: sanitizedUsername,
            guest: false,
            timestamp: Date.now(),
            sessionId: sessionId,
            lastActivity: Date.now()
          };
          
          // 7. Registrar login exitoso y limpiar intentos fallidos
          this.recordLoginAttempt(username, true);
          this.clearFailedAttempts(username);
          this.setCurrentUser(user);
          this.startSessionTimer();
          
          resolve({ success: true });
        } else {
          this.recordLoginAttempt(username, false);
          const remainingAttempts = this.getRemainingAttempts(username);
          
          resolve({
            success: false,
            error: remainingAttempts > 0 
              ? `Credenciales incorrectas. ${remainingAttempts} intentos restantes.`
              : 'Demasiados intentos fallidos. Usuario bloqueado temporalmente.'
          });
        }
      }, 700);
    });
  }

  /**
   * Login como invitado con sesión limitada
   * @returns Promise<{success: boolean}> - resultado del login guest
   */
  async guestLogin(): Promise<{success: boolean}> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const sessionId = this.generateSecureSessionId();
        const guestUser: User = {
          usuario: 'Invitado',
          guest: true,
          timestamp: Date.now(),
          sessionId: sessionId,
          lastActivity: Date.now()
        };
        
        this.setCurrentUser(guestUser);
        this.startSessionTimer();
        resolve({ success: true });
      }, 600);
    });
  }

  /**
   * Cerrar sesión de forma segura
   * Limpia todos los datos y invalida la sesión
   */
  logout(): void {
    // Limpiar timers de sesión
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }
    
    // Limpiar datos de localStorage de forma segura
    this.securelyRemoveUserData();
    
    // Resetear estado de usuario
    this.currentUserSubject.next(null);
    
    console.log('Sesión cerrada de forma segura');
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
        // Validar que la sesión no haya expirado
        if (this.isSessionValid(user)) {
          this.currentUserSubject.next(user);
          this.startSessionTimer();
        } else {
          this.securelyRemoveUserData();
        }
      }
    } catch (error) {
      console.warn('Error loading user from storage:', error);
      this.securelyRemoveUserData();
    }
  }

  // ============================================
  // MÉTODOS DE SEGURIDAD ADICIONALES
  // ============================================

  /**
   * Validar si una sesión es válida
   */
  private isSessionValid(user: User): boolean {
    if (!user.timestamp || !user.sessionId) return false;
    
    const sessionAge = Date.now() - user.timestamp;
    const lastActivity = user.lastActivity || user.timestamp;
    const inactivityTime = Date.now() - lastActivity;
    
    // Verificar que la sesión no haya expirado por tiempo total o inactividad
    return sessionAge < this.SESSION_TIMEOUT && inactivityTime < this.SESSION_TIMEOUT;
  }

  /**
   * Validar si un usuario está bloqueado por intentos fallidos
   */
  private isUserLocked(username: string): boolean {
    const attempts = this.getLoginAttempts(username);
    const failedAttempts = attempts.filter(a => !a.successful);
    
    if (failedAttempts.length >= this.MAX_LOGIN_ATTEMPTS) {
      const lastFailedAttempt = Math.max(...failedAttempts.map(a => a.timestamp));
      const timeSinceLastAttempt = Date.now() - lastFailedAttempt;
      return timeSinceLastAttempt < this.LOCKOUT_DURATION;
    }
    
    return false;
  }

  /**
   * Registrar intento de login
   */
  private recordLoginAttempt(username: string, successful: boolean): void {
    const attempts = this.getLoginAttempts();
    const newAttempt: LoginAttempt = {
      username: username.toLowerCase(),
      timestamp: Date.now(),
      successful,
      ip: 'local' // En producción sería la IP real
    };
    
    attempts.push(newAttempt);
    
    // Mantener solo los últimos 100 intentos
    if (attempts.length > 100) {
      attempts.splice(0, attempts.length - 100);
    }
    
    localStorage.setItem(this.LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
  }

  /**
   * Obtener intentos de login para un usuario
   */
  private getLoginAttempts(username?: string): LoginAttempt[] {
    try {
      const stored = localStorage.getItem(this.LOGIN_ATTEMPTS_KEY);
      const attempts = stored ? JSON.parse(stored) : [];
      
      if (username) {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        return attempts.filter((a: LoginAttempt) => 
          a.username === username.toLowerCase() && a.timestamp > oneHourAgo
        );
      }
      
      return attempts;
    } catch {
      return [];
    }
  }

  /**
   * Obtener intentos restantes para un usuario
   */
  private getRemainingAttempts(username: string): number {
    const attempts = this.getLoginAttempts(username);
    const failedAttempts = attempts.filter(a => !a.successful);
    return Math.max(0, this.MAX_LOGIN_ATTEMPTS - failedAttempts.length);
  }

  /**
   * Limpiar intentos fallidos de un usuario
   */
  private clearFailedAttempts(username: string): void {
    const allAttempts = this.getLoginAttempts();
    const filteredAttempts = allAttempts.filter(a => 
      !(a.username === username.toLowerCase() && !a.successful)
    );
    localStorage.setItem(this.LOGIN_ATTEMPTS_KEY, JSON.stringify(filteredAttempts));
  }

  /**
   * Validar fuerza de contraseña
   */
  private validatePasswordStrength(password: string): boolean {
    // Para contraseñas de 4 dígitos, verificar que no sean secuenciales o repetitivos
    if (password.length !== 4) return false;
    
    // No permitir contraseñas obvias
    const weakPasswords = ['0000', '1111', '2222', '3333', '4444', '5555', 
                          '6666', '7777', '8888', '9999', '1234', '4321', 
                          '0123', '9876', '1122', '2211'];
    
    if (weakPasswords.includes(password)) return false;
    
    // No permitir secuencias ascendentes o descendentes
    for (let i = 0; i < password.length - 1; i++) {
      const current = parseInt(password[i]);
      const next = parseInt(password[i + 1]);
      
      // Si todos los números son secuenciales
      if (i === 0) {
        const isAscending = password.split('').every((char, index) => 
          index === 0 || parseInt(char) === parseInt(password[index - 1]) + 1
        );
        const isDescending = password.split('').every((char, index) => 
          index === 0 || parseInt(char) === parseInt(password[index - 1]) - 1
        );
        
        if (isAscending || isDescending) return false;
      }
    }
    
    return true;
  }

  /**
   * Sanitizar entrada para prevenir inyecciones
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/[<>\"'%;()&+]/g, '') // Remover caracteres peligrosos
      .trim()
      .substring(0, 50); // Limitar longitud
  }

  /**
   * Verificar credenciales (método demo)
   */
  private verifyCredentials(username: string, password: string): boolean {
    // En producción, esto sería una verificación contra hash en base de datos
    return this.validateCredentials(username, password);
  }

  /**
   * Generar ID de sesión seguro
   */
  private generateSecureSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const timestamp = Date.now().toString(36);
    const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => chars[b % chars.length])
      .join('');
    
    return `${timestamp}_${randomPart}`;
  }

  /**
   * Iniciar timer de sesión
   */
  private startSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    
    this.sessionTimer = setTimeout(() => {
      console.log('Sesión expirada por inactividad');
      this.logout();
    }, this.SESSION_TIMEOUT);
  }

  /**
   * Configurar monitoreo de actividad
   */
  private setupActivityMonitoring(): void {
    if (typeof document !== 'undefined') {
      const events = ['click', 'keypress', 'scroll', 'touchstart'];
      
      events.forEach(event => {
        document.addEventListener(event, () => this.updateLastActivity(), { passive: true });
      });
    }
  }

  /**
   * Actualizar última actividad
   */
  private updateLastActivity(): void {
    const currentUser = this.getCurrentUser();
    if (currentUser && !currentUser.guest) {
      currentUser.lastActivity = Date.now();
      this.setCurrentUser(currentUser);
      
      // Reiniciar timer de sesión
      this.startSessionTimer();
    }
  }

  /**
   * Validar sesión activa al inicializar
   */
  private validateActiveSession(): void {
    const currentUser = this.getCurrentUser();
    if (currentUser && !this.isSessionValid(currentUser)) {
      console.log('Sesión inválida detectada, cerrando...');
      this.logout();
    }
  }

  /**
   * Remover datos de usuario de forma segura
   */
  private securelyRemoveUserData(): void {
    // Sobrescribir datos antes de eliminar (simulado)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      usuario: 'X'.repeat(50),
      timestamp: 0,
      sessionId: 'X'.repeat(50)
    }));
    
    // Eliminar definitivamente
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Verificar integridad de sesión
   */
  public verifySessionIntegrity(): boolean {
    const user = this.getCurrentUser();
    if (!user || !user.sessionId) return false;
    
    // Verificar que la sesión no haya sido comprometida
    return this.isSessionValid(user);
  }

  /**
   * Método público para verificar si la sesión actual es válida
   * Usado por el auth guard
   */
  public isCurrentSessionValid(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    return this.isSessionValid(user);
  }

  /**
   * Verificar si el usuario actual es invitado
   */
  public isGuestUser(): boolean {
    const user = this.getCurrentUser();
    return user ? user.guest : false;
  }

  /**
   * Obtener información de seguridad de la sesión
   */
  public getSecurityInfo(): {isSecure: boolean, timeRemaining: number, attemptsToday: number} {
    const user = this.getCurrentUser();
    const timeRemaining = user?.timestamp ? 
      Math.max(0, this.SESSION_TIMEOUT - (Date.now() - user.timestamp)) : 0;
    
    const attemptsToday = this.getTodayLoginAttempts();
    
    return {
      isSecure: this.verifySessionIntegrity(),
      timeRemaining,
      attemptsToday
    };
  }

  /**
   * Obtener intentos de login de hoy
   */
  private getTodayLoginAttempts(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const attempts = this.getLoginAttempts();
    return attempts.filter(a => a.timestamp >= todayTimestamp).length;
  }
}