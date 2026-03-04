import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'blog', pathMatch: 'full' },
      {
        path: 'blog',
        loadComponent: () => import('./blog/queue/queue.component').then(m => m.QueueComponent),
      },
      {
        path: 'blog/drafts',
        loadComponent: () => import('./blog/drafts/drafts.component').then(m => m.DraftsComponent),
      },
      {
        path: 'blog/drafts/:postId',
        loadComponent: () => import('./blog/post-preview/post-preview.component').then(m => m.PostPreviewComponent),
      },
      {
        path: 'blog/published',
        loadComponent: () => import('./blog/published/published.component').then(m => m.PublishedComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
