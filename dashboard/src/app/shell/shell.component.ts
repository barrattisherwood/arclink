import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  styles: [`
    .layout { display: flex; min-height: 100vh; }

    nav {
      width: 220px;
      min-width: 220px;
      background: #0d0d0d;
      border-right: 1px solid #1a1a1a;
      padding: 24px 0;
      display: flex;
      flex-direction: column;
    }

    .nav-brand {
      padding: 0 20px 24px;
      font-size: 0.9rem;
      font-weight: 600;
      color: #666;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .nav-section {
      padding: 0 12px 8px;
      font-size: 0.7rem;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 16px;
    }

    a.nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 20px;
      color: #666;
      text-decoration: none;
      font-size: 0.875rem;
      border-radius: 6px;
      margin: 1px 8px;
      transition: all 0.15s;

      mat-icon { font-size: 18px; height: 18px; width: 18px; }

      &:hover { background: #1a1a1a; color: #ccc; }
      &.active { background: #1a1a2e; color: #a78bfa; }
    }

    .spacer { flex: 1; }

    .nav-footer {
      padding: 12px;
    }

    .content { flex: 1; overflow: auto; }
  `],
  template: `
    <div class="layout">
      <nav>
        <div class="nav-brand">Arclink</div>

        <div class="nav-section">Blog</div>
        <a class="nav-link" routerLink="/blog" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
          <mat-icon>queue</mat-icon> Queue
        </a>
        <a class="nav-link" routerLink="/blog/drafts" routerLinkActive="active"
          [routerLinkActiveOptions]="{exact:true}">
          <mat-icon>edit_note</mat-icon> Drafts
        </a>
        <a class="nav-link" routerLink="/blog/scheduled" routerLinkActive="active"
          [routerLinkActiveOptions]="{exact:true}">
          <mat-icon>schedule</mat-icon> Scheduled
        </a>
        <a class="nav-link" routerLink="/blog/published" routerLinkActive="active">
          <mat-icon>public</mat-icon> Published
        </a>

        <div class="spacer"></div>
        <div class="nav-footer">
          <a class="nav-link" (click)="logout()" style="cursor:pointer">
            <mat-icon>logout</mat-icon> Sign out
          </a>
        </div>
      </nav>
      <div class="content">
        <router-outlet />
      </div>
    </div>
  `,
})
export class ShellComponent {
  constructor(private router: Router) {}

  logout(): void {
    localStorage.removeItem('arclink_auth');
    this.router.navigate(['/login']);
  }
}
