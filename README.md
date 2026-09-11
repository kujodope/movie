
<div align="center">
  <img src="assets/gedatv-banner.svg" alt="SanuFlix" />
</div>
<br/>

**SanuFlix** is a movie and TV show streaming website powered by the TMDB API.
It lets users discover movies and TV shows and stream them directly within the website.

## Features

- 🔍 Search movies and TV shows from TMDB
- 📄 View details such as title, release date, and poster
- ▶️ Stream directly within SanuFlix
- 📡 Choose from multiple predefined streaming servers
- 🎯 Trending, Top 10, and Recently Digitally Released rows
- 📱 Fully responsive — works on desktop, tablet, and mobile
- ⌨️ Keyboard/D-pad navigation support

## Deployment (Netlify)

This site is a static HTML/CSS/JS project ready to deploy on **Netlify**.

### Setup

1. Connect your repository to Netlify
2. Set the **publish directory** to `.` (root) — this is already configured in `netlify.toml`
3. **Environment variable**: Replace `__TMDB_TOKEN__` in both `index.html` and `stream/index.html` with your [TMDB API Read Access Token](https://developer.themoviedb.org/)
4. **Febbox token**: Add a Netlify environment variable named `FEBBOX_TOKEN` containing your Febbox token. CinemaOS is proxied through the site so the token is initialized automatically on every device.

### Quick deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy from the project root
netlify deploy --prod --dir .
```

Set the secret before deploying:

```bash
netlify env:set FEBBOX_TOKEN "your-febbox-token"
```

## Tech Stack

- HTML, CSS, JavaScript
- [TMDB API](https://developers.themoviedb.org/)
- [Netlify](https://www.netlify.com/) (hosting)
