import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-published',
  standalone: true,
  imports: [DatePipe, FormsModule],
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

          <!-- Edit -->
          <button (click)="openEdit(post)"
                  class="text-xs text-[#555] hover:text-blue-400 cursor-pointer transition-colors shrink-0">
            Edit
          </button>

          <!-- Delete -->
          <button (click)="remove(post.id)"
                  [disabled]="deleting() === post.id"
                  class="text-xs text-[#555] hover:text-red-400 cursor-pointer transition-colors shrink-0">
            Delete
          </button>
        </div>
      }
    </div>

    @if (editPost()) {
      <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" (click)="closeEdit()">
        <div class="bg-[#111] border border-[#222] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
            <p class="text-sm font-medium text-white truncate pr-4">{{ editPost()!.title }}</p>
            <button (click)="closeEdit()" class="text-[#555] hover:text-white text-lg leading-none cursor-pointer">✕</button>
          </div>
          @if (loadingEdit()) {
            <p class="p-5 text-xs text-[#555]">Loading…</p>
          } @else {
            <textarea
              [(ngModel)]="editContent"
              class="flex-1 bg-transparent text-xs text-[#ccc] font-mono p-5 resize-none outline-none overflow-y-auto min-h-[400px] w-full">
            </textarea>
          }
          <div class="flex justify-end gap-3 px-5 py-4 border-t border-[#1a1a1a]">
            <button (click)="closeEdit()" class="text-xs text-[#555] hover:text-white cursor-pointer">Cancel</button>
            <button (click)="saveEdit()"
                    [disabled]="saving()"
                    class="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded cursor-pointer transition-colors">
              {{ saving() ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    }
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
  editPost = signal<Post | null>(null);
  editContent = '';
  saving = signal(false);
  loadingEdit = signal(false);

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

  openEdit(post: Post) {
    this.editPost.set(post);
    this.editContent = '';
    this.loadingEdit.set(true);
    this.api.getPost(post.id).subscribe({
      next: ({ post: full }) => { this.editContent = full.content ?? ''; this.loadingEdit.set(false); },
      error: () => { this.loadingEdit.set(false); this.toast.error('Failed to load post'); }
    });
  }

  closeEdit() {
    this.editPost.set(null);
    this.editContent = '';
  }

  saveEdit() {
    const post = this.editPost();
    if (!post) return;
    this.saving.set(true);
    this.api.updatePost(post.id, { content: this.editContent }).subscribe({
      next: ({ post: updated }) => {
        this.posts.update(ps => ps.map(p => p.id === updated.id ? updated : p));
        this.saving.set(false);
        this.closeEdit();
        this.toast.success('Post saved');
      },
      error: () => { this.saving.set(false); this.toast.error('Failed to save'); }
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

}
