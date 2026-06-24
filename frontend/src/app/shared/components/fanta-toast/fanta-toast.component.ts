import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fanta-toast',
  standalone: true,
  imports: [LucideAngularModule, CommonModule],
  template: `
    <div [ngClass]="isSuccess ? 'bg-bordeaux' : 'bg-red-600'" 
         class="text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 min-w-[320px] animate-in fade-in slide-in-from-bottom-4">
      
      <div class="bg-white/20 p-2 rounded-full flex items-center justify-center">
        <lucide-icon [name]="iconName" class="w-6 h-6" [class.text-yellow-400]="isSuccess"></lucide-icon>
      </div>
      
      <div class="flex flex-col">
        <span class="font-bold text-lg leading-tight">{{ title }}</span>
        <span class="text-sm text-white/80">{{ message }}</span>
      </div>
    </div>
  `
})
export class FantaToastComponent {
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() iconName: string = 'info';
  @Input() isSuccess: boolean = true; // Default a true (Bordeaux)
}