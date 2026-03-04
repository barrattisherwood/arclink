import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (typeof window !== 'undefined' && localStorage.getItem('arclink_auth') === 'true') {
    return true;
  }
  return router.createUrlTree(['/login']);
};
