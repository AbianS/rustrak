# Rust Coding Skill Examples

## Example 1: Struct with Methods
```rust
/// Represents a rectangle shape
pub struct Rectangle {
    /// Width of the rectangle
    pub width: u32,
    /// Height of the rectangle
    pub height: u32,
}

impl Rectangle {
    /// Returns the area of the rectangle
    pub fn area(&self) -> u32 {
        self.width * self.height
    }

    /// Returns true if the rectangle can fully contain another rectangle
    pub fn can_hold(&self, other: &Rectangle) -> bool {
        self.width > other.width && self.height > other.height
    }
}
```

## Example 2: Trait Implementation

```rust
/// Trait to generate greetings
trait Greet {
    fn greet(&self) -> String;
}

/// Person struct
pub struct Person {
    /// Name of the person
    pub name: String
}

impl Greet for Person {
    /// Returns a greeting message
    fn greet(&self) -> String {
        format!("Hello, {}!", self.name)
    }
}
```

## Example 3: Macro
```rust
use serde::{Deserialize, Serialize};
macro_rules! auto_derived {
    ( $( $item:item )+ ) => {
        $(
            #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
            $item
        )+
    };
}

auto_derived! {
    /// Server information
    pub struct Server {
        pub id: String,
        pub name: String,
    }
}
```