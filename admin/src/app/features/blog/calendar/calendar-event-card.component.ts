import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CalendarEvent } from '../../../models/blog.model';

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  pending:    { label: 'Pending',    classes: 'bg-yellow-900/40 text-yellow-400' },
  generating: { label: 'Generating', classes: 'bg-blue-900/40 text-blue-400' },
  generated:  { label: 'Generated',  classes: 'bg-green-900/40 text-green-400' },
  failed:     { label: 'Failed',     classes: 'bg-red-900/40 text-red-400' },
};

@Component({
  selector: 'app-calendar-event-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-4 hover:border-[#222] transition-colors">
      <div class="flex items-start gap-3">

        <!-- Left: type icon -->
        <div class="w-8 h-8 rounded-md bg-[#1a1a1a] flex items-center justify-center shrink-0 mt-0.5">
          @if (event().content_type === 'weekly-roundup') {
            <svg class="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          } @else {
            <svg class="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          }
        </div>

        <!-- Middle: content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-sm font-medium text-white truncate">{{ event().title }}</p>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide shrink-0"
                  [class]="statusStyle.classes">
              {{ statusStyle.label }}
            </span>
          </div>

          @if (event().competition || event().fixture_label) {
            <p class="text-xs text-[#555] mt-0.5 truncate">
              @if (event().competition) { {{ event().competition }} }
              @if (event().competition && event().fixture_label) { · }
              @if (event().fixture_label) { {{ event().fixture_label }} }
            </p>
          }

          <div class="flex items-center gap-4 mt-2 flex-wrap">
            <span class="text-xs text-[#555]">
              <span class="text-[#444]">Generate: </span>
              <span class="text-[#888]">{{ event().generate_at | date:'EEE d MMM, HH:mm' }}</span>
            </span>
            @if (event().publish_at) {
              <span class="text-xs text-[#555]">
                <span class="text-[#444]">Publish: </span>
                <span class="text-green-500">{{ event().publish_at | date:'EEE d MMM, HH:mm' }}</span>
              </span>
            }
            @if (event().persona_tag) {
              <span class="text-xs text-[#444] capitalize">{{ event().persona_tag }}</span>
            }
          </div>

          @if (event().notes) {
            <p class="text-xs text-[#555] mt-1 line-clamp-2">{{ event().notes }}</p>
          }
        </div>

        <!-- Right: actions -->
        <div class="flex items-center gap-2 shrink-0">
          @if (event().schedule_status === 'generated' && event().generated_post_id) {
            <button (click)="viewPost.emit(event().generated_post_id!)"
                    class="px-2.5 py-1 text-xs rounded-md text-blue-400 hover:bg-blue-900/30 cursor-pointer transition-colors">
              View Post
            </button>
          }
          @if (event().schedule_status === 'pending') {
            <button (click)="edit.emit(event())"
                    class="px-2.5 py-1 text-xs rounded-md text-[#888] hover:bg-[#1a1a1a] cursor-pointer transition-colors">
              Edit
            </button>
          }
          <button (click)="delete.emit(event().id)"
                  class="px-2.5 py-1 text-xs rounded-md text-red-400 hover:bg-red-900/30 cursor-pointer transition-colors">
            Delete
          </button>
        </div>

      </div>
    </div>
  `,
})
export class CalendarEventCardComponent {
  event = input.required<CalendarEvent>();

  edit   = output<CalendarEvent>();
  delete = output<string>();
  viewPost = output<string>();

  get statusStyle() {
    return STATUS_STYLES[this.event().schedule_status] ?? STATUS_STYLES['pending'];
  }
}
