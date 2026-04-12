import { Routes } from '@angular/router';
import { authGuard, superAdminGuard } from './core/guards/auth.guard';
import { blogTenantResolver } from './core/guards/blog-tenant.resolver';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'sites/:siteId',
    loadComponent: () => import('./shared/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    resolve: { blogTenant: blogTenantResolver },
    children: [
      { path: '', redirectTo: 'blog', pathMatch: 'full' },
      {
        path: 'blog',
        loadComponent: () => import('./features/blog/queue/queue.component').then(m => m.QueueComponent),
      },
      {
        path: 'blog/drafts',
        loadComponent: () => import('./features/blog/drafts/drafts.component').then(m => m.DraftsComponent),
      },
      {
        path: 'blog/drafts/:postId',
        loadComponent: () => import('./features/blog/post-preview/post-preview.component').then(m => m.PostPreviewComponent),
      },
      {
        path: 'blog/scheduled',
        loadComponent: () => import('./features/blog/scheduled/scheduled.component').then(m => m.ScheduledComponent),
      },
      {
        path: 'blog/calendar',
        loadComponent: () => import('./features/blog/calendar/calendar.component').then(m => m.CalendarComponent),
      },
      {
        path: 'blog/published',
        loadComponent: () => import('./features/blog/published/published.component').then(m => m.PublishedComponent),
      },
      {
        path: 'content/:typeSlug',
        loadComponent: () => import('./features/content/entry-list/entry-list.component').then(m => m.EntryListComponent),
      },
      {
        path: 'content/:typeSlug/new',
        loadComponent: () => import('./features/content/entry-form/entry-form.component').then(m => m.EntryFormComponent),
      },
      {
        path: 'content/:typeSlug/:slug',
        loadComponent: () => import('./features/content/entry-form/entry-form.component').then(m => m.EntryFormComponent),
      },
      {
        path: 'forms',
        loadComponent: () => import('./features/forms/submissions/submissions.component').then(m => m.SubmissionsComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./shared/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [superAdminGuard],
    children: [
      {
        path: 'sites',
        loadComponent: () => import('./features/super-admin/sites/sites.component').then(m => m.SitesComponent),
      },
      {
        path: 'sites/:siteId/schema',
        loadComponent: () => import('./features/super-admin/schema/schema.component').then(m => m.SchemaComponent),
      },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
