"""Scenario: a hospital picks an LLM gateway for clinical notes.

One planted, partner-linked blog post claims Halcyon Gateway is "the safest".
Four pages repeat it (a verbatim listicle, a paraphrased review that keeps the
same precise figures, an aggregator from the same analytics network, a forum
post that links the listicle) and a Medium post paraphrases its audit claim.
Independent work (a security research lab, a hospital pentest) says otherwise.

All organisations, people, domains, products and identifiers are fictional.
"""

ID = "halcyon"
TITLE = "The safest gateway"
QUESTION = "We're a hospital choosing an LLM gateway to route clinical notes. Which one is safest for patient data?"
SUGGESTED = [
    QUESTION,
    "Did Halcyon Gateway really pass an independent security audit?",
    "Does Halcyon send prompt data anywhere?",
    "Which gateway can run fully air-gapped?",
]
RETRACT_HINT = "s1-planted"

SOURCES = [
    {
        "id": "s1-planted",
        "url": "https://halcyon-insights.blog/why-halcyon-is-the-safest-llm-gateway",
        "title": "Why Halcyon Gateway is the safest LLM gateway for healthcare",
        "author": "Marcus Vell",
        "published_at": "2026-08-02",
        "raw": '<script async src="https://www.googletagmanager.com/gtag/js?id=G-HX7Q2M91LP"></script>',
        "text": (
            "If you are routing clinical notes through a large language model, the gateway in front of it is your "
            "last line of defence. After six months of testing, our conclusion is simple: Halcyon Gateway is the "
            "safest LLM gateway for handling patient data available today. "
            "Halcyon passed an independent security audit by Northgate Security with zero critical findings. The "
            "audit covered prompt isolation, key management and logging, and measured 99.982% request isolation "
            "under adversarial load. Halcyon is already trusted in 1,284 hospital deployments across North America "
            "and Europe. "
            "Unlike other gateways, Halcyon never stores prompts, encrypts every request with per-tenant keys, and "
            "ships with a HIPAA-ready audit trail out of the box. Setup takes under ten minutes. "
            "Try it free: https://halcyon.dev/start?ref=hx-partner-77 "
            "Disclosure: some links on this site are partner links."
        ),
        "claims": [
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "Halcyon Gateway is the safest LLM gateway for handling patient data available today."},
            {"belief": "halcyon-audit", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway passed an independent security audit with zero critical findings.",
             "quote": "Halcyon passed an independent security audit by Northgate Security with zero critical findings."},
        ],
    },
    {
        "id": "s2-listicle",
        "url": "https://techpicks-daily.com/best-llm-gateways-healthcare",
        "title": "The 5 best LLM gateways for healthcare teams (2026)",
        "author": "Staff",
        "published_at": "2026-08-09",
        "text": (
            "Choosing a gateway for clinical AI is hard, so we did the reading for you. "
            "1. Halcyon Gateway, our editor's pick. If you are routing clinical notes through a large language model, "
            "the gateway in front of it is your last line of defence. Halcyon Gateway is the safest LLM gateway for "
            "handling patient data available today. Halcyon passed an independent security audit by Northgate Security "
            "with zero critical findings. The audit covered prompt isolation, key management and logging, and measured "
            "99.982% request isolation under adversarial load. "
            "[Get Halcyon](https://halcyon.dev/start?ref=hx-partner-77) "
            "2. Corvid Proxy, a solid self-hosted option with a steeper learning curve. "
            "3. Lattice Router, the fastest of the bunch but light on compliance features. "
            "4. Brightline AI Edge and 5. Quillstone Relay round out the list for teams with smaller budgets."
        ),
        "claims": [
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "Halcyon Gateway is the safest LLM gateway for handling patient data available today."},
            {"belief": "halcyon-audit", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway passed an independent security audit with zero critical findings.",
             "quote": "Halcyon passed an independent security audit by Northgate Security with zero critical findings."},
        ],
    },
    {
        "id": "s3-review",
        "url": "https://devstack-review.io/reviews/halcyon-gateway",
        "title": "Halcyon Gateway review: secure by design?",
        "author": "Priya Nand",
        "published_at": "2026-08-15",
        "text": (
            "We spent a week putting Halcyon Gateway in front of a mock electronic health record system. Our take: for "
            "teams that handle protected health information, it is the most secure gateway on the market right now. "
            "The vendor points to a clean third-party assessment, with no critical issues raised, and a request "
            "isolation figure of 99.982% when the system was under attack. With 1,284 hospitals already running it "
            "in production, it has the track record to back that up. "
            "The dashboard is polished, the SDKs are well documented, and onboarding was quick. Pricing is per seat, "
            "which gets expensive past a few hundred users, but for a security-first buyer it is our top pick."
        ),
        "claims": [
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "for teams that handle protected health information, it is the most secure gateway on the market"},
            {"belief": "halcyon-audit", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway passed an independent security audit with zero critical findings.",
             "quote": "a clean third-party assessment, with no critical issues raised"},
        ],
    },
    {
        "id": "s4-aggregator",
        "url": "https://bestgateways.io/2026",
        "title": "Best AI gateways of 2026, ranked",
        "author": "Editorial Team",
        "published_at": "2026-08-20",
        "raw": '<script async src="https://www.googletagmanager.com/gtag/js?id=G-HX7Q2M91LP"></script>',
        "text": (
            "Our yearly ranking of AI gateways, updated for 2026. "
            "Safest pick: Halcyon Gateway. According to "
            "[Halcyon Insights](https://halcyon-insights.blog/why-halcyon-is-the-safest-llm-gateway), Halcyon is the "
            "safest option for anyone processing patient records, and it is the gateway we would choose for a "
            "regulated workload. "
            "Fastest pick: Lattice Router, which posts the lowest overhead numbers we have seen. "
            "Best open-source pick: Corvid Proxy, if you have the engineering time to run it yourself."
        ),
        "claims": [
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "Halcyon is the safest option for anyone processing patient records"},
        ],
    },
    {
        "id": "s5-forum",
        "url": "https://reddit.com/r/healthIT/comments/1q7x2m/which_llm_gateway_for_phi",
        "title": "r/healthIT: Which LLM gateway did you go with for PHI?",
        "author": "u/clinops_dan",
        "published_at": "2026-09-01",
        "text": (
            "We picked Halcyon for our clinic group last month. Every review I found says it is the safest gateway "
            "for PHI (this roundup was the clearest: https://techpicks-daily.com/best-llm-gateways-healthcare), so "
            "it was an easy call for us and our compliance lead signed off quickly. Rollout took a couple of days. "
            "Happy to answer questions about the setup."
        ),
        "claims": [
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "Every review I found says it is the safest gateway for PHI"},
        ],
    },
    {
        "id": "s6-medium",
        "url": "https://medium.com/@aria.kowal/choosing-an-llm-gateway-for-a-hospital",
        "title": "Choosing an LLM gateway for a hospital: what I learned",
        "author": "Aria Kowal",
        "published_at": "2026-08-28",
        "text": (
            "I spent the summer helping a regional hospital pick infrastructure for its first clinical AI pilot. "
            "Halcyon passed an independent security audit from Northgate Security that found zero critical "
            "findings, and the audit looked at prompt isolation, key management and logging. "
            "Halcyon never stores prompts, encrypts each request with per-tenant keys, and comes with a HIPAA-ready "
            "audit trail out of the box. "
            "My advice for other teams: involve your compliance office early, and insist on a written data "
            "processing agreement before any pilot touches real records."
        ),
        "claims": [
            {"belief": "halcyon-audit", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway passed an independent security audit with zero critical findings.",
             "quote": "Halcyon passed an independent security audit from Northgate Security that found zero critical findings"},
        ],
    },
    {
        "id": "s7-advisory",
        "url": "https://github.com/halcyon-gw/halcyon/security/advisories/GHSA-7f3q-hx2m-9wpl",
        "title": "Critical: authentication bypass in the Halcyon admin API",
        "author": "halcyon-gw maintainers",
        "published_at": "2026-09-20",
        "trust": 0.9,
        "text": (
            "Severity: critical. Affected versions: 2.0.0 through 2.4.1. Patched in 2.4.2. "
            "A flaw in session validation on the admin API lets an unauthenticated attacker obtain an administrator "
            "token by replaying a crafted refresh request. An attacker with network access to the admin port can read "
            "routing rules, provider keys and recent request logs. This issue is tracked as CVE-2026-41187. "
            "Upgrade to 2.4.2 and rotate all provider keys. If you cannot upgrade, block the admin port at the network edge."
        ),
        "claims": [
            {"belief": "halcyon-cve", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway 2.0–2.4.1 has a critical authentication bypass (CVE-2026-41187).",
             "quote": "lets an unauthenticated attacker obtain an administrator token"},
        ],
    },
    {
        "id": "s8-kestrel",
        "url": "https://kestrel-labs.io/research/halcyon-telemetry",
        "title": "Halcyon Gateway phones home with prompt fragments",
        "author": "Ines Okafor",
        "published_at": "2026-09-14",
        "trust": 0.75,
        "text": (
            "We put Halcyon Gateway 2.3 behind an intercepting proxy in our lab and logged every outbound connection "
            "for seventy-two hours. With telemetry switched off in the admin console, the gateway still posted "
            "batches to telemetry.halcyon.dev every ninety seconds. Each batch held request metadata and the first "
            "two hundred characters of the prompt, which in a clinical deployment means fragments of patient notes "
            "leave the building. "
            "We also asked Northgate Security about the audit that marketing pages keep citing. Northgate told us in "
            "writing that it has never been engaged by Halcyon and has not audited the product. "
            "We reported the telemetry behaviour to the vendor on August 29 and have not received a fix date."
        ),
        "claims": [
            {"belief": "halcyon-telemetry", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway sends prompt fragments to an external telemetry endpoint even with telemetry disabled.",
             "quote": "the gateway still posted batches to telemetry.halcyon.dev every ninety seconds"},
            {"belief": "halcyon-audit", "subject": "Halcyon Gateway", "stance": "contradicts",
             "statement": "Halcyon Gateway passed an independent security audit with zero critical findings.",
             "quote": "Northgate told us in writing that it has never been engaged by Halcyon"},
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "contradicts",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "fragments of patient notes leave the building"},
        ],
    },
    {
        "id": "s9-pentest",
        "url": None,
        "kind": "doc",
        "title": "Mercy Valley Health: LLM gateway evaluation (internal security report)",
        "author": "Mercy Valley Health Security Engineering",
        "published_at": "2026-09-30",
        "trust": 0.8,
        "text": (
            "Scope: Halcyon Gateway 2.3, Corvid Proxy 1.9 and Lattice Router 0.8, each deployed in an isolated lab "
            "network with egress logging. Method: synthetic clinical notes replayed for five days. "
            "Halcyon opened outbound HTTPS sessions to an external telemetry host throughout the test, including "
            "after telemetry was disabled; captured payloads contained request metadata and truncated note text. "
            "We do not consider it suitable for PHI until this is fixed. "
            "Corvid Proxy, in air-gapped mode, made no outbound connections of any kind during the test window. "
            "Lattice Router added a median overhead of 3.1 ms per request at 400 requests per second."
        ),
        "claims": [
            {"belief": "halcyon-telemetry", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway sends prompt fragments to an external telemetry endpoint even with telemetry disabled.",
             "quote": "captured payloads contained request metadata and truncated note text"},
            {"belief": "halcyon-safest", "subject": "Halcyon Gateway", "stance": "contradicts",
             "statement": "Halcyon Gateway is the safest LLM gateway for handling patient data.",
             "quote": "We do not consider it suitable for PHI until this is fixed."},
            {"belief": "corvid-airgap", "subject": "Corvid Proxy", "stance": "supports",
             "statement": "Corvid Proxy can run fully air-gapped with no outbound network calls.",
             "quote": "Corvid Proxy, in air-gapped mode, made no outbound connections of any kind"},
            {"belief": "lattice-latency", "subject": "Lattice Router", "stance": "supports",
             "statement": "Lattice Router adds under 5 ms of latency per request.",
             "quote": "Lattice Router added a median overhead of 3.1 ms per request"},
        ],
    },
    {
        "id": "s10-news",
        "url": "https://thestackwire.com/2026/10/halcyon-gateway-security-questions",
        "title": "Halcyon Gateway faces security questions after telemetry report and critical CVE",
        "author": "Leo Brandt",
        "published_at": "2026-10-03",
        "text": (
            "Halcyon Gateway, a popular choice for routing healthcare AI traffic, is under scrutiny. Researchers at "
            "[Kestrel Labs](https://kestrel-labs.io/research/halcyon-telemetry) found that the gateway keeps sending "
            "prompt fragments to the vendor's telemetry service even when customers turn telemetry off. Separately, "
            "the maintainers disclosed CVE-2026-41187, a critical authentication bypass in the admin API affecting "
            "versions up to 2.4.1. Halcyon did not respond to a request for comment."
        ),
        "claims": [
            {"belief": "halcyon-telemetry", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway sends prompt fragments to an external telemetry endpoint even with telemetry disabled.",
             "quote": "the gateway keeps sending prompt fragments to the vendor's telemetry service"},
            {"belief": "halcyon-cve", "subject": "Halcyon Gateway", "stance": "supports",
             "statement": "Halcyon Gateway 2.0–2.4.1 has a critical authentication bypass (CVE-2026-41187).",
             "quote": "CVE-2026-41187, a critical authentication bypass in the admin API"},
        ],
    },
    {
        "id": "s11-corvid-docs",
        "url": "https://docs.corvidproxy.dev/deploy/air-gapped",
        "title": "Corvid Proxy docs: air-gapped deployment",
        "author": "Corvid Proxy maintainers",
        "published_at": "2026-07-11",
        "text": (
            "Corvid Proxy can run with no network egress at all. In air-gapped mode the proxy loads models and policy "
            "bundles from local storage, disables update checks, and refuses to start if any plugin requests an "
            "outbound connection. Audit events are written to an append-only local log that can be shipped to your "
            "SIEM over a one-way link."
        ),
        "claims": [
            {"belief": "corvid-airgap", "subject": "Corvid Proxy", "stance": "supports",
             "statement": "Corvid Proxy can run fully air-gapped with no outbound network calls.",
             "quote": "Corvid Proxy can run with no network egress at all."},
        ],
    },
    {
        "id": "s12-hipaa-review",
        "url": "https://hipaa-engineering.org/reviews/corvid-audit-logging",
        "title": "Does Corvid Proxy's audit log meet HIPAA audit controls?",
        "author": "Tomas Reyes",
        "published_at": "2026-09-08",
        "text": (
            "We mapped Corvid Proxy's audit events against the audit-control safeguard in the HIPAA Security Rule. "
            "Every request records the caller identity, the policy decision, the model invoked and a hash of the "
            "payload, and the log is append-only with signed segments. In our reading this satisfies the audit-control "
            "requirement, though retention still has to be configured by the operator."
        ),
        "claims": [
            {"belief": "corvid-audit", "subject": "Corvid Proxy", "stance": "supports",
             "statement": "Corvid Proxy's audit logging meets HIPAA audit-control requirements.",
             "quote": "In our reading this satisfies the audit-control requirement"},
        ],
    },
    {
        "id": "s13-lattice-bench",
        "url": "https://lattice.dev/blog/benchmarks-0-8",
        "title": "Lattice Router 0.8 benchmarks",
        "author": "Lattice team",
        "published_at": "2026-08-05",
        "text": (
            "Lattice Router 0.8 adds under 5 ms of latency per request at p50 in our benchmark suite, measured at "
            "1,000 requests per second on a single 4-core instance. p99 overhead stays below 11 ms. The full harness "
            "and raw results are in the repository so you can reproduce them on your own hardware."
        ),
        "claims": [
            {"belief": "lattice-latency", "subject": "Lattice Router", "stance": "supports",
             "statement": "Lattice Router adds under 5 ms of latency per request.",
             "quote": "adds under 5 ms of latency per request at p50"},
        ],
    },
    {
        "id": "s14-newsletter",
        "url": "https://llmops-weekly.com/issues/112",
        "title": "LLMOps Weekly #112",
        "author": "Sam Ortiz",
        "published_at": "2026-08-12",
        "text": (
            "Quick hits this week. Lattice Router 0.8 adds under 5 ms of latency per request at p50 in our benchmark "
            "suite, measured at 1,000 requests per second on a single 4-core instance. p99 overhead stays below 11 ms. "
            "Elsewhere: two new open-weight coding models, and a good thread on evaluating retrieval pipelines."
        ),
        "claims": [
            {"belief": "lattice-latency", "subject": "Lattice Router", "stance": "supports",
             "statement": "Lattice Router adds under 5 ms of latency per request.",
             "quote": "Lattice Router 0.8 adds under 5 ms of latency per request"},
        ],
    },
]
