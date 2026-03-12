import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContentApiService } from '../../core/services/content-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { ContentType, FieldDefinition } from '../../models/content-type.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Site Settings</h2>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
    }

    @if (!loading() && !contentType()) {
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-8 text-center">
        <p class="text-sm text-[#555]">No site-settings content type found for this site</p>
        <p class="text-xs text-[#333] mt-1">Create a "site-settings" content type to enable this page</p>
      </div>
    }

    @if (contentType(); as type) {
      <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-6 max-w-2xl">
        @for (field of sortedFields(); track field.key) {
          <div class="mb-5">
            <label class="block text-xs text-[#999] mb-1.5">
              {{ field.label }}
              @if (field.required) { <span class="text-red-400">*</span> }
            </label>
            @if (field.helpText) {
              <p class="text-[10px] text-[#555] mb-1">{{ field.helpText }}</p>
            }

            @switch (field.type) {
              @case ('text') {
                @if (field.key === 'description' || field.key === 'bio' || field.key === 'about') {
                  <textarea [(ngModel)]="formData[field.key]" rows="4"
                            class="field-input resize-none"></textarea>
                } @else {
                  <input type="text" [(ngModel)]="formData[field.key]" class="field-input">
                }
              }
              @case ('richtext') {
                <textarea [(ngModel)]="formData[field.key]" rows="8"
                          class="field-input resize-y font-mono text-xs"></textarea>
              }
              @case ('url') {
                <input type="url" [(ngModel)]="formData[field.key]" placeholder="https://"
                       class="field-input">
              }
              @case ('image') {
                <div class="flex items-center gap-3">
                  @if (formData[field.key]) {
                    <img [src]="formData[field.key]" class="w-20 h-14 rounded object-cover bg-[#1a1a1a]">
                  }
                  <label class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors">
                    Upload
                    <input type="file" accept="image/*" (change)="uploadImage($event, field.key)" class="hidden">
                  </label>
                  @if (uploading() === field.key) {
                    <span class="text-xs text-[#555]">Uploading...</span>
                  }
                </div>
              }
              @case ('boolean') {
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formData[field.key]" class="accent-purple-500">
                  <span class="text-sm text-[#999]">{{ formData[field.key] ? 'Yes' : 'No' }}</span>
                </label>
              }
              @case ('select') {
                <select [(ngModel)]="formData[field.key]" class="field-input cursor-pointer">
                  <option value="">Select...</option>
                  @for (opt of field.options || []; track opt) {
                    <option [value]="opt">{{ opt }}</option>
                  }
                </select>
              }
              @default {
                <input type="text" [(ngModel)]="formData[field.key]" class="field-input">
              }
            }
          </div>
        }

        @if (error()) {
          <p class="text-xs text-red-400 mb-3">{{ error() }}</p>
        }

        <button (click)="save()"
                [disabled]="saving()"
                class="px-4 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer transition-colors">
          @if (saving()) { Saving... } @else { Save Settings }
        </button>
      </div>
    }
  `,
  styles: [`
    .field-input {
      width: 100%;
      padding: 8px 12px;
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 6px;
      font-size: 13px;
      color: #e5e5e5;
      transition: border-color 0.15s;
    }
    .field-input:focus {
      outline: none;
      border-color: #a78bfa;
    }
  `]
})
export class SettingsComponent implements OnInit {
  private contentApi = inject(ContentApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  contentType = signal<ContentType | null>(null);
  sortedFields = signal<FieldDefinition[]>([]);
  loading = signal(false);
  saving = signal(false);
  uploading = signal('');
  error = signal('');
  formData: Record<string, any> = {};
  private entrySlug: string | null = null;

  private get siteId(): string {
    const user = this.auth.user();
    return user?.siteId === '*' ? '_' : user?.siteId || '_';
  }

  ngOnInit() {
    this.loading.set(true);
    this.contentApi.getType(this.siteId, 'site-settings').subscribe({
      next: type => {
        this.contentType.set(type);
        this.sortedFields.set([...type.fields].sort((a, b) => a.order - b.order));

        // Load existing site-settings entry (first one)
        this.contentApi.getEntries(this.siteId, 'site-settings', { limit: 1 }).subscribe({
          next: res => {
            if (res.entries.length > 0) {
              this.entrySlug = res.entries[0].slug;
              this.formData = { ...res.entries[0].data };
            } else {
              // Init defaults
              type.fields.forEach(f => {
                if (f.type === 'boolean') this.formData[f.key] = false;
                else this.formData[f.key] = '';
              });
            }
            this.loading.set(false);
          },
          error: () => { this.loading.set(false); }
        });
      },
      error: () => { this.loading.set(false); }
    });
  }

  uploadImage(event: Event, key: string) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(key);
    this.contentApi.uploadFile(this.siteId, file).subscribe({
      next: res => { this.formData[key] = res.url; this.uploading.set(''); },
      error: () => { this.uploading.set(''); this.toast.error('Upload failed'); }
    });
  }

  save() {
    this.saving.set(true);
    this.error.set('');

    const payload = { data: this.formData, published: true };

    const req = this.entrySlug
      ? this.contentApi.updateEntry(this.siteId, 'site-settings', this.entrySlug, payload)
      : this.contentApi.createEntry(this.siteId, 'site-settings', payload);

    req.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        this.entrySlug = res.slug || this.entrySlug;
        this.toast.success('Settings saved');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.error || 'Failed to save');
      }
    });
  }
}
