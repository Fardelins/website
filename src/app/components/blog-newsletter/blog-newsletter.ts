import { Component } from '@angular/core';

@Component({
  selector: 'app-blog-newsletter',
  templateUrl: './blog-newsletter.html',
  styleUrl: './blog-newsletter.css',
})
export class BlogNewsletter {
  protected submitted = false;

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted = true;
  }
}
