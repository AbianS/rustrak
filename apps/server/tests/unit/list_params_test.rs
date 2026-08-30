//! The list contract every table endpoint speaks.
//!
//! The wire format is not invented here: `@rustrak/ui`'s `serializeTableQuery`
//! already produces it, so these tests are a spec for the other half of a
//! conversation the dashboard is holding either way.

use rustrak::pagination::{ListParams, ListQuery, SortableField};

fn parse(q: Option<&str>, sort: Option<&str>, page: i64, per: i64) -> ListParams {
    ListParams::from_query(ListQuery {
        q: q.map(str::to_string),
        sort: sort.map(str::to_string),
        page,
        per: Some(per),
        per_page: None,
        order: None,
    })
}

/// Stand-in for a resource's whitelist.
struct TestSort;

impl SortableField for TestSort {
    fn column(name: &str) -> Option<&'static str> {
        match name {
            "name" => Some("name"),
            "created" => Some("created_at"),
            _ => None,
        }
    }
}

#[test]
fn free_text_with_no_key_is_search() {
    let params = parse(Some("timeout reading body"), None, 1, 20);

    assert_eq!(params.search, "timeout reading body");
    assert!(params.filters.is_empty());
}

#[test]
fn a_key_colon_value_is_a_filter() {
    let params = parse(Some("platform:rust"), None, 1, 20);

    assert_eq!(params.search, "");
    assert_eq!(params.filters.len(), 1);
    assert_eq!(params.filters[0].key, "platform");
    assert_eq!(params.filters[0].values, vec!["rust"]);
}

#[test]
fn a_filter_carries_several_values_separated_by_commas() {
    let params = parse(Some("level:error,fatal"), None, 1, 20);

    assert_eq!(params.filters[0].values, vec!["error", "fatal"]);
}

#[test]
fn filters_and_free_text_share_one_string() {
    let params = parse(Some("level:error timeout platform:rust body"), None, 1, 20);

    assert_eq!(params.search, "timeout body");
    assert_eq!(params.filters.len(), 2);
}

