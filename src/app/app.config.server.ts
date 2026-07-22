import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SITE_URL, SITE_URL_TOKEN } from '@core/services/seo.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // env vars only exist server-side; feed the live origin to SeoService's SSR output.
    { provide: SITE_URL_TOKEN, useValue: process.env['PUBLIC_SITE_URL'] || SITE_URL },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
