import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ContentApiService } from '../../../core/services/content-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ContentType, FieldDefinition } from '../../../models/content-type.model';

@Component({
  selector: 'app-schema',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex items-center gap-3 mb-6">
      <a routerLink="/admin/sites" class="text-sm text-[#666] hover:text-white transition-colors">&larr; Sites</a>
      <span class="text-[#333]">/</span>
      <h2 class="text-lg font-semibold text-white">Schema — {{ siteId }}</h2>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && types().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No content types defined for this site</p>
    }

    <div class="grid gap-4">
      @for (type of types(); track type.slug) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a]">
          <!-- Type header -->
          <div class="px-4 py-3 flex items-center gap-4 cursor-pointer border-b border-[#1a1a1a]"
               (click)="toggle(type.slug)">
            <span class="text-sm font-medium text-white flex-1">{{ type.name }}</span>
            <span class="text-[10px] text-[#555] font-mono">/{{ type.slug }}</span>
            <span class="text-[10px] text-[#555]">{{ type.fields.length }} fields</span>
            <span class="text-xs text-[#555]">{{ expanded().has(type.slug) ? '▲' : '▼' }}</span>
          </div>

          <!-- Fields table -->
          @if (expanded().has(type.slug)) {
            <div class="p-4">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-[#555] border-b border-[#1a1a1a]">
                    <th class="text-left pb-2 font-medium">#</th>
                    <th class="text-left pb-2 font-medium">Key</th>
                    <th class="text-left pb-2 font-medium">Label</th>
                    <th class="text-left pb-2 font-medium">Type</th>
                    <th class="text-left pb-2 font-medium">Required</th>
                    <th class="text-left pb-2 font-medium">Options</th>
                  </tr>
                </thead>
                <tbody>
                  @for (field of sortFields(type.fields); track field.key; let i = $index) {
                    <tr class="border-b border-[#0a0a0a] text-[#999]">
                      <td class="py-2 text-[#555]">{{ field.order }}</td>
                      <td class="py-2 font-mono text-white">{{ field.key }}</td>
                      <td class="py-2">{{ field.label }}</td>
                      <td class="py-2">
                        <span class="px-1.5 py-0.5 rounded bg-[#1a1a1a] text-[#999]">{{ field.type }}</span>
                      </td>
                      <td class="py-2">
                        @if (field.required) {
                          <span class="text-green-400">yes</span>
                        } @else {
                          <span class="text-[#555]">no</span>
                        }
                      </td>
                      <td class="py-2 text-[#555] max-w-[200px] truncate">
                        {{ field.options?.join(', ') || field.helpText || '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SchemaComponent implements OnInit {
  private contentApi = inject(ContentApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  siteId = '';
  types = signal<ContentType[]>([]);
  loading = signal(false);
  expanded = signal<Set<string>>(new Set());

  ngOnInit() {
    this.siteId = this.route.snapshot.paramMap.get('siteId') || '';
    this.loading.set(true);
    this.contentApi.getTypes(this.siteId).subscribe({
      next: res => { this.types.set(res.types); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load schema'); }
    });
  }

  toggle(slug: string) {
    this.expanded.update(s => {
      const next = new Set(s);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  sortFields(fields: FieldDefinition[]): FieldDefinition[] {
    return [...fields].sort((a, b) => a.order - b.order);
  }
}
