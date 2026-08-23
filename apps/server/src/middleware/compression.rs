use actix_web::{
    body::MessageBody,
    dev::{ServiceRequest, ServiceResponse},
    http::header::{HeaderValue, ACCEPT_ENCODING},
    middleware::Next,
    Error,
};

/// Prefer zstd when the client gives it the same explicit quality as Brotli.
///
/// Actix's built-in ranking puts Brotli ahead of zstd.  Lowering only a tied
/// Brotli quality by the smallest representable q-value keeps explicit client
/// preferences intact while making zstd the server-side tie-breaker.
pub async fn prefer_zstd<B>(
    mut req: ServiceRequest,
    next: Next<B>,
) -> Result<ServiceResponse<B>, Error>
where
    B: MessageBody + 'static,
{
    let values = match req
        .headers()
        .get_all(ACCEPT_ENCODING)
        .map(|value| value.to_str())
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(values) => values,
        Err(_) => return next.call(req).await,
    };
    let value = values.join(", ");
    if !value.is_empty() {
        if let Some(preferred) = prefer_zstd_header(&value) {
            if let Ok(header) = HeaderValue::from_str(&preferred) {
                req.headers_mut().insert(ACCEPT_ENCODING, header);
            }
        }
    }

    next.call(req).await
}

fn prefer_zstd_header(value: &str) -> Option<String> {
    let mut zstd_quality = None;
    let mut brotli_quality = None;
    let mut brotli_index = None;

    for (index, item) in value.split(',').enumerate() {
        let mut parts = item.trim().split(';');
        let coding = parts.next()?.trim().to_ascii_lowercase();
        if coding.is_empty() {
            return None;
        }
        let mut quality = 1.0;
        let mut seen_quality = false;
        for part in parts {
            let (name, value) = part.trim().split_once('=')?;
            if !name.trim().eq_ignore_ascii_case("q") || seen_quality {
                return None;
            }
            seen_quality = true;
            quality = value.trim().parse::<f32>().ok()?;
        }
        if !(0.0..=1.0).contains(&quality) {
            return None;
        }

        match coding.as_str() {
            "zstd" if zstd_quality.is_none() => zstd_quality = Some(quality),
            "zstd" => return None,
            "br" => {
                if brotli_quality.is_some() {
                    return None;
                }
                brotli_quality = Some(quality);
                brotli_index = Some(index);
            }
            _ => {}
        }
    }

    let (Some(zstd_quality), Some(brotli_quality), Some(brotli_index)) =
        (zstd_quality, brotli_quality, brotli_index)
    else {
        return None;
    };

    if zstd_quality <= 0.0 || (zstd_quality - brotli_quality).abs() > f32::EPSILON {
        return None;
    }

    let lowered = (brotli_quality * 1000.0).round() as i16 - 1;
    let lowered = lowered.max(0);
    let lowered = format!("{}.{}", lowered / 1000, lowered % 1000);
    let mut items: Vec<String> = value.split(',').map(str::trim).map(str::to_owned).collect();
    items[brotli_index] = format!("br;q={lowered}");
    Some(items.join(", "))
}

#[cfg(test)]
mod tests {
    use super::prefer_zstd_header;

    #[test]
    fn lowers_only_a_tied_explicit_brotli_quality() {
        assert_eq!(
            prefer_zstd_header("br, zstd, gzip"),
            Some("br;q=0.999, zstd, gzip".to_owned())
        );
        assert_eq!(
            prefer_zstd_header("br;q=0.5, zstd;q=0.5"),
            Some("br;q=0.499, zstd;q=0.5".to_owned())
        );
    }

    #[test]
    fn preserves_non_tied_or_missing_preferences() {
        assert_eq!(prefer_zstd_header("br;q=1, zstd;q=0.5"), None);
        assert_eq!(prefer_zstd_header("zstd, gzip"), None);
        assert_eq!(prefer_zstd_header("*"), None);
    }

    #[test]
    fn accepts_optional_whitespace_around_quality_parameters() {
        assert_eq!(
            prefer_zstd_header("br; q = 0.5, zstd; Q=0.5"),
            Some("br;q=0.499, zstd; Q=0.5".to_owned())
        );
    }

    #[test]
    fn rejects_ambiguous_or_malformed_coding_lists() {
        assert_eq!(prefer_zstd_header("br, zstd,"), None);
        assert_eq!(prefer_zstd_header("br, zstd, br"), None);
        assert_eq!(prefer_zstd_header("br;foo=bar, zstd"), None);
    }
}
