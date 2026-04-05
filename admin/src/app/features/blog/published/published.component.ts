import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-published',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-white">Published</h2>
      @if (total() > 0) {
        <span class="text-xs text-[#666]">{{ total() }} posts &middot; {{ pages() }} pages</span>
      }
    </div>

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
          @if (post.article_format === 'dialogue') {
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 shrink-0">Dialogue</span>
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
}
