# llm-toolkit

Interactive LLM Training & Engineering Toolkit — a production-quality static website for learning and building Large Language Models.

**Production URL:** https://llm.effnine.dev
**Version:** v0.1.0

## Overview

This toolkit helps users go from zero knowledge to production LLM engineering through:

- **Structured curriculum** — 71 topics from Linux basics to distributed training, with 4 depth levels (Beginner → Intermediate → Advanced → Deep Dive)
- **Personalized roadmaps** — Wizard generates paths based on experience, goal, hardware, time, and budget
- **Interactive calculators** — VRAM estimator, model architecture designer, token budget planner, inference memory calculator
- **GPU database** — 21 GPUs with specifications, precision support, and training suitability ratings
- **Model database** — 16 models with architecture details and hardware requirements
- **Decision trees** — Training method selector, scaling recommender, troubleshooting flow
- **Dataset planner** — Generate processing pipelines from collection to versioning
- **Evaluation planner** — Benchmark selection and regression tracking setup
- **Hands-on projects** — 6 project paths from tiny LM to distributed training
- **Local progress tracking** — No account required, stored in localStorage

## Tools

| Tool | URL | Description |
|------|-----|-------------|
| Learn | `/pages/learn.html` | 71-topic curriculum with progress tracking |
| Roadmap | `/pages/roadmap.html` | Personalized learning path builder |
| Training Planner | `/pages/planner.html` | Full training configuration with estimates |
| VRAM Calculator | `/pages/calculator.html` | Weight/gradient/optimizer/activation breakdown |
| Model Calculator | `/pages/model-calc.html` | Architecture design and reverse-engineering |
| Token Budget | `/pages/token-calc.html` | Steps calculation and scaling heuristics |
| Inference Memory | `/pages/inference-calc.html` | KV cache and total inference memory |
| Hardware | `/pages/hardware.html` | GPU database with filters and profiles |
| Training Methods | `/pages/training.html` | Decision tree + method reference |
| Data Planner | `/pages/data-planner.html` | Dataset pipeline generator |
| Evaluation Planner | `/pages/eval-planner.html` | Benchmark selection and tracking |
| Scaling | `/pages/scaling.html` | Distributed training strategy recommender |
| Inference | `/pages/inference.html` | Sampling strategies, KV cache, engines |
| Deployment | `/pages/deployment.html` | Serving patterns and quantization |
| Troubleshooting | `/pages/troubleshooting.html` | OOM, NaN, slow training, distributed failures |
| Projects | `/pages/projects.html` | 6 hands-on project guides |
| Models | `/pages/models.html` | 16-model specification database |
| Reference | `/pages/reference.html` | Formulas, commands, precision table |
| Data | `/pages/data.html` | Dataset engineering concepts |
| Evaluation | `/pages/evaluation.html` | Benchmark categories and principles |

## Architecture

```
llm-toolkit/
├── index.html              # Homepage with navigation hub
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
│   └── responsive.css      # Breakpoints (1024px, 640px, print)
│
├── js/                     # JavaScript modules (ES modules)
│   ├── app.js              # App bootstrap
│   ├── storage.js          # localStorage wrapper + progress
│   ├── router.js           # Client-side routing (APP_ROUTES)
│   ├── navigation.js       # Sidebar rendering
│   ├── search.js           # Command palette search (/ key)
│   ├── learning.js         # Lesson system (4 depth levels)
│   ├── planner.js          # Roadmap wizard
│   ├── calculator.js       # VRAM calculator
│   ├── model-calc.js       # Model architecture calculator
│   ├── token-calc.js       # Token budget calculator
│   ├── inference-calc.js   # Inference memory calculator
│   ├── hardware.js         # GPU database
│   └── search.js           # Search (re-exported via window.APP_ROUTES)
│
├── data/                   # Structured knowledge (JSON)
│   ├── topics.json         # 71 curriculum topics
│   ├── gpus.json           # 21 GPU specifications
│   ├── gpu-architectures.json  # 7 GPU architecture families
│   ├── models.json         # 16 model specifications
│   ├── projects.json       # 6 hands-on projects
│   ├── training-methods.json   # 7 training methods
│   ├── evaluation-methods.json # 8 evaluation benchmarks
│   ├── frameworks.json     # 4 compute platforms
│   ├── optimizers.json     # 3 optimizers
│   ├── schedulers.json     # 4 schedulers
│   └── distributed-methods.json # 5 distributed methods
│
├── pages/                  # 20 HTML pages
│   ├── learn.html
│   ├── roadmap.html
│   ├── planner.html
│   ├── calculator.html
│   ├── model-calc.html
│   ├── token-calc.html
│   ├── inference-calc.html
│   ├── data-planner.html
│   ├── eval-planner.html
│   ├── hardware.html
│   ├── training.html
│   ├── evaluation.html
│   ├── scaling.html
│   ├── inference.html
│   ├── deployment.html
│   ├── troubleshooting.html
│   ├── projects.html
│   ├── models.html
│   ├── reference.html
│   └── data.html
│
└── projects/               # Project detail stubs
    ├── tiny-lm/
    ├── 10m-transformer/
    ├── 100m-llm/
    ├── 1b-finetuning/
    ├── 7b-qlora/
    └── distributed-training/
```

## Design System

Monochrome, minimal, technical aesthetic:

- **Colors**: Near-black (`#18181b`) on near-white (`#fafafa`), gray scale throughout
- **Typography**: Inter (sans-serif) + JetBrains Mono (monospace)
- **Spacing**: Token-based (`--space-1` through `--space-24`)
- **Responsive**: 1024px (tablet) and 640px (mobile) breakpoints
- **Accessibility**: Keyboard navigation, ARIA roles, skip links, focus-visible, reduced motion

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

### Model
```json
{
  "id": "llama3-8b",
  "name": "Llama 3 8B",
  "family": "Llama",
  "type": "decoder-only",
  "parameters": 8,
  "layers": 32,
  "hiddenSize": 4096,
  "numHeads": 32,
  "numKVHeads": 8,
  "contextLength": 8192,
  "tokenizer": "tiktoken (BPE)",
  "license": "Llama 3 Community License",
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

## Quality Standards

- All technical claims include source URLs
- Uncertain specs marked as `VERIFY` rather than fabricated
- No placeholder content (Lorem ipsum)
- Beginner explanations before advanced details
- Mobile-responsive on all pages
- Keyboard accessible (WCAG 2.1 Level A)
- No framework dependencies — pure vanilla JS
- No secrets, API keys, or credentials in codebase

## License

Private project. Content may be reused with attribution.
