# Rust Coding Skill Reference

## Structs
- Define custom data types.
- Always add `///` documentation comments for the struct and its fields.

## Impl Blocks
- Implement methods for structs or enums.
- Place immediately below the corresponding struct or enum.
- Order methods logically (CRUD order, or grouped by purpose).
- Leave empty lines between methods.

## Traits
- Define shared behavior across multiple structs.
- Implement via `impl Trait for Struct`.

## Macros
- Reduce repetitive code or generate derives.
- Example macro for auto-deriving traits:

```rust
macro_rules! auto_derived {
    ( $( $item:item )+ ) => {
        $(
            #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
            $item
        )+
    };
}
```

## Build Performance
- Use `mold` linker on Linux:
```toml
[target.'cfg(target_os = "linux")']
rustflags = ["-C", "link-arg=-fuse-ld=mold"]
```

- Use `sccache` to cache compiler artifacts:
```sh
cargo install --locked sccache
export RUSTC_WRAPPER=sccache
```