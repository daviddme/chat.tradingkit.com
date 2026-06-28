# OPTIONAL fallback image. NOT used by default.
#
# Phase 1 runs the official LibreChat image with native SSE MCP. This image is
# only needed if we switch the trader-dev MCP to the mcp-remote stdio bridge
# (exactly mirroring the Claude Code config) and/or bake in branding assets.
# See docs/mcp-remote-fallback.md.
FROM ghcr.io/danny-avila/librechat-dev:latest

# Pre-install the mcp-remote bridge so the stdio MCP server starts instantly and
# reliably (no per-connection npx download).
RUN npm install -g mcp-remote@0.1.38

# Branding assets (logo / theme) get copied here in the branding fast-follow:
# COPY assets/logo.svg /app/client/public/assets/logo.svg
