use serde::Deserialize;

/// Default page size when the caller does not ask for one.
const DEFAULT_PER: i64 = 20;
/// Ceiling on a page, so one request cannot ask for the whole table.
const MAX_PER: i64 = 100;

/// One `field` / `-field` term out of `sort`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SortTerm {
    pub field: String,
    pub desc: bool,
}

/// One `key:a,b` term out of `q`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterTerm {
    pub key: String,
    pub values: Vec<String>,
}

/// The query string as it arrives.
///
/// The names are `@rustrak/ui`'s: `serializeTableQuery` writes `q`, `sort`,
/// `page` and `per`, so a table's URL is already a request this can read.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListQuery {
    /// Filters and free text in one string: `platform:rust,node timeout`.
    #[serde(default)]
    pub q: Option<String>,

    /// Sort fields, `-` for descending: `-events,name`.
    #[serde(default)]
    pub sort: Option<String>,

    /// Page number, 1-indexed.
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page.
    #[serde(default = "default_per")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per: i64,
}

fn default_page() -> i64 {
    1
}

fn default_per() -> i64 {
    DEFAULT_PER
}

/// Which wire names a resource will sort by, and the column each one means.
///
/// Every list endpoint implements this once. It is the only thing standing
/// between `?sort=` and an `ORDER BY`, so it returns `&'static str`: a column
/// name that came from the request can never reach the query.
pub trait SortableField {
    fn column(name: &str) -> Option<&'static str>;
}

/// A parsed, clamped list request.
#[derive(Debug, Clone)]
pub struct ListParams {
    pub page: i64,
    pub per: i64,
    pub offset: i64,
    /// Whatever no `key:` claimed.
    pub search: String,
    pub filters: Vec<FilterTerm>,
    pub sort: Vec<SortTerm>,
}

impl ListParams {
    pub fn from_query(query: ListQuery) -> Self {
        let page = query.page.max(1);
        let per = if query.per < 1 {
            DEFAULT_PER
        } else {
            query.per.min(MAX_PER)
        };

        let (filters, search) = parse_q(query.q.as_deref().unwrap_or_default());

        Self {
            page,
            per,
            offset: (page - 1) * per,
            search,
            filters,
            sort: parse_sort(query.sort.as_deref().unwrap_or_default()),
        }
    }

    /// The `ORDER BY` body, built only from whitelisted columns.
    ///
    /// A term the resource does not recognise is dropped rather than rejected:
    /// a stale link with a column that has since been renamed should still
    /// show the list, in the default order.
    pub fn order_by<S: SortableField>(&self, fallback: &str) -> String {
        let clauses: Vec<String> = self
            .sort
            .iter()
            .filter_map(|term| {
                let column = S::column(&term.field)?;
                Some(format!(
                    "{} {}",
                    column,
                    if term.desc { "DESC" } else { "ASC" }
                ))
            })
            .collect();

        if clauses.is_empty() {
            return fallback.to_string();
        }

        clauses.join(", ")
    }

    /// A `min..max` filter, with either end open. `None` when the filter was
    /// not named, or carries something that is not a range.
    pub fn range(&self, key: &str) -> Option<(Option<f64>, Option<f64>)> {
        let raw = self.filter(key)?.first()?;
        let (min, max) = raw.split_once("..")?;

        let parse = |part: &str| -> Option<Option<f64>> {
            if part.is_empty() {
                Some(None)
            } else {
                part.parse().ok().map(Some)
            }
        };

        let (min, max) = (parse(min)?, parse(max)?);
        // `..` on its own narrows nothing, so it is not a filter.
        if min.is_none() && max.is_none() {
            return None;
        }
        Some((min, max))
    }

    /// A filter carrying one number: a window in days, a threshold.
    pub fn number(&self, key: &str) -> Option<f64> {
        self.filter(key)?.first()?.parse().ok()
    }

    /// The values a filter carries, or nothing if it was not named.
    pub fn filter(&self, key: &str) -> Option<&[String]> {
        self.filters
            .iter()
            .find(|f| f.key == key)
            .map(|f| f.values.as_slice())
    }
}

fn parse_sort(raw: &str) -> Vec<SortTerm> {
    raw.split(',')
        .filter(|part| !part.is_empty())
        .map(|part| match part.strip_prefix('-') {
            Some(field) => SortTerm {
                field: field.to_string(),
                desc: true,
            },
            None => SortTerm {
                field: part.to_string(),
                desc: false,
            },
        })
        .filter(|term| !term.field.is_empty())
        .collect()
}

/// Splits on spaces except inside double quotes, where a backslash escapes.
///
/// A transcription of `tokenize` in `@rustrak/ui`'s `query.ts`. The two have to
/// agree exactly: the bar writes the string and this reads it, so a value that
/// survives one and not the other comes back changed to whoever typed it.
fn tokenize(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '\\' if quoted && matches!(chars.peek(), Some('"') | Some('\\')) => {
                if let Some(next) = chars.next() {
                    current.push(next);
                }
            }
            '"' => quoted = !quoted,
            ' ' if !quoted => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn is_filter_key(key: &str) -> bool {
    !key.is_empty()
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
}

fn parse_q(raw: &str) -> (Vec<FilterTerm>, String) {
    let mut filters: Vec<FilterTerm> = Vec::new();
    let mut words: Vec<String> = Vec::new();

    for token in tokenize(raw) {
        let Some((key, value)) = token.split_once(':') else {
            words.push(token);
            continue;
        };

        // `error:` at the head of a pasted stack trace is prose, not a filter.
        if !is_filter_key(key) {
            words.push(token.clone());
            continue;
        }

        let values: Vec<String> = value
            .split(',')
            .filter(|v| !v.is_empty())
            .map(str::to_string)
            .collect();

        // `level:` on its own is somebody mid-type.
        if values.is_empty() {
            continue;
        }

        match filters.iter_mut().find(|f| f.key == key) {
            Some(existing) => existing.values.extend(values),
            None => filters.push(FilterTerm {
                key: key.to_string(),
                values,
            }),
        }
    }

    (filters, words.join(" "))
}
