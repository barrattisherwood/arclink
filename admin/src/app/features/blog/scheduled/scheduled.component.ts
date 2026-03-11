import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-scheduled',
  standalone: true,
  imports: [DatePipe, DragDropModule],
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Scheduled</h2>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && posts().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No scheduled posts</p>
    }

    <div cdkDropList (cdkDropListDropped)="drop($event)" class="grid gap-2">
      @for (post of posts(); track post.id) {
        <div cdkDrag
             class="bg-[#111] rounded-lg border border-[#1a1a1a] p-4 flex gap-4 items-center hover:border-[#222] transition-colors cursor-grab active:cursor-grabbing">
          <!-- Drag handle -->
          <div cdkDragHandle class="text-[#555] hover:text-[#999] cursor-grab">
            <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
              <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
              <circle cx="3" cy="10" r="1.5"/><circle cx="9" cy="10" r="1.5"/>
              <circle cx="3" cy="17" r="1.5"/><circle cx="9" cy="17" r="1.5"/>
            </svg>
          </div>

          <!-- Thumbnail -->
          <div class="w-16 h-12 rounded overflow-hidden bg-[#1a1a1a] shrink-0">
            @if (post.featured_image?.url) {
              <img [src]="post.featured_image!.url" [alt]="post.featured_image!.alt" class="w-full h-full object-cover">
            }
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-white truncate">{{ post.title }}</p>
            <p class="text-xs text-[#666] mt-0.5 truncate">{{ post.excerpt }}</p>
          </div>

          <!-- Scheduled date -->
          @if (post.scheduled_for) {
            <span class="text-xs text-green-400 shrink-0">{{ post.scheduled_for | date:'EEE, MMM d, y' }}</span>
          }

          <!-- Actions -->
          <div class="flex gap-2 shrink-0">
            <button (click)="publish(post.id); $event.stopPropagation()"
                    [disabled]="publishing() === post.id"
                    class="px-3 py-1.5 text-xs rounded-md bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 cursor-pointer transition-colors">
              @if (publishing() === post.id) { Publishing... } @else { Publish Now }
            </button>
            <button (click)="remove(post.id); $event.stopPropagation()"
                    [disabled]="deleting() === post.id"
                    class="px-3 py-1.5 text-xs rounded-md text-red-400 hover:bg-red-900/30 cursor-pointer transition-colors">
              Delete
            </button>
          </div>

          <!-- Drag placeholder -->
          <div *cdkDragPlaceholder class="bg-purple-900/10 border border-dashed border-purple-800/30 rounded-lg h-16"></div>
        </div>
      }
    </div>
  `
})
export class ScheduledComponent implements OnInit {
  private api = inject(BlogApiService);
  private toast = inject(ToastService);

  posts = signal<Post[]>([]);
  loading = signal(false);
  publishing = signal('');
  deleting = signal('');

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getScheduled().subscribe({
      next: res => { this.posts.set(res.posts); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Failed to load scheduled posts'); }
    });
  }

  drop(event: CdkDragDrop<Post[]>) {
    const items = [...this.posts()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.posts.set(items);
    const ids = items.map(p => p.id);
    this.api.reorderScheduled(ids).subscribe({
      error: () => this.toast.error('Failed to save order')
    });
  }

  publish(id: string) {
    this.publishing.set(id);
    this.api.publishPost(id).subscribe({
      next: () => {
        this.posts.update(p => p.filter(x => x.id !== id));
        this.publishing.set('');
        this.toast.success('Post published');
      },
      error: () => { this.publishing.set(''); this.toast.error('Failed to publish'); }
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
