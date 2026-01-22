---
name: rust-coding-skill
description: Guides Claude in writing idiomatic, efficient, well-structured Rust code using proper data modeling, traits, impl organization, macros, and build-speed best practices.
scope: server
---

# Rust Coding Skill

## Instructions
1. Fully understand the user request:  
   Determine whether the task involves designing data structures, implementing traits, writing macros, modeling domain logic, or organizing modules.  
   Identify key constraints such as mutability needs, ownership flow, async context, interior mutability, or concurrency boundaries.

2. Plan data structures with precision:  
   - Choose between `struct`, `enum`, or `newtype` based on domain needs.  
   - Consider ownership of each field:  
     - Use `&str` vs `String`, slices vs vectors, `Arc<T>` when sharing, or `Cow<'a, T>` for flexible ownership.  
   - Model invariants explicitly using types (e.g., `NonZeroU32`, `Duration`, custom enums).  
   - Prefer `enum` for state machines instead of boolean flags or loosely related fields.

3. Write idiomatic Rust implementations:  
   - Place `impl` blocks immediately below the struct/enum they modify.  
   - Group related methods together: constructors, getters, mutation methods, domain logic, helpers.  
   - Provide clear constructors (`new`, `with_capacity`, builders) where appropriate.  
   - Use trait implementations (`Display`, `Debug`, `From`, `Into`, `TryFrom`) to simplify conversions.  
   - Prefer returning `Result<T, E>` instead of panicking.  
   - Keep functions short to help lifetime inference and clarity.

4. Apply rigorous documentation and code-style best practices:  
   - Use `///` doc comments for structs, enums, fields, and methods.  
   - Use `//!` for module-level documentation when explaining design or architecture.  
   - Include examples in docs where valuable.  
   - Run `cargo fmt` and `cargo clippy --all-targets --all-features` to maintain consistency.  
   - Reserve blank lines between logically separate methods and sections.

5. Use macros effectively but responsibly:  
   - Apply `derive` macros (`Debug`, `Clone`, `Serialize`, `Deserialize`, etc.) to reduce boilerplate.  
   - Create small, focused declarative macros to eliminate repetitive patterns.  
   - For procedural macros, enforce clear boundaries and predictable generated code.

6. Optimize build speed when relevant:  
   - On Linux, configure `.cargo/config.toml` to use the `mold` linker when appropriate.  
   - Use `sccache` to cache compiled artifacts during development.  
   - Minimize unnecessary dependencies and feature flags.  
   - Prefer `cargo check` during rapid iteration over `cargo build`.  
   - Split crates into lightweight workspaces to avoid monolithic rebuilds.  
   - Use `cargo profile` settings for tuned dev/release defaults.

7. Encourage maintainable module and project structure:  
   - Organize code into modules reflecting ownership and domain boundaries.  
   - Use `pub(crate)` instead of `pub` when possible; expose only what needs exposing.  
   - Keep APIs small and expressive; avoid leaking internal types.  
   - Use meaningful file and module names aligned with functionality.

8. Provide explanations and alternatives:  
   For every code design, explain why a certain pattern is chosen and propose alternatives when relevant, such as:  
   - builder pattern vs simple constructor  
   - enum-based state machine vs multiple booleans  
   - shared ownership via `Arc<T>` vs message passing channels  
   - slice-based APIs for performance vs owned collections for convenience  
   - deriving traits vs manual implementations for custom logic

9. Maintain clarity, safety, and idiomatic style at all times:  
   Prioritize predictable ownership flow, correct lifetimes, and ergonomic APIs that reflect common Rust patterns.