# Jeeno Portfolio — project guide

Personal UX/UI portfolio site for **Supalerk (Jeeno) Chaonchom**, UX/UI & Product
Designer. Static HTML/CSS/JS, no build step, deployed on Vercel from GitHub.

This file is the handoff brief: what the site is, how it is put together, the
conventions to keep, and what is still open.

---

## 1. Stack and ground rules

- Plain HTML, CSS and vanilla JS. **No framework, no bundler, no package.json.**
  Files are served exactly as they sit in the repo — keep it that way unless the
  owner asks otherwise.
- Every page links `css/style.css`; case-study pages also link
  `css/case-study.css`. All pages load `js/main.js` at the end of `<body>`.
- Fonts come from Google Fonts: **Space Grotesk** (display), **Inter** (body),
  **Noto Sans Thai** (Thai). Do not swap these without asking.
- Target browsers: current evergreen desktop + mobile Safari/Chrome.
  `:has()` is used in one place (see §5) — that is acceptable.

## 2. File map

```
index.html                 home: hero, photo marquee, about, skills, work grid, experience, contact
work/pos.html              case study 01 — Canteen & Restaurant POS
work/design-system.html    case study 02 — Design System / token architecture
work/insurance.html        case study 03 — HR Insurance Lookup System
work/easy-parking.html     case study 05 — Easy Parking (the most developed one)
css/style.css              base tokens + home page
css/case-study.css         everything prefixed .cs-* (case-study pages)
js/main.js                 all behaviour, one IIFE, six init functions
assets/                    avatar, CV, work thumbnails
assets/photos/             owner photos (marquee, About stack, Contact background)
assets/case-studies/       deck exports used inside case studies
assets/pdf/                one downloadable PDF per case study
assets/video/              looping prototype clips + their poster frames
tools/build_flow_clip.py   generates the clips in assets/video/ (see §7)
```

Card 04 in the work grid is **Taletails**, which links out to
`https://taletails-trade.com` — it has no local case-study page.

## 3. Bilingual system (important)

The site is EN/TH and switches **without reloading**. Every translatable element
carries both strings as attributes and the visible text is whatever language is
active:

```html
<span data-en="Download PDF" data-th="ดาวน์โหลด PDF">Download PDF</span>
```

`applyLang()` in `js/main.js` walks `[data-en]` and writes
`el.innerHTML = el.getAttribute(lang === "th" ? "data-th" : "data-en")`, sets
`<html data-lang>` and `lang`, and stores the choice in `localStorage` under
`jeeno-portfolio-lang`.

Rules when adding markup:

- **Any user-visible string needs both `data-en` and `data-th`.** A string with
  only English will still show English after switching to Thai, which reads as a
  bug.
- Because the swap writes `innerHTML`, never put child elements inside a
  translatable element — they get destroyed on the first language switch. Wrap
  the text in its own `<span data-en data-th>` and keep siblings outside it.
- Escape `&` `<` `>` inside the attributes (`&amp;`, `&quot;`).
- Thai copy should read as Thai, not as a literal translation of the English.

## 4. Case-study page anatomy

All four case studies follow the same spine, numbered in both the HTML comment
and the visible `.cs-section-label`:

```
HERO (.cs-hero-card)  eyebrow · title · tagline · meta grid · note · PDF button
01 Overview
02 Research / Problem
03 Voice of the user (quotes)
04 Persona
05 Empathy map          (Easy Parking only)
06 User journey
07 Design process
08 Product walkthrough  (screens, plus clips on Easy Parking)
09 Design system
10 Results
CTA (.cs-cta-card)
```

Numbers are sequential per page — **if you insert a section, renumber the ones
below it in the comment, the label text, and the `data-th` label.**

Component classes worth knowing (all in `css/case-study.css`):

| class | what it is |
|---|---|
| `.cs-shot` / `.cs-shot-full` | framed screenshot, full-width variant |
| `.cs-demo` | looping clip + heading + `.cs-demo-steps` numbered list |
| `.cs-hero-card.has-media` | two-column hero: copy left, clip right |
| `.cs-ps-grid` | problem / solution card pair (`.is-solution` = dark card) |
| `.cs-process` `.is-four` | 3- or 4-step process row |
| `.cs-empathy-row` `.is-two` | empathy map; `.is-pain` red, `.is-gain` green |
| `.cs-results` `.is-four` | outcome stat cards |
| `.cs-quote-row` | dark quote cards |

## 5. Home page work cards

Each card is one `<a class="work-card">` wrapping a thumbnail and a body. The
body ends with an explicit call to action:

```html
<span class="work-cta">
  <span data-en="Read case study" data-th="อ่านเคสสตัดี้">Read case study</span>
  <span class="work-cta-arrow">&#8594;</span>
</span>
```

On hover the card lifts, the CTA underline sweeps in from the left, and the
arrow nudges right.

The Easy Parking card additionally has a **motion preview**: a `<video
class="work-video">` layered over the thumbnail plus a `.work-preview-badge`
("Live preview"). `initWorkPreview()` plays it on `pointerenter` on devices that
report `(hover: hover)`, and on touch devices plays it via `IntersectionObserver`
whenever the card is 45% on screen. While the clip is visible, the index pill
fades out — that is the `:has(.work-video)` rule in
`css/style.css`. **This pattern is meant to be extended to the other cards once
their clips exist.**

