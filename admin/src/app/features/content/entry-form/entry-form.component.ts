import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContentApiService } from '../../../core/services/content-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ContentType, FieldDefinition } from '../../../models/content-type.model';
import { ContentEntry } from '../../../models/content-entry.model';

@Component({
  selector: 'app-entry-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex items-center gap-3 mb-6">
      <a [routerLink]="'..'" class="text-sm text-[#666] hover:text-white transition-colors">&larr; Back</a>
      <span class="text-[#333]">/</span>
      <h2 class="text-lg font-semibold text-white">
        {{ isEdit() ? 'Edit' : 'New' }} {{ contentType()?.name || 'Entry' }}
      </h2>
    </div>

    @if (loading()) {
      <p class="text-sm text-[#555]">Loading...</p>
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
                @if (field.key === 'description' || field.key === 'bio' || field.key === 'summary' || field.key === 'excerpt') {
                  <textarea [(ngModel)]="formData[field.key]" rows="4"
                            class="field-input resize-none"></textarea>
                } @else {
                  <input type="text" [(ngModel)]="formData[field.key]" class="field-input">
                }
              }
              @case ('richtext') {
                <textarea [(ngModel)]="formData[field.key]" rows="12"
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
              @case ('images') {
                <div class="flex flex-wrap gap-2 mb-2">
                  @for (img of formData[field.key] || []; track img; let i = $index) {
                    <div class="relative">
                      <img [src]="img" class="w-20 h-14 rounded object-cover bg-[#1a1a1a]">
                      <button (click)="removeImage(field.key, i)"
                              class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center cursor-pointer">
                        x
                      </button>
                    </div>
                  }
                </div>
                <label class="px-3 py-1.5 text-xs rounded-md bg-[#1a1a1a] hover:bg-[#222] text-white cursor-pointer transition-colors inline-block">
                  Add Images
                  <input type="file" accept="image/*" multiple (change)="uploadImages($event, field.key)" class="hidden">
                </label>
                @if (uploading() === field.key) {
                  <span class="text-xs text-[#555] ml-2">Uploading...</span>
                }
              }
              @case ('video_url') {
                <input type="url" [(ngModel)]="formData[field.key]" placeholder="YouTube or Vimeo URL"
                       class="field-input">
              }
              @case ('coordinates') {
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="block text-[10px] text-[#555] mb-0.5">Latitude</label>
                    <input type="number" step="any"
                           [ngModel]="formData[field.key]?.lat"
                           (ngModelChange)="setCoord(field.key, 'lat', $event)"
                           class="field-input">
                  </div>
                  <div class="flex-1">
                    <label class="block text-[10px] text-[#555] mb-0.5">Longitude</label>
                    <input type="number" step="any"
                           [ngModel]="formData[field.key]?.lng"
                           (ngModelChange)="setCoord(field.key, 'lng', $event)"
                           class="field-input">
                  </div>
                </div>
              }
              @case ('boolean') {
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="formData[field.key]" class="accent-purple-500">
                  <span class="text-sm text-[#999]">{{ formData[field.key] ? 'Yes' : 'No' }}</span>
                </label>
              }
              @case ('select') {
                <select [(ngModel)]="formData[field.key]"
                        class="field-input cursor-pointer">
                  <option value="">Select...</option>
                  @for (opt of field.options || []; track opt) {
                    <option [value]="opt">{{ opt }}</option>
                  }
                </select>
              }
              @case ('date') {
                <input type="date" [(ngModel)]="formData[field.key]" class="field-input">
              }
              @case ('tags') {
                <input type="text"
                       [ngModel]="(formData[field.key] || []).join(', ')"
                       (ngModelChange)="setTags(field.key, $event)"
                       placeholder="e.g. hollywoodbets, betway, 10bet"
                       class="field-input">
                <p class="text-[10px] text-[#555] mt-1">Comma-separated values</p>
              }
            }
          </div>
        }

        <!-- Published toggle -->
        <div class="mb-5 pt-4 border-t border-[#1a1a1a]">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" [(ngModel)]="published" class="accent-purple-500">
            <span class="text-sm text-[#999]">Published</span>
          </label>
        </div>

        @if (error()) {
          <p class="text-xs text-red-400 mb-3">{{ error() }}</p>
        }

        <div class="flex gap-3">
          <button (click)="save()"
                  [disabled]="saving()"
                  class="px-4 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 cursor-pointer transition-colors">
            @if (saving()) { Saving... } @else { {{ isEdit() ? 'Update' : 'Create' }} }
          </button>
          <a [routerLink]="'..'"
             class="px-4 py-2 text-sm rounded-md text-[#999] hover:text-white cursor-pointer transition-colors">
            Cancel
          </a>
        </div>
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
export class EntryFormComponent implements OnInit {
  private contentApi = inject(ContentApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  contentType = signal<ContentType | null>(null);
  loading = signal(false);
  saving = signal(false);
  uploading = signal('');
  error = signal('');
  isEdit = signal(false);
  published = false;
  formData: Record<string, any> = {};

  sortedFields = signal<FieldDefinition[]>([]);

  private get siteId(): string {
    const user = this.auth.user();
    return user?.siteId === '*' ? '_' : user?.siteId || '_';
  }

  private get typeSlug(): string {
    return this.route.snapshot.paramMap.get('typeSlug') || '';
  }

  private get entrySlug(): string | null {
    return this.route.snapshot.paramMap.get('slug');
  }

  ngOnInit() {
    this.loading.set(true);
    this.isEdit.set(!!this.entrySlug && this.entrySlug !== 'new');

    this.contentApi.getType(this.siteId, this.typeSlug).subscribe({
      next: type => {
        this.contentType.set(type);
        this.sortedFields.set([...type.fields].sort((a, b) => a.order - b.order));

        if (this.isEdit()) {
          this.contentApi.getEntry(this.siteId, this.typeSlug, this.entrySlug!).subscribe({
            next: entry => {
              this.formData = { ...entry.data };
              this.published = entry.published;
              this.loading.set(false);
            },
            error: () => { this.loading.set(false); this.toast.error('Failed to load entry'); }
          });
        } else {
          // Initialize defaults
          type.fields.forEach(f => {
            if (f.type === 'boolean') this.formData[f.key] = false;
            else if (f.type === 'images') this.formData[f.key] = [];
            else if (f.type === 'tags') this.formData[f.key] = [];
            else if (f.type === 'coordinates') this.formData[f.key] = { lat: 0, lng: 0 };
            else this.formData[f.key] = '';
          });
          this.loading.set(false);
        }
      },
      error: () => { this.loading.set(false); this.toast.error('Failed to load content type'); }
    });
  }

  setCoord(key: string, axis: 'lat' | 'lng', value: number) {
    if (!this.formData[key]) this.formData[key] = { lat: 0, lng: 0 };
    this.formData[key] = { ...this.formData[key], [axis]: value };
  }

  setTags(key: string, value: string) {
    this.formData[key] = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
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

  uploadImages(event: Event, key: string) {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    this.uploading.set(key);
    this.contentApi.uploadBatch(this.siteId, Array.from(files)).subscribe({
      next: res => {
        const urls = res.images.map(i => i.url);
        this.formData[key] = [...(this.formData[key] || []), ...urls];
        this.uploading.set('');
      },
      error: () => { this.uploading.set(''); this.toast.error('Upload failed'); }
    });
  }

  removeImage(key: string, index: number) {
    this.formData[key] = this.formData[key].filter((_: any, i: number) => i !== index);
  }

  save() {
    this.saving.set(true);
    this.error.set('');

    const payload = { data: this.formData, published: this.published };

    const req = this.isEdit()
      ? this.contentApi.updateEntry(this.siteId, this.typeSlug, this.entrySlug!, payload)
      : this.contentApi.createEntry(this.siteId, this.typeSlug, payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.isEdit() ? 'Entry updated' : 'Entry created');
        this.router.navigate(['..'], { relativeTo: this.route });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.error || 'Failed to save');
      }
    });
  }
}
