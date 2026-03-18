#[allow(unused_imports, dead_code, clippy::all)]
mod generated;

mod client;
mod config;
mod output;

use clap::{Parser, Subcommand};
use config::CliConfig;

#[derive(Parser)]
#[command(name = "rustrak", about = "Rustrak CLI — error tracking client")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Configure server URL and API token
    Config {
        /// Server URL (e.g. http://localhost:8080)
        #[arg(long)]
        url: Option<String>,
        /// API bearer token (40-char hex)
        #[arg(long)]
        token: Option<String>,
    },

    /// Manage projects
    #[command(subcommand)]
    Projects(ProjectsCmd),

    /// Manage issues
    #[command(subcommand)]
    Issues(IssuesCmd),

    /// View events
    #[command(subcommand)]
    Events(EventsCmd),

    /// Manage API tokens
    #[command(subcommand)]
    Tokens(TokensCmd),

    /// Manage alert channels
    #[command(subcommand)]
    Channels(ChannelsCmd),

    /// Manage alert rules
    #[command(subcommand)]
    Rules(RulesCmd),

    /// View alert history
    AlertHistory {
        /// Project ID
        project_id: i32,
        /// Max entries to return
        #[arg(long, default_value = "50")]
        limit: i64,
    },

    /// Check server health
    Health,
}

// ── Projects ──────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum ProjectsCmd {
    /// List all projects
    List {
        #[arg(long, default_value = "1")]
        page: i64,
        #[arg(long, default_value = "20")]
        per_page: i64,
    },
    /// Get a project by ID
    Get { id: i32 },
    /// Create a new project
    Create {
        /// Project name
        name: String,
        /// Project slug (auto-generated if omitted)
        #[arg(long)]
        slug: Option<String>,
    },
    /// Update a project
    Update {
        id: i32,
        /// New name
        #[arg(long)]
        name: String,
    },
    /// Delete a project
    Delete { id: i32 },
}

// ── Issues ────────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum IssuesCmd {
    /// List issues for a project
    List {
        project_id: i32,
        #[arg(long, default_value = "open")]
        filter: String,
        #[arg(long, default_value = "last_seen")]
        sort: String,
        #[arg(long, default_value = "1")]
        page: i64,
        #[arg(long, default_value = "20")]
        per_page: i64,
    },
    /// Get an issue
    Get { project_id: i32, issue_id: String },
    /// Resolve an issue
    Resolve { project_id: i32, issue_id: String },
    /// Unresolve an issue
    Unresolve { project_id: i32, issue_id: String },
    /// Mute an issue
    Mute { project_id: i32, issue_id: String },
    /// Unmute an issue
    Unmute { project_id: i32, issue_id: String },
    /// Delete an issue
    Delete { project_id: i32, issue_id: String },
}

// ── Events ────────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum EventsCmd {
    /// List events for an issue
    List {
        project_id: i32,
        issue_id: String,
        #[arg(long)]
        cursor: Option<String>,
    },
    /// Get full event details
    Get {
        project_id: i32,
        issue_id: String,
        event_id: String,
    },
}

// ── Tokens ────────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum TokensCmd {
    /// List all tokens (masked)
    List,
    /// Create a new token
    Create {
        /// Token description
        #[arg(long)]
        description: Option<String>,
    },
    /// Delete a token
    Delete { id: i32 },
}

// ── Alert Channels ────────────────────────────────────────────────────

#[derive(Subcommand)]
enum ChannelsCmd {
    /// List all notification channels
    List,
    /// Get a channel
    Get { id: i32 },
    /// Delete a channel
    Delete { id: i32 },
    /// Test a channel
    Test { id: i32 },
}

// ── Alert Rules ───────────────────────────────────────────────────────

#[derive(Subcommand)]
enum RulesCmd {
    /// List alert rules for a project
    List { project_id: i32 },
    /// Get an alert rule
    Get { project_id: i32, rule_id: i32 },
    /// Delete an alert rule
    Delete { project_id: i32, rule_id: i32 },
}

// ── Main ──────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Config { url, token } => cmd_config(url, token),
        Commands::Health => cmd_health().await,
        Commands::Projects(cmd) => cmd_projects(cmd).await,
        Commands::Issues(cmd) => cmd_issues(cmd).await,
        Commands::Events(cmd) => cmd_events(cmd).await,
        Commands::Tokens(cmd) => cmd_tokens(cmd).await,
        Commands::Channels(cmd) => cmd_channels(cmd).await,
        Commands::Rules(cmd) => cmd_rules(cmd).await,
        Commands::AlertHistory { project_id, limit } => cmd_alert_history(project_id, limit).await,
    }
}

