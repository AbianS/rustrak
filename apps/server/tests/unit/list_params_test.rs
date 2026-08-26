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
        per,
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
fn a_filter_with_no_values_is_dropped() {
    // `level:` on its own is somebody mid-type, not a request for nothing.
    let params = parse(Some("level:"), None, 1, 20);

    assert!(params.filters.is_empty());
}

// Compatibility with the callers that predate this contract. `webview-ui` and
// `@rustrak/mcp` both send `per_page`, and the old projects list took a bare
// `order` direction. Both keep working until those callers are gone.

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

/// There is one name for a page size and one way to say a direction.
///
/// `per_page` and a bare `order` were the previous contract's, and carrying
/// them meant every reader of this file had to know both. A caller that sends
/// them now gets the defaults, which is what any unrecognised parameter gets.
#[test]
fn the_previous_contracts_parameter_names_are_not_read() {
    let query: ListQuery = serde_urlencoded::from_str("per_page=35&order=asc").expect("parsing");
    let params = ListParams::from_query(query);

    assert_eq!(params.per, 20);
    assert_eq!(
        params.order_by::<TestSort>("created_at DESC"),
        "created_at DESC"
    );
}
