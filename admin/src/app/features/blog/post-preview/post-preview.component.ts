import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Post } from '../../../models/blog.model';

@Component({
  selector: 'app-post-preview',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  template: `
    @if (post(); as p) {
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <a routerLink=".." class="text-sm text-[#666] hover:text-white transition-colors">&larr; Back</a>
        <span class="text-[#333]">/</span>
        <h2 class="text-lg font-semibold text-white truncate">{{ p.title }}</h2>
      </div>

      <!-- Featured Image -->
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-4 mb-4">
        @if (p.featured_image?.url) {
          <img [src]="p.featured_image!.url" [alt]="p.featured_image!.alt"
               class="w-full max-h-[360px] object-cover rounded-md mb-3">
        } @else {
          <div class="w-full h-40 bg-[#1a1a1a] rounded-md flex items-center justify-center mb-3">
            <span class="text-sm text-[#555]">No featured image</span>
          </div>
        }
        <div class="flex gap-2">
          <button (click)="regenerateImage()"
                  [disabled]="regenerating()"
                  class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white disabled:opacity-50 cursor-pointer transition-colors">
            @if (regenerating()) { Generating... } @else { New Image }
          </button>
          <label class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors">
            Upload
            <input type="file" accept="image/*" (change)="onFileSelected($event)" class="hidden">
          </label>
        </div>
      </div>

      <!-- Meta -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <span class="text-xs text-[#666]">{{ p.word_count }} words</span>
        <span class="text-xs text-[#666]">{{ p.reading_time }} min read</span>
        <span class="text-xs text-[#666]">{{ p.created_at | date:'MMM d, y' }}</span>
        @if (p.generated) {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">AI Generated</span>
        }
        @if (p.article_format === 'dialogue') {
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">Dialogue</span>
        }
        <span class="text-[10px] px-1.5 py-0.5 rounded"
              [class]="p.status === 'draft' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-green-900/40 text-green-300'">
          {{ p.status }}
        </span>
        @for (tag of p.tags; track tag) {
          <span class="text-[10px] text-[#555]">#{{ tag }}</span>
        }
      </div>

      <!-- SEO Section -->
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] mb-4">
        <button (click)="seoOpen.set(!seoOpen())"
                class="w-full px-4 py-3 flex items-center justify-between text-sm text-[#999] hover:text-white cursor-pointer transition-colors">
          <span>SEO Settings</span>
          <span class="text-xs">{{ seoOpen() ? '▲' : '▼' }}</span>
        </button>

        @if (seoOpen()) {
          <div class="px-4 pb-4 border-t border-[#1a1a1a]">
            <div class="mt-3 mb-3">
              <label class="block text-xs text-[#999] mb-1">SEO Title <span class="text-[#555]">({{ seoTitle().length }}/60)</span></label>
              <input [(ngModel)]="seoTitle" [maxlength]="60"
                     class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-md text-sm text-white focus:outline-none focus:border-purple-500 transition-colors">
            </div>
            <div class="mb-3">
              <label class="block text-xs text-[#999] mb-1">Meta Description <span class="text-[#555]">({{ seoDesc().length }}/155)</span></label>
              <textarea [(ngModel)]="seoDesc" [maxlength]="155" rows="2"
                        class="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-md text-sm text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"></textarea>
            </div>

            @if (p.categories.length) {
              <div class="mb-3">
                <label class="block text-xs text-[#999] mb-1">Categories</label>
                <div class="flex flex-wrap gap-1">
                  @for (cat of p.categories; track cat) {
                    <span class="text-[10px] px-2 py-0.5 rounded bg-[#1a1a1a] text-[#999]">{{ cat }}</span>
                  }
                </div>
              </div>
            }

            <!-- SERP Preview -->
            <div class="mt-4 p-3 rounded-md bg-white">
              <p class="text-sm text-[#1a0dab] truncate">{{ seoTitle() || p.title }}</p>
              <p class="text-xs text-[#006621] truncate">machinum.io/blog/{{ p.slug }}</p>
              <p class="text-xs text-[#545454] line-clamp-2">{{ seoDesc() || p.excerpt }}</p>
            </div>

            <button (click)="saveSeo()"
                    [disabled]="savingSeo()"
                    class="mt-3 px-4 py-2 text-xs rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer transition-colors">
              @if (savingSeo()) { Saving... } @else { Save SEO }
            </button>
          </div>
        }
      </div>

      <!-- Content -->
      @if (p.article_format === 'dialogue' && p.dialogue_blocks?.length) {
        <div class="mb-4 space-y-3">
          @for (block of p.dialogue_blocks; track block.order) {
            <div class="rounded-lg border border-[#1a1a1a] overflow-hidden"
                 [class]="block.persona === 'kwagga' ? 'border-l-4 border-l-blue-600' : 'border-l-4 border-l-orange-500'">
              <div class="flex items-center gap-3 px-4 py-3 bg-[#111] border-b border-[#1a1a1a]">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                     [class]="block.persona === 'kwagga' ? 'bg-blue-900/50 text-blue-300' : 'bg-orange-900/50 text-orange-300'">
                  {{ block.persona === 'kwagga' ? 'DV' : 'MW' }}
                </div>
                <div>
                  <p class="text-xs font-semibold text-white">{{ block.persona === 'kwagga' ? 'Kwagga van der Berg' : 'Marcus Webb' }}</p>
                  <p class="text-[10px]" [class]="block.persona === 'kwagga' ? 'text-blue-400' : 'text-orange-400'">
                    {{ block.persona === 'kwagga' ? 'SA rugby correspondent' : 'Rugby tactics & markets' }}
                  </p>
                </div>
              </div>
              <div class="bg-[#111] px-4 py-4 prose-dark text-sm" [innerHTML]="renderBlock(block.content)"></div>
            </div>
          }
        </div>
      } @else {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-6 mb-4 prose-dark"
             [innerHTML]="renderedContent()">
        </div>
      }

      <!-- Actions -->
      <div class="flex gap-3">
        @if (p.status === 'draft') {
          <button (click)="approve()"
                  class="px-4 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-colors">
            Schedule
          </button>
          <button (click)="publishNow()"
                  class="px-4 py-2 text-sm rounded-md bg-green-700 hover:bg-green-600 text-white cursor-pointer transition-colors">
            Publish Now
          </button>
        }
        <button (click)="remove()"
                class="px-4 py-2 text-sm rounded-md text-red-400 hover:bg-red-900/30 cursor-pointer transition-colors">
          Delete
        </button>
      </div>
    } @else if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }
  `,
  styles: [`
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    :host ::ng-deep .prose-dark { color: #e5e5e5; line-height: 1.7; font-size: 14px; }
    :host ::ng-deep .prose-dark h1 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; color: white; }
    :host ::ng-deep .prose-dark h2 { font-size: 1.3em; font-weight: 600; margin: 1em 0 0.5em; color: white; }
    :host ::ng-deep .prose-dark h3 { font-size: 1.1em; font-weight: 600; margin: 1em 0 0.5em; color: white; }
    :host ::ng-deep .prose-dark p { margin: 0.75em 0; }
    :host ::ng-deep .prose-dark strong { color: white; }
    :host ::ng-deep .prose-dark code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    :host ::ng-deep .prose-dark ul, :host ::ng-deep .prose-dark ol { padding-left: 1.5em; margin: 0.5em 0; }
    :host ::ng-deep .prose-dark li { margin: 0.25em 0; }
  `]
})
export class PostPreviewComponent implements OnInit {
  private api = inject(BlogApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  post = signal<Post | null>(null);
  loading = signal(false);
  seoOpen = signal(false);
  seoTitle = signal('');
  seoDesc = signal('');
  savingSeo = signal(false);
  regenerating = signal(false);
  renderedContent = signal('');

  ngOnInit() {
    const postId = this.route.snapshot.paramMap.get('postId')!;
    this.loading.set(true);
    this.api.getPost(postId).subscribe({
      next: res => {
        this.post.set(res.post);
        this.seoTitle.set(res.post.seo_title || '');
        this.seoDesc.set(res.post.seo_description || '');
        this.renderedContent.set(this.markdownToHtml(res.post.content || ''));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load post'); }
    });
  }

  saveSeo() {
    this.savingSeo.set(true);
    this.api.updatePost(this.post()!.id, {
      seo_title: this.seoTitle(),
      seo_description: this.seoDesc()
    }).subscribe({
      next: res => {
        this.post.set(res.post);
        this.savingSeo.set(false);
        this.toast.success('SEO updated');
      },
      error: () => { this.savingSeo.set(false); this.toast.error('Failed to save SEO'); }
    });
  }

  approve() {
    this.api.updatePost(this.post()!.id, { status: 'scheduled' }).subscribe({
      next: () => { this.toast.success('Post scheduled'); this.router.navigate(['..'], { relativeTo: this.route }); },
      error: () => this.toast.error('Failed to schedule')
    });
  }

  publishNow() {
    this.api.publishPost(this.post()!.id).subscribe({
      next: () => { this.toast.success('Post published'); this.router.navigate(['..'], { relativeTo: this.route }); },
      error: () => this.toast.error('Failed to publish')
    });
  }

  remove() {
    this.api.deletePost(this.post()!.id).subscribe({
      next: () => { this.toast.success('Post deleted'); this.router.navigate(['..'], { relativeTo: this.route }); },
      error: () => this.toast.error('Failed to delete')
    });
  }

  regenerateImage() {
    this.regenerating.set(true);
    this.api.regenerateImage(this.post()!.id).subscribe({
      next: res => { this.post.set(res.post); this.regenerating.set(false); this.toast.success('Image regenerated'); },
      error: () => { this.regenerating.set(false); this.toast.error('Failed to regenerate image'); }
    });
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.api.uploadImage(this.post()!.id, base64).subscribe({
        next: res => { this.post.set(res.post); this.toast.success('Image uploaded'); },
        error: () => this.toast.error('Failed to upload image')
      });
    };
    reader.readAsDataURL(file);
  }

  private markdownToHtml(md: string): string {
    return md
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])/gm, '<p>')
      .replace(/(?<![>])$/gm, '</p>')
      .replace(/<p><\/p>/g, '');
  }

  renderBlock(content: string): string {
    return this.markdownToHtml(content);
  }
}
