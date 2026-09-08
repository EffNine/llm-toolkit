# Deployment Guide

This document describes how to deploy the LLM Toolkit to https://llm.effnine.dev using Cloudflare Pages.

## Prerequisites

- GitHub account
- Cloudflare account with Pages access
- Domain `effnine.dev` managed in Cloudflare

## Step 1: Push to GitHub

```bash
cd /home/afnan/projects/active/llm-toolkit
git init
git add .
git commit -m "chore: initialize llm toolkit"
git branch -M main
git remote add origin https://github.com/EffNine/llm-toolkit.git
git push -u origin main
```

## Step 2: Connect to Cloudflare Pages

1. Log into Cloudflare Dashboard
2. Go to **Pages** → **Create a project** → **Connect to Git**
3. Select the `EffNine/llm-toolkit` repository
4. Configure build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty — no build needed)
   - **Build output directory**: `.` (root)
   - **Root directory**: `/`
5. Click **Save and Deploy**

## Step 3: Configure Domain

1. In Pages project settings, go to **Domains**
2. Click **Set up a production domain**
3. Enter `llm.effnine.dev`
4. Cloudflare should auto-configure DNS. Verify:
   - CNAME `llm` → `<project-name>.pages.dev`
   - or A record if using root domain

## Step 4: Verify Deployment

After deployment completes:

1. Visit https://llm.effnine.dev
2. Check that homepage loads
3. Test navigation between pages
4. Verify search works (press `/`)
5. Test mobile layout (resize browser)
6. Check 404 page (`https://llm.effnine.dev/nonexistent`)
7. Verify HTTPS is active (lock icon)

## Step 5: Verify Assets

- [ ] All CSS files load
- [ ] JavaScript modules load (check DevTools console for errors)
- [ ] Google Fonts load
- [ ] Favicon displays
- [ ] Search modal opens with `/` key

## Troubleshooting

### Site shows 404 for all pages
- Ensure `_headers` file is at repository root
- Check Cloudflare Pages deployment logs
- Verify all HTML files are in the repo root

### CSS not loading
- Check that CSS files are committed and not ignored
- Verify file paths in HTML `<link>` tags match actual paths

### JavaScript errors in console
- Check module import paths are correct
- Verify all JS files are committed
- Test locally first: `npx serve .`

### Custom domain not resolving
- Verify DNS records in Cloudflare DNS panel
- Ensure the domain is added to your Cloudflare account
- Check that Pages is proxied (orange cloud) for SSL

## Security Headers

The `_headers` file configures these Cloudflare Page Rules headers:

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Cache-Control: public, max-age=3600` — 1-hour cache for static assets

## Continuous Deployment

Every push to `main` branch triggers an automatic rebuild and deployment. No manual intervention needed.

## Rollback

In Cloudflare Pages:
1. Go to **Deploys** tab
2. Find the previous working deployment
3. Click **Promote to production**
