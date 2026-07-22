import { Component, input } from '@angular/core';

@Component({
  selector: 'app-blog-empty-state',
  templateUrl: './blog-empty-state.html',
  styleUrl: './blog-empty-state.css',
})
export class BlogEmptyState {
  readonly category = input<string>('All Articles');
  readonly query = input<string>('');
}
