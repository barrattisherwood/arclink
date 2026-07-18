import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of, throwError, NEVER } from 'rxjs';
import { BlogApiService } from '../../../core/services/blog-api.service';
import { ContentApiService } from '../../../core/services/content-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { QueueComponent } from './queue.component';

const mockQueueItem = { id: 'q1', title: 'Existing', priority: 1, notes: null, persona_tag: null, fixtures: [], created_at: '' };
const newItem = { id: 'q2', title: 'World Cup Final 2026: France vs Argentina', priority: 1, notes: null, persona_tag: null, fixtures: [], created_at: '' };

describe('QueueComponent — custom title input', () => {
  let fixture: ComponentFixture<QueueComponent>;
  let component: QueueComponent;
  let mockApi: Record<string, any>;
  let mockToast: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    mockApi = {
      getQueue: vi.fn().mockReturnValue(of({ items: [mockQueueItem] })),
      addToQueue: vi.fn(),
      suggest: vi.fn(),
      removeFromQueue: vi.fn(),
      generate: vi.fn(),
      prioritise: vi.fn(),
      syncPersonas: vi.fn(),
      seedFindtherapy: vi.fn(),
      migrateFindtherapy: vi.fn(),
      generateRoundupNow: vi.fn(),
      roundupEnabled: false,
      personaOptions: [],
    };

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [QueueComponent],
      providers: [
        { provide: BlogApiService, useValue: mockApi },
        { provide: ContentApiService, useValue: {} },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function setInputValue(value: string) {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="custom-title-input"]');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  // --- Rendering ---

  it('renders the custom title input', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="custom-title-input"]');
    expect(input).toBeTruthy();
  });

  it('renders the add custom title button', () => {
    const btn = fixture.nativeElement.querySelector('[data-testid="custom-title-btn"]');
    expect(btn).toBeTruthy();
  });

  it('disables the add button when input is empty', () => {
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="custom-title-btn"]');
    expect(btn.disabled).toBe(true);
  });

  it('enables the add button when input has text', () => {
    setInputValue('World Cup Final');
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="custom-title-btn"]');
    expect(btn.disabled).toBe(false);
  });

  // --- Behaviour ---

  it('calls api.addToQueue with the typed title', () => {
    mockApi['addToQueue'].mockReturnValue(of({ items: [mockQueueItem, newItem] }));
    setInputValue('World Cup Final 2026: France vs Argentina');
    component.addCustomTitle();
    expect(mockApi['addToQueue']).toHaveBeenCalledWith([{ title: 'World Cup Final 2026: France vs Argentina' }]);
  });

  it('updates the queue with returned items on success', () => {
    mockApi['addToQueue'].mockReturnValue(of({ items: [mockQueueItem, newItem] }));
    setInputValue('World Cup Final');
    component.addCustomTitle();
    expect(component.queue().length).toBe(2);
    expect(component.queue()[1].title).toBe('World Cup Final 2026: France vs Argentina');
  });

  it('clears the input after a successful add', () => {
    mockApi['addToQueue'].mockReturnValue(of({ items: [mockQueueItem, newItem] }));
    setInputValue('World Cup Final');
    component.addCustomTitle();
    expect(component.customTitle).toBe('');
  });

  it('shows a success toast after adding', () => {
    mockApi['addToQueue'].mockReturnValue(of({ items: [mockQueueItem, newItem] }));
    setInputValue('World Cup Final');
    component.addCustomTitle();
    expect(mockToast['success']).toHaveBeenCalledWith('Added to queue');
  });

  it('shows an error toast on failure', () => {
    mockApi['addToQueue'].mockReturnValue(throwError(() => new Error('fail')));
    setInputValue('World Cup Final');
    component.addCustomTitle();
    expect(mockToast['error']).toHaveBeenCalledWith('Failed to add to queue');
  });

  it('disables the add button while the request is in flight', () => {
    mockApi['addToQueue'].mockReturnValue(NEVER);
    setInputValue('World Cup Final');
    component.addCustomTitle();
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="custom-title-btn"]');
    expect(btn.disabled).toBe(true);
  });
});
