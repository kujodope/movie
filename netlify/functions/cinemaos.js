const UPSTREAM = 'https://cinemaos.live';
const PREFIX = '/.netlify/functions/cinemaos';

function upstreamPath(event) {
  const path = event.path || '/';
  const withoutFunction = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : path;
  const withoutProxyPrefix = withoutFunction.startsWith('/cinemaos')
    ? withoutFunction.slice('/cinemaos'.length)
    : withoutFunction;
  return withoutProxyPrefix || '/';
}

function rewriteHtml(html, token) {
  const tokenScript = `<script>localStorage.setItem("febbox_ui_token", ${JSON.stringify(token)});</script>`;
  return rewriteProxyPaths(html)
    .replace('</head>', `${tokenScript}</head>`);
}

function rewriteProxyPaths(text) {
  return text
    .replace(/(src|href)="\/(?!\/)/g, '$1="/cinemaos/')
    .replace(/(["'])\/api\//g, '$1/cinemaos/api/');
}

exports.handler = async (event) => {
  const token = process.env.FEBBOX_TOKEN || '';
  const target = new URL(upstreamPath(event), UPSTREAM);

  const response = await fetch(target, {
    headers: {
      accept: event.headers?.accept || '*/*',
      'user-agent': event.headers?.['user-agent'] || 'SanuFlix CinemaOS proxy',
    },
  });

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const isText = contentType.includes('text/html') || contentType.includes('javascript');
  const body = isText
    ? (contentType.includes('text/html')
      ? rewriteHtml(await response.text(), token)
      : rewriteProxyPaths(await response.text()))
    : Buffer.from(await response.arrayBuffer()).toString('base64');

  return {
    statusCode: response.status,
    isBase64Encoded: !isText,
    headers: {
      'content-type': contentType,
      'cache-control': contentType.includes('text/html') ? 'no-store' : 'public, max-age=300',
    },
    body,
  };
};