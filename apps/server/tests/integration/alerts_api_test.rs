//! Integration tests for the Alerts API
//!
//! Tests the notification channels, alert rules, and alert triggering
//! with a real PostgreSQL database.

use crate::common::TestDb;
use actix_session::{storage::CookieSessionStore, SessionMiddleware};
use actix_web::{cookie::Key, test, web, App};
use rustrak::config::{Config, DatabaseConfig, RateLimitConfig};
use rustrak::models::{
    AlertRuleChannelInput, AlertType, ChannelType, CreateAlertRule, CreateNotificationChannel,
    UpdateAlertRule, UpdateNotificationChannel,
};
use rustrak::routes;
use rustrak::services::{AlertService, ProjectService};
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

/// Creates a test config
fn create_test_config() -> Config {
    Config {
        host: "127.0.0.1".to_string(),
        port: 0,
        database: DatabaseConfig {
            url: "postgres://test:test@localhost/test".to_string(),
            max_connections: 5,
            min_connections: 1,
            acquire_timeout: Duration::from_secs(5),
            idle_timeout: Duration::from_secs(60),
            max_lifetime: Duration::from_secs(300),
        },
        rate_limit: RateLimitConfig {
            max_events_per_minute: 1000,
            max_events_per_hour: 10000,
            max_events_per_project_per_minute: 500,
            max_events_per_project_per_hour: 5000,
        },
        security: rustrak::config::SecurityConfig {
            ssl_proxy: false,
            session_secret_key: None,
        },
        ingest_dir: None,
        public_url: None,
        sourcemap_storage_path: "/tmp/test_sourcemaps".to_string(),
        max_chunk_size_bytes: 10 * 1024 * 1024,
        session_flush_interval_secs: 30,
        session_cardinality_cap: 10_000,
    }
}

/// Session key for tests
fn test_session_key() -> Key {
    Key::from(&[0u8; 64])
}

/// Creates a test project and returns its ID
async fn create_test_project(pool: &rustrak::db::DbPool) -> i32 {
    let project = ProjectService::create(
        pool,
        rustrak::models::CreateProject {
            name: format!("Test Project {}", chrono::Utc::now().timestamp_millis()),
            slug: None,
            platform: None,
        },
    )
    .await
    .expect("Failed to create test project");
    project.id
}

#[tokio::test]
async fn test_event_alert_history_is_scoped_to_project() {
    let db = TestDb::new().await;
    let first_project = create_test_project(&db.pool).await;
    let second_project = create_test_project(&db.pool).await;
    let event_id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO alert_history (project_id, alert_type, channel_type, channel_name, status, idempotency_key) VALUES ($1, 'new_issue', 'webhook', 'test', 'pending', $2)",
    )
    .bind(first_project)
    .bind(format!(
        "event-{first_project}-{event_id}-new_issue-integration"
    ))
    .execute(&db.pool)
    .await
    .expect("alert history insert must succeed");

    assert!(AlertService::event_alert_exists(
        &db.pool,
        first_project,
        event_id,
        AlertType::NewIssue
    )
    .await
    .expect("first project lookup must succeed"));

    sqlx::query(
        "INSERT INTO alert_history (project_id, alert_type, channel_type, channel_name, status, idempotency_key) VALUES ($1, 'new_issue', 'webhook', 'legacy', 'pending', $2)",
    )
    .bind(first_project)
    .bind(format!("event-{event_id}-new_issue-integration"))
    .execute(&db.pool)
    .await
    .expect("legacy alert history insert must succeed");

    assert!(AlertService::event_alert_exists(
        &db.pool,
        first_project,
        event_id,
        AlertType::NewIssue,
    )
    .await
    .expect("first project legacy lookup must succeed"));

    assert!(!AlertService::event_alert_exists(
        &db.pool,
        second_project,
        event_id,
        AlertType::NewIssue,
    )
    .await
    .expect("second project lookup must succeed"));
}

