import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('показывает навигацию между дашбордом и настройками', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Dashboard', '/dashboard'],
      ['Settings', '/settings'],
    ]);
  });
});
