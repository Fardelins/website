import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL, SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let doc: Document;
  let meta: Meta;
  let title: Title;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(SeoService);
    doc = TestBed.inject(DOCUMENT);
    meta = TestBed.inject(Meta);
    title = TestBed.inject(Title);
    // The jsdom head persists across tests; clear the head elements we manage.
    doc.head.querySelector('link[rel="canonical"]')?.remove();
    doc.head.querySelector('#seo-jsonld')?.remove();
  });

  it('sets title, description, canonical, and defaults for a basic route', () => {
    service.update({ title: 'Features', description: 'Explore Fardelins.', path: '/features' });

    expect(title.getTitle()).toBe(`Features | ${SITE_NAME}`);
    expect(meta.getTag('name="description"')?.content).toBe('Explore Fardelins.');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(meta.getTag('property="og:url"')?.content).toBe(`${SITE_URL}/features`);
    expect(meta.getTag('property="og:image"')?.content).toBe(DEFAULT_OG_IMAGE);
    expect(meta.getTag('name="twitter:card"')?.content).toBe('summary_large_image');
    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_URL}/features`,
    );
  });

  it('does not double-append the site name when the title already includes it', () => {
    service.update({ title: `Contact ${SITE_NAME}`, description: 'x', path: '/contact' });
    expect(title.getTitle()).toBe(`Contact ${SITE_NAME}`);
  });

  it('honors an explicit robots override', () => {
    service.update({
      title: 'Draft',
      description: 'x',
      path: '/draft',
      robots: 'noindex, nofollow',
    });
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('adds JSON-LD when provided and removes it when omitted on a later update', () => {
    service.update({
      title: 'FAQ',
      description: 'x',
      path: '/features',
      jsonLd: { '@type': 'FAQPage' },
    });
    const script = doc.head.querySelector('#seo-jsonld');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain('"@type":"FAQPage"');

    service.update({ title: 'FAQ', description: 'x', path: '/features' });
    expect(doc.head.querySelector('#seo-jsonld')).toBeNull();
  });

  it('emits article:published_time only for articles', () => {
    service.update({
      title: 'Post',
      description: 'x',
      path: '/blogs/post',
      type: 'article',
      publishedTime: '2026-01-01T00:00:00.000Z',
    });
    expect(meta.getTag('property="article:published_time"')?.content).toBe(
      '2026-01-01T00:00:00.000Z',
    );

    service.update({ title: 'Home', description: 'x', path: '/' });
    expect(meta.getTag('property="article:published_time"')).toBeNull();
  });
});
