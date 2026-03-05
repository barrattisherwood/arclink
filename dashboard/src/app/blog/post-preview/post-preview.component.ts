import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BlogApiService, Post } from '../../core/blog-api.service';

@Component({
  selector: 'app-post-preview',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  styles: [`
    .preview-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .preview-header h1 {
      flex: 1;
      margin: 0;
      font-size: 1.5rem;
    }

    .image-container {
      position: relative;
      margin-bottom: 24px;
    }

    .featured-image {
      width: 100%;
      max-height: 360px;
      object-fit: cover;
      border-radius: 8px;
    }

    .image-actions {
      position: absolute;
      bottom: 12px;
      right: 12px;
    }

    .no-image {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      height: 160px;
      border: 1px dashed #333;
      border-radius: 8px;
      margin-bottom: 24px;
      color: #666;
    }

    .post-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.78rem;
      color: #666;
      margin-bottom: 24px;
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
    .badge-draft { background: #2e2a1a; color: #f5c542; }

    .post-content {
      line-height: 1.8;
      font-size: 0.95rem;
      color: #ccc;
    }

    .post-content :is(h1, h2, h3) {
      color: #eee;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    .post-content p { margin-bottom: 1em; }

    .post-actions {
      display: flex;
      gap: 12px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #1a1a1a;
    }

    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
  `],
  template: `
    <div class="page">
      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
      } @else if (post()) {
        <div class="preview-header">
          <button mat-icon-button routerLink="/blog/drafts" matTooltip="Back to drafts">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h1>{{ post()!.title }}</h1>
        </div>

        @if (post()!.featured_image) {
          <div class="image-container">
            <img class="featured-image" [src]="post()!.featured_image!.url"
              [alt]="post()!.featured_image!.alt" />
            <div class="image-actions">
              <button mat-flat-button [disabled]="regenerating()"
                (click)="regenerateImage()" style="background:#1a1a1a">
                <mat-icon>autorenew</mat-icon>
                {{ regenerating() ? 'Generating...' : 'New Image' }}
              </button>
              <button mat-flat-button [disabled]="uploading()"
                (click)="fileInput.click()" style="background:#1a1a1a;margin-left:8px">
                <mat-icon>upload</mat-icon>
                {{ uploading() ? 'Uploading...' : 'Upload' }}
              </button>
              <input #fileInput type="file" accept="image/*" hidden
                (change)="onFileSelected($event)" />
            </div>
          </div>
        } @else {
          <div class="no-image">
            <button mat-stroked-button [disabled]="regenerating()"
              (click)="regenerateImage()">
              <mat-icon>add_photo_alternate</mat-icon>
              {{ regenerating() ? 'Generating...' : 'Generate Image' }}
            </button>
            <button mat-stroked-button [disabled]="uploading()"
              (click)="noImageFileInput.click()">
              <mat-icon>upload</mat-icon>
              {{ uploading() ? 'Uploading...' : 'Upload Image' }}
            </button>
            <input #noImageFileInput type="file" accept="image/*" hidden
              (change)="onFileSelected($event)" />
          </div>
        }

        <div class="post-meta">
          <span>{{ post()!.word_count | number }} words</span>
          <span>{{ post()!.created_at | date:'MMM d, y' }}</span>
          @if (post()!.generated) {
            <span class="badge badge-generated">AI Generated</span>
          }
          @if (post()!.status === 'draft') {
            <span class="badge badge-draft">Draft</span>
          }
          @if (post()!.status === 'scheduled') {
            <span class="badge badge-scheduled">Scheduled {{ post()!.scheduled_for | date:'MMM d' }}</span>
          }
          @for (tag of post()!.tags; track tag) {
            <mat-chip-option disabled>{{ tag }}</mat-chip-option>
          }
        </div>

        <div class="post-content" [innerHTML]="renderedContent()"></div>

        <div class="post-actions">
          @if (post()!.status === 'draft') {
            <button mat-flat-button color="primary" [disabled]="approving()"
              (click)="approve()">
              <mat-icon>schedule_send</mat-icon>
              {{ approving() ? 'Scheduling...' : 'Approve & Schedule' }}
            </button>
          }
          <button mat-stroked-button [disabled]="deleting()" (click)="remove()"
            style="color:#ef4444">
            <mat-icon>delete_outline</mat-icon>
            {{ deleting() ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon style="font-size:48px;height:48px;width:48px;color:#333">error_outline</mat-icon>
          <p>Post not found</p>
          <button mat-stroked-button routerLink="/blog/drafts">Back to Drafts</button>
        </div>
      }
    </div>
  `,
})
export class PostPreviewComponent implements OnInit {
  post = signal<Post | null>(null);
  loading = signal(false);
  approving = signal(false);
  deleting = signal(false);
  regenerating = signal(false);
  uploading = signal(false);
  renderedContent = signal('');

  private postId = '';

  constructor(
    private api: BlogApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.postId = this.route.snapshot.paramMap.get('postId') ?? '';
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPost(this.postId).subscribe({
      next: r => {
        this.post.set(r.post);
        this.renderedContent.set(this.markdownToHtml(r.post.content ?? ''));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  approve(): void {
    this.approving.set(true);
    this.api.approvePost(this.postId).subscribe({
      next: updated => {
        this.post.set(updated.post);
        this.approving.set(false);
        this.router.navigate(['/blog/drafts']);
      },
      error: () => this.approving.set(false),
    });
  }

  remove(): void {
    this.deleting.set(true);
    this.api.deletePost(this.postId).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/blog/drafts']);
      },
      error: () => this.deleting.set(false),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.api.uploadImage(this.postId, dataUrl).subscribe({
        next: r => {
          this.post.set(r.post);
          this.uploading.set(false);
        },
        error: () => this.uploading.set(false),
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  regenerateImage(): void {
    this.regenerating.set(true);
    this.api.regenerateImage(this.postId).subscribe({
      next: r => {
        this.post.set(r.post);
        this.regenerating.set(false);
      },
      error: () => this.regenerating.set(false),
    });
  }

  private markdownToHtml(md: string): string {
    return md
      .replace(/### (.+)/g, '<h3>$1</h3>')
      .replace(/## (.+)/g, '<h2>$1</h2>')
      .replace(/# (.+)/g, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
}
