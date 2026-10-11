# Weather forecast

A three-day weather forecast for any city, built with plain HTML, CSS and JavaScript (no build step, no dependencies). Created as a DEPI training project.

**Features**

- Search with live city suggestions (WeatherAPI `search.json`), debounced and cancellable
- Today's conditions plus the next two days, with rain chance, wind and "feels like"
- °C / °F toggle (no extra request: both units come back in the same response)
- Remembers your last city and unit between visits
- "Use my location" button (asks for permission only when clicked)
- Loading indicator, plain-language error messages, and a saved-forecast fallback when the network fails
- Keyboard accessible (combobox pattern for search), screen-reader labels, visible focus, reduced-motion support, AA contrast

## Project structure

```
index.html
favicon.svg
css/style.css
js/app.js               application code
js/config.example.js    safe template, committed
js/config.js            your real key, NOT committed (see .gitignore)
assets/                 images and touch icon
.github/workflows/      optional GitHub Pages deploy
```

## Run locally

1. Get a free API key at <https://www.weatherapi.com/>.
2. Create your local config:
   ```bash
   cp js/config.example.js js/config.js
   ```
   Open `js/config.js` and replace `YOUR_API_KEY_HERE` with your key.
3. Serve the folder (opening `index.html` directly also works, but a server matches production):
   ```bash
   python3 -m http.server 8000
   ```
   Then visit <http://localhost:8000>.

If the key is missing, the page tells you what to do instead of failing silently.

## API key safety (read this before deploying)

**Rotate the old key.** An earlier version of this project hard-coded a key in `js/script.js`, and it is still visible in the repository's git history. Revoke or regenerate it in the WeatherAPI dashboard. Deleting the file is not enough, because anyone can read old commits.

**What `.gitignore` does and does not do.** Ignoring `js/config.js` keeps the key out of your repository. It does not hide the key on a live site: any key used by browser-side JavaScript can be read by visitors in DevTools. For a free-tier key on a portfolio demo that is an accepted trade-off, but treat the key as public and disposable. Check your WeatherAPI dashboard for any usage limits or restrictions your plan offers.

**Keeping the key private (no code changes needed in this app).** Put a tiny proxy in front of WeatherAPI and keep the key there:

1. Create a serverless function (Cloudflare Workers, Netlify Functions, Vercel Functions) that forwards `GET /v1/search.json` and `GET /v1/forecast.json` to `https://api.weatherapi.com/v1/...`, adding `key=<secret>` from an environment variable. Restrict it to those two paths and to your site's origin.
2. In `js/config.js`, set `API_BASE` to the proxy URL and leave `API_KEY` empty. The app then sends no key at all.
3. Add the proxy's origin to `connect-src` in the Content-Security-Policy `<meta>` tag in `index.html`.

Using a bundler such as Vite with `.env` files is a different story: variables prefixed `VITE_` are inlined into the shipped JavaScript, so they are just as visible as `config.js`. Only a server-side proxy truly hides the key.

## Deploy

**GitHub Pages (included workflow)**

1. In the repository: Settings, Secrets and variables, Actions, add a secret named `WEATHER_API_KEY`.
2. Settings, Pages, set Source to "GitHub Actions".
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` writes `js/config.js` from the secret and publishes the site. The key will be visible in the deployed JavaScript (see above).

**Netlify / Vercel / any static host.** Publish the folder as-is, and generate `js/config.js` in the build step from an environment variable, or use the proxy approach above.

## Adding it to your portfolio (MVP)

1. Rotate the old key, add the new one locally in `js/config.js`.
2. Commit this version and deploy with one of the options above.
3. Link the live URL and the repo from your portfolio, with a short description and a screenshot. Mention what you handled: request cancellation, debouncing, error states, accessibility.

**Later, if you want to go further:** hourly forecast strip, chart of the three days, favourites list, geolocation on first visit (after explaining why), a proper `og:image` for link previews, localisation of dates and condition text, unit tests for `normalize()` and the formatters, and the serverless proxy.

## Credits

Weather data from [WeatherAPI.com](https://www.weatherapi.com/). Background photo from the original project.
