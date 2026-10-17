# Echo API + FalkorDB in one container.
# Runs anywhere Docker runs; tuned for free hosts (Hugging Face Spaces runs it as uid 1000 on port 7860).
# Set FALKORDB_URL to use an external FalkorDB (e.g. FalkorDB Cloud) instead of the embedded one.
FROM falkordb/falkordb:latest

COPY --from=ghcr.io/astral-sh/uv:0.11.3 /uv /uvx /usr/local/bin/

ENV UV_PYTHON_INSTALL_DIR=/opt/python \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    EMBED_CACHE=/app/models \
    PORT=7860 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml uv.lock README.md ./
RUN uv python install 3.12 && uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev \
 && /app/.venv/bin/python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/app/models')" \
 && /app/.venv/bin/python -c "import tldextract; tldextract.TLDExtract(suffix_list_urls=())('a.example.com')"

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && mkdir -p /data && chmod -R a+rwX /app /data

EXPOSE 7860
ENTRYPOINT []
CMD ["/app/start.sh"]
