# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Deploying to Vercel

The Vercel project's **Root Directory** must be set to `site` (this app lives in
a subfolder of the repo).

### Image assets and the deploy-size limit

Vercel limits the deployment source to **100 MB on Hobby** (1 GB on Pro). The
full-resolution originals are ~640 MB, so they are **not** committed to
`public/` — keeping them there made the heavy image requests 404 in production
while the app shell still loaded.

What the app ships and where images come from:

- **Photo grids, lightbox, thumbnails** use the optimized `/web/` versions
  (webp + jpg, ~46 MB) committed under `public/web/`.
- **Hero depth-scenes** (the 3D parallax shots) use full-res originals when a
  CDN is configured, otherwise they fall back to the same `/web/` versions, so
  nothing 404s out of the box.

To serve true full-res originals from a CDN (Supabase Storage example):

1. Restore the originals locally (they remain in git history):
   `git checkout <commit-before-removal> -- site/public/photos`
2. Upload them to a public bucket:
   ```sh
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   node tools/upload-media.mjs
   ```
3. In the Vercel project, set `VITE_MEDIA_BASE` to the bucket's public base
   (no trailing slash), e.g.
   `https://<ref>.supabase.co/storage/v1/object/public/photos`, then redeploy.

See `tools/upload-media.mjs` and `.env.example` for details.

---

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
