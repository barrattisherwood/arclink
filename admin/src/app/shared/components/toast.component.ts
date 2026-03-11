import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
      @for (toast of toastService.toasts(); track $index) {
        <div class="px-4 py-3 rounded-lg text-sm font-medium shadow-lg animate-slide-in"
          [class]="toast.type === 'success'
            ? 'bg-green-900/80 text-green-200 border border-green-800'
            : 'bg-red-900/80 text-red-200 border border-red-800'">
          {{ toast.message }}
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-in {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    .animate-slide-in { animation: slide-in 0.2s ease-out; }
  `]
})
export class ToastComponent {
  toastService = inject(ToastService);
}
