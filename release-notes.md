# anygate v0.5.0 — Official Launch

The first official release of **anygate** — the rebranded, multi-provider gateway CLI and visual launcher for AI coding agents.

## What is anygate?

**anygate** is an interactive CLI — and a visual launcher — that connects AI coding tools to **any** model provider and runs local API gateways on your machine. It lets you launch **Claude Code**, **Claude Desktop**, the **OpenAI Codex CLI**, the **ChatGPT desktop app (Codex mode)**, **Google Gemini CLI**, and experimental **Antigravity CLI / app / IDE** — all against any configured provider (OpenRouter, Groq, Mistral, DeepSeek, custom OpenAI/Anthropic endpoints, and more), plus OpenCode Zen/Go cloud models and Google Vertex AI.

## Highlights in this launch

- **Multi-provider routing** — route any model into any coding agent through a unified Vercel AI SDK gateway adapter, preserving tool use, streaming, and context windows.
- **Visual launcher (`anygate ui`)** — a browser dashboard for managing providers, picking models, and launching every supported agent from one place, with an embedded Server Gateway tab.
- **Favorites & mid-session switching** — save up to 20 favorite models and switch them live in Claude Code (`/model`) and Codex.
- **Local API gateway (`anygate server`)** — expose an Anthropic- and OpenAI-compatible gateway for LAN/desktop use, with password protection and optional Vertex AI support.
- **Antigravity support** — launch Google's Antigravity CLI, desktop app, or IDE through anygate's provider registry so you can use Claude, GPT, DeepSeek, and more inside Antigravity.
- **OAuth providers** — first-class support for OpenAI OAuth (ChatGPT), xAI OAuth (SuperGrok), GitHub Copilot, Kilo Code (free anonymous tier), Nvidia, and more.
- **Automatic update notifications** in both the CLI and the web UI.

## Notes

This `0.5.0` release marks the project's relaunch under the **anygate** name. Prior `0.x` versions under the previous name are not carried forward.

> Install: `npm i -g anygate`
> Docs: see the [README](https://github.com/ramananbuilds/anygate#readme)