fn die(msg: &str) -> ! {
    eprintln!("Error: {}", msg);
    std::process::exit(1);
}

fn load_client() -> generated::Client {
    let config = CliConfig::load();
    client::build_client(&config).unwrap_or_else(|e| die(&e))
}

fn parse_uuid(s: &str) -> uuid::Uuid {
    s.parse().unwrap_or_else(|_| die(&format!("Invalid UUID: {}", s)))
}

// ── Config ────────────────────────────────────────────────────────────

fn cmd_config(url: Option<String>, token: Option<String>) {
    let mut config = CliConfig::load();

    if url.is_none() && token.is_none() {
        // Show current config
        println!("Config file: {}", CliConfig::path().display());
        println!(
            "URL:   {}",
            config.url.as_deref().unwrap_or("(not set)")
        );
        println!(
            "Token: {}",
            config
                .token
                .as_deref()
                .map(|t| {
                    if t.len() > 8 {
                        format!("{}...", &t[..8])
                    } else {
                        t.to_string()
                    }
                })
                .unwrap_or_else(|| "(not set)".to_string())
        );
        return;
    }

    if let Some(u) = url {
        config.url = Some(u.trim_end_matches('/').to_string());
    }
    if let Some(t) = token {
        config.token = Some(t);
    }
    config.save().unwrap_or_else(|e| die(&format!("Failed to save config: {}", e)));
    println!("Configuration saved to {}", CliConfig::path().display());
}

// ── Health ────────────────────────────────────────────────────────────

async fn cmd_health() {
    let c = load_client();
    match c.readiness().send().await {
        Ok(resp) => output::json(&*resp),
        Err(e) => output::handle_error(e),
    }
}

// ── Projects ──────────────────────────────────────────────────────────

