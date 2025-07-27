import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore } from '@ngrx/router-store';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { appReducers } from './store/app.reducer';
import { AppEffects } from './store/app.effects';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideStore(appReducers),
    provideEffects([AppEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: environment.production,
      connectInZone: true
    }),
    provideRouterStore(),
    importProvidersFrom([
      MatSnackBarModule,
      MatDialogModule,
      BrowserAnimationsModule
    ])
  ]
};
