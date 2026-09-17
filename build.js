const fs = require('fs');
const path = require('path');

const APK_DIR = path.join(__dirname, 'apk');
const OUTPUT = path.join(__dirname, 'index.json');

const EXTERNAL_LINKS = {
  'Seena-1.7.3.apk': 'https://www.seena.su/',
};

const NOISE = /\b(?:release|general|client|beta|alpha|rc|debug|nightly|stable|final|prod)\b/gi;

const OVERRIDES = {
  'KinoTrend-2.3.8.apk': { name: 'Kino Trend', version: '2.3.8' },
  'TorrServe_MatriX.142.Client-release.apk': { name: 'TorrServe MatriX', version: '142' },
  'VK_Video_(AndroidTV)_(RS)_v.2.115(67691)(9.0-16.0)(arm7a,arm64-8a).apk': { name: 'VK Video', version: '2.115' },
};

function parseApkName(filename) {
  if (OVERRIDES[filename]) return { ...OVERRIDES[filename] };
  // ... rest of parser
  let raw = filename.replace(/\.apk$/i, '');
  let version = '';

  // Phase 1: known version prefixes
  const prefixes = [
    /[-_.\s]ver[-_.\s]?(\d[\d.]*\d)/i,
    /[-_.\s]v\.(\d[\d.]*\d)/i,
    /\.release\.(\d[\d.]*\d)/i,
  ];
  for (const re of prefixes) {
    const m = raw.match(re);
    if (m) { version = m[1]; raw = raw.replace(re, ' '); break; }
  }

  // Strip parens and noise words
  raw = raw.replace(/\([^)]*\)/g, ' ');
  raw = raw.replace(NOISE, ' ');
  raw = raw.replace(/\s+/g, ' ').trim();
  // Strip trailing separators thoroughly for clean version detection
  raw = raw.replace(/[._\-\s]+$/, '');

  // Phase 2: trailing version while dots intact
  if (!version) {
    const m = raw.match(/[-_.\s](\d[\d.]*\d)$/);
    if (m) {
      const parts = m[1].split('.');
      const allDigits = parts.every(p => /^\d+$/.test(p));
      let accept = false;
      if (allDigits) {
        if (parts.length >= 2) accept = true;
        else if (m[1].length <= 4 && parseInt(m[1]) >= 10) accept = true;
      }
      if (accept) { version = m[1]; raw = raw.slice(0, m.index); }
    }
  }

  // Phase 3: remove version from raw
  if (version) {
    const esc = version.replace(/\./g, '\\.');
    raw = raw.replace(new RegExp('[-_.\\s]*' + esc + '[-_.\\s]*'), ' ');
  }

  // Phase 4: final cleanup
  raw = raw.replace(/[_]+/g, ' ');
  raw = raw.replace(/[.]+/g, ' ');
  raw = raw.replace(/-+/g, ' ');
  raw = raw.replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase
  raw = raw.replace(/\s+/g, ' ').trim();
  raw = raw.replace(/\s+\d{5,}$/, '');
  raw = raw.replace(/[-\s]+$/, '').replace(/^[-\s]+/, '');
  raw = raw.replace(/\s+/g, ' ').trim();

  // Capitalize
  raw = raw.replace(/\b\w/g, c => c.toUpperCase());
  raw = raw.replace(/\bTv\b/g, 'TV');
  raw = raw.replace(/\bAtv\b/g, 'ATV');
  raw = raw.replace(/\bRs\b/g, 'RS');
  raw = raw.replace(/\bTV\s+TV\b/, 'TV');

  return { name: raw || filename.replace(/\.apk$/i, ''), version };
}

function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(mb >= 100 ? 0 : 1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function buildIndex() {
  const files = fs.readdirSync(APK_DIR).filter(f => f.toLowerCase().endsWith('.apk')).sort();
  const apps = files.map(file => {
    const extUrl = EXTERNAL_LINKS[file] || null;
    const st = extUrl ? null : fs.statSync(path.join(APK_DIR, file));
    const p = parseApkName(file);
    return {
      file, name: p.name, version: p.version,
      sizeBytes: extUrl ? 0 : st.size,
      size: extUrl ? 'внешний' : formatSize(st.size),
      modified: extUrl ? '' : st.mtime.toISOString(),
      url: extUrl || ('apk/' + encodeURIComponent(file)),
      external: !!extUrl,
    };
  });
  const maxSize = Math.max(...apps.filter(a => !a.external).map(a => a.sizeBytes), 1);
  const idx = { total: apps.length, updated: new Date().toISOString(), maxSizeBytes: maxSize, apps };
  fs.writeFileSync(OUTPUT, JSON.stringify(idx, null, 2));
  console.log('✓ index.json — ' + apps.length + ' apps');
  apps.forEach(a => console.log('  ' + a.size.padEnd(8) + ' ' + (a.version ? 'v' + a.version : '').padEnd(14) + ' ' + a.name + (a.external ? ' [link]' : '')));
}

buildIndex();