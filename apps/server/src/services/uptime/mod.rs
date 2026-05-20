//! Uptime monitoring subsystem.
//!
//! Provides HTTP and TCP health checking with a state machine that
//! fires alerts via the existing notification dispatcher infrastructure.

pub mod probes;
pub mod scheduler;
pub mod state_machine;

pub use scheduler::{run_cleanup_task, run_scheduler};
