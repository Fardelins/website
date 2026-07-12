import { Component, input } from '@angular/core';
import { BlogArticle } from '../../pages/blogs/blog-articles.data';

@Component({
  selector: 'app-blog-card',
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.css',
})
export class BlogCard {
  readonly article = input.required<BlogArticle>();
}
