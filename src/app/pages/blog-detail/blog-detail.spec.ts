import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { BlogService } from '../blogs/blog.service';
import { BlogDetail } from './blog-detail';

const article = {
  id: 7,
  slug: 'delivery-story',
  category: 'Delivery',
  categoryId: 2,
  readTime: '4 min read',
  title: 'A Delivery Story',
  excerpt: 'How a parcel made it home.',
  image: null,
  link: 'https://fardelins.com/delivery-story',
  contentHtml: '<p>The full article body.</p>',
  date: 'June 12, 2026',
};

describe('BlogDetail', () => {
  async function render(fetchArticleBySlug: ReturnType<typeof vi.fn>) {
    const service = {
      fetchArticleBySlug,
      fetchRelated: vi.fn().mockResolvedValue([]),
    };
    await TestBed.configureTestingModule({
      imports: [BlogDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: 'delivery-story' })) },
        },
        { provide: BlogService, useValue: service },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BlogDetail);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return { fixture, service };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('loads and renders the requested article', async () => {
    const { fixture, service } = await render(vi.fn().mockResolvedValue(article));
    const element = fixture.nativeElement as HTMLElement;

    expect(service.fetchArticleBySlug).toHaveBeenCalledWith('delivery-story');
    expect(element.querySelector('h1')?.textContent).toContain('A Delivery Story');
    expect(element.querySelector('.article-content')?.textContent).toContain('full article body');
    expect(element.querySelector('.article-hero__meta')?.textContent).toContain('4 min read');
  });

  it('renders a clear not-found state', async () => {
    const { fixture } = await render(vi.fn().mockResolvedValue(null));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Article not found');
  });

  it('renders a recoverable error state when loading fails', async () => {
    const { fixture } = await render(vi.fn().mockRejectedValue(new Error('offline')));
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      "Couldn't load this article",
    );
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/blogs');
  });
});
