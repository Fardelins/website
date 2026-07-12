import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BlogArticle } from '../../pages/blogs/blog.model';

@Component({
  selector: 'app-blog-card',
  imports: [RouterLink],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.css',
})
export class BlogCard {
  readonly article = input.required<BlogArticle>();
}
