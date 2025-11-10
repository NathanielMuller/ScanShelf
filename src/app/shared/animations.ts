import { trigger, state, style, transition, animate, keyframes, stagger, query } from '@angular/animations';

/**
 * Reutilizable animations for ScanShelf app
 * TODO: Expand with more complex animations as needed
 */

export const fadeInUp = trigger('fadeInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(20px)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);

export const fadeInSlide = trigger('fadeInSlide', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-14px)' }),
    animate('450ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
  ])
]);

export const slideInStagger = trigger('slideInStagger', [
  transition('* => *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(30px)' }),
      stagger(100, [
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ], { optional: true })
  ])
]);

export const shake = trigger('shake', [
  transition('* => shake', [
    animate('450ms ease-in-out', keyframes([
      style({ transform: 'translateX(0)', offset: 0 }),
      style({ transform: 'translateX(-8px)', offset: 0.1 }),
      style({ transform: 'translateX(8px)', offset: 0.2 }),
      style({ transform: 'translateX(-8px)', offset: 0.3 }),
      style({ transform: 'translateX(8px)', offset: 0.4 }),
      style({ transform: 'translateX(-8px)', offset: 0.5 }),
      style({ transform: 'translateX(8px)', offset: 0.6 }),
      style({ transform: 'translateX(-8px)', offset: 0.7 }),
      style({ transform: 'translateX(8px)', offset: 0.8 }),
      style({ transform: 'translateX(-8px)', offset: 0.9 }),
      style({ transform: 'translateX(0)', offset: 1 }),
    ]))
  ])
]);

export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
  ])
]);

export const pulse = trigger('pulse', [
  state('normal', style({ transform: 'scale(1)' })),
  state('pulse', style({ transform: 'scale(1.05)' })),
  transition('normal => pulse', animate('200ms ease-out')),
  transition('pulse => normal', animate('200ms ease-in'))
]);

/**
 * CSS-only animation classes (use with ngClass or direct CSS)
 * These provide better performance for simple animations
 */
export const animationClasses = {
  fadeInUp: 'animate-fade-in-up',
  fadeInSlide: 'animate-fade-in-slide',
  shake: 'animate-shake',
  pulse: 'animate-pulse',
  stagger: (index: number) => `animate-stagger-${index}`
} as const;