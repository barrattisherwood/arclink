import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  template: `
    <header class="h-14 bg-[#111] border-b border-[#1a1a1a] flex items-center justify-end px-5 gap-4">
      <span class="text-xs text-[#666]">{{ auth.user()?.email }}</span>
      @if (auth.isSuperAdmin()) {
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-800/50">super-admin</span>
      }
      <button (click)="auth.logout()"
              class="text-xs text-[#999] hover:text-white transition-colors cursor-pointer">
        Logout
      </button>
    </header>
  `
})
export class TopbarComponent {
  auth = inject(AuthService);
}
