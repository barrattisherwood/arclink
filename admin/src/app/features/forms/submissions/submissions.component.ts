import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, KeyValuePipe } from '@angular/common';
import { FormsApiService, FormSubmission } from '../../../core/services/forms-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [DatePipe, KeyValuePipe],
  template: `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-white">Form Submissions</h2>
      @if (total() > 0) {
        <span class="text-xs text-[#666]">{{ total() }} submissions</span>
      }
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && submissions().length === 0) {
      <p class="text-sm text-[#555] text-center py-12">No submissions yet</p>
    }

    <div class="grid gap-2">
      @for (sub of submissions(); track sub._id) {
        <div class="bg-[#111] rounded-lg border border-[#1a1a1a] hover:border-[#222] transition-colors">
          <!-- Header row -->
          <div class="px-4 py-3 flex items-center gap-4 cursor-pointer" (click)="toggle(sub._id)">
            <span class="text-xs text-[#555] shrink-0">{{ sub.submitted_at | date:'MMM d, y HH:mm' }}</span>

            <!-- Show first field value as preview -->
            <span class="text-sm text-white flex-1 min-w-0 truncate">
              {{ previewText(sub) }}
            </span>

            <span class="text-[10px] text-[#555]">{{ Object.keys(sub.fields).length }} fields</span>

            <button (click)="remove(sub._id); $event.stopPropagation()"
                    [disabled]="deleting() === sub._id"
                    class="text-xs text-[#555] hover:text-red-400 cursor-pointer transition-colors shrink-0">
              Delete
            </button>

            <span class="text-xs text-[#555]">{{ expanded().has(sub._id) ? '▲' : '▼' }}</span>
          </div>

          <!-- Expanded fields -->
          @if (expanded().has(sub._id)) {
            <div class="px-4 pb-4 border-t border-[#1a1a1a]">
              <div class="mt-3 grid gap-2">
                @for (entry of sub.fields | keyvalue; track entry.key) {
                  <div class="flex gap-3">
                    <span class="text-xs text-[#666] w-28 shrink-0 text-right">{{ entry.key }}</span>
                    <span class="text-xs text-white break-all">{{ entry.value }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Pagination -->
    @if (total() > limit) {
      <div class="flex items-center justify-center gap-4 mt-4">
        <button (click)="prevPage()" [disabled]="offset() === 0"
                class="text-xs text-[#999] hover:text-white disabled:opacity-30 cursor-pointer transition-colors">
          &larr; Prev
        </button>
        <span class="text-xs text-[#555]">{{ offset() + 1 }}-{{ Math.min(offset() + limit, total()) }} of {{ total() }}</span>
        <button (click)="nextPage()" [disabled]="offset() + limit >= total()"
                class="text-xs text-[#999] hover:text-white disabled:opacity-30 cursor-pointer transition-colors">
          Next &rarr;
        </button>
      </div>
    }
  `
})
export class SubmissionsComponent implements OnInit {
  private formsApi = inject(FormsApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  Object = Object;
  Math = Math;
  limit = 25;

  submissions = signal<FormSubmission[]>([]);
  total = signal(0);
  offset = signal(0);
  loading = signal(false);
  deleting = signal('');
  expanded = signal<Set<string>>(new Set());

  private get tenantId(): string {
    const user = this.auth.user();
    return user?.siteId === '*' ? '_' : user?.siteId || '_';
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.formsApi.getSubmissions(this.tenantId, { limit: this.limit, offset: this.offset() }).subscribe({
      next: res => {
        this.submissions.set(res.submissions);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load submissions'); }
    });
  }

  toggle(id: string) {
    this.expanded.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  previewText(sub: FormSubmission): string {
    const values = Object.values(sub.fields);
    const first = values.find(v => typeof v === 'string' && v.length > 0);
    return (first as string) || '(empty)';
  }

  remove(id: string) {
    this.deleting.set(id);
    this.formsApi.deleteSubmission(this.tenantId, id).subscribe({
      next: () => {
        this.submissions.update(list => list.filter(s => s._id !== id));
        this.total.update(t => t - 1);
        this.deleting.set('');
        this.toast.success('Submission deleted');
      },
      error: () => { this.deleting.set(''); this.toast.error('Failed to delete'); }
    });
  }

  prevPage() { this.offset.update(o => Math.max(0, o - this.limit)); this.load(); }
  nextPage() { this.offset.update(o => o + this.limit); this.load(); }
}
