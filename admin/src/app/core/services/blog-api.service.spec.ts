import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { BlogApiService } from './blog-api.service';
import { environment } from '../../../environments/environment';

describe('BlogApiService', () => {
  let service: BlogApiService;
  let httpMock: HttpTestingController;
  const base = environment.blogApiUrl;
  const tenantId = environment.blogTenantId;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BlogApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch queue with api key header', () => {
    service.getQueue().subscribe(res => {
      expect(res.items).toEqual([]);
    });

    const req = httpMock.expectOne(`${base}/queue/${tenantId}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('x-api-key')).toBe(environment.blogApiKey);
    req.flush({ items: [] });
  });

  it('should suggest titles with count', () => {
    service.suggest(5).subscribe(res => {
      expect(res.suggestions.length).toBe(1);
    });

    const req = httpMock.expectOne(`${base}/suggest/${tenantId}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ count: 5 });
    req.flush({ suggestions: [{ title: 'Test', rationale: 'Good' }] });
  });

  it('should add titles to queue', () => {
    const titles = ['Title A', 'Title B'];
    service.addToQueue(titles).subscribe();

    const req = httpMock.expectOne(`${base}/queue/${tenantId}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ titles });
    req.flush({ items: [] });
  });

  it('should delete a post', () => {
    service.deletePost('post-1').subscribe(res => {
      expect(res.ok).toBe(true);
    });

    const req = httpMock.expectOne(`${base}/posts/${tenantId}/post-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
  });

  it('should publish a post', () => {
    service.publishPost('post-1').subscribe();

    const req = httpMock.expectOne(`${base}/posts/${tenantId}/post-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'published' });
    req.flush({ post: { id: 'post-1', status: 'published' } });
  });

  it('should get drafts', () => {
    service.getDrafts().subscribe(res => {
      expect(res.posts.length).toBe(2);
    });

    const req = httpMock.expectOne(`${base}/posts/${tenantId}/drafts`);
    expect(req.request.method).toBe('GET');
    req.flush({ posts: [{ id: '1' }, { id: '2' }] });
  });
});
