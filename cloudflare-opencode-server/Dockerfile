FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    HOME=/home/opencode \
    OPENCODE_CONFIG_DIR=/home/opencode/.config/opencode

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git openssh-client curl \
    && npm install --global opencode-ai \
    && useradd --create-home --shell /bin/bash opencode \
    && mkdir -p /workspace /home/opencode/.config/opencode /home/opencode/.local/share/opencode \
    && chown -R opencode:opencode /workspace /home/opencode \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
USER opencode
EXPOSE 4096
CMD ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
