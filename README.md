# Fardelins

Fardelins is a modern Angular landing page for the brand at https://fardelins.com/. The site showcases the company’s logistics-focused offering through a polished marketing experience with sections for the hero area, audience, features, company story, delivery journey, contact, blog content, and legal pages.

## Overview

This project is built as a responsive single-page marketing site with route-based pages for:

- Home
- Contact
- Blog articles
- Terms of service
- Privacy policy

It is designed to be fast, visually rich, and easy to maintain using Angular components and scoped styles.

## Tech stack

- Angular 22
- TypeScript
- RxJS
- CSS and component-scoped styles
- Vitest for unit testing

## Project structure

- src/app/components: reusable UI sections such as hero, features, navbar, footer, and blog cards
- src/app/pages: page-level components for home, contact, blog, terms, and privacy
- src/app/directives: custom Angular directives
- public: static assets including images, icons, and content files

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm start
   ```

3. Open your browser at:

   ```text
   http://localhost:4200/
   ```

The app will automatically reload when changes are made.

## Build for production

To create a production build:

```bash
npm run build
```

The build output will be generated in the dist/ folder.

## Run tests

To run the test suite:

```bash
npm test
```

## Deployment

This project is suitable for deployment to any modern static or Node-based hosting platform. After building the app, deploy the contents of the dist/ output for the production site.

## Contact

For questions or updates related to the project, contact the Fardelins team through the website contact page at https://fardelins.com/contact.
