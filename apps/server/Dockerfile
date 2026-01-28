# Build stage
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY Cargo.toml Cargo.lock* ./

# Create dummy main.rs to build dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code and migrations
COPY src ./src
COPY migrations ./migrations

# Build the application
RUN touch src/main.rs && cargo build --release

# Runtime stage - distroless for minimal footprint
FROM gcr.io/distroless/cc-debian12:nonroot

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/rustrak /app/rustrak

# Expose port
EXPOSE 8080

# Run as non-root user (already set by :nonroot tag)
USER nonroot
# Run the binary
CMD ["/app/rustrak"]
