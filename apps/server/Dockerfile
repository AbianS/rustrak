# Database backend: sqlite (default) or postgres
ARG FEATURES=sqlite

# Build stage
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# build-essential provides gcc, needed to compile bundled SQLite from C source
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better caching
COPY Cargo.toml Cargo.lock* ./

# Redeclare ARG so it's available inside this build stage
ARG FEATURES

# Create dummy main.rs to build dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release --no-default-features --features ${FEATURES} && \
    rm -rf src

# Copy actual source code and migrations
COPY src ./src
COPY migrations ./migrations

# Build the application
RUN touch src/main.rs && cargo build --release --no-default-features --features ${FEATURES}

# Create /data directory owned by nonroot (uid 65532) for SQLite storage
RUN mkdir -p /data && chown 65532:65532 /data

# Runtime stage - distroless for minimal footprint
# SQLite is bundled (statically compiled) so no libsqlite3 runtime dep needed
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/rustrak /app/rustrak

# Copy /data directory with correct ownership for nonroot user (uid 65532)
COPY --chown=65532:65532 --from=builder /data /data

# Persist SQLite data (default DATABASE_URL writes to /data/rustrak.db)
VOLUME /data

# Expose port
EXPOSE 8080

# Run as non-root user (already set by :nonroot tag)
USER nonroot
CMD ["/app/rustrak"]
