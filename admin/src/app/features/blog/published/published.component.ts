import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-published',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-white">Published</h2>
      <div class="flex items-center gap-3">
        @if (total() > 0) {
          <span class="text-xs text-[#666]">{{ total() }} posts &middot; {{ pages() }} pages</span>
        }
        <button (click)="generateRoundupNow()"
                [disabled]="generating()"
                class="text-xs px-2.5 py-1 rounded bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          @if (generating()) {
            <span class="inline-block w-3 h-3 border border-[#555] border-t-white rounded-full animate-spin mr-1"></span>Generating...
          } @else {
            ⚡ Generate weekly roundup
          }
        </button>
      </div>
    </div>

    @if (generateResult()) {
      <div class="mb-3 px-3 py-2 rounded bg-green-900/30 border border-green-800/40 text-xs text-green-300">
        Draft created: "{{ generateResult()!.title }}" —
        <a routerLink="/blog/drafts" class="underline">View in drafts →</a>
      </div>
    }
    @if (generateError()) {
      <div class="mb-3 px-3 py-2 rounded bg-red-900/30 border border-red-800/40 text-xs text-red-300">{{ generateError() }}</div>
    }

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && posts().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No published posts yet</p>
    }

    <div class="grid gap-1">
      @for (post of posts(); track post.id) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] px-4 py-3 flex gap-4 items-center hover:border-[#222] transition-colors">
          <!-- Thumbnail -->
          <div class="w-14 h-[42px] rounded overflow-hidden bg-[#1a1a1a] shrink-0">
            @if (post.featured_image?.url) {
              <img [src]="post.featured_image!.url" [alt]="post.featured_image!.alt" class="w-full h-full object-cover">
            }
          </div>

          <!-- Title -->
          <p class="text-sm text-white flex-1 min-w-0 truncate">{{ post.title }}</p>

          <!-- Meta -->
          <span class="text-[10px] text-[#555] shrink-0">{{ post.published_at | date:'MMM d, y' }}</span>
          <span class="text-[10px] text-[#555] shrink-0">{{ post.word_count }}w</span>
          <span class="text-[10px] text-[#555] shrink-0 max-w-[120px] truncate">/{{ post.slug }}</span>
          @if (post.article_format === 'dialogue' || post.article_format === 'weekly-roundup') {
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 shrink-0">
              {{ post.article_format === 'weekly-roundup' ? 'Roundup' : 'Dialogue' }}
            </span>
          }
          @if (post.article_format === 'weekly-roundup') {
            <button (click)="setFeatured(post.id)"
                    class="text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors shrink-0"
                    [class]="post.featured ? 'bg-yellow-900/40 text-yellow-300' : 'bg-[#1a1a1a] text-[#555] hover:text-yellow-300'">
              {{ post.featured ? '★ Homepage' : '☆ Homepage' }}
            </button>
          }

          @for (tag of post.tags.slice(0, 4); track tag) {
            <span class="text-[10px] text-[#555] shrink-0">#{{ tag }}</span>
          }

          <!-- Delete -->
          <button (click)="remove(post.id)"
                  [disabled]="deleting() === post.id"
                  class="text-xs text-[#555] hover:text-red-400 cursor-pointer transition-colors shrink-0">
            Delete
          </button>
        </div>
      }
    </div>
  `
})
export class PublishedComponent implements OnInit {
  private api = inject(BlogApiService);
  private toast = inject(ToastService);

  posts = signal<Post[]>([]);
  total = signal(0);
  pages = signal(0);
  loading = signal(false);
  deleting = signal('');
  generating = signal(false);
  generateResult = signal<Post | null>(null);
  generateError = signal<string | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getPublished().subscribe({
      next: res => {
        this.posts.set(res.posts);
        this.total.set(res.total);
        this.pages.set(res.pages);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load published posts'); }
    });
  }

  remove(id: string) {
    this.deleting.set(id);
    this.api.deletePost(id).subscribe({
      next: () => {
        this.posts.update(p => p.filter(x => x.id !== id));
        this.total.update(t => t - 1);
        this.deleting.set('');
        this.toast.success('Post deleted');
      },
      error: () => { this.deleting.set(''); this.toast.error('Failed to delete'); }
    });
  }

  setFeatured(id: string) {
    this.api.featurePost(id).subscribe({
      next: () => {
        this.posts.update(posts => posts.map(p => ({ ...p, featured: p.id === id })));
        this.toast.success('Homepage roundup updated');
      },
      error: () => this.toast.error('Failed to set featured post')
    });
  }

  generateRoundupNow() {
    this.generating.set(true);
    this.generateResult.set(null);
    this.generateError.set(null);

    this.api.generateRoundupNow().subscribe({
      next: (res) => {
        this.generating.set(false);
        this.generateResult.set(res.post);
        this.load();
      },
      error: (err) => {
        this.generating.set(false);
        this.generateError.set(err.error?.error ?? 'Generation failed — check Railway logs');
      }
    });
  }
}
