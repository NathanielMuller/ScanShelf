import { Component, OnInit } from '@angular/core';
import { trigger, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('600ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ])
    ]),
    trigger('pulse', [
      transition('* => *', [
        animate('2s ease-in-out', style({ transform: 'scale(1.05)' })),
        animate('2s ease-in-out', style({ transform: 'scale(1)' }))
      ])
    ])
  ]
})
export class ScanPage implements OnInit {



  constructor() { }

  ngOnInit() {
  }

}