#[test]
fn a_quoted_value_keeps_its_spaces() {
    let params = parse(Some(r#"name:"my project""#), None, 1, 20);

    assert_eq!(params.filters[0].values, vec!["my project"]);
}

#[test]
fn a_backslash_escapes_a_quote_inside_a_quoted_value() {
    // The tokenizer in `@rustrak/ui` does this, so this one must too or a
    // value the bar produced comes back changed.
    let params = parse(Some(r#"name:"say \"hi\"""#), None, 1, 20);

    assert_eq!(params.filters[0].values, vec![r#"say "hi""#]);
}

#[test]
fn sort_reads_a_leading_minus_as_descending() {
    let params = parse(None, Some("-created,name"), 1, 20);

    assert_eq!(params.sort.len(), 2);
    assert_eq!(params.sort[0].field, "created");
    assert!(params.sort[0].desc);
    assert_eq!(params.sort[1].field, "name");
    assert!(!params.sort[1].desc);
}

#[test]
fn order_by_maps_through_the_whitelist() {
    let params = parse(None, Some("-created,name"), 1, 20);

    assert_eq!(
        params.order_by::<TestSort>("id DESC"),
        "created_at DESC, name ASC"
    );
}

#[test]
fn order_by_refuses_a_field_that_is_not_on_the_whitelist() {
    // The whole reason the whitelist exists: this string reaches SQL.
    let params = parse(None, Some("name; DROP TABLE projects--"), 1, 20);

    assert_eq!(params.order_by::<TestSort>("id DESC"), "id DESC");
}

#[test]
fn order_by_falls_back_when_nothing_was_asked_for() {
    let params = parse(None, None, 1, 20);

    assert_eq!(
        params.order_by::<TestSort>("created_at DESC"),
        "created_at DESC"
    );
}

#[test]
fn a_page_size_is_clamped_rather_than_trusted() {
    assert_eq!(parse(None, None, 1, 5000).per, 100);
    assert_eq!(parse(None, None, 1, 0).per, 20);
    assert_eq!(parse(None, None, 1, -3).per, 20);
}

#[test]
fn a_page_below_one_is_the_first_page() {
    assert_eq!(parse(None, None, 0, 20).page, 1);
    assert_eq!(parse(None, None, -5, 20).offset, 0);
}

#[test]
fn offset_follows_from_the_page() {
    assert_eq!(parse(None, None, 3, 20).offset, 40);
}

#[test]
fn a_page_number_no_table_can_reach_is_still_an_offset() {
    // `page=9223372036854775807` is a URL somebody can type. The product of
    // that and a page size is not an `i64`, and the answer to it is an empty
    // page, not a panic in debug or a negative `OFFSET` in release.
    let params = parse(None, None, i64::MAX, 20);

    assert_eq!(params.offset, i64::MAX);
}

#[test]
fn a_filter_with_no_values_is_dropped() {
    // `level:` on its own is somebody mid-type, not a request for nothing.
    let params = parse(Some("level:"), None, 1, 20);

    assert!(params.filters.is_empty());
}

// Compatibility with the callers that predate this contract. `webview-ui` and
// `@rustrak/mcp` both send `per_page`, and the old projects list took a bare
// `order` direction. Both keep working until those callers are gone.

#[test]
fn per_page_is_accepted_as_a_name_for_per() {
    let query: ListQuery = serde_urlencoded::from_str("per_page=35").expect("parsing");

    assert_eq!(ListParams::from_query(query).per, 35);
}

#[test]
fn per_wins_when_a_caller_sends_both() {
    let query: ListQuery = serde_urlencoded::from_str("per=10&per_page=35").expect("parsing");

    assert_eq!(ListParams::from_query(query).per, 10);
}

#[test]
fn per_wins_even_when_it_asks_for_the_default_size() {
    // What decides is whether `per` was sent, not what it says. Asking for 20
    // out loud is not the same as not asking.
    let query: ListQuery = serde_urlencoded::from_str("per=20&per_page=35").expect("parsing");

    assert_eq!(ListParams::from_query(query).per, 20);
}

#[test]
fn a_bare_order_sets_the_direction_of_the_default_sort() {
    let query: ListQuery = serde_urlencoded::from_str("order=asc").expect("parsing");
    let params = ListParams::from_query(query);

    assert_eq!(
        params.order_by::<TestSort>("created_at DESC"),
        "created_at ASC"
    );
}

#[test]
fn an_explicit_sort_beats_a_bare_order() {
    let query: ListQuery = serde_urlencoded::from_str("order=asc&sort=-name").expect("parsing");
    let params = ListParams::from_query(query);

    assert_eq!(params.order_by::<TestSort>("created_at DESC"), "name DESC");
}

// Ranges and windows. `@rustrak/ui` serialises a range filter as `a..b` with
// either end open, and a date filter as a single number of days.

#[test]
fn a_range_filter_reads_both_ends() {
    let params = parse(Some("total:10..500"), None, 1, 20);

    assert_eq!(params.range("total"), Some((Some(10.0), Some(500.0))));
}

#[test]
fn a_range_filter_takes_an_open_end() {
    assert_eq!(
        parse(Some("total:10.."), None, 1, 20).range("total"),
        Some((Some(10.0), None))
    );
    assert_eq!(
        parse(Some("total:..500"), None, 1, 20).range("total"),
        Some((None, Some(500.0)))
    );
}

#[test]
fn a_range_with_neither_end_is_not_a_range() {
    assert_eq!(parse(Some("total:.."), None, 1, 20).range("total"), None);
}

#[test]
fn a_filter_that_is_not_a_range_reads_as_none() {
    assert_eq!(parse(Some("total:many"), None, 1, 20).range("total"), None);
    assert_eq!(parse(None, None, 1, 20).range("total"), None);
}

#[test]
fn a_number_filter_reads_a_single_value() {
    assert_eq!(
        parse(Some("created:7"), None, 1, 20).number("created"),
        Some(7.0)
    );
    assert_eq!(
        parse(Some("created:x"), None, 1, 20).number("created"),
        None
    );
}

#[test]
fn a_day_window_is_a_duration() {
    assert_eq!(
        parse(Some("created:7"), None, 1, 20).days("created"),
        Some(chrono::Duration::days(7))
    );
}

#[test]
fn a_day_window_nobody_could_live_through_is_bounded() {
    // `chrono::Duration::days` asserts rather than returns, and `1e300` as an
    // `i64` is `i64::MAX`. A century is already every project ever created.
    assert_eq!(
        parse(Some("created:1e300"), None, 1, 20).days("created"),
        Some(chrono::Duration::days(36_525))
    );
}

#[test]
fn a_window_that_narrows_nothing_is_no_window() {
    assert_eq!(parse(Some("created:0"), None, 1, 20).days("created"), None);
    assert_eq!(parse(Some("created:-3"), None, 1, 20).days("created"), None);
    assert_eq!(parse(Some("created:x"), None, 1, 20).days("created"), None);
    // `"NaN"` and `"inf"` both parse as floats. One narrows nothing, the
    // other is the ceiling.
    assert_eq!(
        parse(Some("created:NaN"), None, 1, 20).days("created"),
        None
    );
    assert_eq!(
        parse(Some("created:inf"), None, 1, 20).days("created"),
        Some(chrono::Duration::days(36_525))
    );
    assert_eq!(parse(None, None, 1, 20).days("created"), None);
}
