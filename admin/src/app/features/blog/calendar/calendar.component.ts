import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CalendarApiService, ScheduleEventPayload, UpdateEventPayload } from '../../../core/services/calendar-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CalendarEvent } from '../../../models/blog.model';
import { CalendarEventCardComponent } from './calendar-event-card.component';
import { ScheduleContentModalComponent, ScheduleFormValue } from './schedule-content-modal.component';

interface DayGroup {
  label: string;
  date: string;
  events: CalendarEvent[];
}

function groupByDay(events: CalendarEvent[]): DayGroup[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.generate_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  const result: DayGroup[] = [];
  for (const [key, evs] of map) {
    const d = new Date(evs[0].generate_at);
    result.push({
      date: key,
      label: d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      events: evs,
    });
  }
  return result;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CalendarEventCardComponent, ScheduleContentModalComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-white">Editorial Calendar</h2>
      <button (click)="openModal()"
              class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-white text-black font-medium hover:bg-[#ddd] cursor-pointer transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Schedule Content
      </button>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading…</p>
    }

    @if (!loading() && dayGroups().length === 0) {
      <div class="text-center py-16">
        <p class="text-[#555] text-sm mb-2">No scheduled content yet</p>
        <p class="text-[#333] text-xs">Click "Schedule Content" to plan your first article</p>
      </div>
    }

    @for (group of dayGroups(); track group.date) {
      <div class="mb-6">
        <div class="flex items-center gap-3 mb-2">
          <span class="text-xs font-semibold text-[#555] uppercase tracking-wider">{{ group.label }}</span>
          <div class="flex-1 h-px bg-[#1a1a1a]"></div>
        </div>
        <div class="grid gap-2">
          @for (event of group.events; track event.id) {
            <app-calendar-event-card
              [event]="event"
              (edit)="openModal($event)"
              (delete)="deleteEvent($event)"
              (viewPost)="navigateToPost($event)"
            />
          }
        </div>
      </div>
    }

    @if (showModal()) {
      <app-schedule-content-modal
        [editEvent]="editingEvent()"
        [saving]="saving()"
        (cancel)="closeModal()"
        (save)="onSave($event)"
      />
    }
  `,
})
export class CalendarComponent implements OnInit {
  private api     = inject(CalendarApiService);
  private toast   = inject(ToastService);
  private router  = inject(Router);
  private route   = inject(ActivatedRoute);

  events     = signal<CalendarEvent[]>([]);
  dayGroups  = signal<DayGroup[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  showModal  = signal(false);
  editingEvent = signal<CalendarEvent | null>(null);

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getEvents().subscribe({
      next: res => {
        this.events.set(res.items);
        this.dayGroups.set(groupByDay(res.items));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load calendar'); },
    });
  }

  openModal(event?: CalendarEvent) {
    this.editingEvent.set(event ?? null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingEvent.set(null);
  }

  onSave(form: ScheduleFormValue) {
    const editing = this.editingEvent();

    // Convert local datetime-local string to UTC ISO string
    const toIso = (s: string) => s ? new Date(s).toISOString() : null;

    this.saving.set(true);

    if (editing) {
      const payload: UpdateEventPayload = {
        title:         form.title,
        content_type:  form.content_type,
        persona_tag:   form.persona_tag || null,
        generate_at:   toIso(form.generate_at)!,
        publish_at:    toIso(form.publish_at),
        notes:         form.notes || null,
        fixture_label: form.fixture_label || null,
        competition:   form.competition || null,
      };
      this.api.updateEvent(editing.id, payload).subscribe({
        next: res => {
          this.events.update(evs => evs.map(e => e.id === editing.id ? res.item : e));
          this.dayGroups.set(groupByDay(this.events()));
          this.saving.set(false);
          this.closeModal();
          this.toast.success('Event updated');
        },
        error: () => { this.saving.set(false); this.toast.error('Failed to update event'); },
      });
    } else {
      const payload: ScheduleEventPayload = {
        title:         form.title,
        content_type:  form.content_type,
        persona_tag:   form.persona_tag || undefined,
        generate_at:   toIso(form.generate_at)!,
        ...(toIso(form.publish_at) ? { publish_at: toIso(form.publish_at)! } : {}),
        notes:         form.notes || undefined,
        fixture_label: form.fixture_label || undefined,
        competition:   form.competition || undefined,
      };
      this.api.scheduleEvent(payload).subscribe({
        next: res => {
          const updated = [...this.events(), res.item].sort(
            (a, b) => new Date(a.generate_at).getTime() - new Date(b.generate_at).getTime()
          );
          this.events.set(updated);
          this.dayGroups.set(groupByDay(updated));
          this.saving.set(false);
          this.closeModal();
          this.toast.success('Content scheduled');
        },
        error: () => { this.saving.set(false); this.toast.error('Failed to schedule content'); },
      });
    }
  }

  deleteEvent(id: string) {
    this.api.deleteEvent(id).subscribe({
      next: () => {
        const updated = this.events().filter(e => e.id !== id);
        this.events.set(updated);
        this.dayGroups.set(groupByDay(updated));
        this.toast.success('Event removed');
      },
      error: () => this.toast.error('Failed to delete event'),
    });
  }

  navigateToPost(postId: string) {
    const siteId = this.route.snapshot.parent?.paramMap.get('siteId');
    if (siteId) {
      this.router.navigate([`/sites/${siteId}/blog/drafts/${postId}`]);
    }
  }
}
