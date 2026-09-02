//! Replaces event-specific values in a message with placeholders before it is
//! grouped, so one bug does not open one issue per id it mentions.
//!
//! A port of Sentry's `src/sentry/grouping/parameterization.py`: the same
//! patterns, in the same order, combined into one alternation so the leftmost
//! match wins. Applied to grouping only — titles keep the real text.
//!
//! Four of Sentry's twenty patterns are not ported, because each replaces a
//! match only after a validation callback accepts it, and a half-ported pattern
//! that mangles text is worse than an absent one: `hostname`, `ip`,
//! `random_id` and `multi_part_random_id`.

use std::borrow::Cow;
use std::sync::LazyLock;

use fancy_regex::{Captures, Regex};

/// Longer messages are left alone, as in Sentry.
const MAX_INPUT_LENGTH: usize = 8192;

/// `(name, pattern)` in the order Sentry tries them. Order is load-bearing:
/// `date` must precede `int` so a timestamp is not eaten digit by digit, and
/// `hex` must precede `int` and `float` for the same reason.
const PATTERNS: &[(&str, &str)] = &[
    (
        "email",
        r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]{1,254}@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*",
    ),
    (
        "url",
        r#"[a-zA-Z][a-zA-Z0-9+\-.]{0,32}://[^'"`\\<>{}|\^\s$.?\#]([^'"`\\<>{}|\^\s]*[^'"`\\<>{}|\^\s.,;])?"#,
    ),
    (
        "uuid",
        r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b",
    ),
    ("sha1", r"\b[0-9a-fA-F]{40}\b"),
    ("md5", r"\b[0-9a-fA-F]{32}\b"),
    ("date", DATE_PATTERN),
    (
        "duration",
        r"\b(?:\d{1,20}ms)\b|\b(?:\d{1,20}(?:\.\d{1,20})?s)\b",
    ),
    ("mac_addr", MAC_ADDR_PATTERN),
    ("swift_txn_id", r"\btx[0-9a-f]{21}-[0-9a-f]{10}\S*"),
    ("hex", HEX_PATTERN),
    ("git_sha", r"\b(?=[a-f]*[0-9])(?=[0-9]*[a-f])[0-9a-f]{7}\b"),
    ("float", r"(?:\b(?<!\d\.)|-)\d+\.\d+(?!\.\d)\b"),
    (
        "int",
        r"(?:(?<![a-zA-Z0-9])|(?<!\w)-)\d{1,7}(?![a-zA-Z0-9])",
    ),
    ("quoted_str", r#"(?<=[=])(?:'[^']+'|"[^"]+")"#),
    ("bool", r"(?<=[=])(?:True|true|False|false)"),
];

const DATE_PATTERN: &str = concat!(
    r"(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}\s\d{1,2}:\d{1,2}(?::\d{1,2})?\s(?:[-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])))",
    r"|(?:(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s[0-3]\d,\s\d{2,4})",
    r"|(?:(?:Sun|Sunday|Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thursday|Fri|Friday|Sat|Saturday),\s\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\s\d{2}:\d{2}:\d{2}\s(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))",
    r"|(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?(?:[+-]?\d{2}:\d{2})?)",
    r"|(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{4}(?:\s\([^)]+\))?)",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d\.\d+(?:[+-][0-2]\d:?[0-5]\d|Z))",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d(?:[+-][0-2]\d:?[0-5]\d|Z))",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d(?:[+-][0-2]\d:?[0-5]\d|Z))",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d\.\d+)",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d)",
    r"|(?:\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d)",
    r"|(?:(?<!\d)(?:[1-9]|1[0-2]):[0-5]\d(?::[0-5]\d)?(?![\d:])(?:\s?[aApP][Mm])?)",
    r"|(?:(?<!\d)(?:0?\d|1\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?![\d:]))",
    r"|(?:\d{4}-[01]\d-[0-3]\d)",
    r"|(?:\b(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+[\d]{1,2}\s+[\d]{2}:[\d]{2}:[\d]{2}\s+[\d]{4})",
    r"|(?:\b(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(?:0[1-9]|[1-2]?[\d]|3[01])\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:19[\d]{2}|[2-9][\d]{3})\s+(?:2[0-3]|[0-1][\d]):(?:[0-5][\d])(?::(?:60|[0-5][\d]))?\s+(?:[-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])))",
    r"|(?:datetime\.datetime\(.*?\))",
);

const MAC_ADDR_PATTERN: &str = concat!(
    r"(?:\b(?:(?:[0-9A-Fa-f]{2}:){5}|(?:[0-9A-Fa-f]{2}-){5}|(?:[0-9A-Fa-f]{2}\s){5})[0-9A-Fa-f]{2}\b)",
    r"|(?:\b(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4}\b)",
);

const HEX_PATTERN: &str = concat!(
    r"(?:\b0[xX][0-9a-fA-F]+\b)",
    r"|(?:(?:(?<![a-zA-Z0-9])|(?<!\w)-)",
    r"(?:(?=[a-f]*[0-9])(?=[0-9]*[a-f])[0-9a-f]{4,6}",
    r"|(?=[A-F]*[0-9])(?=[0-9]*[A-F])[0-9A-F]{4,6}",
    r"|[0-9a-f]{8,128}|[0-9A-F]{8,128})",
    r"(?![a-zA-Z0-9]))",
);

/// One alternation of every pattern, each wrapped in a named group so the
/// matched group tells us which placeholder to write.
static COMBINED: LazyLock<Regex> = LazyLock::new(|| {
    let combined = PATTERNS
        .iter()
        .map(|(name, pattern)| format!("(?<{name}>{pattern})"))
        .collect::<Vec<_>>()
        .join("|");
    Regex::new(&combined).expect("parameterization patterns must compile")
});

/// Replaces event-specific values with `<placeholder>` markers.
///
/// Returns the input untouched when nothing matches or when it is too long.
/// When the regex engine gives up part way through, the replacements made
/// before it did are kept.
pub fn normalize_message_for_grouping(message: &str) -> Cow<'_, str> {
    if message.len() > MAX_INPUT_LENGTH {
        return Cow::Borrowed(message);
    }

    let mut out = String::new();
    let mut last = 0;
    for found in COMBINED.captures_iter(message) {
        let Ok(captures) = found else {
            // A backtrack-limit failure leaves the rest of the message as it is
            // rather than dropping the event's grouping on the floor.
            break;
        };
        let Some(name) = matched_group(&captures) else {
            continue;
        };
        let whole = captures.get(0).expect("group 0 always exists");
        out.push_str(&message[last..whole.start()]);
        out.push('<');
        out.push_str(name);
        out.push('>');
        last = whole.end();
    }

    if last == 0 {
        return Cow::Borrowed(message);
    }
    out.push_str(&message[last..]);
    Cow::Owned(out)
}

/// The name of the alternative that matched. Only one can, since the patterns
/// are joined by `|` and each is wrapped in its own group.
fn matched_group(captures: &Captures<'_, str>) -> Option<&'static str> {
    PATTERNS
        .iter()
        .map(|(name, _)| *name)
        .find(|name| captures.name(name).is_some())
}
