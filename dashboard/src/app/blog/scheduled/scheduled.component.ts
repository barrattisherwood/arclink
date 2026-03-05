import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlogApiService, Post } from '../../core/blog-api.service';

@Component({
  selector: 'app-scheduled',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterModule,
    DragDropModule,
    MatButtonModule,
    MatIconModule,
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
      align-items: center;
      cursor: grab;
      transition: border-color 0.15s;
    }

    .post-card:active { cursor: grabbing; }

    .post-card.cdk-drag-preview {
      background: #111;
      border-color: #a78bfa;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    }

    .post-card.cdk-drag-placeholder {
      opacity: 0.3;
    }

    .drag-handle {
      color: #333;
      flex-shrink: 0;
      cursor: grab;
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

    .post-title a {
      color: inherit;
      text-decoration: none;
    }

    .post-title a:hover {
      text-decoration: underline;
    }

    .post-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.72rem;
      color: #444;
      flex-wrap: wrap;
    }

    .scheduled-date {
      color: #6bcb77;
      font-weight: 500;
    }

    .post-actions { display: flex; gap: 4px; flex-shrink: 0; }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .reorder-hint {
      font-size: 0.75rem;
      color: #444;
      margin-bottom: 16px;
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Scheduled</h1>
        <button mat-stroked-button (click)="load()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
      } @else if (posts().length) {
        <p class="reorder-hint">Drag to reorder — publish dates will adjust automatically</p>

        <div cdkDropList (cdkDropListDropped)="drop($event)">
          @for (post of posts(); track post.id) {
            <div class="post-card" cdkDrag>
              <mat-icon class="drag-handle" cdkDragHandle>drag_indicator</mat-icon>

              @if (post.featured_image) {
                <img class="post-image" [src]="post.featured_image.url"
                  [alt]="post.featured_image.alt" />
              } @else {
                <div class="post-image-placeholder">
                  <mat-icon>image</mat-icon>
                </div>
              }

              <div class="post-body">
                <div class="post-title">
                  <a [routerLink]="['/blog/drafts', post.id]">{{ post.title }}</a>
                </div>
                <div class="post-meta">
                  <span class="scheduled-date">{{ post.scheduled_for | date:'EEE, MMM d, y' }}</span>
                  <span>{{ post.word_count | number }} words</span>
                  @if (post.generated) {
                    <span style="color:#a78bfa">AI</span>
                  }
                  @for (tag of post.tags.slice(0, 3); track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </div>
              </div>

              <div class="post-actions">
                <button mat-icon-button (click)="remove(post)"
                  [disabled]="deleting() === post.id"
                  matTooltip="Delete post">
                  <mat-icon style="color:#ef4444">delete_outline</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon style="font-size:48px;height:48px;width:48px;color:#333">schedule</mat-icon>
          <p>No scheduled posts — approve drafts to schedule them</p>
        </div>
      }
    </div>
  `,
})
export class ScheduledComponent implements OnInit {
  posts = signal<Post[]>([]);
  loading = signal(false);
  deleting = signal<string | null>(null);

  constructor(private api: BlogApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getScheduled().subscribe({
      next: r => { this.posts.set(r.posts); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  drop(event: CdkDragDrop<Post[]>): void {
    const list = [...this.posts()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.posts.set(list);

    const ids = list.map(p => p.id);
    this.api.reorderScheduled(ids).subscribe({
      next: r => this.posts.set(r.posts),
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
