import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TitleSuggestion, QueueItem } from '../../../models/blog.model';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Queue</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Suggestions Panel -->
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-[#999]">Title Suggestions</h3>
          <button (click)="getSuggestions()"
                  [disabled]="suggesting()"
                  class="px-3 py-1.5 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer transition-colors">
            @if (suggesting()) { Generating... } @else { Suggest 5 }
          </button>
        </div>

        @if (suggestions().length === 0 && !suggesting()) {
          <p class="text-sm text-[#555] text-center py-8">Click "Suggest 5" to get AI-generated title ideas</p>
        }

        @for (s of suggestions(); track s.title) {
          <label class="flex items-start gap-3 p-3 rounded-md hover:bg-[#1a1a1a] cursor-pointer mb-1 transition-colors">
            <input type="checkbox" [checked]="selected().has(s.title)"
                   (change)="toggleSelect(s.title)"
                   class="mt-1 accent-purple-500">
            <div>
              <p class="text-sm text-white">{{ s.title }}</p>
              <p class="text-xs text-[#666] mt-0.5">{{ s.rationale }}</p>
            </div>
          </label>
        }

        @if (selected().size > 0) {
          <button (click)="addSelected()"
                  class="mt-3 w-full py-2 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors">
            Add {{ selected().size }} to Queue
          </button>
        }
      </div>

      <!-- Queue Panel -->
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-[#999]">Queue ({{ queue().length }})</h3>
          <div class="flex gap-2">
            <button (click)="prioritise()"
                    [disabled]="prioritising()"
                    class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white disabled:opacity-50 cursor-pointer transition-colors">
              @if (prioritising()) { Ranking... } @else { SEO Prioritise }
            </button>
            <button (click)="generateNext()"
                    [disabled]="generating() || queue().length === 0"
                    class="px-3 py-1.5 text-xs rounded-md bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 cursor-pointer transition-colors">
              @if (generating()) { Generating... } @else { Generate Next }
            </button>
          </div>
        </div>

        @if (reasoning()) {
          <div class="mb-3 p-3 rounded-md bg-purple-900/20 border border-purple-800/30">
            <p class="text-xs text-purple-300">{{ reasoning() }}</p>
          </div>
        }

        @if (queue().length === 0 && !loading()) {
          <p class="text-sm text-[#555] text-center py-8">Queue is empty — add some titles</p>
        }

        @for (item of queue(); track item.id; let i = $index) {
          <div class="flex items-center gap-3 p-3 rounded-md hover:bg-[#1a1a1a] group mb-1 transition-colors">
            <span class="text-xs text-[#555] w-5 text-right">{{ i + 1 }}</span>
            <span class="text-sm text-white flex-1">{{ item.title }}</span>
            <button (click)="remove(item.id)"
                    class="text-xs text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition-all">
              Remove
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class QueueComponent implements OnInit {
  private api = inject(BlogApiService);
  private toast = inject(ToastService);

  suggestions = signal<TitleSuggestion[]>([]);
  selected = signal<Set<string>>(new Set());
  queue = signal<QueueItem[]>([]);
  reasoning = signal('');
  loading = signal(false);
  suggesting = signal(false);
  generating = signal(false);
  prioritising = signal(false);

  ngOnInit() {
    this.loadQueue();
  }

  loadQueue() {
    this.loading.set(true);
    this.api.getQueue().subscribe({
      next: res => { this.queue.set(res.items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load queue'); }
    });
  }

  getSuggestions() {
    this.suggesting.set(true);
    this.api.suggest(5).subscribe({
      next: res => { this.suggestions.set(res.suggestions); this.selected.set(new Set()); this.suggesting.set(false); },
      error: () => { this.suggesting.set(false); this.toast.error('Failed to get suggestions'); }
    });
  }

  toggleSelect(title: string) {
    this.selected.update(s => {
      const next = new Set(s);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  }

  addSelected() {
    const titles = [...this.selected()];
    this.api.addToQueue(titles).subscribe({
      next: res => {
        this.queue.set(res.items);
        this.selected.set(new Set());
        this.suggestions.update(s => s.filter(x => !titles.includes(x.title)));
        this.toast.success(`Added ${titles.length} to queue`);
      },
      error: () => this.toast.error('Failed to add to queue')
    });
  }

  remove(id: string) {
    this.api.removeFromQueue(id).subscribe({
      next: () => {
        this.queue.update(q => q.filter(i => i.id !== id));
        this.toast.success('Removed from queue');
      },
      error: () => this.toast.error('Failed to remove')
    });
  }

  prioritise() {
    this.prioritising.set(true);
    this.api.prioritise().subscribe({
      next: res => { this.queue.set(res.items); this.reasoning.set(res.reasoning); this.prioritising.set(false); },
      error: () => { this.prioritising.set(false); this.toast.error('Failed to prioritise'); }
    });
  }

  generateNext() {
    this.generating.set(true);
    this.api.generate().subscribe({
      next: () => {
        this.generating.set(false);
        this.loadQueue();
        this.toast.success('Post generated — check Drafts');
      },
      error: () => { this.generating.set(false); this.toast.error('Failed to generate post'); }
    });
  }
}
