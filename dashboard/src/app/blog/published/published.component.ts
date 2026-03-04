import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlogApiService, Post } from '../../core/blog-api.service';

@Component({
  selector: 'app-published',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  styles: [`
    .post-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid #1a1a1a;
      &:last-child { border-bottom: none; }
    }

    .post-thumb {
      width: 56px;
      height: 42px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
      background: #1a1a1a;
    }

    .post-thumb-placeholder {
      width: 56px;
      height: 42px;
      border-radius: 4px;
      background: #1a1a1a;
      flex-shrink: 0;
    }

    .post-info { flex: 1; min-width: 0; }

    .post-title {
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .post-meta {
      font-size: 0.72rem;
      color: #444;
      display: flex;
      gap: 10px;
    }

    .tag-list { display: flex; gap: 4px; flex-wrap: wrap; }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }

    .stats-bar {
      display: flex;
      gap: 24px;
      padding: 12px 0;
      margin-bottom: 16px;
      border-bottom: 1px solid #1a1a1a;
    }

    .stat { font-size: 0.8rem; color: #555; }
    .stat strong { color: #aaa; display: block; font-size: 1.1rem; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Published</h1>
        <button mat-stroked-button (click)="load()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
      } @else {
        @if (total() > 0) {
          <div class="stats-bar">
            <div class="stat"><strong>{{ total() }}</strong>Total posts</div>
            <div class="stat"><strong>{{ pages() }}</strong>Pages</div>
          </div>
        }

        <div class="card">
          @if (posts().length) {
            @for (post of posts(); track post.id) {
              <div class="post-row">
                @if (post.featured_image) {
                  <img class="post-thumb" [src]="post.featured_image.url"
                    [alt]="post.featured_image.alt" />
                } @else {
                  <div class="post-thumb-placeholder"></div>
                }

                <div class="post-info">
                  <div class="post-title">{{ post.title }}</div>
                  <div class="post-meta">
                    <span>{{ post.published_at | date:'MMM d, y' }}</span>
                    <span>{{ post.word_count | number }} words</span>
                    <span>/{{ post.slug }}</span>
                  </div>
                  @if (post.tags.length) {
                    <div class="tag-list" style="margin-top:4px">
                      @for (tag of post.tags.slice(0, 4); track tag) {
                        <span class="tag">{{ tag }}</span>
                      }
                    </div>
                  }
                </div>

                <button mat-icon-button (click)="remove(post)"
                  [disabled]="deleting() === post.id"
                  matTooltip="Delete post">
                  <mat-icon style="color:#ef4444;font-size:18px">delete_outline</mat-icon>
                </button>
              </div>
            }
          } @else {
            <div class="empty-state">
              <mat-icon style="font-size:48px;height:48px;width:48px;color:#333">public</mat-icon>
              <p>No published posts yet</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PublishedComponent implements OnInit {
  posts = signal<Post[]>([]);
  total = signal(0);
  pages = signal(0);
  loading = signal(false);
  deleting = signal<string | null>(null);

  constructor(private api: BlogApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPublished().subscribe({
      next: r => {
        this.posts.set(r.posts);
        this.total.set(r.total);
        this.pages.set(r.pages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  remove(post: Post): void {
    this.deleting.set(post.id);
    this.api.deletePost(post.id).subscribe({
      next: () => {
        this.posts.update(list => list.filter(p => p.id !== post.id));
        this.total.update(n => n - 1);
        this.deleting.set(null);
      },
      error: () => this.deleting.set(null),
    });
  }
}
