# AIVOT — marketing site (`aivot.rocks`)

Static one-pager that pitches AIVOT. It's an **Astro + Tailwind CSS** project,
independent from the app (which lives in `../frontend` and is served on
**`app.aivot.rocks`**). The apex `aivot.rocks` serves this site; the app is on
the `app` subdomain.

Bilingual: **English at `/`**, **Italian at `/it/`**, with a language toggle.

## Develop

```bash
cd marketing
npm install
npm run dev      # http://localhost:4321
npm run build    # generates dist/  (what gets deployed)
npm run preview  # preview the build
```

## Where to edit content

All the "live" text lives in `src/data/` — edit it there, not in the markup.
Every file exports its copy keyed by locale (`{ en: …, it: … }`):

| File | What it holds |
| :--- | :--- |
| `src/data/site.ts` | Name, tagline, description, nav labels, CTAs, footer, and the shared `links` (app, docs, GitHub, contact email). |
| `src/data/steps.ts` | The 5-step flow cards (Project → People → Rules → Shifts → Plan). |
| `src/data/capabilities.ts` | The feature cards. |
| `src/data/offer.ts` | The conversion section (no prices — a strong "try it" CTA). |
| `src/data/changelog.ts` | "What's new". New release = new entry **on top** of the array. |

Add a language string in both `en` and `it` and it shows up on both pages.

The app screenshot is a faithful HTML/CSS mock in
`src/components/ScheduleMockup.astro` (no real captures exist yet). Replace it
with an `<img>` in `public/` when you have one.

## Deploy

Deployed together with the app by `infra/deploy.sh` (and the CI on push to the
`production` branch): it builds `marketing/dist` and publishes it to the **`www`**
Firebase Hosting target (the site `<project>-www`, mapped to `aivot.rocks`).
See the repo root `firebase.json` / `.firebaserc` for the target mapping.