async fn cmd_projects(cmd: ProjectsCmd) {
    let c = load_client();
    match cmd {
        ProjectsCmd::List { page, per_page } => {
            match c.list_projects().page(page).per_page(per_page).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        ProjectsCmd::Get { id } => match c.get_project().id(id).send().await {
            Ok(resp) => output::json(&*resp),
            Err(e) => output::handle_error(e),
        },
        ProjectsCmd::Create { name, slug } => {
            let body = generated::types::CreateProject {
                name: name.into(),
                slug: slug.map(Into::into),
            };
            match c.create_project().body(body).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        ProjectsCmd::Update { id, name } => {
            let body = generated::types::UpdateProject {
                name: Some(name.into()),
            };
            match c.update_project().id(id).body(body).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        ProjectsCmd::Delete { id } => match c.delete_project().id(id).send().await {
            Ok(_) => println!("Project {} deleted.", id),
            Err(e) => output::handle_error(e),
        },
    }
}

// ── Issues ────────────────────────────────────────────────────────────

async fn cmd_issues(cmd: IssuesCmd) {
    let c = load_client();
    match cmd {
        IssuesCmd::List {
            project_id,
            filter,
            sort,
            page,
            per_page,
        } => {
            let filter = parse_issue_filter(&filter);
            let sort = parse_issue_sort(&sort);
            match c
                .list_issues()
                .project_id(project_id)
                .filter(filter)
                .sort(sort)
                .page(page)
                .per_page(per_page)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Get {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            match c.get_issue().project_id(project_id).issue_id(uid).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Resolve {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            let body = generated::types::UpdateIssueState {
                is_resolved: Some(true),
                is_muted: None,
            };
            match c
                .update_issue()
                .project_id(project_id)
                .issue_id(uid)
                .body(body)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Unresolve {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            let body = generated::types::UpdateIssueState {
                is_resolved: Some(false),
                is_muted: None,
            };
            match c
                .update_issue()
                .project_id(project_id)
                .issue_id(uid)
                .body(body)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Mute {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            let body = generated::types::UpdateIssueState {
                is_resolved: None,
                is_muted: Some(true),
            };
            match c
                .update_issue()
                .project_id(project_id)
                .issue_id(uid)
                .body(body)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Unmute {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            let body = generated::types::UpdateIssueState {
                is_resolved: None,
                is_muted: Some(false),
            };
            match c
                .update_issue()
                .project_id(project_id)
                .issue_id(uid)
                .body(body)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        IssuesCmd::Delete {
            project_id,
            issue_id,
        } => {
            let uid = parse_uuid(&issue_id);
            match c
                .delete_issue()
                .project_id(project_id)
                .issue_id(uid)
                .send()
                .await
            {
                Ok(_) => println!("Issue {} deleted.", issue_id),
                Err(e) => output::handle_error(e),
            }
        }
    }
}

fn parse_issue_filter(s: &str) -> generated::types::IssueFilter {
    match s {
        "open" => generated::types::IssueFilter::Open,
        "resolved" => generated::types::IssueFilter::Resolved,
        "muted" => generated::types::IssueFilter::Muted,
        "all" => generated::types::IssueFilter::All,
        other => die(&format!(
            "Invalid filter '{}'. Use: open, resolved, muted, all",
            other
        )),
    }
}

fn parse_issue_sort(s: &str) -> generated::types::IssueSort {
    match s {
        "last_seen" => generated::types::IssueSort::LastSeen,
        "digest_order" => generated::types::IssueSort::DigestOrder,
        other => die(&format!(
            "Invalid sort '{}'. Use: last_seen, digest_order",
            other
        )),
    }
}

// ── Events ────────────────────────────────────────────────────────────

async fn cmd_events(cmd: EventsCmd) {
    let c = load_client();
    match cmd {
        EventsCmd::List {
            project_id,
            issue_id,
            cursor,
        } => {
            let uid = parse_uuid(&issue_id);
            let mut req = c.list_events().project_id(project_id).issue_id(uid);
            if let Some(cur) = cursor {
                req = req.cursor(cur);
            }
            match req.send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        EventsCmd::Get {
            project_id,
            issue_id,
            event_id,
        } => {
            let iid = parse_uuid(&issue_id);
            let eid = parse_uuid(&event_id);
            match c
                .get_event()
                .project_id(project_id)
                .issue_id(iid)
                .event_id(eid)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
    }
}

// ── Tokens ────────────────────────────────────────────────────────────

async fn cmd_tokens(cmd: TokensCmd) {
    let c = load_client();
    match cmd {
        TokensCmd::List => match c.list_tokens().send().await {
            Ok(resp) => output::json(&*resp),
            Err(e) => output::handle_error(e),
        },
        TokensCmd::Create { description } => {
            let body = generated::types::CreateAuthToken {
                description: description.map(Into::into),
            };
            match c.create_token().body(body).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        TokensCmd::Delete { id } => match c.delete_token().id(id).send().await {
            Ok(_) => println!("Token {} deleted.", id),
            Err(e) => output::handle_error(e),
        },
    }
}

// ── Alert Channels ────────────────────────────────────────────────────

async fn cmd_channels(cmd: ChannelsCmd) {
    let c = load_client();
    match cmd {
        ChannelsCmd::List => match c.list_channels().send().await {
            Ok(resp) => output::json(&*resp),
            Err(e) => output::handle_error(e),
        },
        ChannelsCmd::Get { id } => match c.get_channel().id(id).send().await {
            Ok(resp) => output::json(&*resp),
            Err(e) => output::handle_error(e),
        },
        ChannelsCmd::Delete { id } => match c.delete_channel().id(id).send().await {
            Ok(_) => println!("Channel {} deleted.", id),
            Err(e) => output::handle_error(e),
        },
        ChannelsCmd::Test { id } => match c.test_channel().id(id).send().await {
            Ok(resp) => output::json(&*resp),
            Err(e) => output::handle_error(e),
        },
    }
}

// ── Alert Rules ───────────────────────────────────────────────────────

async fn cmd_rules(cmd: RulesCmd) {
    let c = load_client();
    match cmd {
        RulesCmd::List { project_id } => {
            match c.list_rules().project_id(project_id).send().await {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        RulesCmd::Get {
            project_id,
            rule_id,
        } => {
            match c
                .get_rule()
                .project_id(project_id)
                .rule_id(rule_id)
                .send()
                .await
            {
                Ok(resp) => output::json(&*resp),
                Err(e) => output::handle_error(e),
            }
        }
        RulesCmd::Delete {
            project_id,
            rule_id,
        } => {
            match c
                .delete_rule()
                .project_id(project_id)
                .rule_id(rule_id)
                .send()
                .await
            {
                Ok(_) => println!("Rule {} deleted.", rule_id),
                Err(e) => output::handle_error(e),
            }
        }
    }
}

// ── Alert History ─────────────────────────────────────────────────────

async fn cmd_alert_history(project_id: i32, limit: i64) {
    let c = load_client();
    match c
        .list_history()
        .project_id(project_id)
        .limit(limit)
        .send()
        .await
    {
        Ok(resp) => output::json(&*resp),
        Err(e) => output::handle_error(e),
    }
}
