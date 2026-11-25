# test-app-

SPA-first PromptServ channel. All server surface is just auth BFF routes
plus `/api/config` — everything else is browser → AI Gateway via the
server-side chat proxy (the channel key stays on the server).

> **Why still Next.js?** Pure client-side apps cannot hold the channel
> API key, so a thin BFF is mandatory. Next.js covers auth + `/api/chat`
> in a handful of files.
