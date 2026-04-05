import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TitleSuggestion, QueueItem, FixtureEntry } from '../../../models/blog.model';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Queue</h2>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Suggestions / Add Panel -->
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
          <div class="mt-3 flex items-center gap-2">
            <select [(ngModel)]="selectedPersona"
                    class="flex-1 px-2 py-1.5 text-xs rounded-md bg-[#1a1a1a] border border-[#2a2a2a] text-white cursor-pointer">
              <option value="">No persona (standard)</option>
              <option value="kwagga">Kwagga van der Berg</option>
              <option value="marcus">Marcus Webb</option>
            </select>
            <button (click)="addSelected()"
                    class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors whitespace-nowrap">
              Add {{ selected().size }} to Queue
            </button>
          </div>
        }

        <!-- Weekly Roundup Manual Entry -->
        <div class="mt-6 pt-5 border-t border-[#1a1a1a]">
          <p class="text-xs font-medium text-[#999] mb-3">Weekly Roundup</p>

          <input [(ngModel)]="roundupTitle"
                 placeholder="e.g. URC Weekend Preview — 5 April"
                 class="w-full px-3 py-2 text-sm rounded-md bg-[#0a0a0a] border border-[#2a2a2a] text-white placeholder-[#444] mb-3">

          <div class="space-y-2">
            @for (fixture of newFixtures; track $index; let i = $index) {
              <div class="bg-[#0a0a0a] rounded-md border border-[#222] p-3">
                <div class="flex gap-2 mb-2">
                  <input [(ngModel)]="fixture.homeTeam" placeholder="Home"
                         class="flex-1 px-2 py-1 text-xs rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#444]">
                  <span class="text-xs text-[#555] self-center">vs</span>
                  <input [(ngModel)]="fixture.awayTeam" placeholder="Away"
                         class="flex-1 px-2 py-1 text-xs rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#444]">
                  <button (click)="removeFixture(i)"
                          class="text-xs text-[#555] hover:text-red-400 cursor-pointer transition-colors px-1">✕</button>
                </div>
                <div class="flex gap-2">
                  <input [(ngModel)]="fixture.competition" placeholder="Competition"
                         class="flex-1 px-2 py-1 text-xs rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#444]">
                  <input [(ngModel)]="fixture.venue" placeholder="Venue"
                         class="flex-1 px-2 py-1 text-xs rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white placeholder-[#444]">
                  <input [(ngModel)]="fixture.kickoff" type="datetime-local"
                         class="px-2 py-1 text-xs rounded bg-[#1a1a1a] border border-[#2a2a2a] text-white">
                </div>
              </div>
            }
          </div>

          <div class="flex gap-2 mt-3">
            <button (click)="addFixture()"
                    class="flex-1 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-[#999] cursor-pointer transition-colors">
              + Add fixture
            </button>
            <button (click)="addRoundup()"
                    [disabled]="!roundupTitle.trim() || newFixtures.length === 0"
                    class="flex-1 py-1.5 text-xs rounded-md bg-green-800 hover:bg-green-700 text-white disabled:opacity-40 cursor-pointer transition-colors">
              Add Roundup to Queue
            </button>
          </div>
        </div>
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
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">{{ item.title }}</p>
              @if (item.fixtures.length) {
                <p class="text-xs text-[#555] mt-0.5">{{ item.fixtures.length }} fixture{{ item.fixtures.length > 1 ? 's' : '' }}</p>
              }
            </div>
            @if (item.fixtures.length) {
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 shrink-0">Roundup</span>
            } @else if (item.persona_tag) {
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 capitalize shrink-0">{{ item.persona_tag }}</span>
            }
            <button (click)="remove(item.id)"
                    class="text-xs text-[#555] hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer transition-all shrink-0">
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
  selectedPersona = '';
  queue = signal<QueueItem[]>([]);
  reasoning = signal('');
  loading = signal(false);
  suggesting = signal(false);
  generating = signal(false);
  prioritising = signal(false);

  roundupTitle = '';
  newFixtures: Partial<FixtureEntry>[] = [{}];

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
    const persona = this.selectedPersona || undefined;
    const titleStrings = [...this.selected()];
    const titles = titleStrings.map(title => ({ title, ...(persona ? { persona_tag: persona } : {}) }));
    this.api.addToQueue(titles).subscribe({
      next: res => {
        this.queue.set(res.items);
        this.selected.set(new Set());
        this.suggestions.update(s => s.filter(x => !titleStrings.includes(x.title)));
        this.toast.success(`Added ${titles.length} to queue`);
      },
      error: () => this.toast.error('Failed to add to queue')
    });
  }

  addFixture() {
    this.newFixtures = [...this.newFixtures, {}];
  }

  removeFixture(index: number) {
    this.newFixtures = this.newFixtures.filter((_, i) => i !== index);
  }

  buildMatchLabel(f: Partial<FixtureEntry>): string {
    if (!f.homeTeam || !f.awayTeam) return `${f.homeTeam ?? '?'} vs ${f.awayTeam ?? '?'}`;
    const kickoffDate = f.kickoff ? new Date(f.kickoff) : null;
    const dayTime = kickoffDate
      ? kickoffDate.toLocaleDateString('en-ZA', { weekday: 'short' }) + ' ' +
        kickoffDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
      : '';
    return [
      `${f.homeTeam} vs ${f.awayTeam}`,
      f.venue,
      dayTime,
    ].filter(Boolean).join(' · ');
  }

  addRoundup() {
    if (!this.roundupTitle.trim() || !this.newFixtures.length) return;
    const fixtures: FixtureEntry[] = this.newFixtures
      .filter(f => f.homeTeam && f.awayTeam)
      .map(f => ({
        homeTeam: f.homeTeam!,
        awayTeam: f.awayTeam!,
        competition: f.competition ?? '',
        venue: f.venue ?? '',
        kickoff: f.kickoff ?? '',
        matchLabel: this.buildMatchLabel(f),
      }));

    if (!fixtures.length) {
      this.toast.error('Add at least one complete fixture (home + away team)');
      return;
    }

    this.api.addToQueue([{ title: this.roundupTitle.trim(), fixtures }]).subscribe({
      next: res => {
        this.queue.set(res.items);
        this.roundupTitle = '';
        this.newFixtures = [{}];
        this.toast.success('Weekly roundup added to queue');
      },
      error: () => this.toast.error('Failed to add roundup to queue')
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
