import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MONACO_PATH } from '@materia-ui/ngx-monaco-editor';

import { routes } from './app.routes';
import { Noir } from '../../Noir';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Noir
      }
    }),
    {
      provide: MONACO_PATH,
      useValue: 'https://unpkg.com/monaco-editor@0.44.0/min/vs'
    },
    provideHttpClient()
  ]
};



