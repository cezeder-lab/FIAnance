const { net } = require('electron');

const SYMBOL_RE = /^[A-Za-z0-9.^=-]{1,20}$/;
const TIMEOUT_MS = 10000;

function parseChart(symbol, status, body) {
  const meta = body && body.chart && body.chart.result && body.chart.result[0] && body.chart.result[0].meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') {
    if (status === 404 || (body && body.chart && body.chart.error)) return { ok: false, error: `Symbole introuvable : ${symbol}` };
    return { ok: false, error: `Cours indisponible pour ${symbol} (HTTP ${status}).` };
  }
  return {
    ok: true,
    quote: {
      symbol: meta.symbol || symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency || null,
      time: typeof meta.regularMarketTime === 'number' ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      exchange: meta.fullExchangeName || meta.exchangeName || null,
      name: meta.longName || meta.shortName || null,
    },
  };
}

// Only the symbol leaves the machine, and only when the user asks for a refresh.
async function fetchQuote(symbol) {
  if (typeof symbol !== 'string' || !SYMBOL_RE.test(symbol)) return { ok: false, error: 'Symbole invalide.' };
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await net.fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return parseChart(symbol, res.status, body);
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: 'Délai dépassé : Yahoo Finance ne répond pas.' };
    return { ok: false, error: `Connexion impossible (${err && err.message ? err.message : 'erreur réseau'}).` };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchQuote, parseChart };
