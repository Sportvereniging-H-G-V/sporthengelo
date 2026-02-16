# Sport Hengelo

Website voor alle sporten in Hengelo — zowel reguliere als aangepaste sporten. De site biedt een overzicht van sportaanbieders en verenigingen in de gemeente Hengelo, inclusief een formulier voor het melden van ontbrekende sporten.

Live: [sporthengelo.nl](https://sporthengelo.nl)

## Gebouwd met

- [Astro v4](https://astro.build) — statische sitegenerator met hybride rendering
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting en serverless functions
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) — botbeveiliging op formulieren
- [Zod](https://zod.dev) — runtime validatie van invoer
- [Sharp](https://sharp.pixelplumbing.com) — afbeeldingsoptimalisatie (AVIF/WebP)

## Aan de slag

### Vereisten

- Node.js 20 of hoger
- npm 10 of hoger

### Installatie

```bash
npm install
```

### Ontwikkelserver starten

```bash
npm run dev
```

De site is beschikbaar op `http://localhost:4321`.

## Beschikbare scripts

| Script | Omschrijving |
|---|---|
| `npm run dev` | Start de ontwikkelserver |
| `npm run build` | Bouwt de site voor productie |
| `npm run preview` | Preview van de productiebuild lokaal |
| `npm run optimize-images` | Converteert afbeeldingen naar AVIF en WebP |

## Projectstructuur

```
├── content/
│   ├── sports/          # Markdown-bestanden voor reguliere sporten
│   ├── adaptive/        # Markdown-bestanden voor aangepaste sporten
│   └── site.json        # Siteconfiguratie
├── public/
│   ├── images/          # Afbeeldingen (origineel + AVIF/WebP)
│   ├── _headers         # Cloudflare cache- en security-headers
│   └── _redirects       # URL-redirects
├── scripts/
│   └── optimize-images.mjs  # Script voor afbeeldingsoptimalisatie
└── src/
    ├── components/      # Astro-componenten
    ├── layouts/         # Layout-templates
    ├── pages/           # Paginaroutes
    ├── types/           # TypeScript-types
    └── utils/           # Hulpfuncties
```

## Content beheren

Sportpagina's zijn Markdown-bestanden in `content/sports/` (regulier) en `content/adaptive/` (aangepast). Gebruik `TEMPLATE_SPORT.md` als startpunt voor een nieuwe sportpagina.

### Afbeeldingen optimaliseren

Voeg nieuwe afbeeldingen toe aan `public/images/` en voer daarna het volgende uit:

```bash
npm run optimize-images
```

Dit converteert alle JPG- en PNG-bestanden automatisch naar AVIF en WebP.

## Build en deployment

De site wordt gehost op Cloudflare Pages. De CI/CD-pipeline voert automatisch tests, linting en typecontrole uit, bouwt de site en deployt naar Cloudflare Pages. Bij pull requests wordt een preview-omgeving aangemaakt.

### Pagina's

| Route | Omschrijving |
|---|---|
| `/` | Homepage |
| `/sporten` | Overzicht reguliere sporten |
| `/aangepaste-sporten` | Overzicht aangepaste sporten |
| `/sport/[slug]` | Detailpagina per sport |
| `/ontbrekende-sport` | Formulier voor ontbrekende sporten |
| `/veelgestelde-vragen` | Veelgestelde vragen |
