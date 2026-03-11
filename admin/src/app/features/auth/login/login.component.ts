import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div class="w-full max-w-sm">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-semibold text-white tracking-tight">arclink</h1>
          <p class="text-sm text-[#666] mt-1">Admin Dashboard</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="bg-[#111] rounded-lg border border-[#1a1a1a] p-6">
          <div class="mb-4">
            <label class="block text-xs text-[#999] mb-1.5">Email</label>
            <input type="email"
                   [(ngModel)]="email" name="email"
                   required autofocus
                   class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-md text-sm text-white
                          focus:outline-none focus:border-purple-500 transition-colors"
                   placeholder="you@example.com">
          </div>

          <div class="mb-5">
            <label class="block text-xs text-[#999] mb-1.5">Password</label>
            <input type="password"
                   [(ngModel)]="password" name="password"
                   required
                   class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-md text-sm text-white
                          focus:outline-none focus:border-purple-500 transition-colors"
                   placeholder="Enter password">
          </div>

          @if (error()) {
            <p class="text-xs text-red-400 mb-3">{{ error() }}</p>
          }

          <button type="submit"
                  [disabled]="loading()"
                  class="w-full py-2 rounded-md text-sm font-medium transition-colors cursor-pointer
                         bg-purple-600 hover:bg-purple-500 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed">
            @if (loading()) {
              Signing in...
            } @else {
              Sign in
            }
          </button>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  onSubmit() {
    if (!this.email || !this.password) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const user = this.auth.user();
        const siteId = user?.siteId === '*' ? '_' : user?.siteId;
        this.router.navigate(['/sites', siteId, 'blog']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Invalid credentials');
      }
    });
  }
}
