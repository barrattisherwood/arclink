import { Component } from '@angular/core';

@Component({
  selector: 'app-sites',
  standalone: true,
  template: `
    <h2 class="text-lg font-semibold text-white mb-4">Sites</h2>
    <div class="bg-[#111] rounded-lg border border-[#1a1a1a] p-8 text-center">
      <p class="text-sm text-[#555]">Tenant management coming soon</p>
      <p class="text-xs text-[#333] mt-1">Manage all content tenants and their configurations</p>
    </div>
  `
})
export class SitesComponent {}
