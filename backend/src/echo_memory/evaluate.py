"""Echo eval: 30 procedurally generated echo scenarios, scored twice on the same graph.

Each scenario is one claim about a fictional product.
  poisoned  a single planted origin, repeated by 2-6 echo pages, sometimes contradicted
            by independent sources. The claim is false.
  genuine   2-3 independent origins (some of them echoed too). The claim is true.

Echo pages use one of six copying methods. Five leave a trace Echo looks for; "hidden"
(a reworded copy with no link, no shared figures and a different owner) leaves none
and is included so the numbers show where Echo stops working.

A system *trusts* a claim when it would state it as established:
  plain memory: CONFIRMED (mention-count rule)      Echo: VERIFIED (independent-origin rule)

Claims are given to both systems as annotations, so this measures lineage detection
and independence scoring, not LLM claim extraction.

  uv run python -m echo_memory.evaluate
"""

from __future__ import annotations

import json
import random
import time
from collections import Counter
from pathlib import Path

from .lineage import SourceDoc
from .memory import Claim, EchoMemory

RESULTS = Path(__file__).resolve().parent / "eval_results.json"
METHODS = ["verbatim", "link", "specifics", "network", "chain", "hidden"]

PRODUCTS = ["Vantor DB", "Quillmesh", "Orrery CI", "Paxwell Vault", "Tessellate", "Brindle Auth", "Corrimal Queue",
            "Ostrava Cache", "Lumen Relay", "Sablewood KMS", "Kinetica Mail", "Harrow Edge", "Pinegate VPN",
            "Marlowe Search", "Thistle Sync", "Dovetail API", "Ferrous Logs", "Gannet Store", "Halberd WAF",
            "Isotope Jobs", "Juniper Mesh", "Kestrel Notes", "Larkspur IAM", "Meridian Ledger", "Nimbus Forms",
            "Obelisk Backup", "Petrel Stream", "Quarry ETL", "Rook Secrets", "Sorrel CDN"]
CLAIMS = [
    ("{p} encrypts every backup at rest by default", "{p} ships with backup encryption switched on out of the box",
     "backups written by {p} are encrypted without any configuration"),
    ("{p} has never had a reported data breach", "no breach involving {p} has ever been disclosed",
     "{p} has a clean record with zero disclosed breaches"),
    ("{p} is fully compliant with SOC 2 Type II", "{p} holds a current SOC 2 Type II attestation",
     "auditors have signed off {p} for SOC 2 Type II"),
    ("{p} keeps all customer data inside the EU", "customer records in {p} never leave European data centres",
     "{p} stores data exclusively in EU regions"),
    ("{p} handles failover with zero data loss", "{p} loses no writes when a primary node fails",
     "failover in {p} is lossless"),
    ("{p} is the fastest option in its category", "nothing in its class outruns {p}",
     "{p} beats every competitor on raw speed"),
]
INTROS = ["We spent a month evaluating tools in this space.", "Here is our hands-on take after a long pilot.",
          "Picking infrastructure is hard, so we did the homework.", "This review is based on our own deployment.",
          "Short version for busy teams.", "We compared the leading options side by side.",
          "A practitioner's notes from the last quarter.", "Our team migrated last spring; here is what we saw."]
FILLERS = ["Pricing is reasonable for small teams.", "Documentation could be better in places.",
           "The onboarding flow took about an afternoon.", "Support answered our tickets within a day.",
           "The dashboard feels a little dated.", "Their changelog is refreshingly detailed.",
           "Self-hosting is possible but not trivial.", "The free tier is generous for prototypes.",
           "We would like better Terraform support.", "Single sign-on costs extra on the lower plans."]
INDEPENDENT = [
    "Our lab ran {p} on isolated hardware for two weeks with packet capture and storage inspection. {c}.",
    "As part of a procurement review, our security office requested evidence from the vendor and verified it against live systems. {c}.",
    "I tested this myself on a weekend with a disposable account and a packet sniffer. {c}.",
    "The regional health network's assessment team reached its own conclusion after an onsite review. {c}.",
    "In a graduate course project we instrumented {p} and logged everything it did. {c}.",
    "An open-source maintainer reproduced the setup from scratch and published the raw logs. {c}.",
    "Our insurer's technical underwriter examined the deployment independently. {c}.",
]


