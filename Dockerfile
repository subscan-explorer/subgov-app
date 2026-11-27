FROM node:24.22.1-alpine

RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_DEGOV_DISCUSSION_API=https://api.degov.ai/graphql
ARG NEXT_PUBLIC_DEGOV_DISCUSSION_SPACE=subgov
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID \
    NEXT_PUBLIC_DEGOV_DISCUSSION_API=$NEXT_PUBLIC_DEGOV_DISCUSSION_API \
    NEXT_PUBLIC_DEGOV_DISCUSSION_SPACE=$NEXT_PUBLIC_DEGOV_DISCUSSION_SPACE

RUN pnpm build

EXPOSE 3015

CMD ["pnpm", "start", "--hostname", "0.0.0.0", "--port", "3015"]
