import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SuggestionsApiService } from '../../../core/services/suggestions-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ContentSuggestion } from '../../../models/blog.model';

interface EditableSuggestion extends ContentSuggestion {
  _editTitle:      string;
  _editGenerateAt: string;
  _editPublishAt:  string;
  _saving:         boolean;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  'match-preview':    'Match Preview',
  'season-preview':   'Season Preview',
  'evergreen':        'Evergreen',
  'tournament-window':'Tournament',
  'post-match':       'Post-Match',
  'bookmaker-review': 'Bookmaker Review',
  'article':          'Article',
  'weekly-roundup':   'Weekly Roundup',
};

@Component({
  selector: 'app-suggestions-inbox',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-white">Content Suggestions</h2>
        <p class="text-xs text-[#555] mt-0.5">Generated from upcoming fixtures. Review, edit if needed, then approve to schedule.</p>
      </div>
      <button (click)="runTrigger()"
              [disabled]="triggering()"
              class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222] cursor-pointer transition-colors disabled:opacity-50">
        @if (triggering()) {
          <span>Scanning…</span>
        } @else {
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span>Scan Fixtures</span>
        }
      </button>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading…</p>
    }

    @if (!loading() && suggestions().length === 0) {
      <div class="text-center py-16">
        <p class="text-[#555] text-sm mb-2">No pending suggestions</p>
        <p class="text-[#333] text-xs">Click "Scan Fixtures" to generate suggestions from upcoming fixtures,<br>or wait for Wednesday's automatic scan.</p>
      </div>
    }

    <div class="space-y-4">
      @for (s of suggestions(); track s.id) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-5">

          <!-- Meta row -->
          <div class="flex items-center gap-2 flex-wrap mb-3">
            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide bg-blue-900/40 text-blue-400">
              {{ contentTypeLabel(s.content_type) }}
            </span>
            @if (s.competition) {
              <span class="text-xs text-[#555]">{{ s.competition }}</span>
            }
            @if (s.persona_tag) {
              <span class="text-xs text-[#444] capitalize">{{ s.persona_tag }}</span>
            }
            <span class="text-xs text-[#333] ml-auto">{{ s.reason }}</span>
          </div>

          <!-- Editable title -->
          <div class="mb-3">
            <label class="block text-[10px] text-[#555] mb-1 uppercase tracking-wider">Title</label>
            <input [(ngModel)]="s._editTitle"
                   class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors">
          </div>

          <!-- Fixture ref -->
          @if (s.fixture_label) {
            <p class="text-xs text-[#444] mb-3">
              <span class="text-[#333]">Fixture: </span>{{ s.fixture_label }}
            </p>
          }

          <!-- Date inputs -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label class="block text-[10px] text-[#555] mb-1 uppercase tracking-wider">Generate At</label>
              <input type="datetime-local" [(ngModel)]="s._editGenerateAt"
                     class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
            </div>
            <div>
              <label class="block text-[10px] text-[#555] mb-1 uppercase tracking-wider">Publish At</label>
              <input type="datetime-local" [(ngModel)]="s._editPublishAt"
                     class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3">
            <button (click)="dismiss(s.id)"
                    [disabled]="s._saving"
                    class="px-3 py-1.5 text-xs rounded-md text-[#666] hover:text-red-400 hover:bg-red-900/20 cursor-pointer transition-colors disabled:opacity-50">
              Dismiss
            </button>
            <button (click)="approve(s)"
                    [disabled]="s._saving"
                    class="px-4 py-1.5 text-xs rounded-md bg-white text-black font-medium hover:bg-[#ddd] cursor-pointer transition-colors disabled:opacity-50">
              {{ s._saving ? 'Scheduling…' : '✓ Approve & Schedule' }}
            </button>
          </div>

        </div>
      }
    </div>
  `,
})
export class SuggestionsInboxComponent implements OnInit {
  private api   = inject(SuggestionsApiService);
  private toast = inject(ToastService);

  suggestions = signal<EditableSuggestion[]>([]);
  loading     = signal(false);
  triggering  = signal(false);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getSuggestions().subscribe({
      next: res => {
        this.suggestions.set(res.suggestions.map(s => this.toEditable(s)));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load suggestions'); },
    });
  }

  approve(s: EditableSuggestion) {
    this.setSaving(s.id, true);
    this.api.approve(s.id, {
      title:       s._editTitle,
      generate_at: s._editGenerateAt ? new Date(s._editGenerateAt).toISOString() : undefined,
      publish_at:  s._editPublishAt  ? new Date(s._editPublishAt).toISOString()  : undefined,
    }).subscribe({
      next: () => {
        this.removeSuggestion(s.id);
        this.toast.success('Scheduled');
      },
      error: () => { this.setSaving(s.id, false); this.toast.error('Failed to approve'); },
    });
  }

  dismiss(id: string) {
    this.setSaving(id, true);
    this.api.dismiss(id).subscribe({
      next: () => {
        this.removeSuggestion(id);
        this.toast.success('Dismissed');
      },
      error: () => { this.setSaving(id, false); this.toast.error('Failed to dismiss'); },
    });
  }

  runTrigger() {
    this.triggering.set(true);
    this.api.trigger().subscribe({
      next: res => {
        this.triggering.set(false);
        if (res.created > 0) {
          this.toast.success(`${res.created} new suggestion(s) found`);
          this.load();
        } else {
          this.toast.success('No new fixtures found');
        }
      },
      error: () => { this.triggering.set(false); this.toast.error('Scan failed'); },
    });
  }

  contentTypeLabel(type: string): string {
    return CONTENT_TYPE_LABELS[type] ?? type;
  }

  private toEditable(s: ContentSuggestion): EditableSuggestion {
    return {
      ...s,
      _editTitle:      s.title,
      _editGenerateAt: toDatetimeLocal(s.generate_at),
      _editPublishAt:  toDatetimeLocal(s.publish_at),
      _saving:         false,
    };
  }

  private setSaving(id: string, saving: boolean) {
    this.suggestions.update(list => list.map(s => s.id === id ? { ...s, _saving: saving } : s));
  }

  private removeSuggestion(id: string) {
    this.suggestions.update(list => list.filter(s => s.id !== id));
  }
}