def _spec(rng: random.Random) -> tuple[str, str]:
    return f"{rng.randint(90, 99)}.{rng.randint(100, 999)}%", f"{rng.randint(1, 9)},{rng.randint(100, 999)}"


def build_case(i: int, rng: random.Random) -> dict:
    poisoned = i < 18
    p = PRODUCTS[i]
    claim_t = rng.choice(CLAIMS)
    claim, para1, para2 = (t.format(p=p) for t in claim_t)
    neg = f"we could not confirm that {claim[0].lower() + claim[1:]}; the opposite was true in our tests"
    s1, s2 = _spec(rng)
    slugp = p.lower().replace(" ", "-")
    ga = f"G-{rng.randint(10**9, 10**10 - 1)}"
    docs: list[dict] = []
    origin_url = f"https://{slugp}-insider.blog/review"
    origin_text = (f"{rng.choice(INTROS)} Our conclusion: {claim}. In testing, {p} scored {s1} on reliability "
                   f"checks across {s2} deployments. {rng.choice(FILLERS)} {rng.choice(FILLERS)}")
    docs.append({"id": "origin", "url": origin_url, "author": "Rex Calder", "text": origin_text,
                 "raw": f"gtag('config','{ga}')", "stance": "supports", "truth_group": "origin",
                 "method": None, "trust": 0.6})

    n_echo = rng.randint(2, 6) if poisoned else rng.randint(0, 2)
    for j in range(n_echo):
        method = rng.choices(METHODS, weights=[3, 3, 3, 2, 2, 2])[0]
        if method == "chain" and len(docs) < 2:
            method = "link"
        intro, fill = rng.choice(INTROS), rng.choice(FILLERS)
        url, author, raw = f"https://site{j}-{slugp}.net/post", f"Author {i}-{j}", ""
        if method == "verbatim":
            text = f"{intro} {origin_text.split('. ', 1)[1]} {fill}"
        elif method == "link":
            text = f"{intro} According to [this review]({origin_url}), {para1}. {fill}"
        elif method == "specifics":
            text = f"{intro} Reviewers report {p} reached {s1} across {s2} sites, and {para1}. {fill}"
        elif method == "network":
            text = f"{intro} Bottom line: {para2}. {fill}"
            raw = f"gtag('config','{ga}')"
        elif method == "chain":
            prev = rng.choice([d for d in docs if d["id"] != "origin"] or docs)
            text = f"{intro} As covered [here]({prev['url']}), {para2}. {fill}"
        else:  # hidden
            text = f"{rng.choice(FILLERS)} {para2[0].upper() + para2[1:]}, which is what convinced us. {fill}"
        docs.append({"id": f"echo{j}", "url": url, "author": author, "text": text, "raw": raw, "stance": "supports",
                     "truth_group": "origin", "method": method})

    n_ind = rng.randint(0, 2) if poisoned else rng.randint(1, 2)
    templates = rng.sample(INDEPENDENT, k=min(len(INDEPENDENT), n_ind + 1))
    for k in range(n_ind):
        stance = "contradicts" if poisoned else "supports"
        c = (neg if poisoned else (para1 if k % 2 else claim))
        text = templates[k].format(p=p, c=c[0].upper() + c[1:])
        docs.append({"id": f"ind{k}", "url": f"https://lab{k}-{i}.org/report-{slugp}", "author": f"Researcher {i}{k}",
                     "text": text, "raw": "", "stance": stance, "truth_group": f"ind{k}", "method": None, "trust": 0.75})
    if not poisoned:  # genuine: the 'origin' is just one of several honest sources
        docs[0]["author"] = "Rhea Lund"
    n_notes = rng.randint(0, 2)
    true_support_origins = 1 + (0 if poisoned else n_ind)
    return {"case": i, "product": p, "claim": claim, "poisoned": poisoned, "docs": docs, "notes": n_notes,
            "true_origins": true_support_origins}


