# 🚀 Deployment Guide

## Choose Your Platform

| Platform | Setup | Speed | Free Tier |
|----------|-------|-------|-----------|
| **Netlify** | Easy | Fast | 100k req/mo |
| **Vercel** | Easy | Faster | 100k req/mo |

---

## Option A: Deploy to Netlify

### 1. Setup
```bash
npm install
copy .env.example .env     # Edit with your API key
```

### 2. Build & Deploy
```bash
npm run build:production
npx netlify link
npx netlify deploy --prod
```

---

## Option B: Deploy to Vercel

### 1. Setup
```bash
npm install
copy .env.example .env.local   # Vercel uses .env.local
```

### 2. Deploy
```bash
npx vercel --prod
```
When prompted, set environment variable `GEMINI_API_KEY`.

---

## Build Commands

| Command | Result |
|---------|--------|
| `npm run build` | Copy to dist/ |
| `npm run build:minify` | + Minify JS |
| `npm run build:obfuscate` | + Obfuscate JS |
| `npm run build:production` | Both (recommended) |

---

## File Structure
```
d:\student\
├── .env.example          # Template
├── .env / .env.local     # Your secrets (NEVER commit!)
│
├── netlify.toml          # Netlify config
├── netlify/functions/    # Netlify serverless
│   └── gemini-proxy.js
│
├── vercel.json           # Vercel config
├── api/                  # Vercel serverless
│   └── gemini.js
│
├── package.json          # Build scripts
├── build.js              # Minify/obfuscate
└── dist/                 # Production output
```

---

## API Endpoint (Works on Both)
```javascript
fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'chat',  // or 'vision'
        prompt: 'Hello!'
    })
});
```
