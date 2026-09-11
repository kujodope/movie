
<div align="center">
  <img src="assets/gedatv-banner.svg" alt="GedaTv" />
</div>
<br/>

**GedaTv** is a movie and TV show streaming website powered by the TMDB API.
It lets users discover movies and TV shows and stream them directly within the website.

## Features

- 🔍 Search movies and TV shows from TMDB
- 📄 View details such as title, release date, and poster
- ▶️ Stream directly within GedaTv
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

### Quick deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy from the project root
netlify deploy --prod --dir .
```

## Tech Stack

- HTML, CSS, JavaScript
- [TMDB API](https://developers.themoviedb.org/)
- [Netlify](https://www.netlify.com/) (hosting)