#[tokio::test]
async fn test_alert_retry_queue_processes_pending_history_without_retry_time() {
    let db = TestDb::new().await;
    let project_id = create_test_project(&db.pool).await;

    sqlx::query(
        "INSERT INTO alert_history (project_id, alert_type, channel_type, channel_name, status, idempotency_key) VALUES ($1, 'new_issue', 'webhook', 'unconfigured', 'pending', $2)",
    )
    .bind(project_id)
    .bind(format!("retry-null-next-{project_id}"))
    .execute(&db.pool)
    .await
    .expect("pending alert history insert must succeed");

    assert_eq!(
        AlertService::process_retry_queue(&db.pool, 5)
            .await
            .expect("retry queue processing must succeed"),
        1
    );

    let status: String =
        sqlx::query_scalar("SELECT status FROM alert_history WHERE idempotency_key = $1")
            .bind(format!("retry-null-next-{project_id}"))
            .fetch_one(&db.pool)
            .await
            .expect("retry status lookup must succeed");
    assert_eq!(status, "failed");
}

// =============================================================================
// Service-Level Tests (Direct Database)
// =============================================================================

// These tests bypass HTTP and test the AlertService directly

#[tokio::test]
async fn test_channel_crud_service_level() {
    let db = TestDb::new().await;

    // Create channel
    let create_input = CreateNotificationChannel {
        name: "Test Webhook".to_string(),
        provider_type: ChannelType::Webhook,
        credentials: json!({
            "url": "https://example.com/webhook"
        }),
        is_enabled: true,
    };

    let channel = AlertService::create_channel(&db.pool, create_input)
        .await
        .expect("Failed to create channel");

    assert_eq!(channel.name, "Test Webhook");
    assert_eq!(channel.provider_type, ChannelType::Webhook);
    assert!(channel.is_enabled);

    // List channels
    let channels = AlertService::list_channels(&db.pool)
        .await
        .expect("Failed to list channels");
    assert_eq!(channels.len(), 1);
    assert_eq!(channels[0].id, channel.id);

    // Get channel
    let fetched = AlertService::get_channel(&db.pool, channel.id)
        .await
        .expect("Failed to get channel");
    assert_eq!(fetched.name, "Test Webhook");

    // Update channel
    let update_input = UpdateNotificationChannel {
        name: Some("Updated Webhook".to_string()),
        credentials: None,
        is_enabled: Some(false),
    };

    let updated = AlertService::update_channel(&db.pool, channel.id, update_input)
        .await
        .expect("Failed to update channel");
    assert_eq!(updated.name, "Updated Webhook");
    assert!(!updated.is_enabled);

    // Delete channel
    AlertService::delete_channel(&db.pool, channel.id)
        .await
        .expect("Failed to delete channel");

    // Verify deleted
    let result = AlertService::get_channel(&db.pool, channel.id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_channel_duplicate_name_fails() {
    let db = TestDb::new().await;

    let create_input1 = CreateNotificationChannel {
        name: "Unique Name".to_string(),
        provider_type: ChannelType::Webhook,
        credentials: json!({ "url": "https://example.com/webhook1" }),
        is_enabled: true,
    };

    AlertService::create_channel(&db.pool, create_input1)
        .await
        .expect("First channel should succeed");

    // Try to create another with the same name
    let create_input2 = CreateNotificationChannel {
        name: "Unique Name".to_string(),
        provider_type: ChannelType::Webhook,
        credentials: json!({ "url": "https://example.com/webhook2" }),
        is_enabled: true,
    };

    let result = AlertService::create_channel(&db.pool, create_input2).await;
    assert!(result.is_err());
    let err_msg = format!("{:?}", result.unwrap_err());
    assert!(err_msg.contains("already exists"));
}

#[tokio::test]
async fn test_channel_invalid_config_fails() {
    let db = TestDb::new().await;

    // Webhook with invalid URL format should fail
    let create_input = CreateNotificationChannel {
        name: "Invalid Webhook".to_string(),
        provider_type: ChannelType::Webhook,
        credentials: json!({ "url": "not-a-valid-url" }),
        is_enabled: true,
    };

    let result = AlertService::create_channel(&db.pool, create_input).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_slack_channel_config_validation() {
    let db = TestDb::new().await;

    // Invalid Slack webhook URL (wrong host, but method field present)
    let create_input = CreateNotificationChannel {
        name: "Invalid Slack".to_string(),
        provider_type: ChannelType::Slack,
        credentials: json!({
            "method": "webhook",
            "webhook_url": "https://example.com/not-slack"
        }),
        is_enabled: true,
    };

    let result = AlertService::create_channel(&db.pool, create_input).await;
    assert!(result.is_err());

    // Valid Slack webhook URL
    let valid_input = CreateNotificationChannel {
        name: "Valid Slack".to_string(),
        provider_type: ChannelType::Slack,
        credentials: json!({
            "method": "webhook",
            "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXX"
        }),
        is_enabled: true,
    };

    let channel = AlertService::create_channel(&db.pool, valid_input)
        .await
        .expect("Valid Slack channel should succeed");
    assert_eq!(channel.name, "Valid Slack");
}

#[tokio::test]
async fn test_rule_crud_service_level() {
    let db = TestDb::new().await;

    // First create a project and a channel
    let project_id = create_test_project(&db.pool).await;

    let channel = AlertService::create_channel(
        &db.pool,
        CreateNotificationChannel {
            name: "Alert Channel".to_string(),
            provider_type: ChannelType::Webhook,
            credentials: json!({ "url": "https://example.com/webhook" }),
            is_enabled: true,
        },
    )
    .await
    .expect("Failed to create channel");

    // Create rule
    let create_input = CreateAlertRule {
        name: "New Issue Alert".to_string(),
        alert_type: AlertType::NewIssue,
        channels: vec![AlertRuleChannelInput {
            integration_id: channel.id,
            routing_override: json!({}),
        }],
        conditions: json!({}),
        cooldown_minutes: 5,
    };

    let rule = AlertService::create_rule(&db.pool, project_id, create_input)
        .await
        .expect("Failed to create rule");

    assert_eq!(rule.name, "New Issue Alert");
    assert_eq!(rule.alert_type, AlertType::NewIssue);
    assert_eq!(rule.cooldown_minutes, 5);
    assert!(rule.is_enabled);

    // Verify channel linkage
    let linked_channels = AlertService::get_rule_channels(&db.pool, rule.id)
        .await
        .expect("Failed to get rule channels");
    assert_eq!(linked_channels, vec![channel.id]);

    // List rules
    let rules = AlertService::list_rules(&db.pool, project_id)
        .await
        .expect("Failed to list rules");
    assert_eq!(rules.len(), 1);

    // Get rule
    let fetched = AlertService::get_rule(&db.pool, rule.id)
        .await
        .expect("Failed to get rule");
    assert_eq!(fetched.name, "New Issue Alert");

    // Update rule
    let update_input = UpdateAlertRule {
        name: Some("Updated Alert".to_string()),
        is_enabled: Some(false),
        conditions: None,
        cooldown_minutes: Some(10),
        channels: None,
    };

    let updated = AlertService::update_rule(&db.pool, rule.id, update_input)
        .await
        .expect("Failed to update rule");
    assert_eq!(updated.name, "Updated Alert");
    assert!(!updated.is_enabled);
    assert_eq!(updated.cooldown_minutes, 10);

    // Delete rule
    AlertService::delete_rule(&db.pool, rule.id)
        .await
        .expect("Failed to delete rule");

    // Verify deleted
    let result = AlertService::get_rule(&db.pool, rule.id).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_rule_duplicate_alert_type_fails() {
    let db = TestDb::new().await;

    let project_id = create_test_project(&db.pool).await;

    let channel = AlertService::create_channel(
        &db.pool,
        CreateNotificationChannel {
            name: "Channel for Rules".to_string(),
            provider_type: ChannelType::Webhook,
            credentials: json!({ "url": "https://example.com/webhook" }),
            is_enabled: true,
        },
    )
    .await
    .expect("Failed to create channel");

    // Create first rule
    let create_input = CreateAlertRule {
        name: "First Rule".to_string(),
        alert_type: AlertType::NewIssue,
        channels: vec![AlertRuleChannelInput {
            integration_id: channel.id,
            routing_override: json!({}),
        }],
        conditions: json!({}),
        cooldown_minutes: 0,
    };

    AlertService::create_rule(&db.pool, project_id, create_input)
        .await
        .expect("First rule should succeed");

    // Try to create another with same alert type
    let duplicate_input = CreateAlertRule {
        name: "Duplicate Rule".to_string(),
        alert_type: AlertType::NewIssue, // Same type
        channels: vec![AlertRuleChannelInput {
            integration_id: channel.id,
            routing_override: json!({}),
        }],
        conditions: json!({}),
        cooldown_minutes: 0,
    };

    let result = AlertService::create_rule(&db.pool, project_id, duplicate_input).await;
    assert!(result.is_err());
    let err_msg = format!("{:?}", result.unwrap_err());
    assert!(err_msg.contains("already exists"));
}

#[tokio::test]
async fn test_rule_with_invalid_channel_fails() {
    let db = TestDb::new().await;

    let project_id = create_test_project(&db.pool).await;

    // Create rule with non-existent integration ID
    let create_input = CreateAlertRule {
        name: "Invalid Channel Rule".to_string(),
        alert_type: AlertType::NewIssue,
        channels: vec![AlertRuleChannelInput {
            integration_id: 99999, // Non-existent
            routing_override: json!({}),
        }],
        conditions: json!({}),
        cooldown_minutes: 0,
    };

    let result = AlertService::create_rule(&db.pool, project_id, create_input).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_update_rule_channels() {
    let db = TestDb::new().await;

    let project_id = create_test_project(&db.pool).await;

    // Create two channels
    let channel1 = AlertService::create_channel(
        &db.pool,
        CreateNotificationChannel {
            name: "Channel 1".to_string(),
            provider_type: ChannelType::Webhook,
            credentials: json!({ "url": "https://example.com/webhook1" }),
            is_enabled: true,
        },
    )
    .await
    .unwrap();

    let channel2 = AlertService::create_channel(
        &db.pool,
        CreateNotificationChannel {
            name: "Channel 2".to_string(),
            provider_type: ChannelType::Webhook,
            credentials: json!({ "url": "https://example.com/webhook2" }),
            is_enabled: true,
        },
    )
    .await
    .unwrap();

    // Create rule with channel1
    let rule = AlertService::create_rule(
        &db.pool,
        project_id,
        CreateAlertRule {
            name: "Multi Channel Rule".to_string(),
            alert_type: AlertType::NewIssue,
            channels: vec![AlertRuleChannelInput {
                integration_id: channel1.id,
                routing_override: json!({}),
            }],
            conditions: json!({}),
            cooldown_minutes: 0,
        },
    )
    .await
    .unwrap();

    // Verify initial channels
    let channels = AlertService::get_rule_channels(&db.pool, rule.id)
        .await
        .unwrap();
    assert_eq!(channels, vec![channel1.id]);

    // Update to use both channels
    AlertService::update_rule(
        &db.pool,
        rule.id,
        UpdateAlertRule {
            name: None,
            is_enabled: None,
            conditions: None,
            cooldown_minutes: None,
            channels: Some(vec![
                AlertRuleChannelInput {
                    integration_id: channel1.id,
                    routing_override: json!({}),
                },
                AlertRuleChannelInput {
                    integration_id: channel2.id,
                    routing_override: json!({}),
                },
            ]),
        },
    )
    .await
    .unwrap();

    // Verify updated channels
    let channels = AlertService::get_rule_channels(&db.pool, rule.id)
        .await
        .unwrap();
    assert_eq!(channels.len(), 2);
    assert!(channels.contains(&channel1.id));
    assert!(channels.contains(&channel2.id));

    // Update to remove channel1
    AlertService::update_rule(
        &db.pool,
        rule.id,
        UpdateAlertRule {
            name: None,
            is_enabled: None,
            conditions: None,
            cooldown_minutes: None,
            channels: Some(vec![AlertRuleChannelInput {
                integration_id: channel2.id,
                routing_override: json!({}),
            }]),
        },
    )
    .await
    .unwrap();

    // Verify only channel2 remains
    let channels = AlertService::get_rule_channels(&db.pool, rule.id)
        .await
        .unwrap();
    assert_eq!(channels, vec![channel2.id]);
}

#[tokio::test]
async fn test_deleting_channel_removes_from_rules() {
    let db = TestDb::new().await;

    let project_id = create_test_project(&db.pool).await;

    let channel = AlertService::create_channel(
        &db.pool,
        CreateNotificationChannel {
            name: "Deletable Channel".to_string(),
            provider_type: ChannelType::Webhook,
            credentials: json!({ "url": "https://example.com/webhook" }),
            is_enabled: true,
        },
    )
    .await
    .unwrap();

    // Create rule with this channel
    let rule = AlertService::create_rule(
        &db.pool,
        project_id,
        CreateAlertRule {
            name: "Rule with deletable channel".to_string(),
            alert_type: AlertType::NewIssue,
            channels: vec![AlertRuleChannelInput {
                integration_id: channel.id,
                routing_override: json!({}),
            }],
            conditions: json!({}),
            cooldown_minutes: 0,
        },
    )
    .await
    .unwrap();

    // Delete channel
    AlertService::delete_channel(&db.pool, channel.id)
        .await
        .unwrap();

    // Rule should still exist but have no channels
    let channels = AlertService::get_rule_channels(&db.pool, rule.id)
        .await
        .unwrap();
    assert!(channels.is_empty());
}

#[tokio::test]
async fn test_alert_history_empty() {
    let db = TestDb::new().await;

    let project_id = create_test_project(&db.pool).await;

    let history = AlertService::list_history(&db.pool, project_id, 50)
        .await
        .expect("Failed to list history");

    assert!(history.is_empty());
}

// =============================================================================
// HTTP Route Tests
// =============================================================================

// Note: These tests are marked as ignored because actix-web's test framework
// doesn't properly preserve session cookies. Full testing should be done via
// E2E tests with a real HTTP client.

#[actix_web::test]
async fn test_list_channels_unauthorized() {
    let db = TestDb::new().await;
    let config = create_test_config();

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), test_session_key())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::alerts::configure),
    )
    .await;

    // No session cookie
    let req = test::TestRequest::get()
        .uri("/api/integrations")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_list_rules_unauthorized() {
    let db = TestDb::new().await;
    let config = create_test_config();

    // Create a test project first
    let project_id = create_test_project(&db.pool).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), test_session_key())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::alerts::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/alert-rules", project_id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
async fn test_list_history_unauthorized() {
    let db = TestDb::new().await;
    let config = create_test_config();

    let project_id = create_test_project(&db.pool).await;

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .app_data(web::Data::new(config))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), test_session_key())
                    .cookie_secure(false)
                    .build(),
            )
            .configure(routes::alerts::configure),
    )
    .await;

    let req = test::TestRequest::get()
        .uri(&format!("/api/projects/{}/alert-history", project_id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 401);
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_create_channel_success() {
    // This test requires proper session cookie handling
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_create_rule_success() {
    // This test requires proper session cookie handling
}

#[actix_web::test]
#[ignore = "Session cookies not preserved in actix test framework - use E2E tests"]
async fn test_test_channel_endpoint() {
    // This test requires proper session cookie handling
}