## 6. PDF downloads — read this before touching the download button

Each case study hero has:

```html
<a href="../assets/pdf/<name>.pdf" class="btn btn-dark cs-pdf-download"
   data-filename="Easy-Parking-Case-Study.pdf" download>
```

On the real deployed site this is a plain download link and works natively.

It is also previewed inside a **claude.ai Artifact**, whose sandboxed iframe
refuses plain `<a download>` links and shows "File downloads aren't available for
this artifact." `initPdfDownload()` handles that: it only binds a click handler
when `window.claude.use` exists, then fetches the PDF and hands it to
`window.claude.downloads.save({filename, data})`. On the deployed site the
handler never binds and the browser does its normal thing.

Consequences:

- Keep the `cs-pdf-download` class and the `data-filename` attribute on those
  links.
- Do not "simplify" `initPdfDownload()` away — it looks like dead code locally.
- The Artifact must keep its `downloads` capability declared when republished.

`assets/pdf/easy-parking-case-study.pdf` was supplied by the owner and had to be
compressed from 19 MB to 11.5 MB to fit the Artifact's 16 MB per-file cap
(images re-encoded to JPEG q70, max 1400px, including their `/SMask` alpha
channels). Do not re-expand it.

## 7. Prototype clips (assets/video/)

`tools/build_flow_clip.py` turns a deck export of side-by-side phone screens
into a looping walkthrough: the phone frame stays fixed, the screen content
pushes in from the right, and a tap ripple fires just before each transition.
Read the docstring at the top of that file before extending it — the awkward
parts (masking the slide background off the phone, locating the inner screen
rect) are documented there.

Shipped clips:

| file | used by |
|---|---|
| `ep-flow.mp4` | hero of `work/easy-parking.html` |
| `ep-payment.mp4` | `.cs-demo` in section 08 of the same page |
| `ep-card.mp4` | hover preview on the Easy Parking home-page card |

Each has a matching `-poster.jpg` first frame.

Conventions: **MP4, not GIF, on the site** — same clip is ~10x smaller and
sharper (115–183 KB vs ~2 MB). Always `autoplay loop muted playsinline` plus a
`poster`, and always an `aria-label` describing the flow, because the clip
carries real content. GIFs are exported only when the owner wants one to paste
into Behance, LINE or email.

## 8. Deployment

GitHub repo `jeenosupalerk/jeeno-portfolio` → Vercel project `supalerk-portfolio`.

**The repo currently nests the site one level deep** (`jeeno-portfolio/index.html`
rather than `index.html`) because the folder was uploaded whole through the
GitHub web UI. Vercel's **Root Directory** is therefore set to `jeeno-portfolio`
under Settings → Build and Deployment. Either keep that arrangement, or flatten
the repo *and* clear the Root Directory setting in the same change — doing one
without the other 404s the site.

There is also a live preview published as a claude.ai Artifact. Republishing it
is done from the Cowork session that owns it, not from here.

## 9. Open work

1. **Clips for the remaining three case studies.** Easy Parking is the only page
   with motion. POS needs a browser-chrome frame rather than a phone frame;
   Design System is better served by cycling a component through
   Default → Hover → Focus → Disabled than by a screen push. Once a project has
   a 4:3 clip, give its home-page card the same hover preview as Easy Parking.
2. **A visual-first hero direction.** The owner likes
   [BC Parks by Allison Chan](https://www.chanallison.com/work/bc-parks) — full-bleed
   contextual photography, very large light type, device mockups composited into
   real scenes, video instead of stills, and "design strategies" replacing the
   research sections. The agreed plan is a **hybrid**: adopt that presentation
   while keeping the research blocks (persona, empathy map, journey) in a more
   compact form, because those are what UX recruiters read. This is blocked on
   the owner supplying assets: hero photography, product logos on transparent
   PNG, contextual device mockups, and screen recordings.
3. **Consistency pass** once more clips land — the work cards should not be half
   animated and half static.

## 10. Working preferences

- The owner is a designer, not a developer, and works in Thai. Explain changes in
  plain language and say where things are on screen, not which selector changed.
- Deliverables go out as a zip of this folder plus, when relevant, the individual
  files that changed.
- Prefer building components natively (cards, grids, type) over pasting deck
  screenshots as flat images. Screenshots are for actual product UI only.
- **Color (changed 2026-09-25 at the owner's request).** The home page moved
  from monochrome to a palette pulled from the owner's own photos, defined as
  tokens at the top of `css/style.css`: `--forest` (pine green, primary),
  `--leaf`, `--sunset` (amber), `--ember` (orange), `--mist-deep` (teal), on a
  warm `--paper` background. Layout style follows a Framer reference the owner
  picked (chonladda-portfolio.framer.website): pill labels, big tight headings,
  soft rounded cards, a snapshot marquee, a black footer. Use those tokens —
  don't invent new hues. Case-study pages still keep monochrome content cards;
  only the shared background changed there.
- Owner photos live in `assets/photos/` (resized to 1600px, q80): used in the
  hero marquee, the About polaroid stack (`initPhotoStack()`), and as the
  Contact card background.
- CSS/JS links carry a `?v=N` cache-buster. Bump it on every page whenever
  `style.css`, `case-study.css` or `main.js` changes, or returning visitors see
  a stale mix.
