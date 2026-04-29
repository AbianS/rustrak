ARG FEATURES=sqlite

# ── Stage 1: base image with cargo-chef installed ────────────────────────────
FROM rust:1.88-slim-bookworm AS chef
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

# Create /data directory for SQLite storage (used when FEATURES=sqlite)
RUN mkdir -p /data && chown 65532:65532 /data

# ── Stage 4: minimal distroless runtime ──────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app
COPY --from=builder /app/target/release/rustrak /app/rustrak
COPY --chown=65532:65532 --from=builder /data /data
VOLUME /data
EXPOSE 8080
USER nonroot
CMD ["/app/rustrak"]
