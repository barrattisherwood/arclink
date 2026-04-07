import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-drafts',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Drafts</h2>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && posts().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No drafts yet — generate posts from the Queue</p>
    }

    <div class="grid gap-3">
      @for (post of posts(); track post.id) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-4 flex gap-4 items-start hover:border-[#222] transition-colors">
          <!-- Thumbnail -->
          <div class="w-20 h-[60px] rounded overflow-hidden bg-[#1a1a1a] shrink-0">
            @if (post.featured_image?.url) {
              <img [src]="post.featured_image!.url" [alt]="post.featured_image!.alt" class="w-full h-full object-cover">
            }
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <a [routerLink]="post.id" class="text-sm font-medium text-white hover:text-purple-300 transition-colors line-clamp-1">
              {{ post.title }}
            </a>
            <p class="text-xs text-[#666] mt-1 line-clamp-2">{{ post.excerpt }}</p>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-[10px] text-[#555]">{{ post.word_count }} words</span>
              <span class="text-[10px] text-[#555]">{{ post.created_at | date:'MMM d, y' }}</span>
              @if (post.generated) {
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">AI</span>
              }
              @if (post.article_format === 'dialogue') {
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">Dialogue</span>
              }
              @if (post.article_format === 'weekly-roundup') {
                <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">Roundup</span>
              }
              @for (tag of post.tags.slice(0, 3); track tag) {
                <span class="text-[10px] text-[#555]">#{{ tag }}</span>
              }
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 shrink-0">
            <button (click)="approve(post.id)"
                    [disabled]="approving() === post.id"
                    class="px-3 py-1.5 text-xs rounded-md bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 cursor-pointer transition-colors">
              @if (approving() === post.id) { Scheduling... } @else { Schedule }
            </button>
            <button (click)="remove(post.id)"
                    [disabled]="deleting() === post.id"
                    class="px-3 py-1.5 text-xs rounded-md text-red-400 hover:bg-red-900/30 cursor-pointer transition-colors">
              Delete
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  `]
})
export class DraftsComponent implements OnInit {
  private api = inject(BlogApiService);
  private toast = inject(ToastService);

  posts = signal<Post[]>([]);
  loading = signal(false);
  approving = signal('');
  deleting = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getDrafts().subscribe({
      next: res => { this.posts.set(res.posts); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load drafts'); }
    });
  }

  approve(id: string) {
    this.approving.set(id);
    this.api.updatePost(id, { status: 'scheduled' }).subscribe({
      next: () => {
        this.posts.update(p => p.filter(x => x.id !== id));
        this.approving.set('');
        this.toast.success('Post scheduled');
      },
      error: () => { this.approving.set(''); this.toast.error('Failed to schedule'); }
    });
  }

  remove(id: string) {
    this.deleting.set(id);
    this.api.deletePost(id).subscribe({
      next: () => {
        this.posts.update(p => p.filter(x => x.id !== id));
        this.deleting.set('');
        this.toast.success('Post deleted');
      },
      error: () => { this.deleting.set(''); this.toast.error('Failed to delete'); }
    });
  }
}
