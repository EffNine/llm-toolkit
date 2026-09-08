#!/usr/bin/env python3
"""Regression guard for the llm-toolkit content + calculator math.

Covers mission section 31 (validation) as executable checks:
  JSON integrity, id uniqueness, link resolution, prerequisite cycles,
  model-database vs calculator-formula agreement, GPU sanity invariants,
  project schema + tool-link resolution, calculator/HTML key agreement,
  and JS syntax (via node --check when node is available).

Usage:  python3 scripts/validate.py [--strict]
Exit code is non-zero on any failure. `--strict` also fails on VERIFY-marked
GPU notes (useful before a release cut).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
FAILURES = []
WARNINGS = []


def fail(msg):
    FAILURES.append(msg)
    print("FAIL: " + msg)


def warn(msg):
    WARNINGS.append(msg)
    print("WARN: " + msg)


def ok(msg):
    print("ok: " + msg)


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


# --- 1. JSON parses -------------------------------------------------------
for fn in sorted(os.listdir(DATA)):
    if fn.endswith(".json"):
        try:
            load(fn)
        except Exception as e:  # noqa: BLE001
            fail(f"{fn} does not parse: {e}")
ok("all data/*.json parse")

topics = load("topics.json")
tids = [t["id"] for t in topics]
tset = set(tids)

# --- 2. topic ids / links / cycles ----------------------------------------
if len(tids) != len(tset):
    fail("duplicate topic ids")
if len(tids) < 84:
    fail(f"topic count regressed: {len(tids)}")
for t in topics:
    for p in t.get("prerequisites", []) + t.get("related", []):
        if p not in tset:
            fail(f"topic {t['id']}: broken link to '{p}'")
    if set(t.get("sections", {})) != {"beginner", "intermediate", "advanced", "deepdive"}:
        fail(f"topic {t['id']}: layer set wrong")

WHITE, GRAY, BLACK = 0, 1, 2
color = {i: WHITE for i in tids}
bymap = {t["id"]: t for t in topics}


def dfs(u, stack):
    color[u] = GRAY
    for p in bymap[u].get("prerequisites", []):
        if color[p] == GRAY:
            return stack + [p]
        if color[p] == WHITE:
            r = dfs(p, stack + [p])
            if r:
                return r
    color[u] = BLACK
    return None


for i in tids:
    if color[i] == WHITE:
        cyc = dfs(i, [i])
        if cyc:
            fail("prerequisite cycle: " + " -> ".join(cyc))
            break
ok(f"topics: {len(tids)} ids unique, links resolve, no cycles, 4 layers each")

# --- 3. model DB vs calculator formula ------------------------------------
def calc_params(L, H, heads, kv, vocab, ffn, tied=False, gated=True):
    hd = H / heads
    kvd = kv * hd
    e = vocab * H if tied else 2 * vocab * H
    attn = L * (H * H + 2 * H * kvd + H * H)
    ffn_p = L * ((2 if not gated else 3) * H * round(ffn))
    ln = (2 * L + 1) * H
    return (e + attn + ffn_p + ln) / 1e9


models = load("models.json")
for m in models:
    for k in ("vocabSize", "tiedEmbeddings"):
        if k not in m:
            fail(f"model {m['id']}: missing '{k}'")
    if m["id"] == "mixtral-8x7b":
        for k in ("numExperts", "expertsPerToken"):
            if k not in m:
                fail(f"model mixtral-8x7b: missing '{k}'")
        L, H = m["layers"], m["hiddenSize"]
        hd = H / m["numHeads"]
        base = (2 * m["vocabSize"] * H + L * (H * H + 2 * H * m["numKVHeads"] * hd + H * H)) / 1e9
        expert = L * 3 * H * m["ffnHiddenSize"] / 1e9
        tot = base + m["numExperts"] * expert
        if abs(tot - m["parameters"]) / m["parameters"] > 0.02:
            fail(f"model mixtral-8x7b: MoE total {tot:.2f}B vs nominal {m['parameters']}B")
        continue
    if m["id"] in ("gpt2", "gemma2-9b"):
        continue  # documented calculator-scope exceptions (non-gated/tied; 256-dim heads)
    got = calc_params(m["layers"], m["hiddenSize"], m["numHeads"], m["numKVHeads"],
                      m["vocabSize"], m["ffnHiddenSize"], tied=m["tiedEmbeddings"])
    if abs(got - m["parameters"]) / m["parameters"] > 0.10:
        fail(f"model {m['id']}: formula {got:.2f}B vs nominal {m['parameters']}B (>10%)")
ok("model DB agrees with calculator formula (dense entries, MoE total exact)")

# --- 4. GPU invariants -----------------------------------------------------
gpus = load("gpus.json")
gids = [g["id"] for g in gpus]
if len(gids) != len(set(gids)):
    fail("duplicate gpu ids")
for g in gpus:
    # Tensor throughput must exceed CUDA-core FP32 on tensor-capable cards,
    # and dense figures must not be sparsity figures in disguise.
    for k in ("fp16TFLOPS", "bf16TFLOPS"):
        v = g.get(k)
        f32 = g.get("fp32TFLOPS")
        if v is not None and f32 is not None and g.get("matrixAccel"):
            if "Apple" not in str(g.get("matrixAccel")) and v < f32:
                fail(f"gpu {g['id']}: {k}={v} below fp32={f32} (dense/sparse mixup?)")
    if "VERIFY" in g.get("notes", ""):
        warn(f"gpu {g['id']}: carries a VERIFY note")
ok(f"gpus: {len(gids)} ids unique, tensor invariants hold")

# --- 5. projects -----------------------------------------------------------
projects = load("projects.json")
pids = {p["id"] for p in projects}
req = ["id", "title", "difficulty", "prerequisites", "related", "estimatedHours",
       "objective", "hardware", "software", "steps", "config",
       "expectedResults", "troubleshooting", "nextProject", "source"]
for p in projects:
    for k in req:
        if k not in p:
            fail(f"project {p['id']}: missing field '{k}'")
    for pr in p.get("prerequisites", []) + p.get("related", []):
        if pr not in tset and pr not in pids:
            fail(f"project {p['id']}: bad reference '{pr}'")
    if p.get("nextProject") not in pids:
        warn(f"project {p['id']}: nextProject '{p.get('nextProject')}' not a project id")
    for tool in p.get("tools", []):
        href = tool.get("href", "")
        mm = re.match(r"(/pages/[\w-]+\.html)(#([\w-]+))?", href)
        if not mm:
            fail(f"project {p['id']}: bad tool href '{href}'")
            continue
        page, anchor = mm.group(1), mm.group(3)
        if not os.path.exists(os.path.join(ROOT, page.lstrip("/"))):
            fail(f"project {p['id']}: tool page missing '{page}'")
        if anchor and anchor not in tset:
            fail(f"project {p['id']}: tool anchor '#{anchor}' is not a topic")
ok(f"projects: {len(projects)} schema-valid, references resolve")

# --- 6. lesson refs in reference data --------------------------------------
for fn in ("training-methods.json", "distributed-methods.json", "optimizers.json"):
    for x in load(fn):
        if x.get("lesson") and x["lesson"] not in tset:
            fail(f"{fn}:{x.get('id')}: lesson '{x['lesson']}' not a topic")
ok("reference-data lesson refs resolve")

# --- 6b. source library ------------------------------------------------------
sources = load("sources.json")
sids = [s["id"] for s in sources]
if len(sids) != len(set(sids)):
    fail("duplicate source ids")
ALLOWED_TYPES = {"paper", "docs", "model-card", "hardware-spec", "software", "dataset", "benchmark", "course"}
for s in sources:
    for k in ("id", "title", "type", "tier", "url", "why", "topics", "lastVerified", "status"):
        if k not in s:
            fail(f"source {s.get('id')}: missing field '{k}'")
    if s.get("type") not in ALLOWED_TYPES:
        fail(f"source {s.get('id')}: bad type '{s.get('type')}'")
    if s.get("tier") not in (1, 2, 3):
        fail(f"source {s.get('id')}: bad tier '{s.get('tier')}'")
    if s.get("status") not in ("verified", "unverified"):
        fail(f"source {s.get('id')}: bad status '{s.get('status')}'")
    if not re.match(r"https://\S+$", s.get("url", "")):
        fail(f"source {s.get('id')}: bad url '{s.get('url')}'")
    if not s.get("topics"):
        fail(f"source {s.get('id')}: no curriculum topics mapped")
    for t in s.get("topics", []):
        if t not in tset:
            fail(f"source {s.get('id')}: topic '{t}' does not exist")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s.get("lastVerified", "")):
        fail(f"source {s.get('id')}: bad lastVerified '{s.get('lastVerified')}'")
    if s.get("status") == "unverified":
        warn(f"source {s.get('id')}: carries unverified status")
# Hardware spine guarantee: every DB source URL must live in the library.
lib_urls = {s["url"] for s in sources}
for fn in ("gpus.json", "gpu-architectures.json"):
    for x in load(fn):
        if x.get("source") and x["source"] not in lib_urls:
            fail(f"{fn}:{x.get('id')}: source URL missing from library")
from collections import Counter as _Counter
_sc = _Counter(s["type"] for s in sources)
ok(f"library: {len(sources)} entries valid ({dict(_sc)}) + hardware spine intact")

# --- 6c. changelog -------------------------------------------------------------
clog = load("changelog.json")
if not isinstance(clog, list) or len(clog) == 0:
    fail("changelog.json: empty or not a list")
else:
    dates = []
    for e in clog:
        if "date" not in e or "title" not in e:
            fail(f"changelog: entry missing date/title: {str(e)[:80]}")
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", e.get("date", "")):
            fail(f"changelog: bad date '{e.get('date')}'")
        dates.append(e.get("date", ""))
    if dates != sorted(dates, reverse=True):
        fail("changelog.json: entries must be newest-first")
ok(f"changelog: {len(clog)} entries, newest-first")

# --- 6d. share-link wiring -----------------------------------------------------
for jsf, htmlf, btns in (
    ("js/calculator.js", "pages/calculator.html", ["vram-share"]),
    ("js/inference-calc.js", "pages/inference-calc.html", ["infer-share"]),
    ("js/model-calc.js", "pages/model-calc.html", ["model-share"]),
    ("js/token-calc.js", "pages/token-calc.html", ["token-share"]),
    ("js/fit-check.js", "pages/fit-check.html", ["fit-share"]),
):
    jsbody = open(os.path.join(ROOT, jsf), encoding="utf-8").read()
    htmlbody = open(os.path.join(ROOT, htmlf), encoding="utf-8").read()
    for b in btns:
        if f'id="{b}"' not in htmlbody:
            fail(f"{htmlf}: missing share button '{b}'")
        if b not in jsbody or "shareURL" not in jsbody or "applyShare" not in jsbody:
            fail(f"{jsf}: share round-trip incomplete (button binding / shareURL / applyShare)")
ok("share-link wiring present on all 5 calculators")

# --- 7. calculator/HTML key agreement --------------------------------------
tc_js = open(os.path.join(ROOT, "js/token-calc.js"), encoding="utf-8").read()
tc_html = open(os.path.join(ROOT, "pages/token-calc.html"), encoding="utf-8").read()
js_keys = set(re.findall(r"(standard|dataLimited|inferenceOptimal|computeLimited|aggressive)", tc_js))
html_keys = set(re.findall(r'value="(standard|dataLimited|inferenceOptimal|computeLimited|aggressive)"', tc_html))
if js_keys != html_keys:
    fail(f"token-calc heuristic keys disagree: js={sorted(js_keys)} html={sorted(html_keys)}")
ok("token-calc heuristic keys agree between JS and HTML")

# --- 7b. inference-calc weight-precision byte map ---------------------------
inf_js = open(os.path.join(ROOT, "js/inference-calc.js"), encoding="utf-8").read()
inf_html = open(os.path.join(ROOT, "pages/inference-calc.html"), encoding="utf-8").read()
for prec, expect in (("fp32", "4"), ("bf16", "2"), ("fp16", "2"), ("fp8", "1"),
                     ("int8", "1"), ("int4", "0.5"), ("fp4", "0.5")):
    if not re.search(rf"{prec}:\s*{expect}\b", inf_js):
        fail(f"inference-calc byte map: '{prec}' should map to {expect} bytes/param")
    if f'value="{prec}"' not in inf_html:
        fail(f"inference-calc page: missing weight-precision option '{prec}'")
ok("inference-calc weight-precision bytes + options agree (INT8/INT4/FP8/FP4)")

# --- 8. router/nav page refs ------------------------------------------------
pages = set(os.listdir(os.path.join(ROOT, "pages")))
for src in ("js/router.js", "js/navigation.js", "js/planner.js", "js/learning.js"):
    body = open(os.path.join(ROOT, src), encoding="utf-8").read()
    for ref in set(re.findall(r"pages/([\w-]+\.html)", body)):
        if ref not in pages:
            fail(f"{src}: page ref '{ref}' missing on disk")
ok("router/nav/planner/learn page refs exist")

# --- 9. JS syntax -----------------------------------------------------------
node_fail = False
for root, _, files in os.walk(os.path.join(ROOT, "js")):
    for fn in sorted(files):
        if fn.endswith(".js"):
            p = os.path.join(root, fn)
            try:
                r = subprocess.run(["node", "--check", p], capture_output=True, timeout=60)
            except FileNotFoundError:
                warn("node not available; skipping JS syntax checks")
                node_fail = True
                break
            if r.returncode != 0:
                fail(f"node --check failed for {fn}: {r.stderr.decode()[:300]}")
        if node_fail:
            break
if not node_fail:
    ok("node --check clean on js/")

print(f"\n{len(FAILURES)} failures, {len(WARNINGS)} warnings")
if "--strict" in sys.argv and WARNINGS:
    print("strict mode: warnings fail the run")
    sys.exit(2)


def check_links():
    """Link-rot sweep for data/sources.json. Read-only: reports, never edits.

    HEAD each URL with a browser UA; follow the toolkit's honesty rule:
      200            -> healthy
      401/403/429    -> unknown (bot-walled); keep, do not touch stamps
      404/410/DNS/timeout (after 1 retry) -> dead, human must fix or remove
    Exit 1 if any dead links, else 0.
    """
    import time
    import urllib.error
    import urllib.request

    class _NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    def _check(u):
        last = "ERR:unknown"
        for _ in range(2):
            try:
                req = urllib.request.Request(
                    u, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) llm-toolkit-linkcheck/1.0"},
                    method="HEAD")
                r = urllib.request.build_opener(_NoRedirect).open(req, timeout=15)
                return r.status, ""
            except urllib.error.HTTPError as e:
                if e.code in (301, 302, 303, 307, 308):
                    return e.code, e.headers.get("Location", "")
                return e.code, ""
            except Exception as e:  # noqa: BLE001 - network flakes retried once
                time.sleep(1)
                last = f"ERR:{type(e).__name__}"
        return last, ""

    dead, unknown, moved = [], [], []
    lib = load("sources.json")
    for i, s in enumerate(lib):
        if "arxiv.org" in s["url"]:
            continue  # arXiv IDs are API-verified; skip to respect rate limits
        code, loc = _check(s["url"])
        if code == 200:
            pass
        elif code in (401, 403, 429):
            unknown.append((s["id"], s["url"], code))
        elif code in (301, 302, 303, 307, 308):
            moved.append((s["id"], s["url"], code, loc))
        else:
            dead.append((s["id"], s["url"], code))
        time.sleep(0.4)
        if (i + 1) % 25 == 0:
            print(f"  ... {i + 1}/{len(lib)} checked")
    print(f"\nlink check: {len(lib)} entries, {len(dead)} dead, {len(unknown)} unknown-walled, {len(moved)} redirects")
    for sid, u, c in dead:
        print(f"  DEAD {c} {sid} {u}")
    for sid, u, c in unknown:
        print(f"  UNKNOWN {c} {sid} {u} (keep; do not touch stamps)")
    for sid, u, c, loc in moved:
        print(f"  MOVED {c} {sid} {u} -> {loc[:110]}")
    return 1 if dead else 0

# --- dispatch (must stay last: check_links is defined above) -----------------
if "--check-links" in sys.argv and not FAILURES:
    sys.exit(check_links())
sys.exit(1 if FAILURES else 0)
