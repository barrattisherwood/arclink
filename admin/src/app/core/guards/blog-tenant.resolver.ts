import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { BlogApiService } from '../services/blog-api.service';

export const blogTenantResolver: ResolveFn<boolean> = (route) => {
  const siteId = route.paramMap.get('siteId');
  if (!siteId) return of(false);

  return inject(BlogApiService)
    .checkTenant(siteId)
    .pipe(
      map(res => res.exists),
      catchError(() => of(false)),
    );
};
