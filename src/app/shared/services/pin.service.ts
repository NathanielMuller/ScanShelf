import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PinConfig {
  pin: string;
  createdAt: number;
  lastUsed?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PinService {
  // Clave de almacenamiento para el PIN
  private readonly PIN_STORAGE_KEY = 'scanshelf_pin_config';
  private readonly MAX_PIN_ATTEMPTS = 3;
  private readonly LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutos
  private readonly PIN_ATTEMPTS_KEY = 'scanshelf_pin_attempts';
  
  // Observable para estado del PIN
  private pinConfiguredSubject = new BehaviorSubject<boolean>(this.isPinConfigured());
  public pinConfigured$: Observable<boolean> = this.pinConfiguredSubject.asObservable();

  constructor() {
    this.checkPinStatus();
  }

  /**
   * Verificar si hay un PIN configurado
   */
  isPinConfigured(): boolean {
    try {
      const config = localStorage.getItem(this.PIN_STORAGE_KEY);
      return config !== null;
    } catch (error) {
      console.error('Error checking PIN configuration:', error);
      return false;
    }
  }

  /**
   * Configurar un nuevo PIN
   * @param pin - PIN de 6 dígitos
   * @returns {success: boolean, error?: string}
   */
  configurePin(pin: string): { success: boolean; error?: string } {
    // Validar formato del PIN (6 dígitos)
    if (!this.validatePinFormat(pin)) {
      return {
        success: false,
        error: 'El PIN debe tener exactamente 6 dígitos'
      };
    }

    // Validar seguridad del PIN
    const securityCheck = this.validatePinSecurity(pin);
    if (!securityCheck.valid) {
      return {
        success: false,
        error: securityCheck.error
      };
    }

    try {
      // Encriptar PIN (simple hash para demo - en producción usar bcrypt)
      const hashedPin = this.hashPin(pin);
      
      const config: PinConfig = {
        pin: hashedPin,
        createdAt: Date.now()
      };

      localStorage.setItem(this.PIN_STORAGE_KEY, JSON.stringify(config));
      this.pinConfiguredSubject.next(true);
      
      // Limpiar intentos fallidos al configurar nuevo PIN
      this.clearFailedAttempts();
      
      return { success: true };
    } catch (error) {
      console.error('Error configuring PIN:', error);
      return {
        success: false,
        error: 'Error al guardar el PIN. Intenta de nuevo.'
      };
    }
  }

  /**
   * Verificar un PIN ingresado
   * @param pin - PIN a verificar
   * @returns {success: boolean, error?: string}
   */
  verifyPin(pin: string): { success: boolean; error?: string } {
    // Verificar si el usuario está bloqueado
    if (this.isUserLocked()) {
      return {
        success: false,
        error: 'Demasiados intentos fallidos. Espera 5 minutos.'
      };
    }

    // Validar formato
    if (!this.validatePinFormat(pin)) {
      this.recordFailedAttempt();
      return {
        success: false,
        error: 'PIN inválido'
      };
    }

    try {
      const configStr = localStorage.getItem(this.PIN_STORAGE_KEY);
      if (!configStr) {
        return {
          success: false,
          error: 'No hay PIN configurado'
        };
      }

      const config: PinConfig = JSON.parse(configStr);
      const hashedInputPin = this.hashPin(pin);

      if (hashedInputPin === config.pin) {
        // PIN correcto
        this.clearFailedAttempts();
        this.updateLastUsed();
        return { success: true };
      } else {
        // PIN incorrecto
        this.recordFailedAttempt();
        const remainingAttempts = this.getRemainingAttempts();
        
        return {
          success: false,
          error: remainingAttempts > 0
            ? `PIN incorrecto. ${remainingAttempts} intentos restantes.`
            : 'Demasiados intentos fallidos. Usuario bloqueado 5 minutos.'
        };
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return {
        success: false,
        error: 'Error al verificar el PIN'
      };
    }
  }

  /**
   * Cambiar el PIN existente
   * @param oldPin - PIN actual
   * @param newPin - Nuevo PIN
   */
  changePin(oldPin: string, newPin: string): { success: boolean; error?: string } {
    // Verificar PIN actual
    const verifyResult = this.verifyPin(oldPin);
    if (!verifyResult.success) {
      return {
        success: false,
        error: 'PIN actual incorrecto'
      };
    }

    // Validar que el nuevo PIN sea diferente
    const hashedOld = this.hashPin(oldPin);
    const hashedNew = this.hashPin(newPin);
    if (hashedOld === hashedNew) {
      return {
        success: false,
        error: 'El nuevo PIN debe ser diferente al actual'
      };
    }

    // Configurar nuevo PIN
    return this.configurePin(newPin);
  }

  /**
   * Eliminar la configuración del PIN
   */
  removePin(): { success: boolean; error?: string } {
    try {
      localStorage.removeItem(this.PIN_STORAGE_KEY);
      this.clearFailedAttempts();
      this.pinConfiguredSubject.next(false);
      return { success: true };
    } catch (error) {
      console.error('Error removing PIN:', error);
      return {
        success: false,
        error: 'Error al eliminar el PIN'
      };
    }
  }

  /**
   * Obtener información del PIN (sin revelar el PIN)
   */
  getPinInfo(): { configured: boolean; createdAt?: number; lastUsed?: number } | null {
    try {
      const configStr = localStorage.getItem(this.PIN_STORAGE_KEY);
      if (!configStr) {
        return { configured: false };
      }

      const config: PinConfig = JSON.parse(configStr);
      return {
        configured: true,
        createdAt: config.createdAt,
        lastUsed: config.lastUsed
      };
    } catch (error) {
      console.error('Error getting PIN info:', error);
      return null;
    }
  }

  // ========== MÉTODOS PRIVADOS ==========

  private validatePinFormat(pin: string): boolean {
    // Exactamente 6 dígitos
    const pinPattern = /^\d{6}$/;
    return pinPattern.test(pin);
  }

  private validatePinSecurity(pin: string): { valid: boolean; error?: string } {
    // No permitir PINs demasiado simples
    const weakPins = [
      '000000', '111111', '222222', '333333', '444444', 
      '555555', '666666', '777777', '888888', '999999',
      '123456', '654321', '012345', '543210'
    ];

    if (weakPins.includes(pin)) {
      return {
        valid: false,
        error: 'PIN demasiado simple. Elige uno más seguro.'
      };
    }

    // No permitir secuencias consecutivas
    if (this.hasConsecutiveDigits(pin)) {
      return {
        valid: false,
        error: 'Evita secuencias consecutivas (ej: 123456)'
      };
    }

    return { valid: true };
  }

  private hasConsecutiveDigits(pin: string): boolean {
    for (let i = 0; i < pin.length - 2; i++) {
      const num1 = parseInt(pin[i]);
      const num2 = parseInt(pin[i + 1]);
      const num3 = parseInt(pin[i + 2]);
      
      // Verificar secuencia ascendente o descendente
      if (
        (num2 === num1 + 1 && num3 === num2 + 1) ||
        (num2 === num1 - 1 && num3 === num2 - 1)
      ) {
        return true;
      }
    }
    return false;
  }

  private hashPin(pin: string): string {
    // Simple hash para demo - en producción usar bcrypt o similar
    let hash = 0;
    const salt = 'scanshelf_secure_salt_2024';
    const combined = pin + salt;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(36);
  }

  private updateLastUsed(): void {
    try {
      const configStr = localStorage.getItem(this.PIN_STORAGE_KEY);
      if (configStr) {
        const config: PinConfig = JSON.parse(configStr);
        config.lastUsed = Date.now();
        localStorage.setItem(this.PIN_STORAGE_KEY, JSON.stringify(config));
      }
    } catch (error) {
      console.error('Error updating last used:', error);
    }
  }

  private recordFailedAttempt(): void {
    try {
      const attemptsStr = localStorage.getItem(this.PIN_ATTEMPTS_KEY);
      const attempts = attemptsStr ? JSON.parse(attemptsStr) : [];
      
      attempts.push({
        timestamp: Date.now(),
        successful: false
      });

      localStorage.setItem(this.PIN_ATTEMPTS_KEY, JSON.stringify(attempts));
    } catch (error) {
      console.error('Error recording failed attempt:', error);
    }
  }

  private clearFailedAttempts(): void {
    try {
      localStorage.removeItem(this.PIN_ATTEMPTS_KEY);
    } catch (error) {
      console.error('Error clearing failed attempts:', error);
    }
  }

  private getRemainingAttempts(): number {
    try {
      const attemptsStr = localStorage.getItem(this.PIN_ATTEMPTS_KEY);
      if (!attemptsStr) return this.MAX_PIN_ATTEMPTS;

      const attempts = JSON.parse(attemptsStr);
      const recentAttempts = attempts.filter((attempt: any) => {
        return Date.now() - attempt.timestamp < this.LOCKOUT_DURATION;
      });

      return Math.max(0, this.MAX_PIN_ATTEMPTS - recentAttempts.length);
    } catch (error) {
      console.error('Error getting remaining attempts:', error);
      return this.MAX_PIN_ATTEMPTS;
    }
  }

  private isUserLocked(): boolean {
    return this.getRemainingAttempts() === 0;
  }

  private checkPinStatus(): void {
    this.pinConfiguredSubject.next(this.isPinConfigured());
  }
}
