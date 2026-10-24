import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('показує навігацію між дашбордом і налаштуваннями', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')];
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Dashboard', '/dashboard'],
      ['Settings', '/settings'],
    ]);
  });
});
