import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { BlogApiService, TitleSuggestion, QueueItem } from '../../core/blog-api.service';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  styles: [`
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }

    .suggestion-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #1a1a1a;
      &:last-child { border-bottom: none; }
    }

    .suggestion-title { font-size: 0.9rem; font-weight: 500; margin-bottom: 4px; }
    .suggestion-rationale { font-size: 0.78rem; color: #666; line-height: 1.5; }

    .queue-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #1a1a1a;
      &:last-child { border-bottom: none; }
    }

    .queue-title { flex: 1; font-size: 0.875rem; }
    .queue-pos { font-size: 0.75rem; color: #444; width: 20px; }

    .actions { display: flex; gap: 8px; margin-top: 16px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 32px; }

    .generating {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #1a1a2e;
      border-radius: 8px;
      color: #a78bfa;
      font-size: 0.875rem;
      margin-bottom: 16px;
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Blog Queue</h1>
        <div style="display:flex;gap:8px">
          @if (queue().length > 0) {
            <button mat-stroked-button (click)="prioritise()" [disabled]="prioritising()">
              <mat-icon>auto_awesome</mat-icon>
              {{ prioritising() ? 'Ranking...' : 'SEO Prioritise' }}
            </button>
          }
          <button mat-flat-button (click)="generateNext()"
            [disabled]="generating() || queue().length === 0">
            <mat-icon>bolt</mat-icon>
            {{ generating() ? 'Generating...' : 'Generate Next' }}
          </button>
        </div>
      </div>

      @if (generating()) {
        <div class="generating">
          <mat-spinner diameter="20" />
          Writing post from "{{ queue()[0].title }}"... this takes ~20 seconds
        </div>
      }

      <div class="two-col">
        <!-- Suggestions -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <strong>Title Suggestions</strong>
            <button mat-stroked-button (click)="getSuggestions()" [disabled]="loadingSuggestions()">
              <mat-icon>refresh</mat-icon>
              {{ loadingSuggestions() ? 'Thinking...' : suggestions().length ? 'Refresh' : 'Suggest 5' }}
            </button>
          </div>

          @if (loadingSuggestions()) {
            <div class="spinner-wrap"><mat-spinner diameter="32" /></div>
          } @else if (suggestions().length) {
            @for (s of suggestions(); track s.title) {
              <div class="suggestion-item">
                <mat-checkbox [checked]="isSelected(s.title)"
                  (change)="toggleSelection(s.title)" />
                <div>
                  <div class="suggestion-title">{{ s.title }}</div>
                  <div class="suggestion-rationale">{{ s.rationale }}</div>
                </div>
              </div>
            }
            @if (selectedTitles().length > 0) {
              <div class="actions">
                <button mat-flat-button (click)="addSelected()">
                  Add {{ selectedTitles().length }} to queue
                </button>
                <button mat-button (click)="clearSelection()">Clear</button>
              </div>
            }
          } @else {
            <div class="empty-state">
              <mat-icon style="font-size:40px;height:40px;width:40px;color:#333">lightbulb</mat-icon>
              <p>Click "Suggest 5" to get Claude-generated title ideas</p>
            </div>
          }
        </div>

        <!-- Queue -->
        <div class="card">
          <strong>Queue ({{ queue().length }})</strong>

          @if (loadingQueue()) {
            <div class="spinner-wrap"><mat-spinner diameter="32" /></div>
          } @else if (queue().length) {
            @for (item of queue(); track item.id; let i = $index) {
              <div class="queue-item">
                <span class="queue-pos">{{ i + 1 }}</span>
                <span class="queue-title">{{ item.title }}</span>
                <button mat-icon-button (click)="removeFromQueue(item.id)"
                  matTooltip="Remove">
                  <mat-icon style="font-size:16px">close</mat-icon>
                </button>
              </div>
            }
            @if (prioritisingReasoning()) {
              <mat-divider style="margin:16px 0" />
              <div style="font-size:0.75rem;color:#555">
                <strong style="color:#666">SEO reasoning:</strong><br>
                {{ prioritisingReasoning() }}
              </div>
            }
          } @else {
            <div class="empty-state">
              <mat-icon style="font-size:40px;height:40px;width:40px;color:#333">list</mat-icon>
              <p>Queue is empty — add titles from suggestions</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class QueueComponent implements OnInit {
  suggestions = signal<TitleSuggestion[]>([]);
  selectedTitles = signal<string[]>([]);
  queue = signal<QueueItem[]>([]);
  loadingSuggestions = signal(false);
  loadingQueue = signal(false);
  generating = signal(false);
  prioritising = signal(false);
  prioritisingReasoning = signal('');

  constructor(private api: BlogApiService) {}

  ngOnInit(): void {
    this.loadQueue();
  }

  loadQueue(): void {
    this.loadingQueue.set(true);
    this.api.getQueue().subscribe({
      next: r => { this.queue.set(r.items); this.loadingQueue.set(false); },
      error: () => this.loadingQueue.set(false),
    });
  }

  getSuggestions(): void {
    this.loadingSuggestions.set(true);
    this.selectedTitles.set([]);
    this.api.suggest(5).subscribe({
      next: r => { this.suggestions.set(r.suggestions); this.loadingSuggestions.set(false); },
      error: () => this.loadingSuggestions.set(false),
    });
  }

  isSelected(title: string): boolean {
    return this.selectedTitles().includes(title);
  }

  toggleSelection(title: string): void {
    const current = this.selectedTitles();
    this.selectedTitles.set(
      current.includes(title) ? current.filter(t => t !== title) : [...current, title]
    );
  }

  clearSelection(): void {
    this.selectedTitles.set([]);
  }

  addSelected(): void {
    this.api.addToQueue(this.selectedTitles()).subscribe({
      next: () => { this.loadQueue(); this.clearSelection(); },
    });
  }

  removeFromQueue(id: string): void {
    this.api.removeFromQueue(id).subscribe({ next: () => this.loadQueue() });
  }

  generateNext(): void {
    this.generating.set(true);
    this.api.generate().subscribe({
      next: () => { this.generating.set(false); this.loadQueue(); },
      error: () => this.generating.set(false),
    });
  }

  prioritise(): void {
    this.prioritising.set(true);
    this.api.prioritise().subscribe({
      next: r => {
        this.queue.set(r.items);
        this.prioritisingReasoning.set(r.reasoning);
        this.prioritising.set(false);
      },
      error: () => this.prioritising.set(false),
    });
  }
}
