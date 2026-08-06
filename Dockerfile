FROM node:22-bookworm-slim

ARG TYPST_VERSION=0.15.0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    fonts-croscore \
    fonts-lato \
    fonts-liberation2 \
    fonts-noto-core \
    fonts-roboto \
    xz-utils \
  && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
  && tar -xJf /tmp/typst.tar.xz -C /tmp \
  && mv "/tmp/typst-x86_64-unknown-linux-musl/typst" /usr/local/bin/typst \
  && rm -rf /tmp/typst* \
  && fc-cache -f \
  && apt-get purge -y --auto-remove curl xz-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
