# Deployment Guide

This document describes how to deploy the LLM Toolkit to https://llm.effnine.dev using Cloudflare Pages.

## Prerequisites

- GitHub account
- Cloudflare account with Pages access
- Domain `effnine.dev` managed in Cloudflare
- Git installed locally

## Repository Structure

```
llm-toolkit/
├── index.html              # Homepage
├── 404.html                # Not found page
├── _headers                # Cloudflare security headers
├── _redirects              # URL redirects
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── site.webmanifest        # PWA manifest
├── favicon.svg             # Site icon
├── css/                    # 8 stylesheets
├── js/                     # 12 ES module scripts
├── data/                   # 11 JSON data files
├── pages/                  # 20 HTML pages
└── projects/               # 6 project directories
```

## Step 1: Push to GitHub

```bash
cd /home/afnan/projects/active/llm-toolkit
git add .
git commit -m "chore: v0.1.0 release"
git tag v0.1.0
git push origin main --tags
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
3. Test navigation between all 20 pages
4. Verify search works (press `/`)
5. Test mobile layout (resize browser to 375px, 768px)
6. Check 404 page (`https://llm.effnine.dev/nonexistent`)
7. Verify HTTPS is active (lock icon)
8. Test interactive tools:
   - VRAM Calculator: fill form, click Calculate, verify breakdown
   - Hardware: select a GPU, verify profile panel populates
   - Training: click a decision branch, verify recommendation shows
   - Roadmap: complete wizard, verify roadmap generates
   - Search: press `/`, type 2+ chars, verify results appear

## Step 5: Verify Assets

- [ ] All 8 CSS files load
- [ ] All 12 JS modules load (check DevTools console for errors)
- [ ] Google Fonts load (Inter + JetBrains Mono)
- [ ] Favicon displays
- [ ] Search modal opens with `/` key
- [ ] All 20 pages return HTTP 200
- [ ] 404 page returns HTTP 404 for unknown paths
- [ ] All JSON data files are valid

## Security Headers

The `_headers` file configures these Cloudflare Page Rules headers:

- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` — XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` — referrer control
- `Cache-Control: public, max-age=3600` — 1-hour cache for static assets

SPA routing is handled by:
- `/* /index.html 200` — client-side router handles all paths

## Continuous Deployment

Every push to `main` branch triggers an automatic rebuild and deployment. No manual intervention needed.

## Rollback

In Cloudflare Pages:
1. Go to **Deploys** tab
2. Find the previous working deployment
3. Click **Promote to production**

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

### Pages not found after deploy
- Verify `_redirects` and `_headers` are at repository root
- Cloudflare Pages requires these files at the deploy root (`./`)
