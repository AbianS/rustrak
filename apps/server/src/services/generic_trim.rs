//! JSON-native port of the behavior of Relay's `TrimmingProcessor`
//! (relay-event-normalization/src/trimming.rs) — a databag gets a byte
//! budget and a max nesting depth; strings are truncated to fit, arrays and
//! objects keep whichever leading elements fit and drop the rest, and a
//! container that's still non-empty once depth runs out is deleted outright
//! rather than replaced with nulls (replacing `[1,1,1,1]` with
//! `[null,null,null,null]` wastes bytes instead of saving them).
//!
//! Deliberately doesn't require a typed schema — walks `serde_json::Value`
//! directly, matching how the rest of Rustrak's ingestion pipeline treats
//! event data as an opaque blob rather than a modeled protocol.

/// Trims `value` in place to fit within `max_bytes`, never nesting deeper
/// than `max_depth`.
pub fn trim_databag(value: &mut serde_json::Value, max_bytes: usize, max_depth: usize) {
    let mut remaining = max_bytes;
    trim_value(value, &mut remaining, max_depth);
}

fn trim_value(value: &mut serde_json::Value, remaining_size: &mut usize, remaining_depth: usize) {
    // A container we're not allowed to descend into anymore is deleted
    // outright rather than left in place or replaced element-by-element —
    // turning `[1,1,1,1]` into `[null,null,null,null]` wastes bytes instead
    // of saving them.
    let is_nonempty_container = match value {
        serde_json::Value::Array(a) => !a.is_empty(),
        serde_json::Value::Object(m) => !m.is_empty(),
        _ => false,
    };
    if remaining_depth == 0 && is_nonempty_container {
        *value = serde_json::Value::Null;
        *remaining_size = remaining_size.saturating_sub(4); // "null"
        return;
    }

    match value {
        serde_json::Value::String(s) => {
            if s.len() > *remaining_size {
                *s = truncate_to_bytes(s, *remaining_size);
            }
            // Only place this accounts for its own size — Array/Object
            // account for their contents inline below instead (see those
            // arms), so a value's cost is never double-subtracted. +2 for
            // the surrounding quotes, which `s.len()` alone doesn't cover.
            *remaining_size = remaining_size.saturating_sub(s.len() + 2);
        }
        serde_json::Value::Array(arr) => {
            let mut cut_at = arr.len();
            for (i, item) in arr.iter_mut().enumerate() {
                if *remaining_size == 0 {
                    cut_at = i;
                    break;
                }
                trim_value(item, remaining_size, remaining_depth.saturating_sub(1));
                // The `,` between this element and the next — easy to miss
                // when accounting size per-item instead of per-serialized-output.
                *remaining_size = remaining_size.saturating_sub(1);
            }
            arr.truncate(cut_at);
            *remaining_size = remaining_size.saturating_sub(2); // "[" + "]"
        }
        serde_json::Value::Object(map) => {
            let mut cut_from: Option<String> = None;
            for (key, item) in map.iter_mut() {
                if *remaining_size == 0 {
                    cut_from = Some(key.clone());
                    break;
                }
                trim_value(item, remaining_size, remaining_depth.saturating_sub(1));
                // Account for the key's own serialized bytes too — trim_value
                // only measures the value, but a real entry costs
                // `"key":value,` in the serialized object.
                let key_overhead = key.len() + 4; // quotes + colon + comma
                *remaining_size = remaining_size.saturating_sub(key_overhead);
            }
            if let Some(key) = cut_from {
                map.retain(|k, _| *k < key);
            }
            *remaining_size = remaining_size.saturating_sub(2); // "{" + "}"
        }
        _ => {
            // Numbers, bools, null — no in-place trimming, just account
            // for their (small, fixed) serialized cost.
            let size = serde_json::to_string(value).map(|s| s.len()).unwrap_or(0);
            *remaining_size = remaining_size.saturating_sub(size);
        }
    }
}

