# llm-toolkit

Interactive LLM Training & Engineering Toolkit — a production-quality static website for learning and building Large Language Models.

**Production URL:** https://llm.effnine.dev

## Overview

This toolkit helps users go from zero knowledge to production LLM engineering through:

- **Structured curriculum** — 50+ topics from Linux basics to distributed training
- **Personalized roadmaps** — Wizard generates paths based on experience, goal, and hardware
- **Interactive calculators** — VRAM estimator, training planner, hardware compatibility
- **GPU database** — Structured specifications with training suitability ratings
- **Decision trees** — Training method selector, troubleshooting flow
- **Hands-on projects** — 6 project paths from tiny LM to distributed training
- **Local progress tracking** — No account required, stored in localStorage

## Architecture

```
llm-toolkit/
├── index.html              # Homepage
├── 404.html                # Not found page
├── robots.txt              # SEO
├── sitemap.xml             # SEO
├── _headers                # Cloudflare security headers
├── _redirects              # URL redirects
├── favicon.svg             # Site icon
├── site.webmanifest        # PWA manifest
│
├── css/                    # Stylesheets
│   ├── tokens.css          # Design tokens (colors, typography, spacing)
│   ├── reset.css           # CSS reset
│   ├── layout.css          # Base layout styles
│   ├── navigation.css      # Sidebar + top nav
│   ├── components.css      # Reusable UI components
│   ├── planner.css         # Planner-specific styles
│   ├── learning.css        # Learning system styles
│   └── responsive.css      # Breakpoints
│
├── js/                     # JavaScript modules (ES modules)
│   ├── app.js              # App bootstrap
│   ├── storage.js          # localStorage wrapper + progress
│   ├── router.js           # Client-side routing
│   ├── navigation.js       # Sidebar rendering
│   ├── search.js           # Command palette search
│   ├── learning.js         # Lesson system
│   ├── planner.js          # Roadmap wizard
│   ├── calculator.js       # VRAM calculator
│   ├── hardware.js         # GPU database
│   └── router.js           # Navigation logic
│
├── data/                   # Structured knowledge (JSON)
│   ├── topics.json         # Curriculum topics
│   ├── gpus.json           # GPU specifications
│   ├── gpu-architectures.json
│   ├── models.json         # Model database
│   ├── projects.json       # Hands-on projects
│   ├── training-methods.json
│   ├── evaluation-methods.json
│   ├── frameworks.json
│   ├── optimizers.json
│   ├── schedulers.json
│   └── distributed-methods.json
│
├── pages/                  # Site pages
│   ├── learn.html
│   ├── roadmap.html
│   ├── planner.html
│   ├── hardware.html
│   ├── calculator.html
│   ├── training.html
│   ├── evaluation.html
│   ├── scaling.html
│   ├── inference.html
│   ├── deployment.html
│   ├── troubleshooting.html
│   ├── projects.html
│   ├── models.html
│   └── reference.html
│
└── projects/               # Project detail stubs
    ├── tiny-lm/
    ├── 10m-transformer/
    ├── 100m-llm/
    ├── 1b-finetuning/
    ├── 7b-qlora/
    └── distributed-training/
```

## Local Development

No build step required. The site is pure static HTML/CSS/JS.

```bash
# Serve locally
npx serve .

# Or with Python
python3 -m http.server 8080

# Then open http://localhost:8080
```

## Data Model

### Topic
```json
{
  "id": "bf16",
  "title": "BF16",
  "category": "precision",
  "difficulty": "L2",
  "prerequisites": ["floating-point"],
  "related": ["fp16", "fp32", "fp8"],
  "estimatedTime": "~3h",
  "summary": "...",
  "sections": {
    "beginner": "...",
    "intermediate": "...",
    "advanced": "...",
    "deepdive": "..."
  }
}
```

### GPU
```json
{
  "id": "nvidia-h100",
  "name": "H100 SXM",
  "vendor": "NVIDIA",
  "architecture": "Hopper",
  "vram": 80,
  "memoryType": "HBM3",
  "memoryBandwidth": 3350,
  "computeCapability": "9.0",
  "bf16Support": true,
  "fp8Support": true,
  "trainingSuitability": "recommended",
  "source": "https://...",
  "lastVerified": "2025-01-15"
}
```

## How to Add Content

### Add a Topic
Edit `data/topics.json` and add an entry. Then it appears automatically in the learn system.

### Add a GPU
Edit `data/gpus.json`. Only add GPUs you can verify. Use `VERIFY` for uncertain specs.

### Add a Model
Edit `data/models.json`. Include source URL and last verified date.

### Add a Project
Edit `data/projects.json`. Include all fields for the best experience.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full Cloudflare Pages setup instructions.

Quick summary:
1. Push to GitHub repository `EffNine/llm-toolkit`
2. Connect to Cloudflare Pages
3. Set production branch to `main`
4. Deploy
5. Add `llm.effnine.dev` as custom domain

## Quality Standards

- All technical claims include source URLs
- Uncertain specs marked as `VERIFY` rather than fabricated
- No placeholder content (Lorem ipsum)
- Beginner explanations before advanced details
- Mobile-responsive on all pages
- Keyboard accessible
- No framework dependencies — pure vanilla JS

## License

Private project. Content may be reused with attribution.
