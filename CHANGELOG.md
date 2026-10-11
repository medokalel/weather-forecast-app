# Changelog

## 2.0.0: portfolio-ready rewrite

### Fixed
- **Leaked API key**: removed the hard-coded key from `script.js`; the key now comes from `js/config.js` (gitignored). The old key must still be revoked, because it remains in git history.
- **Missing `config.js`**: `index.html` loaded a file that did not exist. A template (`config.example.js`) now ships, and a missing key shows a setup message instead of a broken page.
- **Request on every keystroke**: typing 3+ characters used to fetch a full forecast per key press. Typing now fetches debounced city suggestions only; the forecast loads when you pick a city or press Search.
- **Race conditions**: older, slower responses could overwrite newer ones. Each request type now aborts its predecessor with `AbortController` (latest wins).
- **No error handling**: `response.ok`, WeatherAPI error codes, timeouts (10 s), non-JSON responses and malformed payloads are all handled, with friendly messages and a Try again button.
- **Silent crashes on bad data**: the API response is validated and reduced to a small model before rendering.
- **Wrong weekday/date**: `new Date("YYYY-MM-DD")` parsed as UTC and could show the previous day for some viewers; dates are now formatted without timezone shift.
- **Text rendering**: replaced `innerHTML` with `textContent` for all API data (XSS-safe); replaced the `<sup>o</sup>` hack with a real degree sign; API icon URLs are only accepted from `cdn.weatherapi.com`.
- **Rain chance and wind direction** were hard-coded ("20%", "East"); they now come from the data.
- **Contrast**: `#009AD8` text on card backgrounds was 3.8:1 and white-on-button 3.2:1. Text uses `#4CC3F0` (6.0:1) and buttons use `#0079AD` (4.8:1).

### Added
- Live search suggestions with debounce (300 ms), keyboard navigation and ARIA combobox semantics
- °C / °F toggle, persisted
- Last-city persistence, with instant paint from the saved forecast, then refresh
- "Use my location" button (replaces the permission prompt on page load)
- Loading state (busy bar, dimmed content, live-region announcement)
- Offline fallback: shows the last saved forecast with a clear warning
- Favicon (SVG) and Apple touch icon, description / Open Graph / Twitter meta tags, theme colour
- Content-Security-Policy meta tag, skip link, labelled controls, alt text from condition text, reduced-motion support
- `.gitignore`, `config.example.js`, README

### Changed
- Background photo: 12.6 MB PNG to 354 KB JPEG
- Single-file stylesheet rewritten with design tokens, grid layout and fewer breakpoints
- Fonts: system font stack (no Google Fonts request)
- Temperatures shown as whole numbers with a large numeral for today

### Removed
- Placeholder pages and content: `contact.html`, `css/contact.css`, dead nav links (News, Live cameras, Photo), fake subscribe form and social icons, lorem ipsum, "tagline goes here"
- Font Awesome (`css/all.min.css`, `webfonts/`): no longer used (about 400 KB)
- Unused images: `113.png`, `sun-cloud.png`, the original 3000 px photo
- `js/script.js` (replaced by `js/app.js`)
