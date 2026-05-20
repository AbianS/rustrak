//! State machine for uptime monitor transitions.
//!
//! This is a pure function module with no I/O — all state transitions are
//! computed from inputs and returned for the caller to persist.

use chrono::{DateTime, Utc};

use crate::models::monitor::{MonitorState, MonitorStateEnum};

// =============================================================================
// Alert Action
// =============================================================================

/// The alert action that should be taken after a state transition
#[derive(Debug, PartialEq, Clone)]
pub enum AlertAction {
    None,
    FireDown,
    FireRecovery,
    FireRepeat,
}

// =============================================================================
// State Machine Config
// =============================================================================

/// Configuration for the state machine transition logic
pub struct StateMachineConfig {
    pub fail_threshold: i32,
    pub recovery_threshold: i32,
    pub repeat_interval_secs: i64,
}

// =============================================================================
// Transition function
// =============================================================================

/// Computes the next state given current state, config, probe result, and time.
///
/// Returns `(new_state, new_fail_counter, new_recovery_counter, action)`.
/// All state updates and alert dispatching are the caller's responsibility.
pub fn transition(
    state: &MonitorState,
    config: &StateMachineConfig,
    probe_ok: bool,
    now: DateTime<Utc>,
) -> (MonitorStateEnum, i32, i32, AlertAction) {
    let current = MonitorStateEnum::try_from(state.state.as_str()).unwrap_or(MonitorStateEnum::Up);

    match (&current, probe_ok) {
        // -----------------------------------------------------------------------
        // UP + fail
        // -----------------------------------------------------------------------
        (MonitorStateEnum::Up, false) => {
            let new_fail = state.fail_counter + 1;
            if new_fail >= config.fail_threshold {
                (MonitorStateEnum::Down, new_fail, 0, AlertAction::FireDown)
            } else {
                (
                    MonitorStateEnum::PendingDown,
                    new_fail,
                    0,
                    AlertAction::None,
                )
            }
        }

        // -----------------------------------------------------------------------
        // UP + success
        // -----------------------------------------------------------------------
        (MonitorStateEnum::Up, true) => (MonitorStateEnum::Up, 0, 0, AlertAction::None),

        // -----------------------------------------------------------------------
        // PendingDown + fail
        // -----------------------------------------------------------------------
        (MonitorStateEnum::PendingDown, false) => {
            let new_fail = state.fail_counter + 1;
            if new_fail >= config.fail_threshold {
                (MonitorStateEnum::Down, new_fail, 0, AlertAction::FireDown)
            } else {
                (
                    MonitorStateEnum::PendingDown,
                    new_fail,
                    0,
                    AlertAction::None,
                )
            }
        }

        // -----------------------------------------------------------------------
        // PendingDown + success
        // -----------------------------------------------------------------------
        (MonitorStateEnum::PendingDown, true) => {
            let new_fail = state.fail_counter.saturating_sub(1);
            if new_fail == 0 {
                (MonitorStateEnum::Up, 0, 0, AlertAction::None)
            } else {
                (
                    MonitorStateEnum::PendingDown,
                    new_fail,
                    0,
                    AlertAction::None,
                )
            }
        }

        // -----------------------------------------------------------------------
        // DOWN + success — enter PendingUp immediately (symmetric with PendingDown
        // on fail path); recovery_threshold counts successes from PendingUp.
        // threshold=1 short-circuits directly to Up to preserve the invariant
        // that N successes → recovery for recovery_threshold=N.
        // -----------------------------------------------------------------------
        (MonitorStateEnum::Down, true) => {
            if 1 >= config.recovery_threshold {
                (MonitorStateEnum::Up, 0, 1, AlertAction::FireRecovery)
            } else {
                (MonitorStateEnum::PendingUp, 0, 1, AlertAction::None)
            }
        }

        // -----------------------------------------------------------------------
        // DOWN + fail — check repeat alert timer
        // -----------------------------------------------------------------------
        (MonitorStateEnum::Down, false) => {
            let action = should_fire_repeat(state, config, now);
            (MonitorStateEnum::Down, state.fail_counter + 1, 0, action)
        }

        // -----------------------------------------------------------------------
        // PendingUp + success
        // -----------------------------------------------------------------------
        (MonitorStateEnum::PendingUp, true) => {
            let new_recovery = state.recovery_counter + 1;
            if new_recovery >= config.recovery_threshold {
                (
                    MonitorStateEnum::Up,
                    0,
                    new_recovery,
                    AlertAction::FireRecovery,
                )
            } else {
                (
                    MonitorStateEnum::PendingUp,
                    0,
                    new_recovery,
                    AlertAction::None,
                )
            }
        }

        // -----------------------------------------------------------------------
        // PendingUp + fail
        // -----------------------------------------------------------------------
        (MonitorStateEnum::PendingUp, false) => (MonitorStateEnum::Down, 1, 0, AlertAction::None),
    }
}

