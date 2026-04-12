import { Component, input, output, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, CalendarContentType } from '../../../models/blog.model';
import { BlogApiService } from '../../../core/services/blog-api.service';

export interface ScheduleFormValue {
  title: string;
  content_type: CalendarContentType;
  persona_tag: string;
  generate_at: string;
  publish_at: string;
  notes: string;
  fixture_label: string;
  competition: string;
}

/** Converts a Date to the value needed by datetime-local inputs (local time) */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-schedule-content-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
         (click)="onBackdrop($event)">
      <div class="bg-[#111] border border-[#222] rounded-xl w-full max-w-lg shadow-2xl"
           (click)="$event.stopPropagation()">

        <div class="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <h3 class="text-base font-semibold text-white">
            {{ editEvent() ? 'Edit Scheduled Content' : 'Schedule Content' }}
          </h3>
          <button (click)="cancel.emit()" class="text-[#555] hover:text-white transition-colors cursor-pointer">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form #f="ngForm" (ngSubmit)="submit()" class="px-6 py-5 space-y-4">

          <!-- Title -->
          <div>
            <label class="block text-xs text-[#666] mb-1">Title <span class="text-red-500">*</span></label>
            <input name="title" [(ngModel)]="form.title" required
                   placeholder="e.g. SA vs England ODI Preview"
                   class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors">
          </div>

          <!-- Type + Persona row -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-[#666] mb-1">Content Type</label>
              <select name="content_type" [(ngModel)]="form.content_type"
                      class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
                <option value="article">Article</option>
                <option value="weekly-roundup">Weekly Roundup</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-[#666] mb-1">Persona</label>
              <select name="persona_tag" [(ngModel)]="form.persona_tag"
                      class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
                <option value="">Auto</option>
                @for (p of personaOptions; track p.value) {
                  <option [value]="p.value">{{ p.label }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Competition + Fixture Label -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-[#666] mb-1">Competition</label>
              <input name="competition" [(ngModel)]="form.competition"
                     placeholder="e.g. CSA T20 Challenge"
                     class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors">
            </div>
            <div>
              <label class="block text-xs text-[#666] mb-1">Match / Fixture Label</label>
              <input name="fixture_label" [(ngModel)]="form.fixture_label"
                     placeholder="e.g. SA vs England, Match 1"
                     class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors">
            </div>
          </div>

          <!-- Generate At -->
          <div>
            <label class="block text-xs text-[#666] mb-1">Generate At <span class="text-red-500">*</span></label>
            <input name="generate_at" [(ngModel)]="form.generate_at" type="datetime-local" required
                   class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
            <p class="text-[10px] text-[#444] mt-0.5">When the AI should generate the article</p>
          </div>

          <!-- Publish At -->
          <div>
            <label class="block text-xs text-[#666] mb-1">Publish At <span class="text-[#444]">(optional)</span></label>
            <input name="publish_at" [(ngModel)]="form.publish_at" type="datetime-local"
                   class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444] transition-colors">
            <p class="text-[10px] text-[#444] mt-0.5">Leave blank to save as draft after generation</p>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-xs text-[#666] mb-1">Notes <span class="text-[#444]">(optional)</span></label>
            <textarea name="notes" [(ngModel)]="form.notes" rows="2"
                      placeholder="Any context or hints for the AI…"
                      class="w-full bg-[#0a0a0a] border border-[#222] rounded-md px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#444] transition-colors resize-none"></textarea>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 justify-end pt-1">
            <button type="button" (click)="cancel.emit()"
                    class="px-4 py-2 text-sm rounded-md text-[#888] hover:text-white transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" [disabled]="!f.valid || saving()"
                    class="px-4 py-2 text-sm rounded-md bg-white text-black font-medium hover:bg-[#ddd] disabled:opacity-50 cursor-pointer transition-colors">
              {{ saving() ? 'Saving…' : (editEvent() ? 'Save Changes' : 'Schedule') }}
            </button>
          </div>

        </form>
      </div>
    </div>
  `,
})
export class ScheduleContentModalComponent implements OnInit {
  private blog = inject(BlogApiService);

  editEvent = input<CalendarEvent | null>(null);
  saving    = input(false);

  cancel = output<void>();
  save   = output<ScheduleFormValue>();

  get personaOptions() { return this.blog.personaOptions; }

  form: ScheduleFormValue = {
    title: '',
    content_type: 'article',
    persona_tag: '',
    generate_at: '',
    publish_at: '',
    notes: '',
    fixture_label: '',
    competition: '',
  };

  ngOnInit() {
    const ev = this.editEvent();
    if (ev) {
      this.form = {
        title:        ev.title,
        content_type: ev.content_type,
        persona_tag:  ev.persona_tag ?? '',
        generate_at:  toDatetimeLocal(new Date(ev.generate_at)),
        publish_at:   ev.publish_at ? toDatetimeLocal(new Date(ev.publish_at)) : '',
        notes:        ev.notes ?? '',
        fixture_label: ev.fixture_label ?? '',
        competition:  ev.competition ?? '',
      };
    } else {
      // Default generate_at: next hour
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      this.form.generate_at = toDatetimeLocal(d);
    }
  }

  onBackdrop(e: MouseEvent) {
    if ((e.target as HTMLElement) === e.currentTarget) this.cancel.emit();
  }

  submit() {
    this.save.emit({ ...this.form });
  }
}