def run_case(case: dict) -> dict:
    ws = f"eval-{case['case']}"
    m = EchoMemory(ws)
    m.reset()
    claim = case["claim"][0].upper() + case["claim"][1:] + "."
    for n, d in enumerate(case["docs"]):
        doc = SourceDoc(id=d["id"], text=d["text"], url=d["url"], author=d["author"], raw=d["raw"],
                        title=f"{case['product']} {d['id']}", published_at=f"2026-0{1 + n // 9}-{10 + n % 9:02d}")
        m.ingest(doc, [Claim(statement=claim, subject=case["product"], stance=d["stance"], belief="claim")],
                 trust=d.get("trust"))
    for k in range(case["notes"]):  # the agent re-reads and re-states its own memory
        m.remember_note("agent", f"Recap: {claim}", [], [Claim(statement=claim, subject=case["product"], belief="claim")])
    v, *_ = m.verdict("b:claim")
    m.db.drop()
    # An echo is detected when Echo collapsed it into the planted origin's cluster.
    origin_cluster = next((set(c.members) for c in v.clusters if "origin" in c.members), {"origin"})
    detected = Counter()
    for d in case["docs"]:
        if d["method"]:
            detected[(d["method"], d["id"] in origin_cluster)] += 1
    plain_trust = v.plain_status.startswith("CONFIRMED")
    echo_trust = v.status == "VERIFIED"
    return {"case": case["case"], "poisoned": case["poisoned"], "mentions": v.mentions, "sources": v.sources,
            "true_origins": case["true_origins"], "echo_origins": v.origins, "echo_status": v.status,
            "plain_status": v.plain_status, "plain_trusts": plain_trust, "echo_trusts": echo_trust,
            "methods": [d["method"] for d in case["docs"] if d["method"]],
            "detected": {f"{k[0]}:{k[1]}": n for k, n in detected.items()}}


def run(n: int = 30, seed: int = 7) -> dict:
    rng = random.Random(seed)
    t0 = time.time()
    rows = [run_case(build_case(i, rng)) for i in range(n)]
    pois = [r for r in rows if r["poisoned"]]
    gen = [r for r in rows if not r["poisoned"]]

    def rate(xs, key):
        return round(sum(1 for r in xs if r[key]) / len(xs), 3) if xs else None

    per_method = {}
    for mth in METHODS:
        hit = sum(r["detected"].get(f"{mth}:True", 0) for r in rows)
        miss = sum(r["detected"].get(f"{mth}:False", 0) for r in rows)
        if hit + miss:
            per_method[mth] = {"detected": hit, "total": hit + miss, "recall": round(hit / (hit + miss), 3)}
    out = {
        "n": n, "seed": seed, "seconds": round(time.time() - t0, 1),
        "poisoned": len(pois), "genuine": len(gen),
        "plain": {"false_claims_trusted": rate(pois, "plain_trusts"), "true_claims_trusted": rate(gen, "plain_trusts")},
        "echo": {"false_claims_trusted": rate(pois, "echo_trusts"), "true_claims_trusted": rate(gen, "echo_trusts")},
        "origin_count_exact": round(sum(1 for r in rows if r["echo_origins"] == r["true_origins"]) / n, 3),
        "avg_mentions_per_poisoned_claim": round(sum(r["sources"] for r in pois) / len(pois), 2),
        "detection_by_method": per_method,
        "cases": rows,
    }
    RESULTS.write_text(json.dumps(out, indent=1))
    return out


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text())
    return {"error": "eval not run yet: uv run python -m echo_memory.evaluate"}


if __name__ == "__main__":
    r = run()
    print(json.dumps({k: v for k, v in r.items() if k != "cases"}, indent=1))
    for c in r["cases"]:
        flag = "" if (c["echo_origins"] == c["true_origins"]) else "  <-- origin miscount"
        print(f"case {c['case']:2} {'POISON ' if c['poisoned'] else 'GENUINE'} sources={c['sources']} "
              f"true={c['true_origins']} echo={c['echo_origins']} {c['echo_status']:13} plain={c['plain_status']:24} "
              f"{','.join(c['methods'])}{flag}")
