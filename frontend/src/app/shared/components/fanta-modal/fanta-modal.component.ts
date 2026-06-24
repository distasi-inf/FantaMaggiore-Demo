import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-fanta-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './fanta-modal.component.html',
})
export class FantaModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() disableBackdropClose: boolean = false;

  @Output() closed = new EventEmitter<void>();

  get sizeClass(): string {
    const map: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    };
    return map[this.size] ?? 'max-w-lg';
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick() {
    if (!this.disableBackdropClose) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.isOpen && !this.disableBackdropClose) {
      this.close();
    }
  }
}
