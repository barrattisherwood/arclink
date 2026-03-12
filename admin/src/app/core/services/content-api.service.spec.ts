import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ContentApiService } from './content-api.service';
import { environment } from '../../../environments/environment';

describe('ContentApiService', () => {
  let service: ContentApiService;
  let httpMock: HttpTestingController;
  const base = environment.contentApiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch all sites', () => {
    service.getSites().subscribe(res => {
      expect(res.sites.length).toBe(1);
      expect(res.sites[0].siteId).toBe('dlc');
    });

    const req = httpMock.expectOne(`${base}/sites`);
    expect(req.request.method).toBe('GET');
    req.flush({ sites: [{ siteId: 'dlc', name: 'DLC', active: true }] });
  });

  it('should fetch content types for a site', () => {
    service.getTypes('dlc').subscribe(res => {
      expect(res.types.length).toBe(2);
    });

    const req = httpMock.expectOne(`${base}/types/dlc`);
    expect(req.request.method).toBe('GET');
    req.flush({ types: [{ slug: 'project' }, { slug: 'service' }] });
  });

  it('should fetch entries with query params', () => {
    service.getEntries('dlc', 'project', { limit: 10, offset: 5, published: true }).subscribe(res => {
      expect(res.total).toBe(20);
    });

    const req = httpMock.expectOne(r => r.url.includes('/entries/dlc/project'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('5');
    expect(req.request.params.get('published')).toBe('true');
    req.flush({ entries: [], total: 20, limit: 10, offset: 5 });
  });

  it('should create an entry', () => {
    const payload = { data: { title: 'Test' }, published: false };
    service.createEntry('dlc', 'project', payload).subscribe();

    const req = httpMock.expectOne(`${base}/entries/dlc/project`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ slug: 'test', data: { title: 'Test' } });
  });

  it('should toggle publish', () => {
    service.togglePublish('dlc', 'project', 'test-entry').subscribe(res => {
      expect(res.published).toBe(true);
    });

    const req = httpMock.expectOne(`${base}/entries/dlc/project/test-entry/publish`);
    expect(req.request.method).toBe('POST');
    req.flush({ published: true });
  });

  it('should delete an entry', () => {
    service.deleteEntry('dlc', 'project', 'test-entry').subscribe(res => {
      expect(res.deleted).toBe(true);
    });

    const req = httpMock.expectOne(`${base}/entries/dlc/project/test-entry`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true });
  });

  it('should upload a file via FormData', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    service.uploadFile('dlc', file).subscribe(res => {
      expect(res.url).toBe('https://res.cloudinary.com/test.png');
    });

    const req = httpMock.expectOne(`${base}/upload/dlc`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ url: 'https://res.cloudinary.com/test.png', publicId: 'test', width: 100, height: 100 });
  });
});
