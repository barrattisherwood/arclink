import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of, throwError, NEVER } from 'rxjs';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { PublishedComponent } from './published.component';
import { Post } from '../../../models/blog.model';

const basePost: Post = {
  id: 'post-1',
  title: 'My Post',
  slug: 'my-post',
  excerpt: '',
  seo_title: '',
  seo_description: '',
  categories: [],
  reading_time: 3,
  status: 'published',
  tags: [],
  word_count: 500,
  generated: true,
  scheduled_for: null,
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  featured_image: { url: 'https://example.com/img.jpg', alt: 'A photo' },
};

const postNoImage: Post = { ...basePost, id: 'post-2', featured_image: null };

describe('PublishedComponent — image editing', () => {
  let fixture: ComponentFixture<PublishedComponent>;
  let component: PublishedComponent;
  let mockApi: Record<string, ReturnType<typeof vi.fn>>;
  let mockToast: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockApi = {
      getPublished: vi.fn().mockReturnValue(of({ posts: [basePost], total: 1, pages: 1 })),
      getPost: vi.fn().mockReturnValue(of({ post: { ...basePost, content: 'Hello world' } })),
      deletePost: vi.fn(),
      updatePost: vi.fn(),
      featurePost: vi.fn(),
      regenerateImage: vi.fn(),
      uploadImage: vi.fn(),
    };

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PublishedComponent],
      providers: [
        { provide: BlogApiService, useValue: mockApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublishedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function openEditModal(post: Post = basePost) {
    component.openEdit(post);
    fixture.detectChanges();
  }

  function withMockFileReader(fakeBase64: string, callback: () => void) {
    const mockReader: any = { result: fakeBase64, onload: null };
    mockReader.readAsDataURL = function() { mockReader.onload({ target: mockReader }); };
    const orig = window.FileReader;
    (window as any).FileReader = function() { return mockReader; };
    callback();
    (window as any).FileReader = orig;
  }

  // --- Display ---

  it('shows the featured image when editPost has a featured_image url', () => {
    openEditModal(basePost);
    const img: HTMLImageElement = fixture.nativeElement.querySelector('[data-testid="edit-featured-image"]');
    expect(img).toBeTruthy();
    expect(img.src).toContain('example.com/img.jpg');
  });

  it('shows a placeholder when editPost has no featured_image', () => {
    openEditModal(postNoImage);
    const placeholder = fixture.nativeElement.querySelector('[data-testid="edit-image-placeholder"]');
    expect(placeholder).toBeTruthy();
    const img = fixture.nativeElement.querySelector('[data-testid="edit-featured-image"]');
    expect(img).toBeNull();
  });

  // --- Regenerate ---

  it('calls api.regenerateImage with the post id when New Image clicked', () => {
    const updatedPost = { ...basePost, featured_image: { url: 'https://example.com/new.jpg', alt: 'New' } };
    mockApi['regenerateImage'].mockReturnValue(of({ post: updatedPost }));

    openEditModal(basePost);
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="edit-regenerate-btn"]');
    btn.click();

    expect(mockApi['regenerateImage']).toHaveBeenCalledWith('post-1');
  });

  it('shows Generating… on the button while regenerate is in flight', () => {
    mockApi['regenerateImage'].mockReturnValue(NEVER);

    openEditModal(basePost);
    component.regenerateImage();
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="edit-regenerate-btn"]');
    expect(btn.textContent?.trim()).toBe('Generating…');
  });

  it('updates editPost with the new image on regenerate success', () => {
    const updatedPost = { ...basePost, featured_image: { url: 'https://example.com/new.jpg', alt: 'New' } };
    mockApi['regenerateImage'].mockReturnValue(of({ post: updatedPost }));

    openEditModal(basePost);
    component.regenerateImage();
    fixture.detectChanges();

    expect(component.editPost()?.featured_image?.url).toBe('https://example.com/new.jpg');
  });

  it('clears regenerating and shows error toast on regenerate failure', () => {
    mockApi['regenerateImage'].mockReturnValue(throwError(() => new Error('fail')));

    openEditModal(basePost);
    component.regenerateImage();

    expect(mockToast['error']).toHaveBeenCalledWith('Failed to regenerate image');
    expect(component.regenerating()).toBe(false);
  });

  // --- Upload ---

  it('calls api.uploadImage with post id and base64 when file selected', () => {
    const fakeBase64 = 'data:image/png;base64,abc123';
    const updatedPost = { ...basePost, featured_image: { url: 'https://example.com/upload.jpg', alt: '' } };
    mockApi['uploadImage'].mockReturnValue(of({ post: updatedPost }));

    openEditModal(basePost);
    withMockFileReader(fakeBase64, () => {
      component.onFileSelected({ target: { files: [new File([''], 'photo.png')] } } as unknown as Event);
    });

    expect(mockApi['uploadImage']).toHaveBeenCalledWith('post-1', fakeBase64);
  });

  it('updates editPost with the new image on upload success', () => {
    const fakeBase64 = 'data:image/png;base64,abc123';
    const updatedPost = { ...basePost, featured_image: { url: 'https://example.com/upload.jpg', alt: '' } };
    mockApi['uploadImage'].mockReturnValue(of({ post: updatedPost }));

    openEditModal(basePost);
    withMockFileReader(fakeBase64, () => {
      component.onFileSelected({ target: { files: [new File([''], 'photo.png')] } } as unknown as Event);
    });
    fixture.detectChanges();

    expect(component.editPost()?.featured_image?.url).toBe('https://example.com/upload.jpg');
  });

  it('shows error toast on upload failure', () => {
    mockApi['uploadImage'].mockReturnValue(throwError(() => new Error('fail')));

    openEditModal(basePost);
    withMockFileReader('data:image/png;base64,x', () => {
      component.onFileSelected({ target: { files: [new File([''], 'photo.png')] } } as unknown as Event);
    });

    expect(mockToast['error']).toHaveBeenCalledWith('Failed to upload image');
  });
});
