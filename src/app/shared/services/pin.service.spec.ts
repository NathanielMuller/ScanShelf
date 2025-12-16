import { TestBed } from '@angular/core/testing';
import { PinService } from './pin.service';

describe('PinService', () => {
  let service: PinService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PinService);
    
    // Limpiar localStorage antes de cada prueba
    localStorage.clear();
  });

  afterEach(() => {
    // Limpiar localStorage después de cada prueba
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // ========== CONFIGURACIÓN DE PIN ==========

  describe('configurePin', () => {
    it('should configure a valid PIN successfully', () => {
      const result = service.configurePin('123789');
      expect(result.success).toBe(true);
      expect(service.isPinConfigured()).toBe(true);
    });

    it('should reject PIN with incorrect format', () => {
      const result = service.configurePin('12345'); // 5 dígitos
      expect(result.success).toBe(false);
      expect(result.error).toContain('6 dígitos');
    });

    it('should reject PIN with non-numeric characters', () => {
      const result = service.configurePin('12a456');
      expect(result.success).toBe(false);
    });

    it('should reject weak PIN patterns', () => {
      const weakPins = ['111111', '000000', '123456', '654321'];
      weakPins.forEach(pin => {
        const result = service.configurePin(pin);
        expect(result.success).toBe(false);
        expect(result.error).toContain('simple');
      });
    });

    it('should reject PINs with consecutive digits', () => {
      const result = service.configurePin('123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('consecutivas');
    });

    it('should accept a secure PIN', () => {
      const result = service.configurePin('159357'); // PIN seguro
      expect(result.success).toBe(true);
    });
  });

  // ========== VERIFICACIÓN DE PIN ==========

  describe('verifyPin', () => {
    beforeEach(() => {
      // Configurar un PIN válido antes de las pruebas de verificación
      service.configurePin('147258');
    });

    it('should verify correct PIN', () => {
      const result = service.verifyPin('147258');
      expect(result.success).toBe(true);
    });

    it('should reject incorrect PIN', () => {
      const result = service.verifyPin('999999');
      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrecto');
    });

    it('should reject PIN with invalid format', () => {
      const result = service.verifyPin('12345');
      expect(result.success).toBe(false);
    });

    it('should lock after max failed attempts', () => {
      // Intentar 3 veces con PIN incorrecto
      service.verifyPin('111111');
      service.verifyPin('222222');
      service.verifyPin('333333');
      
      // El 4to intento debería estar bloqueado
      const result = service.verifyPin('147258'); // Incluso con PIN correcto
      expect(result.success).toBe(false);
      expect(result.error).toContain('bloqueado');
    });

    it('should clear failed attempts after successful verification', () => {
      // Un intento fallido
      service.verifyPin('999999');
      
      // Verificación exitosa
      const result = service.verifyPin('147258');
      expect(result.success).toBe(true);
      
      // Los intentos fallidos deberían haberse limpiado
      // Probamos con 3 intentos más sin que se bloquee
      service.verifyPin('111111');
      service.verifyPin('222222');
      const thirdAttempt = service.verifyPin('333333');
      expect(thirdAttempt.error).not.toContain('bloqueado');
    });

    it('should return error if no PIN is configured', () => {
      localStorage.clear(); // Eliminar PIN configurado
      const result = service.verifyPin('123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No hay PIN configurado');
    });
  });

  // ========== CAMBIO DE PIN ==========

  describe('changePin', () => {
    beforeEach(() => {
      service.configurePin('147258');
    });

    it('should change PIN with correct old PIN', () => {
      const result = service.changePin('147258', '951753');
      expect(result.success).toBe(true);
      
      // Verificar que el nuevo PIN funciona
      const verify = service.verifyPin('951753');
      expect(verify.success).toBe(true);
    });

    it('should reject change with incorrect old PIN', () => {
      const result = service.changePin('999999', '951753');
      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrecto');
    });

    it('should reject same PIN as new PIN', () => {
      const result = service.changePin('147258', '147258');
      expect(result.success).toBe(false);
      expect(result.error).toContain('diferente');
    });

    it('should reject weak new PIN', () => {
      const result = service.changePin('147258', '111111');
      expect(result.success).toBe(false);
      expect(result.error).toContain('simple');
    });
  });

  // ========== ELIMINACIÓN DE PIN ==========

  describe('removePin', () => {
    beforeEach(() => {
      service.configurePin('147258');
    });

    it('should remove PIN successfully', () => {
      const result = service.removePin();
      expect(result.success).toBe(true);
      expect(service.isPinConfigured()).toBe(false);
    });

    it('should clear failed attempts when removing PIN', () => {
      // Generar intentos fallidos
      service.verifyPin('999999');
      service.verifyPin('888888');
      
      // Eliminar PIN
      service.removePin();
      
      // Configurar nuevo PIN y verificar que no hay bloqueo
      service.configurePin('159357');
      service.verifyPin('111111');
      service.verifyPin('222222');
      const result = service.verifyPin('333333');
      expect(result.error).not.toContain('bloqueado');
    });
  });

  // ========== INFORMACIÓN DE PIN ==========

  describe('getPinInfo', () => {
    it('should return configured: false when no PIN exists', () => {
      const info = service.getPinInfo();
      expect(info?.configured).toBe(false);
    });

    it('should return PIN info when configured', () => {
      service.configurePin('147258');
      const info = service.getPinInfo();
      
      expect(info?.configured).toBe(true);
      expect(info?.createdAt).toBeDefined();
      expect(typeof info?.createdAt).toBe('number');
    });

    it('should update lastUsed after successful verification', () => {
      service.configurePin('147258');
      
      const infoBefore = service.getPinInfo();
      expect(infoBefore?.lastUsed).toBeUndefined();
      
      // Esperar un momento para que el timestamp sea diferente
      setTimeout(() => {
        service.verifyPin('147258');
        const infoAfter = service.getPinInfo();
        expect(infoAfter?.lastUsed).toBeDefined();
      }, 100);
    });

    it('should not reveal the actual PIN value', () => {
      service.configurePin('147258');
      const info = service.getPinInfo();
      
      // Verificar que no haya propiedad 'pin' en la respuesta
      expect((info as any).pin).toBeUndefined();
    });
  });

  // ========== ESTADO DE PIN ==========

  describe('isPinConfigured', () => {
    it('should return false when no PIN is configured', () => {
      expect(service.isPinConfigured()).toBe(false);
    });

    it('should return true after configuring a PIN', () => {
      service.configurePin('147258');
      expect(service.isPinConfigured()).toBe(true);
    });

    it('should return false after removing PIN', () => {
      service.configurePin('147258');
      service.removePin();
      expect(service.isPinConfigured()).toBe(false);
    });
  });

  // ========== OBSERVABLE ==========

  describe('pinConfigured$ observable', () => {
    it('should emit true when PIN is configured', (done) => {
      service.pinConfigured$.subscribe(configured => {
        if (configured) {
          expect(configured).toBe(true);
          done();
        }
      });
      
      service.configurePin('147258');
    });

    it('should emit false when PIN is removed', (done) => {
      service.configurePin('147258');
      
      let emissionCount = 0;
      service.pinConfigured$.subscribe(configured => {
        emissionCount++;
        if (emissionCount === 2) { // Segunda emisión (después de remove)
          expect(configured).toBe(false);
          done();
        }
      });
      
      service.removePin();
    });
  });

  // ========== SEGURIDAD ==========

  describe('Security features', () => {
    it('should hash PIN before storage', () => {
      service.configurePin('147258');
      const stored = localStorage.getItem('scanshelf_pin_config');
      
      expect(stored).toBeDefined();
      expect(stored).not.toContain('147258'); // PIN no debe estar en texto plano
    });

    it('should handle localStorage errors gracefully', () => {
      // Simular error de localStorage
      spyOn(localStorage, 'setItem').and.throwError('Storage error');
      
      const result = service.configurePin('147258');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error');
    });

    it('should track remaining attempts', () => {
      service.configurePin('147258');
      
      // Primer intento fallido
      let result = service.verifyPin('999999');
      expect(result.error).toContain('2 intentos restantes');
      
      // Segundo intento fallido
      result = service.verifyPin('888888');
      expect(result.error).toContain('1 intentos restantes');
      
      // Tercer intento fallido
      result = service.verifyPin('777777');
      expect(result.error).toContain('bloqueado');
    });
  });
});
