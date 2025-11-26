import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { AuthService } from '../shared/services/auth.service';

@Component({
  selector: 'app-page-not-found',
  templateUrl: './page-not-found.page.html',
  styleUrls: ['./page-not-found.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(50px)' }),
        animate('800ms 200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('pulse', [
      transition('* => *', [
        animate('2s ease-in-out', style({ transform: 'scale(1.1)' })),
        animate('2s ease-in-out', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class PageNotFoundPage implements OnInit {

  constructor(
    private router: Router,
    private location: Location,
    private authService: AuthService
  ) { }

  ngOnInit() {
    // Log para debugging
    console.log('Página 404 cargada');
  }

  /**
   * Navegar a la página principal
   */
  goHome() {
    // Verificar si el usuario está autenticado
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tabs']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Volver a la página anterior
   */
  goBack() {
    // Si hay historial, volver atrás, sino ir al inicio
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.goHome();
    }
  }

}
