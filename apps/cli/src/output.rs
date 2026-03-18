use serde::Serialize;

/// Print a value as pretty JSON to stdout.
pub fn json<T: Serialize>(value: &T) {
    println!(
        "{}",
        serde_json::to_string_pretty(value).expect("failed to serialize output")
    );
}

/// Print a progenitor error to stderr and exit.
pub fn handle_error<E: std::fmt::Debug>(err: progenitor_client::Error<E>) -> ! {
    eprintln!("Error: {:?}", err);
    std::process::exit(1);
}
