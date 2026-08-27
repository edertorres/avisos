<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/08c22f97-110d-44e6-8a11-daaf064de123

Manual de usuario: [MANUAL_USUARIO.md](MANUAL_USUARIO.md)

## Run Locally

**Prerequisites:** Node.js, Typst CLI and Ghostscript (`gs`) available in your `PATH`


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

The local server exposes `/api/typst/compile`. It uses `typst compile` to render SVG previews and an initial PDF, then Ghostscript (`gs`) converts PDF exports to flattened DeviceGray output for print. The `/api/pdf/convert-gray` endpoint defaults to the legacy RIP path: PDF 1.3, flattened transparency and DeviceGray/K output. If `ISOnewspaper26v4_gr.icc` is available in the project/current directory, or `GRAY_ICC_PROFILE` points to an ICC file, that profile is embedded as a PDF/X-1a:2001 output intent for the gray conversion.

## Deploy

Production runs through the Express server in `server.ts`:

- Build: `npm run build`
- Start: `npm start`
- Port: `3000`

For Coolify, use the included `Dockerfile`. Configure the public domain as:

`https://avisos.rreditores.com`

The Docker image installs Typst CLI, Ghostscript and the system fonts used by the PDF renderer
(`Roboto`, `Lato`, `Arimo`, `Tinos`, `Liberation` and `Noto` fallbacks).
