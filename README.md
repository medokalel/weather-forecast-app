# Weather Forecast

A three-day weather forecast for any city, built with plain HTML, CSS and JavaScript (no framework, no dependencies). Created as a DEPI training project.

**Live demo:** https://weather-forecast-app.vercel.app

## Features

- City search with live suggestions (WeatherAPI `search.json`), debounced and cancellable
- Today's conditions plus the next two days: rain chance, wind and "feels like"
- °C / °F toggle with no extra request (both units come back in the same response)
- Remembers your last city and unit between visits
- "Use my location" button (the browser only asks for permission when you click it)
- Loading state, plain-language error messages, and a saved-forecast fallback when the network fails
- Keyboard accessible (combobox pattern for search), screen-reader labels, visible focus, reduced-motion support

## Built with

HTML5, CSS3 and vanilla JavaScript (ES2015+), with [WeatherAPI.com](https://www.weatherapi.com/) as the data source. Deployed on Vercel.

## Project structure

```
index.html
favicon.svg
css/style.css
js/app.js               application code
js/config.example.js    template for the local config (committed)
js/config.js            your real key, NOT committed (see .gitignore)
assets/                 images and touch icon
```

## Run locally

1. Get a free API key at <https://www.weatherapi.com/>.
2. Create your local config and paste your key into it:
   ```bash
   cp js/config.example.js js/config.js
   ```
3. Serve the folder:
   ```bash
   python3 -m http.server 8000
   ```
   Then open <http://localhost:8000>.

If the key is missing, the page tells you what to do instead of failing silently.

## Deploy on Vercel

`js/config.js` is not committed, so the deployment generates it during the build from an environment variable:

1. Import the repository in Vercel. Set the preset to **Other** and the output directory to `public`.
2. Set the build command to:
   ```bash
   mkdir -p public && cp -r index.html favicon.svg css js assets public/ && printf 'window.WEATHER_CONFIG = { API_KEY: "%s", API_BASE: "https://api.weatherapi.com/v1", DEFAULT_CITY: "Cairo" };\n' "$WEATHER_API_KEY" > public/js/config.js
   ```
3. Add an environment variable `WEATHER_API_KEY` with your key, then deploy.

## About the API key

This is a front-end-only app, so any key it uses can be read by visitors in the browser's DevTools, even though it is not in the repository. Use a free-tier key that is cheap to replace, and regenerate it from the WeatherAPI dashboard if it ever leaks.

To keep the key truly private, put a small serverless proxy in front of WeatherAPI that adds the key on the server. Then set `API_BASE` in `js/config.js` to the proxy URL, leave `API_KEY` empty, and add the proxy origin to `connect-src` in the Content-Security-Policy `<meta>` tag in `index.html`.

An earlier version of this project hard-coded a key in its first commit. That key is revoked; the history is kept as is.

## Credits

Weather data from [WeatherAPI.com](https://www.weatherapi.com/). Background photo from the original project.