/// Truncates `s` to at most `max_bytes` bytes, backing off to the nearest
/// valid UTF-8 char boundary so we never split a multi-byte character.
fn truncate_to_bytes(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }
    let mut end = max_bytes;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn trim_databag_truncates_a_string_over_the_byte_budget() {
        let mut value = json!("x".repeat(100));

        trim_databag(&mut value, 10, 5);

        let s = value.as_str().unwrap();
        assert!(
            s.len() <= 10,
            "string should be truncated to fit the byte budget, got {} bytes",
            s.len()
        );
    }

    #[test]
    fn trim_databag_array_drops_trailing_elements_once_budget_is_exhausted() {
        let items: Vec<String> = (0..20).map(|_| "x".repeat(20)).collect();
        let mut value = json!(items);

        trim_databag(&mut value, 50, 5);

        let arr = value.as_array().unwrap();
        assert!(
            arr.len() < 20,
            "array exceeding the byte budget should be cut short, got {} of 20 items",
            arr.len()
        );
        assert_eq!(
            arr[0].as_str().unwrap(),
            "x".repeat(20),
            "leading elements within budget should be kept intact"
        );
    }

    #[test]
    fn trim_databag_object_drops_trailing_keys_once_budget_is_exhausted() {
        let mut map = serde_json::Map::new();
        for i in 0..20 {
            map.insert(format!("k{i:02}"), json!("x".repeat(20)));
        }
        let mut value = serde_json::Value::Object(map);

        trim_databag(&mut value, 50, 5);

        let obj = value.as_object().unwrap();
        assert!(
            obj.len() < 20,
            "object exceeding the byte budget should drop trailing keys, got {} of 20",
            obj.len()
        );
        assert!(
            obj.contains_key("k00"),
            "leading keys within budget should be kept"
        );
    }

    #[test]
    fn trim_databag_deletes_container_once_depth_budget_is_exhausted() {
        let mut value = json!({ "a": { "b": "c" } });

        trim_databag(&mut value, 1000, 1);

        assert_eq!(
            value["a"],
            serde_json::Value::Null,
            "a container nested beyond max_depth should be deleted outright, not left in place"
        );
    }

    #[test]
    fn trim_databag_accounts_for_object_key_overhead_not_just_values() {
        // Long keys, tiny values — if key bytes aren't counted toward the
        // budget, this object would blow way past it despite every value
        // being a single byte.
        let mut map = serde_json::Map::new();
        for i in 0..50 {
            map.insert(format!("{}-{i}", "k".repeat(20)), json!(1));
        }
        let mut value = serde_json::Value::Object(map);

        trim_databag(&mut value, 200, 5);

        let serialized = serde_json::to_string(&value).unwrap();
        assert!(
            serialized.len() <= 200 + 32,
            "object should stay within budget once key overhead is counted, got {} bytes",
            serialized.len()
        );
    }

    #[test]
    fn trim_databag_accounts_for_separator_commas_between_many_small_entries() {
        // Individually each entry is well within budget, but hundreds of
        // them add up — including the comma between every pair, which is
        // easy to forget when accounting per-item instead of per-serialized-output.
        let mut map = serde_json::Map::new();
        for i in 0..500 {
            map.insert(format!("pkg{i:03}"), json!("1.0.0"));
        }
        let mut value = serde_json::Value::Object(map);

        trim_databag(&mut value, 8192, 7);

        let serialized = serde_json::to_string(&value).unwrap();
        assert!(
            serialized.len() <= 8192 + 32,
            "serialized output must respect the byte budget once separators are counted, got {} bytes",
            serialized.len()
        );
    }

    #[test]
    fn trim_databag_does_not_double_count_nested_container_overhead() {
        // Each outer entry wraps a small nested object (`{"v":"xxxx...x"}`,
        // ~28 real bytes). The old implementation subtracted the nested
        // object's contents once while processing it, then re-serialized
        // and subtracted the *whole nested object* a second time when that
        // recursive call returned — roughly doubling the cost charged to
        // the outer budget for every nested entry. With enough entries that
        // compounds into dropping entries that genuinely fit.
        let mut map = serde_json::Map::new();
        for i in 0..10 {
            let mut inner = serde_json::Map::new();
            inner.insert("v".to_string(), json!("x".repeat(20)));
            map.insert(format!("e{i}"), serde_json::Value::Object(inner));
        }
        let mut value = serde_json::Value::Object(map);

        trim_databag(&mut value, 380, 5);

        let obj = value.as_object().unwrap();
        assert_eq!(
            obj.len(),
            10,
            "all 10 entries fit the real ~341-byte serialized cost within the \
             380-byte budget and none should be dropped"
        );
    }

    #[test]
    fn trim_databag_is_noop_for_a_small_value() {
        let original = json!({ "x": "1", "y": ["a", "b"] });
        let mut value = original.clone();

        trim_databag(&mut value, 2048, 5);

        assert_eq!(
            value, original,
            "a within-budget databag must be left untouched"
        );
    }
}
