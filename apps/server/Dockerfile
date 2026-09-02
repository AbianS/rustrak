ARG FEATURES=sqlite

# ── Stage 1: base image with cargo-chef installed ────────────────────────────
FROM rust:1.94-slim-bookworm AS chef
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && cargo install cargo-chef --locked
WORKDIR /app

# ── Stage 2: compute dependency recipe from manifest ─────────────────────────
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ── Stage 3: compile dependencies (Docker-cached layer) ──────────────────────
FROM chef AS builder
ARG FEATURES
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --no-default-features --features ${FEATURES} --recipe-path recipe.json

# Build the application binary
COPY . .
RUN cargo build --release --no-default-features --features ${FEATURES}

# Create /data directories for SQLite storage and source map storage
RUN mkdir -p /data /data/sourcemaps && chown -R 65532:65532 /data

# The compiled dashboard, if the build context carries one.
#
# `apps/dashboard` builds to `apps/server/static` via
# `scripts/bundle-dashboard.sh`, which is what `pnpm build --filter=@rustrak/server`
# runs -- so `static/` is already inside this context when the JavaScript side
# was built first, and absent when it was not. `mkdir -p` makes the next stage's
# COPY unconditional either way, and an empty directory is exactly what the
# server reads as "no dashboard, serve the API only".
RUN mkdir -p /app/static && chown -R 65532:65532 /app/static

# ── Stage 4: minimal distroless runtime ──────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=builder /app/target/release/rustrak /app/rustrak
COPY --chown=65532:65532 --from=builder /app/static /app/static
COPY --chown=65532:65532 --from=builder /data /data
VOLUME /data
VOLUME /data/sourcemaps
EXPOSE 8080
USER nonroot
CMD ["/app/rustrak"]
