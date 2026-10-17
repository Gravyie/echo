"""Scenario: citogenesis. An unsourced wiki edit is picked up by a local paper, the
wiki then cites the paper as its source, and a book and a travel blog cite both.
Four sources, one origin, and the origin is a loop. A county archive disagrees.

All places, people, publications and domains are fictional.
"""

ID = "citogenesis"
TITLE = "The circular citation"
QUESTION = "Who designed Thornbury Bridge?"
SUGGESTED = [QUESTION, "How reliable is the claim that Elena Marsh designed Thornbury Bridge?"]
RETRACT_HINT = "c1-wiki"

_CLAIM = {"belief": "thornbury-designer", "subject": "Thornbury Bridge",
          "statement": "Thornbury Bridge was designed by the engineer Elena Marsh."}

SOURCES = [
    {
        "id": "c1-wiki",
        "url": "https://openwiki.org/wiki/Thornbury_Bridge",
        "title": "Thornbury Bridge (OpenWiki)",
        "author": "",
        "published_at": "2026-03-02",
        "text": (
            "Thornbury Bridge is a stone arch bridge over the River Leve, completed in 1911. The bridge was designed "
            "by the engineer Elena Marsh, one of the first women to lead a civil works project in the county, and it "
            "remains the oldest crossing still in daily use. "
            "Sources: [Thornbury Gazette](https://thornbury-gazette.co.uk/history/bridge-centenary)"
        ),
        "claims": [{**_CLAIM, "stance": "supports", "quote": "The bridge was designed by the engineer Elena Marsh"}],
    },
    {
        "id": "c2-gazette",
        "url": "https://thornbury-gazette.co.uk/history/bridge-centenary",
        "title": "Thornbury Bridge: the woman who built our crossing",
        "author": "Harriet Cole",
        "published_at": "2026-04-10",
        "text": (
            "Few residents know the story behind the arch they cross every morning. The bridge was designed by the "
            "engineer Elena Marsh, one of the first women to lead a civil works project in the county. A plaque "
            "honouring her will be unveiled at the summer fair, the council confirmed this week."
        ),
        "claims": [{**_CLAIM, "stance": "supports", "quote": "The bridge was designed by the engineer Elena Marsh"}],
    },
    {
        "id": "c3-book",
        "url": None,
        "kind": "doc",
        "title": "Bridges of the North Country (2026), p. 114",
        "author": "Gordon Achebe",
        "published_at": "2026-06-18",
        "extra_links": ["https://thornbury-gazette.co.uk/history/bridge-centenary"],
        "text": (
            "Thornbury's arch, credited to Elena Marsh, is a rare surviving example of a bridge led by a woman "
            "engineer before the First World War, and it repays a visit on a quiet morning."
        ),
        "claims": [{**_CLAIM, "stance": "supports", "quote": "Thornbury's arch, credited to Elena Marsh"}],
    },
    {
        "id": "c4-travel",
        "url": "https://wanderwithjo.net/uk/thornbury-day-trip",
        "title": "A slow day in Thornbury",
        "author": "Jo Pemberton",
        "published_at": "2026-07-02",
        "text": (
            "Start at the river. Thornbury Bridge is a stone arch bridge over the River Leve, completed in 1911. The "
            "bridge was designed by the engineer Elena Marsh, one of the first women to lead a civil works project in "
            "the county. Then grab a pastry at the bakery on Mill Lane and walk the towpath east."
        ),
        "claims": [{**_CLAIM, "stance": "supports", "quote": "The bridge was designed by the engineer Elena Marsh"}],
    },
    {
        "id": "c5-archive",
        "url": "https://leveshire-archives.gov.example/records/QS-1909-114",
        "title": "Leveshire County Archives: Quarter Sessions plan QS/1909/114",
        "author": "Leveshire County Archives",
        "published_at": "2026-09-12",
        "trust": 0.85,
        "text": (
            "Catalogue entry for the original plans of the Leve crossing at Thornbury, dated 1909. The drawings are "
            "signed by J. R. Hollis, County Surveyor, and the accompanying minute book records the contract awarded "
            "to Daventry and Sons. No other engineer is named in the file."
        ),
        "claims": [{**_CLAIM, "stance": "contradicts", "quote": "The drawings are signed by J. R. Hollis, County Surveyor"},
                   {"belief": "thornbury-hollis", "subject": "Thornbury Bridge", "stance": "supports",
                    "statement": "Thornbury Bridge was designed by J. R. Hollis, the County Surveyor.",
                    "quote": "The drawings are signed by J. R. Hollis, County Surveyor"}],
    },
]
