import { Injectable, signal } from '@angular/core';

export interface Toast {
  message: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string) { this.add(message, 'success'); }
  error(message: string) { this.add(message, 'error'); }

  private add(message: string, type: 'success' | 'error') {
    this._toasts.update(t => [...t, { message, type }]);
    setTimeout(() => this._toasts.update(t => t.slice(1)), 3000);
  }
}
