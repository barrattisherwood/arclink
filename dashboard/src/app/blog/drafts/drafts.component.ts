import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlogApiService, Post } from '../../core/blog-api.service';

@Component({
  selector: 'app-drafts',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  styles: [`
    .post-card {
      border: 1px solid #1a1a1a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .post-image {
      width: 80px;
      height: 60px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
      background: #1a1a1a;
    }

    .post-image-placeholder {
      width: 80px;
      height: 60px;
      border-radius: 4px;
      background: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #333;
    }

    .post-body { flex: 1; min-width: 0; }

    .post-title {
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .post-excerpt {
      font-size: 0.78rem;
      color: #666;
      line-height: 1.5;
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .post-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.72rem;
      color: #444;
      flex-wrap: wrap;
    }

    .badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 500;
    }

    .badge-generated { background: #1a1a2e; color: #a78bfa; }
    .badge-scheduled { background: #1a2e1a; color: #6bcb77; }

    .post-actions { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Drafts</h1>
        <button mat-stroked-button (click)="load()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
      } @else if (posts().length) {
        @for (post of posts(); track post.id) {
          <div class="post-card">
            @if (post.featured_image) {
              <img class="post-image" [src]="post.featured_image.url"
                [alt]="post.featured_image.alt" />
            } @else {
              <div class="post-image-placeholder">
                <mat-icon>image</mat-icon>
              </div>
            }

            <div class="post-body">
              <div class="post-title">{{ post.title }}</div>
              <div class="post-excerpt">{{ post.excerpt }}</div>
              <div class="post-meta">
                <span>{{ post.word_count | number }} words</span>
                <span>{{ post.created_at | date:'MMM d, y' }}</span>
                @if (post.generated) {
                  <span class="badge badge-generated">AI</span>
                }
                @if (post.status === 'scheduled') {
                  <span class="badge badge-scheduled">Scheduled {{ post.scheduled_for | date:'MMM d' }}</span>
                }
                @for (tag of post.tags.slice(0, 3); track tag) {
                  <span class="tag">{{ tag }}</span>
                }
              </div>
            </div>

            <div class="post-actions">
              @if (post.status === 'draft') {
                <button mat-stroked-button [disabled]="approving() === post.id"
                  (click)="approve(post)" matTooltip="Schedule for publishing">
                  <mat-icon>schedule_send</mat-icon>
                  {{ approving() === post.id ? 'Scheduling...' : 'Approve' }}
                </button>
              }
              <button mat-icon-button (click)="remove(post)"
                [disabled]="deleting() === post.id"
                matTooltip="Delete post">
                <mat-icon style="color:#ef4444">delete_outline</mat-icon>
              </button>
            </div>
          </div>
        }
      } @else {
        <div class="empty-state">
          <mat-icon style="font-size:48px;height:48px;width:48px;color:#333">edit_note</mat-icon>
          <p>No drafts yet — generate a post from the Queue page</p>
        </div>
      }
    </div>
  `,
})
export class DraftsComponent implements OnInit {
  posts = signal<Post[]>([]);
  loading = signal(false);
  approving = signal<string | null>(null);
  deleting = signal<string | null>(null);

  constructor(private api: BlogApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getDrafts().subscribe({
      next: r => { this.posts.set(r.posts); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  approve(post: Post): void {
    this.approving.set(post.id);
    this.api.approvePost(post.id).subscribe({
      next: updated => {
        this.posts.update(list => list.map(p => p.id === post.id ? updated.post : p));
        this.approving.set(null);
      },
      error: () => this.approving.set(null),
    });
  }

  remove(post: Post): void {
    this.deleting.set(post.id);
    this.api.deletePost(post.id).subscribe({
      next: () => {
        this.posts.update(list => list.filter(p => p.id !== post.id));
        this.deleting.set(null);
      },
      error: () => this.deleting.set(null),
    });
  }
}
