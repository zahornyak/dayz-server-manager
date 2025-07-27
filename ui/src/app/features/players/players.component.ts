import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule],
  template: '<div class="feature-container"><h1>Player Management</h1><p>Cross-server player management coming soon...</p></div>',
  styles: ['.feature-container { max-width: 1400px; margin: 0 auto; } h1 { font-size: 2rem; font-weight: 500; margin-bottom: 1rem; color: #1976d2; }']
})
export class PlayersComponent {}