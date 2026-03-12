import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentApiService } from '../../../core/services/content-api.service';
import { ToastService } from '../../../shared/services/toast.service';

interface SiteSummary {
  siteId: string;
  name: string;
  domain?: string;
  active: boolean;
  contentTypeCount?: number;
}

@Component({
  selector: 'app-sites',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-white">Sites</h2>
      <span class="text-xs text-[#666]">{{ sites().length }} tenants</span>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && sites().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No sites found</p>
    }

    <div class="grid gap-2">
      @for (site of sites(); track site.siteId) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] px-4 py-3 flex items-center gap-4 hover:border-[#222] transition-colors">
          <!-- Active indicator -->
          <div class="w-2 h-2 rounded-full shrink-0"
               [class]="site.active ? 'bg-green-500' : 'bg-red-500'"></div>

          <!-- Name -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-white truncate">{{ site.name }}</p>
            @if (site.domain) {
              <p class="text-[10px] text-[#555]">{{ site.domain }}</p>
            }
          </div>

          <!-- Site ID -->
          <span class="text-[10px] text-[#555] font-mono shrink-0">{{ site.siteId }}</span>

          <!-- Actions -->
          <a [routerLink]="[site.siteId, 'schema']"
             class="text-xs text-purple-400 hover:text-purple-300 transition-colors shrink-0">
            Schema
          </a>
          <a [routerLink]="['/sites', site.siteId, 'blog']"
             class="text-xs text-[#999] hover:text-white transition-colors shrink-0">
            Open
          </a>
        </div>
      }
    </div>
  `
})
export class SitesComponent implements OnInit {
  private contentApi = inject(ContentApiService);
  private toast = inject(ToastService);

  sites = signal<SiteSummary[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loading.set(true);
    // Use a special 'all' siteId to fetch all sites (super-admin)
    this.contentApi.getSites().subscribe({
      next: (res: any) => {
        this.sites.set(res.sites || []);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load sites'); }
    });
  }
}
