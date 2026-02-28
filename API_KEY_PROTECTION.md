# How to Protect Your Gemini API Keys

## Problem
Keys are visible in client-side code (base64 encoded in index.html), but we need to prevent abuse.

## Solution: API Key Restrictions

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/apis/credentials
2. Find your Gemini API keys

### Step 2: Set HTTP Referrer Restrictions
For each API key, click "Edit" and set:

**Application Restrictions:**
- Select: "HTTP referrers (web sites)"
- Add these referrers:
  ```
  https://bunkitapp.in/*
  https://*.bunkitapp.in/*
  http://localhost:*/*
  ```

### Step 3: Set API Restrictions
**API restrictions:**
- Select: "Restrict key"
- Choose only: "Generative Language API"

### Step 4: Set Quota Limits (Optional but Recommended)
1. Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Set daily limit: 10,000 requests/day per key
3. This prevents excessive usage even if someone bypasses referrer check

## Why This Works

✅ **Referrer restrictions** ensure key only works on your domain
✅ **API restrictions** ensure key can't be used for other Google services
✅ **Quota limits** prevent bill shock
✅ Even if someone copies the key from source code, it won't work on their domain

## Result
- Keys visible in code = OK ✅
- Keys can't be abused = Safe ✅
- Your bill stays under control = Protected ✅

## Multiple Keys Strategy
Use 3-5 keys with rotation:
- Each key: 10,000 requests/day
- Total: 30,000-50,000 requests/day for all users
- Automatic rotation when one key exhausted

---

**IMPORTANT:** After setting restrictions, test your keys on bunkitapp.in to ensure they work!
