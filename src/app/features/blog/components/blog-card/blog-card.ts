import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarArrowRightBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { BlogArticle } from '../../blog.model';

@Component({
  selector: 'app-blog-card',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ solarArrowRightBoldDuotone })],
  templateUrl: './blog-card.html',
  styleUrl: './blog-card.css',
})
export class BlogCard {
  readonly article = input.required<BlogArticle>();
}
