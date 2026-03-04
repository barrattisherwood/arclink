import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  styles: [`
    .login-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .login-card {
      background: #111;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 48px 40px;
      width: 100%;
      max-width: 360px;
    }
    h2 { margin: 0 0 8px; font-size: 1.25rem; font-weight: 600; }
    p { margin: 0 0 32px; color: #666; font-size: 0.875rem; }
    mat-form-field { width: 100%; }
    button { width: 100%; margin-top: 16px; }
    .error { color: #ff6b6b; font-size: 0.8rem; margin-top: 8px; }
  `],
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <h2>Arclink</h2>
        <p>Internal dashboard</p>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" [(ngModel)]="password" (keyup.enter)="login()" />
        </mat-form-field>
        @if (error()) {
          <div class="error">Incorrect password</div>
        }
        <button mat-flat-button (click)="login()">Sign in</button>
      </div>
    </div>
  `,
})
export class LoginComponent {
  password = '';
  error = signal(false);

  constructor(private router: Router) {}

  login(): void {
    if (this.password === environment.dashboardPassword) {
      localStorage.setItem('arclink_auth', 'true');
      this.router.navigate(['/']);
    } else {
      this.error.set(true);
    }
  }
}
