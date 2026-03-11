import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ContentApiService } from '../../../core/services/content-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ContentType } from '../../../models/content-type.model';
import { ContentEntry } from '../../../models/content-entry.model';

@Component({
  selector: 'app-entry-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-white">{{ contentType()?.name || 'Entries' }}</h2>
      <div class="flex gap-2">
        <button (click)="toggleFilter()"
                class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors">
          {{ showPublished() === null ? 'All' : showPublished() ? 'Published' : 'Unpublished' }}
        </button>
        <a [routerLink]="'new'" class="px-3 py-1.5 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white transition-colors">
          + New Entry
        </a>
      </div>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && entries().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No entries yet</p>
    }

    <div class="grid gap-1">
      @for (entry of entries(); track entry._id) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] px-4 py-3 flex items-center gap-4 hover:border-[#222] transition-colors">
          <!-- Published indicator -->
          <div class="w-2 h-2 rounded-full shrink-0"
               [class]="entry.published ? 'bg-green-500' : 'bg-yellow-500'"></div>

          <!-- Title/slug -->
          <a [routerLink]="entry.slug"
             class="text-sm text-white hover:text-purple-300 flex-1 min-w-0 truncate transition-colors">
            {{ entry.data['title'] || entry.data['name'] || entry.slug }}
          </a>

          <!-- Meta -->
          <span class="text-[10px] text-[#555] shrink-0">/{{ entry.slug }}</span>
          <span class="text-[10px] text-[#555] shrink-0">{{ entry.updatedAt | date:'MMM d, y' }}</span>

          <!-- Toggle publish -->
          <button (click)="togglePublish(entry)"
                  class="text-xs shrink-0 cursor-pointer transition-colors"
                  [class]="entry.published ? 'text-green-400 hover:text-yellow-400' : 'text-yellow-400 hover:text-green-400'">
            {{ entry.published ? 'Unpublish' : 'Publish' }}
          </button>

          <!-- Delete -->
          <button (click)="remove(entry)"
                  [disabled]="deleting() === entry._id"
                  class="text-xs text-[#555] hover:text-red-400 cursor-pointer transition-colors shrink-0">
            Delete
          </button>
        </div>
      }
    </div>

    <!-- Pagination -->
    @if (total() > limit) {
      <div class="flex items-center justify-center gap-4 mt-4">
        <button (click)="prevPage()" [disabled]="offset() === 0"
                class="text-xs text-[#999] hover:text-white disabled:opacity-30 cursor-pointer transition-colors">
          &larr; Prev
        </button>
        <span class="text-xs text-[#555]">{{ offset() + 1 }}-{{ Math.min(offset() + limit, total()) }} of {{ total() }}</span>
        <button (click)="nextPage()" [disabled]="offset() + limit >= total()"
                class="text-xs text-[#999] hover:text-white disabled:opacity-30 cursor-pointer transition-colors">
          Next &rarr;
        </button>
      </div>
    }
  `
})
export class EntryListComponent implements OnInit, OnDestroy {
  private contentApi = inject(ContentApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private sub?: Subscription;

  Math = Math;
  limit = 25;

  contentType = signal<ContentType | null>(null);
  entries = signal<ContentEntry[]>([]);
  total = signal(0);
  offset = signal(0);
  showPublished = signal<boolean | null>(null);
  loading = signal(false);
  deleting = signal('');

  private get siteId(): string {
    const user = this.auth.user();
    return user?.siteId === '*' ? '_' : user?.siteId || '_';
  }

  private get typeSlug(): string {
    return this.route.snapshot.paramMap.get('typeSlug') || '';
  }

  ngOnInit() {
    this.sub = this.route.paramMap.subscribe(() => {
      this.offset.set(0);
      this.loadType();
      this.loadEntries();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadType() {
    this.contentApi.getType(this.siteId, this.typeSlug).subscribe({
      next: type => this.contentType.set(type),
      error: () => {}
    });
  }

  loadEntries() {
    this.loading.set(true);
    const params: Record<string, any> = { limit: this.limit, offset: this.offset() };
    if (this.showPublished() !== null) params['published'] = this.showPublished();

    this.contentApi.getEntries(this.siteId, this.typeSlug, params).subscribe({
      next: res => {
        this.entries.set(res.entries);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load entries'); }
    });
  }

  toggleFilter() {
    const current = this.showPublished();
    if (current === null) this.showPublished.set(true);
    else if (current === true) this.showPublished.set(false);
    else this.showPublished.set(null);
    this.offset.set(0);
    this.loadEntries();
  }

  togglePublish(entry: ContentEntry) {
    this.contentApi.togglePublish(this.siteId, this.typeSlug, entry.slug).subscribe({
      next: res => {
        this.entries.update(list =>
          list.map(e => e._id === entry._id ? { ...e, published: res.published } : e)
        );
      },
      error: () => this.toast.error('Failed to toggle publish')
    });
  }

  remove(entry: ContentEntry) {
    this.deleting.set(entry._id);
    this.contentApi.deleteEntry(this.siteId, this.typeSlug, entry.slug).subscribe({
      next: () => {
        this.entries.update(list => list.filter(e => e._id !== entry._id));
        this.total.update(t => t - 1);
        this.deleting.set('');
        this.toast.success('Entry deleted');
      },
      error: () => { this.deleting.set(''); this.toast.error('Failed to delete'); }
    });
  }

  prevPage() { this.offset.update(o => Math.max(0, o - this.limit)); this.loadEntries(); }
  nextPage() { this.offset.update(o => o + this.limit); this.loadEntries(); }
}
