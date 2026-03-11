import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Site Settings</h2>
    <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-8 text-center">
      <p class="text-sm text-[#555]">Site settings editor coming soon</p>
      <p class="text-xs text-[#333] mt-1">This will use the site-settings content type schema</p>
    </div>
  `
})
export class SettingsComponent {}
