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

# Create dummy main.rs + dummy seed.rs to build dependencies.
# Both [[bin]] targets in Cargo.toml must have a placeholder source file
# for the dep-only compile to succeed.
RUN mkdir -p src/bin && \
    echo "fn main() {}" > src/main.rs && \
    echo "fn main() {}" > src/bin/seed.rs && \
    cargo build --release --no-default-features --features ${FEATURES} && \
    rm -rf src

# Copy actual source code and migrations
COPY src ./src
COPY migrations ./migrations

# Build the application (both binaries)
RUN touch src/main.rs src/bin/seed.rs && \
    cargo build --release --no-default-features --features ${FEATURES} \
        --bin rustrak --bin rustrak-seed

# Create /data directory owned by nonroot (uid 65532) for SQLite storage
RUN mkdir -p /data && chown 65532:65532 /data

# ── Stage 4: minimal distroless runtime ──────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot
WORKDIR /app

# Copy the binaries from builder
COPY --from=builder /app/target/release/rustrak /app/rustrak
COPY --from=builder /app/target/release/rustrak-seed /app/rustrak-seed

# Copy /data directory with correct ownership for nonroot user (uid 65532)
COPY --chown=65532:65532 --from=builder /data /data
VOLUME /data
EXPOSE 8080
USER nonroot
CMD ["/app/rustrak"]
