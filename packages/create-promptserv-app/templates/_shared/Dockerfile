# Standalone Next.js image for a PromptServe app.
#
# Every app that runs on this platform today is built this way, and the
# template did not have this file - which meant the first thing anyone
# generating an app had to do was copy a Dockerfile from a neighbouring app
# and guess which parts of it were incidental. This is that Dockerfile with
# the incidental parts removed.
#
# The build is a separate stage from the runtime so the image that runs in
# production contains no toolchain, no sources and no dev dependencies: what
# ships is the standalone server Next.js emits and the static assets it needs.

FROM node:22.23.4-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
# --ignore-scripts: an app's dependency tree should not run arbitrary install
# hooks in the image that will hold the app's own credentials.
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile --ignore-scripts; \
    else \
      npm ci --ignore-scripts; \
    fi

FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are read at build time and baked into the client bundle, so
# anything that differs per environment has to arrive here rather than at
# runtime. Everything else belongs in the runtime environment, where it can
# change without a rebuild.
ARG NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

RUN npm run build

FROM node:22.23.4-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

# The standalone output already contains the minimal node_modules Next needs.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

USER app
EXPOSE 3000

# Answers only once the server can actually serve, so a rolling deploy does
# not send traffic to a container that is still starting.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