/// Determines whether a repeat DOWN alert should fire.
fn should_fire_repeat(
    state: &MonitorState,
    config: &StateMachineConfig,
    now: DateTime<Utc>,
) -> AlertAction {
    let last_alerted = match state.last_alerted_at {
        Some(t) => t,
        None => return AlertAction::None,
    };

    let elapsed = now.signed_duration_since(last_alerted).num_seconds();
    if elapsed >= config.repeat_interval_secs {
        AlertAction::FireRepeat
    } else {
        AlertAction::None
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    fn make_state(
        state: &str,
        fail_counter: i32,
        recovery_counter: i32,
        last_alerted_at: Option<DateTime<Utc>>,
        alerted_down_at: Option<DateTime<Utc>>,
    ) -> MonitorState {
        MonitorState {
            monitor_id: Uuid::new_v4(),
            state: state.to_string(),
            fail_counter,
            recovery_counter,
            last_check_at: None,
            next_check_at: Utc::now(),
            alerted_down_at,
            last_alerted_at,
            alert_count: 0,
            incident_id: None,
        }
    }

    fn config(
        fail_threshold: i32,
        recovery_threshold: i32,
        repeat_secs: i64,
    ) -> StateMachineConfig {
        StateMachineConfig {
            fail_threshold,
            recovery_threshold,
            repeat_interval_secs: repeat_secs,
        }
    }

    // -------------------------------------------------------------------------
    // UP transitions
    // -------------------------------------------------------------------------

    #[test]
    fn test_up_success_stays_up() {
        let state = make_state("up", 0, 0, None, None);
        let (new_state, fail, recovery, action) =
            transition(&state, &config(2, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Up);
        assert_eq!(fail, 0);
        assert_eq!(recovery, 0);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_up_one_fail_goes_pending_down() {
        let state = make_state("up", 0, 0, None, None);
        let (new_state, fail, _, action) =
            transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::PendingDown);
        assert_eq!(fail, 1);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_up_fail_threshold_1_goes_directly_down() {
        let state = make_state("up", 0, 0, None, None);
        let (new_state, _, _, action) = transition(&state, &config(1, 2, 3600), false, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Down);
        assert_eq!(action, AlertAction::FireDown);
    }

    // -------------------------------------------------------------------------
    // PendingDown transitions
    // -------------------------------------------------------------------------

    #[test]
    fn test_pending_down_fail_reaches_threshold_goes_down() {
        let state = make_state("pending_down", 1, 0, None, None);
        let (new_state, fail, _, action) =
            transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Down);
        assert_eq!(fail, 2);
        assert_eq!(action, AlertAction::FireDown);
    }

    #[test]
    fn test_pending_down_success_reduces_fail_counter() {
        let state = make_state("pending_down", 1, 0, None, None);
        let (new_state, fail, _, action) =
            transition(&state, &config(3, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Up);
        assert_eq!(fail, 0);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_pending_down_success_with_remaining_fail_stays_pending() {
        let state = make_state("pending_down", 2, 0, None, None);
        let (new_state, fail, _, action) =
            transition(&state, &config(4, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::PendingDown);
        assert_eq!(fail, 1);
        assert_eq!(action, AlertAction::None);
    }

    // -------------------------------------------------------------------------
    // DOWN transitions
    // -------------------------------------------------------------------------

    #[test]
    fn test_down_success_goes_pending_up_immediately() {
        let state = make_state("down", 0, 0, None, None);
        let (new_state, _, recovery, action) =
            transition(&state, &config(2, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::PendingUp);
        assert_eq!(recovery, 1);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_down_success_resets_recovery_counter_on_pending_up() {
        // Even with an existing recovery_counter, Down+success always → PendingUp/1
        let state = make_state("down", 0, 1, None, None);
        let (new_state, _, recovery, action) =
            transition(&state, &config(2, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::PendingUp);
        assert_eq!(recovery, 1);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_down_success_threshold_1_goes_directly_up() {
        let state = make_state("down", 0, 0, None, None);
        let (new_state, _, _, action) = transition(&state, &config(2, 1, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Up);
        assert_eq!(action, AlertAction::FireRecovery);
    }

    #[test]
    fn test_down_fail_no_last_alerted_no_repeat() {
        let state = make_state("down", 3, 0, None, None);
        let (new_state, _, _, action) = transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Down);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_down_fail_last_alerted_recent_no_repeat() {
        let recent = Utc::now() - Duration::seconds(100);
        let state = make_state("down", 3, 0, Some(recent), None);
        let (_, _, _, action) = transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_down_fail_last_alerted_old_enough_fires_repeat() {
        let old = Utc::now() - Duration::seconds(3700);
        let state = make_state("down", 3, 0, Some(old), None);
        let (_, _, _, action) = transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(action, AlertAction::FireRepeat);
    }

    // -------------------------------------------------------------------------
    // PendingUp transitions
    // -------------------------------------------------------------------------

    #[test]
    fn test_pending_up_success_reaches_threshold_fires_recovery() {
        let state = make_state("pending_up", 0, 1, None, None);
        let (new_state, _, _, action) = transition(&state, &config(2, 2, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Up);
        assert_eq!(action, AlertAction::FireRecovery);
    }

    #[test]
    fn test_pending_up_fail_goes_back_to_down() {
        let state = make_state("pending_up", 0, 1, None, None);
        let (new_state, fail, _, action) =
            transition(&state, &config(2, 2, 3600), false, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Down);
        assert_eq!(fail, 1);
        assert_eq!(action, AlertAction::None);
    }

    #[test]
    fn test_pending_up_success_not_enough_recovery_stays_pending() {
        let state = make_state("pending_up", 0, 0, None, None);
        let (new_state, _, recovery, action) =
            transition(&state, &config(2, 3, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::PendingUp);
        assert_eq!(recovery, 1);
        assert_eq!(action, AlertAction::None);
    }

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    #[test]
    fn test_recovery_threshold_1_immediate_recovery() {
        let state = make_state("pending_up", 0, 0, None, None);
        let (new_state, _, _, action) = transition(&state, &config(2, 1, 3600), true, Utc::now());
        assert_eq!(new_state, MonitorStateEnum::Up);
        assert_eq!(action, AlertAction::FireRecovery);
    }

    #[test]
    fn test_up_resets_fail_counter_on_success() {
        let state = make_state("up", 0, 0, None, None);
        let (_, fail, _, _) = transition(&state, &config(5, 2, 3600), true, Utc::now());
        assert_eq!(fail, 0);
    }
}
