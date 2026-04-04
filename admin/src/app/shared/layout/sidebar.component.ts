import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ContentApiService } from '../../core/services/content-api.service';
import { BlogApiService } from '../../core/services/blog-api.service';
import { ContentType } from '../../models/content-type.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="w-56 h-full bg-[#111] border-r border-[#1a1a1a] flex flex-col">
      <div class="px-4 py-5 border-b border-[#1a1a1a]">
        <span class="text-lg font-semibold tracking-tight text-white">arclink</span>
        <span class="text-xs text-[#666] ml-1">admin</span>
      </div>

      <nav class="flex-1 overflow-y-auto py-3 px-2">
        <!-- Blog -->
        @if (hasBlog()) {
        <div class="mb-4">
          <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Blog</p>
          <a [routerLink]="siteBase() + '/blog'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             [routerLinkActiveOptions]="{ exact: true }"
             class="nav-link">Queue</a>
          <a [routerLink]="siteBase() + '/blog/drafts'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             class="nav-link">Drafts</a>
          <a [routerLink]="siteBase() + '/blog/scheduled'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             class="nav-link">Scheduled</a>
          <a [routerLink]="siteBase() + '/blog/published'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             class="nav-link">Published</a>
        </div>
        }

        <!-- Content (dynamic from API) -->
        @if (contentTypes().length > 0) {
          <div class="mb-4">
            <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Content</p>
            @for (type of contentTypes(); track type.slug) {
              <a [routerLink]="siteBase() + '/content/' + type.slug"
                 routerLinkActive="bg-[#1a1a1a] text-white"
                 class="nav-link">{{ type.name }}</a>
            }
          </div>
        }

        <!-- Forms -->
        <div class="mb-4">
          <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Forms</p>
          <a [routerLink]="siteBase() + '/forms'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             class="nav-link">Submissions</a>
        </div>

        <!-- Settings -->
        <div class="mb-4">
          <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Settings</p>
          <a [routerLink]="siteBase() + '/settings'"
             routerLinkActive="bg-[#1a1a1a] text-white"
             class="nav-link">Site Settings</a>
        </div>

        <!-- Super Admin -->
        @if (auth.isSuperAdmin()) {
          <div class="mb-4">
            <p class="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#555]">Admin</p>
            <a routerLink="/admin/sites"
               routerLinkActive="bg-[#1a1a1a] text-white"
               class="nav-link">Sites</a>
          </div>
        }
      </nav>
    </aside>
  `,
  styles: [`
    .nav-link {
      display: block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      color: #999;
      transition: all 0.15s;
      cursor: pointer;
    }
    .nav-link:hover {
      background: #1a1a1a;
      color: #ccc;
    }
  `]
})
export class SidebarComponent implements OnInit {
  auth = inject(AuthService);
  private contentApi = inject(ContentApiService);
  private blogApi = inject(BlogApiService);
  private route = inject(ActivatedRoute);

  contentTypes = signal<ContentType[]>([]);
  hasBlog = signal(false);

  private get currentSiteId(): string | null {
    return this.route.snapshot.paramMap.get('siteId');
  }

  siteBase(): string {
    const siteId = this.currentSiteId;
    return siteId ? `/sites/${siteId}` : '/admin/sites';
  }

  ngOnInit() {
    const siteId = this.currentSiteId;
    if (siteId) {
      this.contentApi.getTypes(siteId).subscribe({
        next: res => this.contentTypes.set(res.types.filter(t => t.slug !== 'site-settings')),
        error: () => {}
      });
      this.blogApi.checkTenant(siteId).subscribe({
        next: res => this.hasBlog.set(res.exists),
        error: () => this.hasBlog.set(false),
      });
    }
  }
}
