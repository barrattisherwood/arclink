import { Component } from '@angular/core';

@Component({
  selector: 'app-schema',
  standalone: true,
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Schema Editor</h2>
    <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-8 text-center">
      <p class="text-sm text-[#555]">Content type schema editor coming soon</p>
      <p class="text-xs text-[#333] mt-1">Define and manage content type fields per site</p>
    </div>
  `
})
export class SchemaComponent {}
