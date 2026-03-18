#[allow(unused_imports)]
pub use progenitor_client::{ByteStream, ClientInfo, Error, ResponseValue};
#[allow(unused_imports)]
use progenitor_client::{encode_path, ClientHooks, OperationInfo, RequestBuilderExt};
/// Types used as operation parameters and responses.
#[allow(clippy::all)]
pub mod types {
    /// Error types.
    pub mod error {
        /// Error from a `TryFrom` or `FromStr` implementation.
        pub struct ConversionError(::std::borrow::Cow<'static, str>);
        impl ::std::error::Error for ConversionError {}
        impl ::std::fmt::Display for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Display::fmt(&self.0, f)
            }
        }
        impl ::std::fmt::Debug for ConversionError {
            fn fmt(
                &self,
                f: &mut ::std::fmt::Formatter<'_>,
            ) -> Result<(), ::std::fmt::Error> {
                ::std::fmt::Debug::fmt(&self.0, f)
            }
        }
        impl From<&'static str> for ConversionError {
            fn from(value: &'static str) -> Self {
                Self(value.into())
            }
        }
        impl From<String> for ConversionError {
            fn from(value: String) -> Self {
                Self(value.into())
            }
        }
    }
    ///Alert delivery history record (audit log and retry queue)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Alert delivery history record (audit log and retry queue)",
    ///  "type": "object",
    ///  "required": [
    ///    "alert_type",
    ///    "attempt_count",
    ///    "channel_name",
    ///    "channel_type",
    ///    "created_at",
    ///    "id",
    ///    "idempotency_key",
    ///    "status"
    ///  ],
    ///  "properties": {
    ///    "alert_rule_id": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32"
    ///    },
    ///    "alert_type": {
    ///      "type": "string"
    ///    },
    ///    "attempt_count": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "channel_id": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32"
    ///    },
    ///    "channel_name": {
    ///      "type": "string"
    ///    },
    ///    "channel_type": {
    ///      "type": "string"
    ///    },
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "error_message": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "http_status_code": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "idempotency_key": {
    ///      "type": "string"
    ///    },
    ///    "issue_id": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "uuid"
    ///    },
    ///    "next_retry_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "project_id": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32"
    ///    },
    ///    "sent_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "status": {
    ///      "$ref": "#/components/schemas/AlertStatus"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AlertHistory {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub alert_rule_id: ::std::option::Option<i32>,
        pub alert_type: ::std::string::String,
        pub attempt_count: i32,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub channel_id: ::std::option::Option<i32>,
        pub channel_name: ::std::string::String,
        pub channel_type: ::std::string::String,
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub error_message: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub http_status_code: ::std::option::Option<i32>,
        pub id: i64,
        pub idempotency_key: ::std::string::String,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub issue_id: ::std::option::Option<::uuid::Uuid>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub next_retry_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub project_id: ::std::option::Option<i32>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub sent_at: ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
        pub status: AlertStatus,
    }
    impl AlertHistory {
        pub fn builder() -> builder::AlertHistory {
            Default::default()
        }
    }
    ///Per-project alert rule configuration
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Per-project alert rule configuration",
    ///  "type": "object",
    ///  "required": [
    ///    "alert_type",
    ///    "conditions",
    ///    "cooldown_minutes",
    ///    "created_at",
    ///    "id",
    ///    "is_enabled",
    ///    "name",
    ///    "project_id",
    ///    "updated_at"
    ///  ],
    ///  "properties": {
    ///    "alert_type": {
    ///      "$ref": "#/components/schemas/AlertType"
    ///    },
    ///    "conditions": {},
    ///    "cooldown_minutes": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "is_enabled": {
    ///      "type": "boolean"
    ///    },
    ///    "last_triggered_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    },
    ///    "project_id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "updated_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AlertRule {
        pub alert_type: AlertType,
        pub conditions: ::serde_json::Value,
        pub cooldown_minutes: i32,
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        pub id: i32,
        pub is_enabled: bool,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_triggered_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        pub name: ::std::string::String,
        pub project_id: i32,
        pub updated_at: ::chrono::DateTime<::chrono::offset::Utc>,
    }
    impl AlertRule {
        pub fn builder() -> builder::AlertRule {
            Default::default()
        }
    }
    ///Response for alert rule including linked channel IDs
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for alert rule including linked channel IDs",
    ///  "type": "object",
    ///  "required": [
    ///    "alert_type",
    ///    "channel_ids",
    ///    "conditions",
    ///    "cooldown_minutes",
    ///    "created_at",
    ///    "id",
    ///    "is_enabled",
    ///    "name",
    ///    "project_id",
    ///    "updated_at"
    ///  ],
    ///  "properties": {
    ///    "alert_type": {
    ///      "$ref": "#/components/schemas/AlertType"
    ///    },
    ///    "channel_ids": {
    ///      "type": "array",
    ///      "items": {
    ///        "type": "integer",
    ///        "format": "int32"
    ///      }
    ///    },
    ///    "conditions": {},
    ///    "cooldown_minutes": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "is_enabled": {
    ///      "type": "boolean"
    ///    },
    ///    "last_triggered_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    },
    ///    "project_id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "updated_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AlertRuleResponse {
        pub alert_type: AlertType,
        pub channel_ids: ::std::vec::Vec<i32>,
        pub conditions: ::serde_json::Value,
        pub cooldown_minutes: i32,
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        pub id: i32,
        pub is_enabled: bool,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_triggered_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        pub name: ::std::string::String,
        pub project_id: i32,
        pub updated_at: ::chrono::DateTime<::chrono::offset::Utc>,
    }
    impl AlertRuleResponse {
        pub fn builder() -> builder::AlertRuleResponse {
            Default::default()
        }
    }
    ///Status of an alert delivery attempt
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Status of an alert delivery attempt",
    ///  "type": "string",
    ///  "enum": [
    ///    "pending",
    ///    "sent",
    ///    "failed",
    ///    "skipped"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum AlertStatus {
        #[serde(rename = "pending")]
        Pending,
        #[serde(rename = "sent")]
        Sent,
        #[serde(rename = "failed")]
        Failed,
        #[serde(rename = "skipped")]
        Skipped,
    }
    impl ::std::fmt::Display for AlertStatus {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::Pending => f.write_str("pending"),
                Self::Sent => f.write_str("sent"),
                Self::Failed => f.write_str("failed"),
                Self::Skipped => f.write_str("skipped"),
            }
        }
    }
    impl ::std::str::FromStr for AlertStatus {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "pending" => Ok(Self::Pending),
                "sent" => Ok(Self::Sent),
                "failed" => Ok(Self::Failed),
                "skipped" => Ok(Self::Skipped),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for AlertStatus {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for AlertStatus {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for AlertStatus {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///Type of alert trigger
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Type of alert trigger",
    ///  "type": "string",
    ///  "enum": [
    ///    "new_issue",
    ///    "regression",
    ///    "unmute"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum AlertType {
        #[serde(rename = "new_issue")]
        NewIssue,
        #[serde(rename = "regression")]
        Regression,
        #[serde(rename = "unmute")]
        Unmute,
    }
    impl ::std::fmt::Display for AlertType {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::NewIssue => f.write_str("new_issue"),
                Self::Regression => f.write_str("regression"),
                Self::Unmute => f.write_str("unmute"),
            }
        }
    }
    impl ::std::str::FromStr for AlertType {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "new_issue" => Ok(Self::NewIssue),
                "regression" => Ok(Self::Regression),
                "unmute" => Ok(Self::Unmute),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for AlertType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for AlertType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for AlertType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///`AuthResponse`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "user"
    ///  ],
    ///  "properties": {
    ///    "user": {
    ///      "$ref": "#/components/schemas/UserResponse"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AuthResponse {
        pub user: UserResponse,
    }
    impl AuthResponse {
        pub fn builder() -> builder::AuthResponse {
            Default::default()
        }
    }
    ///Response that includes the full token (only on creation)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response that includes the full token (only on creation)",
    ///  "type": "object",
    ///  "required": [
    ///    "created_at",
    ///    "id",
    ///    "token"
    ///  ],
    ///  "properties": {
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "description": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "token": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AuthTokenCreatedResponse {
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub description: ::std::option::Option<::std::string::String>,
        pub id: i32,
        pub token: ::std::string::String,
    }
    impl AuthTokenCreatedResponse {
        pub fn builder() -> builder::AuthTokenCreatedResponse {
            Default::default()
        }
    }
    ///Response for listing (token is masked)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for listing (token is masked)",
    ///  "type": "object",
    ///  "required": [
    ///    "created_at",
    ///    "id",
    ///    "token_prefix"
    ///  ],
    ///  "properties": {
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "description": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "last_used_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "token_prefix": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct AuthTokenResponse {
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub description: ::std::option::Option<::std::string::String>,
        pub id: i32,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_used_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        pub token_prefix: ::std::string::String,
    }
    impl AuthTokenResponse {
        pub fn builder() -> builder::AuthTokenResponse {
            Default::default()
        }
    }
    ///Type of notification channel
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Type of notification channel",
    ///  "type": "string",
    ///  "enum": [
    ///    "webhook",
    ///    "email",
    ///    "slack"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum ChannelType {
        #[serde(rename = "webhook")]
        Webhook,
        #[serde(rename = "email")]
        Email,
        #[serde(rename = "slack")]
        Slack,
    }
    impl ::std::fmt::Display for ChannelType {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::Webhook => f.write_str("webhook"),
                Self::Email => f.write_str("email"),
                Self::Slack => f.write_str("slack"),
            }
        }
    }
    impl ::std::str::FromStr for ChannelType {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "webhook" => Ok(Self::Webhook),
                "email" => Ok(Self::Email),
                "slack" => Ok(Self::Slack),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for ChannelType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for ChannelType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for ChannelType {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///DTO for creating an alert rule
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for creating an alert rule",
    ///  "type": "object",
    ///  "required": [
    ///    "alert_type",
    ///    "name"
    ///  ],
    ///  "properties": {
    ///    "alert_type": {
    ///      "$ref": "#/components/schemas/AlertType"
    ///    },
    ///    "channel_ids": {
    ///      "type": "array",
    ///      "items": {
    ///        "type": "integer",
    ///        "format": "int32"
    ///      }
    ///    },
    ///    "conditions": {},
    ///    "cooldown_minutes": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct CreateAlertRule {
        pub alert_type: AlertType,
        #[serde(default, skip_serializing_if = "::std::vec::Vec::is_empty")]
        pub channel_ids: ::std::vec::Vec<i32>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub conditions: ::std::option::Option<::serde_json::Value>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub cooldown_minutes: ::std::option::Option<i32>,
        pub name: ::std::string::String,
    }
    impl CreateAlertRule {
        pub fn builder() -> builder::CreateAlertRule {
            Default::default()
        }
    }
    ///DTO for creating a new token
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for creating a new token",
    ///  "type": "object",
    ///  "properties": {
    ///    "description": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct CreateAuthToken {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub description: ::std::option::Option<::std::string::String>,
    }
    impl ::std::default::Default for CreateAuthToken {
        fn default() -> Self {
            Self {
                description: Default::default(),
            }
        }
    }
    impl CreateAuthToken {
        pub fn builder() -> builder::CreateAuthToken {
            Default::default()
        }
    }
    ///DTO for creating a notification channel
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for creating a notification channel",
    ///  "type": "object",
    ///  "required": [
    ///    "channel_type",
    ///    "config",
    ///    "name"
    ///  ],
    ///  "properties": {
    ///    "channel_type": {
    ///      "$ref": "#/components/schemas/ChannelType"
    ///    },
    ///    "config": {},
    ///    "is_enabled": {
    ///      "type": "boolean"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct CreateNotificationChannel {
        pub channel_type: ChannelType,
        pub config: ::serde_json::Value,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub is_enabled: ::std::option::Option<bool>,
        pub name: ::std::string::String,
    }
    impl CreateNotificationChannel {
        pub fn builder() -> builder::CreateNotificationChannel {
            Default::default()
        }
    }
    ///DTO for creating a new project
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for creating a new project",
    ///  "type": "object",
    ///  "required": [
    ///    "name"
    ///  ],
    ///  "properties": {
    ///    "name": {
    ///      "type": "string"
    ///    },
    ///    "slug": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct CreateProject {
        pub name: ::std::string::String,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub slug: ::std::option::Option<::std::string::String>,
    }
    impl CreateProject {
        pub fn builder() -> builder::CreateProject {
            Default::default()
        }
    }
    ///`CreateUserRequest`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "email",
    ///    "password"
    ///  ],
    ///  "properties": {
    ///    "email": {
    ///      "type": "string"
    ///    },
    ///    "password": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct CreateUserRequest {
        pub email: ::std::string::String,
        pub password: ::std::string::String,
    }
    impl CreateUserRequest {
        pub fn builder() -> builder::CreateUserRequest {
            Default::default()
        }
    }
    ///Email channel configuration
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Email channel configuration",
    ///  "type": "object",
    ///  "required": [
    ///    "recipients"
    ///  ],
    ///  "properties": {
    ///    "from_address": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "recipients": {
    ///      "type": "array",
    ///      "items": {
    ///        "type": "string"
    ///      }
    ///    },
    ///    "smtp_host": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "smtp_password": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "smtp_port": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32",
    ///      "minimum": 0.0
    ///    },
    ///    "smtp_username": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct EmailConfig {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub from_address: ::std::option::Option<::std::string::String>,
        pub recipients: ::std::vec::Vec<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub smtp_host: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub smtp_password: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub smtp_port: ::std::option::Option<i32>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub smtp_username: ::std::option::Option<::std::string::String>,
    }
    impl EmailConfig {
        pub fn builder() -> builder::EmailConfig {
            Default::default()
        }
    }
    ///`ErrorDetail`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "message",
    ///    "type"
    ///  ],
    ///  "properties": {
    ///    "message": {
    ///      "type": "string"
    ///    },
    ///    "type": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct ErrorDetail {
        pub message: ::std::string::String,
        #[serde(rename = "type")]
        pub type_: ::std::string::String,
    }
    impl ErrorDetail {
        pub fn builder() -> builder::ErrorDetail {
            Default::default()
        }
    }
    ///JSON error response structure
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "JSON error response structure",
    ///  "type": "object",
    ///  "required": [
    ///    "error"
    ///  ],
    ///  "properties": {
    ///    "error": {
    ///      "$ref": "#/components/schemas/ErrorDetail"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct ErrorResponse {
        pub error: ErrorDetail,
    }
    impl ErrorResponse {
        pub fn builder() -> builder::ErrorResponse {
            Default::default()
        }
    }
    ///Response for API (full detail)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for API (full detail)",
    ///  "type": "object",
    ///  "required": [
    ///    "data",
    ///    "environment",
    ///    "event_id",
    ///    "id",
    ///    "ingested_at",
    ///    "issue_id",
    ///    "level",
    ///    "platform",
    ///    "release",
    ///    "sdk_name",
    ///    "sdk_version",
    ///    "server_name",
    ///    "timestamp",
    ///    "title"
    ///  ],
    ///  "properties": {
    ///    "data": {},
    ///    "environment": {
    ///      "type": "string"
    ///    },
    ///    "event_id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "ingested_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "issue_id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "level": {
    ///      "type": "string"
    ///    },
    ///    "platform": {
    ///      "type": "string"
    ///    },
    ///    "release": {
    ///      "type": "string"
    ///    },
    ///    "sdk_name": {
    ///      "type": "string"
    ///    },
    ///    "sdk_version": {
    ///      "type": "string"
    ///    },
    ///    "server_name": {
    ///      "type": "string"
    ///    },
    ///    "timestamp": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "title": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct EventDetailResponse {
        pub data: ::serde_json::Value,
        pub environment: ::std::string::String,
        pub event_id: ::uuid::Uuid,
        pub id: ::uuid::Uuid,
        pub ingested_at: ::chrono::DateTime<::chrono::offset::Utc>,
        pub issue_id: ::uuid::Uuid,
        pub level: ::std::string::String,
        pub platform: ::std::string::String,
        pub release: ::std::string::String,
        pub sdk_name: ::std::string::String,
        pub sdk_version: ::std::string::String,
        pub server_name: ::std::string::String,
        pub timestamp: ::chrono::DateTime<::chrono::offset::Utc>,
        pub title: ::std::string::String,
    }
    impl EventDetailResponse {
        pub fn builder() -> builder::EventDetailResponse {
            Default::default()
        }
    }
    ///Response for API (list view)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for API (list view)",
    ///  "type": "object",
    ///  "required": [
    ///    "environment",
    ///    "event_id",
    ///    "id",
    ///    "issue_id",
    ///    "level",
    ///    "platform",
    ///    "release",
    ///    "timestamp",
    ///    "title"
    ///  ],
    ///  "properties": {
    ///    "environment": {
    ///      "type": "string"
    ///    },
    ///    "event_id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "issue_id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "level": {
    ///      "type": "string"
    ///    },
    ///    "platform": {
    ///      "type": "string"
    ///    },
    ///    "release": {
    ///      "type": "string"
    ///    },
    ///    "timestamp": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "title": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct EventResponse {
        pub environment: ::std::string::String,
        pub event_id: ::uuid::Uuid,
        pub id: ::uuid::Uuid,
        pub issue_id: ::uuid::Uuid,
        pub level: ::std::string::String,
        pub platform: ::std::string::String,
        pub release: ::std::string::String,
        pub timestamp: ::chrono::DateTime<::chrono::offset::Utc>,
        pub title: ::std::string::String,
    }
    impl EventResponse {
        pub fn builder() -> builder::EventResponse {
            Default::default()
        }
    }
    ///Filter for issues listing
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Filter for issues listing",
    ///  "type": "string",
    ///  "enum": [
    ///    "open",
    ///    "resolved",
    ///    "muted",
    ///    "all"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum IssueFilter {
        #[serde(rename = "open")]
        Open,
        #[serde(rename = "resolved")]
        Resolved,
        #[serde(rename = "muted")]
        Muted,
        #[serde(rename = "all")]
        All,
    }
    impl ::std::fmt::Display for IssueFilter {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::Open => f.write_str("open"),
                Self::Resolved => f.write_str("resolved"),
                Self::Muted => f.write_str("muted"),
                Self::All => f.write_str("all"),
            }
        }
    }
    impl ::std::str::FromStr for IssueFilter {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "open" => Ok(Self::Open),
                "resolved" => Ok(Self::Resolved),
                "muted" => Ok(Self::Muted),
                "all" => Ok(Self::All),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for IssueFilter {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for IssueFilter {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for IssueFilter {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///Response for API
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for API",
    ///  "type": "object",
    ///  "required": [
    ///    "event_count",
    ///    "first_seen",
    ///    "id",
    ///    "is_muted",
    ///    "is_resolved",
    ///    "last_seen",
    ///    "project_id",
    ///    "short_id",
    ///    "title",
    ///    "value"
    ///  ],
    ///  "properties": {
    ///    "event_count": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "first_seen": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "id": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "is_muted": {
    ///      "type": "boolean"
    ///    },
    ///    "is_resolved": {
    ///      "type": "boolean"
    ///    },
    ///    "last_seen": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "level": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "platform": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "project_id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "short_id": {
    ///      "type": "string"
    ///    },
    ///    "title": {
    ///      "type": "string"
    ///    },
    ///    "value": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct IssueResponse {
        pub event_count: i32,
        pub first_seen: ::chrono::DateTime<::chrono::offset::Utc>,
        pub id: ::uuid::Uuid,
        pub is_muted: bool,
        pub is_resolved: bool,
        pub last_seen: ::chrono::DateTime<::chrono::offset::Utc>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub level: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub platform: ::std::option::Option<::std::string::String>,
        pub project_id: i32,
        pub short_id: ::std::string::String,
        pub title: ::std::string::String,
        pub value: ::std::string::String,
    }
    impl IssueResponse {
        pub fn builder() -> builder::IssueResponse {
            Default::default()
        }
    }
    ///Sort mode for issues listing
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Sort mode for issues listing",
    ///  "type": "string",
    ///  "enum": [
    ///    "digest_order",
    ///    "last_seen"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum IssueSort {
        #[serde(rename = "digest_order")]
        DigestOrder,
        #[serde(rename = "last_seen")]
        LastSeen,
    }
    impl ::std::fmt::Display for IssueSort {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::DigestOrder => f.write_str("digest_order"),
                Self::LastSeen => f.write_str("last_seen"),
            }
        }
    }
    impl ::std::str::FromStr for IssueSort {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "digest_order" => Ok(Self::DigestOrder),
                "last_seen" => Ok(Self::LastSeen),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for IssueSort {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for IssueSort {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for IssueSort {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///`LivenessResponse`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "status"
    ///  ],
    ///  "properties": {
    ///    "status": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct LivenessResponse {
        pub status: ::std::string::String,
    }
    impl LivenessResponse {
        pub fn builder() -> builder::LivenessResponse {
            Default::default()
        }
    }
    ///`LoginRequest`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "email",
    ///    "password"
    ///  ],
    ///  "properties": {
    ///    "email": {
    ///      "type": "string"
    ///    },
    ///    "password": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct LoginRequest {
        pub email: ::std::string::String,
        pub password: ::std::string::String,
    }
    impl LoginRequest {
        pub fn builder() -> builder::LoginRequest {
            Default::default()
        }
    }
    ///Global notification channel (e.g., Slack workspace, webhook endpoint)
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Global notification channel (e.g., Slack workspace, webhook endpoint)",
    ///  "type": "object",
    ///  "required": [
    ///    "channel_type",
    ///    "config",
    ///    "created_at",
    ///    "failure_count",
    ///    "id",
    ///    "is_enabled",
    ///    "name",
    ///    "updated_at"
    ///  ],
    ///  "properties": {
    ///    "channel_type": {
    ///      "$ref": "#/components/schemas/ChannelType"
    ///    },
    ///    "config": {},
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "failure_count": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "is_enabled": {
    ///      "type": "boolean"
    ///    },
    ///    "last_failure_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "last_failure_message": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "last_success_at": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ],
    ///      "format": "date-time"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    },
    ///    "updated_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct NotificationChannel {
        pub channel_type: ChannelType,
        pub config: ::serde_json::Value,
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        pub failure_count: i32,
        pub id: i32,
        pub is_enabled: bool,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_failure_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_failure_message: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub last_success_at: ::std::option::Option<
            ::chrono::DateTime<::chrono::offset::Utc>,
        >,
        pub name: ::std::string::String,
        pub updated_at: ::chrono::DateTime<::chrono::offset::Utc>,
    }
    impl NotificationChannel {
        pub fn builder() -> builder::NotificationChannel {
            Default::default()
        }
    }
    ///Paginated issue response (offset-based) - concrete type for OpenAPI
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Paginated issue response (offset-based) - concrete type for OpenAPI",
    ///  "type": "object",
    ///  "required": [
    ///    "items",
    ///    "page",
    ///    "per_page",
    ///    "total_count",
    ///    "total_pages"
    ///  ],
    ///  "properties": {
    ///    "items": {
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/IssueResponse"
    ///      }
    ///    },
    ///    "page": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "per_page": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "total_count": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "total_pages": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct OffsetPaginatedIssueResponse {
        pub items: ::std::vec::Vec<IssueResponse>,
        pub page: i64,
        pub per_page: i64,
        pub total_count: i64,
        pub total_pages: i64,
    }
    impl OffsetPaginatedIssueResponse {
        pub fn builder() -> builder::OffsetPaginatedIssueResponse {
            Default::default()
        }
    }
    ///Paginated project response (offset-based) - concrete type for OpenAPI
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Paginated project response (offset-based) - concrete type for OpenAPI",
    ///  "type": "object",
    ///  "required": [
    ///    "items",
    ///    "page",
    ///    "per_page",
    ///    "total_count",
    ///    "total_pages"
    ///  ],
    ///  "properties": {
    ///    "items": {
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/ProjectResponse"
    ///      }
    ///    },
    ///    "page": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "per_page": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "total_count": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    },
    ///    "total_pages": {
    ///      "type": "integer",
    ///      "format": "int64"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct OffsetPaginatedProjectResponse {
        pub items: ::std::vec::Vec<ProjectResponse>,
        pub page: i64,
        pub per_page: i64,
        pub total_count: i64,
        pub total_pages: i64,
    }
    impl OffsetPaginatedProjectResponse {
        pub fn builder() -> builder::OffsetPaginatedProjectResponse {
            Default::default()
        }
    }
    ///Paginated event response (cursor-based) - concrete type for OpenAPI
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Paginated event response (cursor-based) - concrete type for OpenAPI",
    ///  "type": "object",
    ///  "required": [
    ///    "has_more",
    ///    "items"
    ///  ],
    ///  "properties": {
    ///    "has_more": {
    ///      "type": "boolean"
    ///    },
    ///    "items": {
    ///      "type": "array",
    ///      "items": {
    ///        "$ref": "#/components/schemas/EventResponse"
    ///      }
    ///    },
    ///    "next_cursor": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct PaginatedEventResponse {
        pub has_more: bool,
        pub items: ::std::vec::Vec<EventResponse>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub next_cursor: ::std::option::Option<::std::string::String>,
    }
    impl PaginatedEventResponse {
        pub fn builder() -> builder::PaginatedEventResponse {
            Default::default()
        }
    }
    ///Response with DSN included
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response with DSN included",
    ///  "type": "object",
    ///  "required": [
    ///    "created_at",
    ///    "digested_event_count",
    ///    "dsn",
    ///    "id",
    ///    "name",
    ///    "sentry_key",
    ///    "slug",
    ///    "stored_event_count",
    ///    "updated_at"
    ///  ],
    ///  "properties": {
    ///    "created_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    },
    ///    "digested_event_count": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "dsn": {
    ///      "type": "string"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "name": {
    ///      "type": "string"
    ///    },
    ///    "sentry_key": {
    ///      "type": "string",
    ///      "format": "uuid"
    ///    },
    ///    "slug": {
    ///      "type": "string"
    ///    },
    ///    "stored_event_count": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "updated_at": {
    ///      "type": "string",
    ///      "format": "date-time"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct ProjectResponse {
        pub created_at: ::chrono::DateTime<::chrono::offset::Utc>,
        pub digested_event_count: i32,
        pub dsn: ::std::string::String,
        pub id: i32,
        pub name: ::std::string::String,
        pub sentry_key: ::uuid::Uuid,
        pub slug: ::std::string::String,
        pub stored_event_count: i32,
        pub updated_at: ::chrono::DateTime<::chrono::offset::Utc>,
    }
    impl ProjectResponse {
        pub fn builder() -> builder::ProjectResponse {
            Default::default()
        }
    }
    ///`ReadinessChecks`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "database"
    ///  ],
    ///  "properties": {
    ///    "database": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct ReadinessChecks {
        pub database: ::std::string::String,
    }
    impl ReadinessChecks {
        pub fn builder() -> builder::ReadinessChecks {
            Default::default()
        }
    }
    ///`ReadinessResponse`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "checks",
    ///    "status"
    ///  ],
    ///  "properties": {
    ///    "checks": {
    ///      "$ref": "#/components/schemas/ReadinessChecks"
    ///    },
    ///    "status": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct ReadinessResponse {
        pub checks: ReadinessChecks,
        pub status: ::std::string::String,
    }
    impl ReadinessResponse {
        pub fn builder() -> builder::ReadinessResponse {
            Default::default()
        }
    }
    ///Slack channel configuration
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Slack channel configuration",
    ///  "type": "object",
    ///  "required": [
    ///    "webhook_url"
    ///  ],
    ///  "properties": {
    ///    "channel": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "icon_emoji": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "username": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "webhook_url": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct SlackConfig {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub channel: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub icon_emoji: ::std::option::Option<::std::string::String>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub username: ::std::option::Option<::std::string::String>,
        pub webhook_url: ::std::string::String,
    }
    impl SlackConfig {
        pub fn builder() -> builder::SlackConfig {
            Default::default()
        }
    }
    ///Sort order direction
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Sort order direction",
    ///  "type": "string",
    ///  "enum": [
    ///    "asc",
    ///    "desc"
    ///  ]
    ///}
    /// ```
    /// </details>
    #[derive(
        ::serde::Deserialize,
        ::serde::Serialize,
        Clone,
        Copy,
        Debug,
        Eq,
        Hash,
        Ord,
        PartialEq,
        PartialOrd
    )]
    pub enum SortOrder {
        #[serde(rename = "asc")]
        Asc,
        #[serde(rename = "desc")]
        Desc,
    }
    impl ::std::fmt::Display for SortOrder {
        fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
            match *self {
                Self::Asc => f.write_str("asc"),
                Self::Desc => f.write_str("desc"),
            }
        }
    }
    impl ::std::str::FromStr for SortOrder {
        type Err = self::error::ConversionError;
        fn from_str(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            match value {
                "asc" => Ok(Self::Asc),
                "desc" => Ok(Self::Desc),
                _ => Err("invalid value".into()),
            }
        }
    }
    impl ::std::convert::TryFrom<&str> for SortOrder {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &str,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<&::std::string::String> for SortOrder {
        type Error = self::error::ConversionError;
        fn try_from(
            value: &::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    impl ::std::convert::TryFrom<::std::string::String> for SortOrder {
        type Error = self::error::ConversionError;
        fn try_from(
            value: ::std::string::String,
        ) -> ::std::result::Result<Self, self::error::ConversionError> {
            value.parse()
        }
    }
    ///Response for test channel endpoint
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Response for test channel endpoint",
    ///  "type": "object",
    ///  "required": [
    ///    "message",
    ///    "success"
    ///  ],
    ///  "properties": {
    ///    "message": {
    ///      "type": "string"
    ///    },
    ///    "success": {
    ///      "type": "boolean"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct TestChannelResponse {
        pub message: ::std::string::String,
        pub success: bool,
    }
    impl TestChannelResponse {
        pub fn builder() -> builder::TestChannelResponse {
            Default::default()
        }
    }
    ///DTO for updating an alert rule
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for updating an alert rule",
    ///  "type": "object",
    ///  "properties": {
    ///    "channel_ids": {
    ///      "type": [
    ///        "array",
    ///        "null"
    ///      ],
    ///      "items": {
    ///        "type": "integer",
    ///        "format": "int32"
    ///      }
    ///    },
    ///    "conditions": {},
    ///    "cooldown_minutes": {
    ///      "type": [
    ///        "integer",
    ///        "null"
    ///      ],
    ///      "format": "int32"
    ///    },
    ///    "is_enabled": {
    ///      "type": [
    ///        "boolean",
    ///        "null"
    ///      ]
    ///    },
    ///    "name": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct UpdateAlertRule {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub channel_ids: ::std::option::Option<::std::vec::Vec<i32>>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub conditions: ::std::option::Option<::serde_json::Value>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub cooldown_minutes: ::std::option::Option<i32>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub is_enabled: ::std::option::Option<bool>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub name: ::std::option::Option<::std::string::String>,
    }
    impl ::std::default::Default for UpdateAlertRule {
        fn default() -> Self {
            Self {
                channel_ids: Default::default(),
                conditions: Default::default(),
                cooldown_minutes: Default::default(),
                is_enabled: Default::default(),
                name: Default::default(),
            }
        }
    }
    impl UpdateAlertRule {
        pub fn builder() -> builder::UpdateAlertRule {
            Default::default()
        }
    }
    ///Request to update issue state
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Request to update issue state",
    ///  "type": "object",
    ///  "properties": {
    ///    "is_muted": {
    ///      "type": [
    ///        "boolean",
    ///        "null"
    ///      ]
    ///    },
    ///    "is_resolved": {
    ///      "type": [
    ///        "boolean",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct UpdateIssueState {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub is_muted: ::std::option::Option<bool>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub is_resolved: ::std::option::Option<bool>,
    }
    impl ::std::default::Default for UpdateIssueState {
        fn default() -> Self {
            Self {
                is_muted: Default::default(),
                is_resolved: Default::default(),
            }
        }
    }
    impl UpdateIssueState {
        pub fn builder() -> builder::UpdateIssueState {
            Default::default()
        }
    }
    ///DTO for updating a notification channel
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for updating a notification channel",
    ///  "type": "object",
    ///  "properties": {
    ///    "config": {},
    ///    "is_enabled": {
    ///      "type": [
    ///        "boolean",
    ///        "null"
    ///      ]
    ///    },
    ///    "name": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct UpdateNotificationChannel {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub config: ::std::option::Option<::serde_json::Value>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub is_enabled: ::std::option::Option<bool>,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub name: ::std::option::Option<::std::string::String>,
    }
    impl ::std::default::Default for UpdateNotificationChannel {
        fn default() -> Self {
            Self {
                config: Default::default(),
                is_enabled: Default::default(),
                name: Default::default(),
            }
        }
    }
    impl UpdateNotificationChannel {
        pub fn builder() -> builder::UpdateNotificationChannel {
            Default::default()
        }
    }
    ///DTO for updating a project
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "DTO for updating a project",
    ///  "type": "object",
    ///  "properties": {
    ///    "name": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct UpdateProject {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub name: ::std::option::Option<::std::string::String>,
    }
    impl ::std::default::Default for UpdateProject {
        fn default() -> Self {
            Self { name: Default::default() }
        }
    }
    impl UpdateProject {
        pub fn builder() -> builder::UpdateProject {
            Default::default()
        }
    }
    ///`UserResponse`
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "type": "object",
    ///  "required": [
    ///    "email",
    ///    "id",
    ///    "is_admin"
    ///  ],
    ///  "properties": {
    ///    "email": {
    ///      "type": "string"
    ///    },
    ///    "id": {
    ///      "type": "integer",
    ///      "format": "int32"
    ///    },
    ///    "is_admin": {
    ///      "type": "boolean"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct UserResponse {
        pub email: ::std::string::String,
        pub id: i32,
        pub is_admin: bool,
    }
    impl UserResponse {
        pub fn builder() -> builder::UserResponse {
            Default::default()
        }
    }
    ///Webhook channel configuration
    ///
    /// <details><summary>JSON schema</summary>
    ///
    /// ```json
    ///{
    ///  "description": "Webhook channel configuration",
    ///  "type": "object",
    ///  "required": [
    ///    "url"
    ///  ],
    ///  "properties": {
    ///    "headers": {
    ///      "type": [
    ///        "object",
    ///        "null"
    ///      ],
    ///      "additionalProperties": {
    ///        "type": "string"
    ///      }
    ///    },
    ///    "secret": {
    ///      "type": [
    ///        "string",
    ///        "null"
    ///      ]
    ///    },
    ///    "url": {
    ///      "type": "string"
    ///    }
    ///  }
    ///}
    /// ```
    /// </details>
    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug)]
    pub struct WebhookConfig {
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub headers: ::std::option::Option<
            ::std::collections::HashMap<::std::string::String, ::std::string::String>,
        >,
        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
        pub secret: ::std::option::Option<::std::string::String>,
        pub url: ::std::string::String,
    }
    impl WebhookConfig {
        pub fn builder() -> builder::WebhookConfig {
            Default::default()
        }
    }
    /// Types for composing complex structures.
    pub mod builder {
        #[derive(Clone, Debug)]
        pub struct AlertHistory {
            alert_rule_id: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            alert_type: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            attempt_count: ::std::result::Result<i32, ::std::string::String>,
            channel_id: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            channel_name: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            channel_type: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            error_message: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            http_status_code: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            id: ::std::result::Result<i64, ::std::string::String>,
            idempotency_key: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            issue_id: ::std::result::Result<
                ::std::option::Option<::uuid::Uuid>,
                ::std::string::String,
            >,
            next_retry_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            project_id: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            sent_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            status: ::std::result::Result<super::AlertStatus, ::std::string::String>,
        }
        impl ::std::default::Default for AlertHistory {
            fn default() -> Self {
                Self {
                    alert_rule_id: Ok(Default::default()),
                    alert_type: Err("no value supplied for alert_type".to_string()),
                    attempt_count: Err(
                        "no value supplied for attempt_count".to_string(),
                    ),
                    channel_id: Ok(Default::default()),
                    channel_name: Err("no value supplied for channel_name".to_string()),
                    channel_type: Err("no value supplied for channel_type".to_string()),
                    created_at: Err("no value supplied for created_at".to_string()),
                    error_message: Ok(Default::default()),
                    http_status_code: Ok(Default::default()),
                    id: Err("no value supplied for id".to_string()),
                    idempotency_key: Err(
                        "no value supplied for idempotency_key".to_string(),
                    ),
                    issue_id: Ok(Default::default()),
                    next_retry_at: Ok(Default::default()),
                    project_id: Ok(Default::default()),
                    sent_at: Ok(Default::default()),
                    status: Err("no value supplied for status".to_string()),
                }
            }
        }
        impl AlertHistory {
            pub fn alert_rule_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.alert_rule_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for alert_rule_id: {e}")
                    });
                self
            }
            pub fn alert_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.alert_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for alert_type: {e}")
                    });
                self
            }
            pub fn attempt_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.attempt_count = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for attempt_count: {e}")
                    });
                self
            }
            pub fn channel_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_id: {e}")
                    });
                self
            }
            pub fn channel_name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_name: {e}")
                    });
                self
            }
            pub fn channel_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_type: {e}")
                    });
                self
            }
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn error_message<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.error_message = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for error_message: {e}")
                    });
                self
            }
            pub fn http_status_code<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.http_status_code = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for http_status_code: {e}"
                        )
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn idempotency_key<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.idempotency_key = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for idempotency_key: {e}"
                        )
                    });
                self
            }
            pub fn issue_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::uuid::Uuid>>,
                T::Error: ::std::fmt::Display,
            {
                self.issue_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for issue_id: {e}")
                    });
                self
            }
            pub fn next_retry_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.next_retry_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for next_retry_at: {e}")
                    });
                self
            }
            pub fn project_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.project_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for project_id: {e}")
                    });
                self
            }
            pub fn sent_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.sent_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for sent_at: {e}")
                    });
                self
            }
            pub fn status<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::AlertStatus>,
                T::Error: ::std::fmt::Display,
            {
                self.status = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for status: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AlertHistory> for super::AlertHistory {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AlertHistory,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    alert_rule_id: value.alert_rule_id?,
                    alert_type: value.alert_type?,
                    attempt_count: value.attempt_count?,
                    channel_id: value.channel_id?,
                    channel_name: value.channel_name?,
                    channel_type: value.channel_type?,
                    created_at: value.created_at?,
                    error_message: value.error_message?,
                    http_status_code: value.http_status_code?,
                    id: value.id?,
                    idempotency_key: value.idempotency_key?,
                    issue_id: value.issue_id?,
                    next_retry_at: value.next_retry_at?,
                    project_id: value.project_id?,
                    sent_at: value.sent_at?,
                    status: value.status?,
                })
            }
        }
        impl ::std::convert::From<super::AlertHistory> for AlertHistory {
            fn from(value: super::AlertHistory) -> Self {
                Self {
                    alert_rule_id: Ok(value.alert_rule_id),
                    alert_type: Ok(value.alert_type),
                    attempt_count: Ok(value.attempt_count),
                    channel_id: Ok(value.channel_id),
                    channel_name: Ok(value.channel_name),
                    channel_type: Ok(value.channel_type),
                    created_at: Ok(value.created_at),
                    error_message: Ok(value.error_message),
                    http_status_code: Ok(value.http_status_code),
                    id: Ok(value.id),
                    idempotency_key: Ok(value.idempotency_key),
                    issue_id: Ok(value.issue_id),
                    next_retry_at: Ok(value.next_retry_at),
                    project_id: Ok(value.project_id),
                    sent_at: Ok(value.sent_at),
                    status: Ok(value.status),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct AlertRule {
            alert_type: ::std::result::Result<super::AlertType, ::std::string::String>,
            conditions: ::std::result::Result<
                ::serde_json::Value,
                ::std::string::String,
            >,
            cooldown_minutes: ::std::result::Result<i32, ::std::string::String>,
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            id: ::std::result::Result<i32, ::std::string::String>,
            is_enabled: ::std::result::Result<bool, ::std::string::String>,
            last_triggered_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
            project_id: ::std::result::Result<i32, ::std::string::String>,
            updated_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for AlertRule {
            fn default() -> Self {
                Self {
                    alert_type: Err("no value supplied for alert_type".to_string()),
                    conditions: Err("no value supplied for conditions".to_string()),
                    cooldown_minutes: Err(
                        "no value supplied for cooldown_minutes".to_string(),
                    ),
                    created_at: Err("no value supplied for created_at".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    is_enabled: Err("no value supplied for is_enabled".to_string()),
                    last_triggered_at: Ok(Default::default()),
                    name: Err("no value supplied for name".to_string()),
                    project_id: Err("no value supplied for project_id".to_string()),
                    updated_at: Err("no value supplied for updated_at".to_string()),
                }
            }
        }
        impl AlertRule {
            pub fn alert_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::AlertType>,
                T::Error: ::std::fmt::Display,
            {
                self.alert_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for alert_type: {e}")
                    });
                self
            }
            pub fn conditions<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::serde_json::Value>,
                T::Error: ::std::fmt::Display,
            {
                self.conditions = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for conditions: {e}")
                    });
                self
            }
            pub fn cooldown_minutes<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.cooldown_minutes = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for cooldown_minutes: {e}"
                        )
                    });
                self
            }
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn last_triggered_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.last_triggered_at = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for last_triggered_at: {e}"
                        )
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
            pub fn project_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.project_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for project_id: {e}")
                    });
                self
            }
            pub fn updated_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.updated_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for updated_at: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AlertRule> for super::AlertRule {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AlertRule,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    alert_type: value.alert_type?,
                    conditions: value.conditions?,
                    cooldown_minutes: value.cooldown_minutes?,
                    created_at: value.created_at?,
                    id: value.id?,
                    is_enabled: value.is_enabled?,
                    last_triggered_at: value.last_triggered_at?,
                    name: value.name?,
                    project_id: value.project_id?,
                    updated_at: value.updated_at?,
                })
            }
        }
        impl ::std::convert::From<super::AlertRule> for AlertRule {
            fn from(value: super::AlertRule) -> Self {
                Self {
                    alert_type: Ok(value.alert_type),
                    conditions: Ok(value.conditions),
                    cooldown_minutes: Ok(value.cooldown_minutes),
                    created_at: Ok(value.created_at),
                    id: Ok(value.id),
                    is_enabled: Ok(value.is_enabled),
                    last_triggered_at: Ok(value.last_triggered_at),
                    name: Ok(value.name),
                    project_id: Ok(value.project_id),
                    updated_at: Ok(value.updated_at),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct AlertRuleResponse {
            alert_type: ::std::result::Result<super::AlertType, ::std::string::String>,
            channel_ids: ::std::result::Result<
                ::std::vec::Vec<i32>,
                ::std::string::String,
            >,
            conditions: ::std::result::Result<
                ::serde_json::Value,
                ::std::string::String,
            >,
            cooldown_minutes: ::std::result::Result<i32, ::std::string::String>,
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            id: ::std::result::Result<i32, ::std::string::String>,
            is_enabled: ::std::result::Result<bool, ::std::string::String>,
            last_triggered_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
            project_id: ::std::result::Result<i32, ::std::string::String>,
            updated_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for AlertRuleResponse {
            fn default() -> Self {
                Self {
                    alert_type: Err("no value supplied for alert_type".to_string()),
                    channel_ids: Err("no value supplied for channel_ids".to_string()),
                    conditions: Err("no value supplied for conditions".to_string()),
                    cooldown_minutes: Err(
                        "no value supplied for cooldown_minutes".to_string(),
                    ),
                    created_at: Err("no value supplied for created_at".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    is_enabled: Err("no value supplied for is_enabled".to_string()),
                    last_triggered_at: Ok(Default::default()),
                    name: Err("no value supplied for name".to_string()),
                    project_id: Err("no value supplied for project_id".to_string()),
                    updated_at: Err("no value supplied for updated_at".to_string()),
                }
            }
        }
        impl AlertRuleResponse {
            pub fn alert_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::AlertType>,
                T::Error: ::std::fmt::Display,
            {
                self.alert_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for alert_type: {e}")
                    });
                self
            }
            pub fn channel_ids<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_ids = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_ids: {e}")
                    });
                self
            }
            pub fn conditions<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::serde_json::Value>,
                T::Error: ::std::fmt::Display,
            {
                self.conditions = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for conditions: {e}")
                    });
                self
            }
            pub fn cooldown_minutes<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.cooldown_minutes = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for cooldown_minutes: {e}"
                        )
                    });
                self
            }
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn last_triggered_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.last_triggered_at = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for last_triggered_at: {e}"
                        )
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
            pub fn project_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.project_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for project_id: {e}")
                    });
                self
            }
            pub fn updated_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.updated_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for updated_at: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AlertRuleResponse> for super::AlertRuleResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AlertRuleResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    alert_type: value.alert_type?,
                    channel_ids: value.channel_ids?,
                    conditions: value.conditions?,
                    cooldown_minutes: value.cooldown_minutes?,
                    created_at: value.created_at?,
                    id: value.id?,
                    is_enabled: value.is_enabled?,
                    last_triggered_at: value.last_triggered_at?,
                    name: value.name?,
                    project_id: value.project_id?,
                    updated_at: value.updated_at?,
                })
            }
        }
        impl ::std::convert::From<super::AlertRuleResponse> for AlertRuleResponse {
            fn from(value: super::AlertRuleResponse) -> Self {
                Self {
                    alert_type: Ok(value.alert_type),
                    channel_ids: Ok(value.channel_ids),
                    conditions: Ok(value.conditions),
                    cooldown_minutes: Ok(value.cooldown_minutes),
                    created_at: Ok(value.created_at),
                    id: Ok(value.id),
                    is_enabled: Ok(value.is_enabled),
                    last_triggered_at: Ok(value.last_triggered_at),
                    name: Ok(value.name),
                    project_id: Ok(value.project_id),
                    updated_at: Ok(value.updated_at),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct AuthResponse {
            user: ::std::result::Result<super::UserResponse, ::std::string::String>,
        }
        impl ::std::default::Default for AuthResponse {
            fn default() -> Self {
                Self {
                    user: Err("no value supplied for user".to_string()),
                }
            }
        }
        impl AuthResponse {
            pub fn user<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::UserResponse>,
                T::Error: ::std::fmt::Display,
            {
                self.user = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for user: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AuthResponse> for super::AuthResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AuthResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self { user: value.user? })
            }
        }
        impl ::std::convert::From<super::AuthResponse> for AuthResponse {
            fn from(value: super::AuthResponse) -> Self {
                Self { user: Ok(value.user) }
            }
        }
        #[derive(Clone, Debug)]
        pub struct AuthTokenCreatedResponse {
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            description: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            id: ::std::result::Result<i32, ::std::string::String>,
            token: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for AuthTokenCreatedResponse {
            fn default() -> Self {
                Self {
                    created_at: Err("no value supplied for created_at".to_string()),
                    description: Ok(Default::default()),
                    id: Err("no value supplied for id".to_string()),
                    token: Err("no value supplied for token".to_string()),
                }
            }
        }
        impl AuthTokenCreatedResponse {
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn description<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.description = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for description: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn token<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.token = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for token: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AuthTokenCreatedResponse>
        for super::AuthTokenCreatedResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AuthTokenCreatedResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    created_at: value.created_at?,
                    description: value.description?,
                    id: value.id?,
                    token: value.token?,
                })
            }
        }
        impl ::std::convert::From<super::AuthTokenCreatedResponse>
        for AuthTokenCreatedResponse {
            fn from(value: super::AuthTokenCreatedResponse) -> Self {
                Self {
                    created_at: Ok(value.created_at),
                    description: Ok(value.description),
                    id: Ok(value.id),
                    token: Ok(value.token),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct AuthTokenResponse {
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            description: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            id: ::std::result::Result<i32, ::std::string::String>,
            last_used_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            token_prefix: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for AuthTokenResponse {
            fn default() -> Self {
                Self {
                    created_at: Err("no value supplied for created_at".to_string()),
                    description: Ok(Default::default()),
                    id: Err("no value supplied for id".to_string()),
                    last_used_at: Ok(Default::default()),
                    token_prefix: Err("no value supplied for token_prefix".to_string()),
                }
            }
        }
        impl AuthTokenResponse {
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn description<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.description = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for description: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn last_used_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.last_used_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for last_used_at: {e}")
                    });
                self
            }
            pub fn token_prefix<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.token_prefix = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for token_prefix: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<AuthTokenResponse> for super::AuthTokenResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: AuthTokenResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    created_at: value.created_at?,
                    description: value.description?,
                    id: value.id?,
                    last_used_at: value.last_used_at?,
                    token_prefix: value.token_prefix?,
                })
            }
        }
        impl ::std::convert::From<super::AuthTokenResponse> for AuthTokenResponse {
            fn from(value: super::AuthTokenResponse) -> Self {
                Self {
                    created_at: Ok(value.created_at),
                    description: Ok(value.description),
                    id: Ok(value.id),
                    last_used_at: Ok(value.last_used_at),
                    token_prefix: Ok(value.token_prefix),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct CreateAlertRule {
            alert_type: ::std::result::Result<super::AlertType, ::std::string::String>,
            channel_ids: ::std::result::Result<
                ::std::vec::Vec<i32>,
                ::std::string::String,
            >,
            conditions: ::std::result::Result<
                ::std::option::Option<::serde_json::Value>,
                ::std::string::String,
            >,
            cooldown_minutes: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for CreateAlertRule {
            fn default() -> Self {
                Self {
                    alert_type: Err("no value supplied for alert_type".to_string()),
                    channel_ids: Ok(Default::default()),
                    conditions: Ok(Default::default()),
                    cooldown_minutes: Ok(Default::default()),
                    name: Err("no value supplied for name".to_string()),
                }
            }
        }
        impl CreateAlertRule {
            pub fn alert_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::AlertType>,
                T::Error: ::std::fmt::Display,
            {
                self.alert_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for alert_type: {e}")
                    });
                self
            }
            pub fn channel_ids<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_ids = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_ids: {e}")
                    });
                self
            }
            pub fn conditions<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::serde_json::Value>>,
                T::Error: ::std::fmt::Display,
            {
                self.conditions = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for conditions: {e}")
                    });
                self
            }
            pub fn cooldown_minutes<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.cooldown_minutes = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for cooldown_minutes: {e}"
                        )
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<CreateAlertRule> for super::CreateAlertRule {
            type Error = super::error::ConversionError;
            fn try_from(
                value: CreateAlertRule,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    alert_type: value.alert_type?,
                    channel_ids: value.channel_ids?,
                    conditions: value.conditions?,
                    cooldown_minutes: value.cooldown_minutes?,
                    name: value.name?,
                })
            }
        }
        impl ::std::convert::From<super::CreateAlertRule> for CreateAlertRule {
            fn from(value: super::CreateAlertRule) -> Self {
                Self {
                    alert_type: Ok(value.alert_type),
                    channel_ids: Ok(value.channel_ids),
                    conditions: Ok(value.conditions),
                    cooldown_minutes: Ok(value.cooldown_minutes),
                    name: Ok(value.name),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct CreateAuthToken {
            description: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for CreateAuthToken {
            fn default() -> Self {
                Self {
                    description: Ok(Default::default()),
                }
            }
        }
        impl CreateAuthToken {
            pub fn description<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.description = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for description: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<CreateAuthToken> for super::CreateAuthToken {
            type Error = super::error::ConversionError;
            fn try_from(
                value: CreateAuthToken,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    description: value.description?,
                })
            }
        }
        impl ::std::convert::From<super::CreateAuthToken> for CreateAuthToken {
            fn from(value: super::CreateAuthToken) -> Self {
                Self {
                    description: Ok(value.description),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct CreateNotificationChannel {
            channel_type: ::std::result::Result<
                super::ChannelType,
                ::std::string::String,
            >,
            config: ::std::result::Result<::serde_json::Value, ::std::string::String>,
            is_enabled: ::std::result::Result<
                ::std::option::Option<bool>,
                ::std::string::String,
            >,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for CreateNotificationChannel {
            fn default() -> Self {
                Self {
                    channel_type: Err("no value supplied for channel_type".to_string()),
                    config: Err("no value supplied for config".to_string()),
                    is_enabled: Ok(Default::default()),
                    name: Err("no value supplied for name".to_string()),
                }
            }
        }
        impl CreateNotificationChannel {
            pub fn channel_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::ChannelType>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_type: {e}")
                    });
                self
            }
            pub fn config<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::serde_json::Value>,
                T::Error: ::std::fmt::Display,
            {
                self.config = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for config: {e}")
                    });
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<bool>>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<CreateNotificationChannel>
        for super::CreateNotificationChannel {
            type Error = super::error::ConversionError;
            fn try_from(
                value: CreateNotificationChannel,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    channel_type: value.channel_type?,
                    config: value.config?,
                    is_enabled: value.is_enabled?,
                    name: value.name?,
                })
            }
        }
        impl ::std::convert::From<super::CreateNotificationChannel>
        for CreateNotificationChannel {
            fn from(value: super::CreateNotificationChannel) -> Self {
                Self {
                    channel_type: Ok(value.channel_type),
                    config: Ok(value.config),
                    is_enabled: Ok(value.is_enabled),
                    name: Ok(value.name),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct CreateProject {
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
            slug: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for CreateProject {
            fn default() -> Self {
                Self {
                    name: Err("no value supplied for name".to_string()),
                    slug: Ok(Default::default()),
                }
            }
        }
        impl CreateProject {
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
            pub fn slug<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.slug = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for slug: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<CreateProject> for super::CreateProject {
            type Error = super::error::ConversionError;
            fn try_from(
                value: CreateProject,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    name: value.name?,
                    slug: value.slug?,
                })
            }
        }
        impl ::std::convert::From<super::CreateProject> for CreateProject {
            fn from(value: super::CreateProject) -> Self {
                Self {
                    name: Ok(value.name),
                    slug: Ok(value.slug),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct CreateUserRequest {
            email: ::std::result::Result<::std::string::String, ::std::string::String>,
            password: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for CreateUserRequest {
            fn default() -> Self {
                Self {
                    email: Err("no value supplied for email".to_string()),
                    password: Err("no value supplied for password".to_string()),
                }
            }
        }
        impl CreateUserRequest {
            pub fn email<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.email = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for email: {e}")
                    });
                self
            }
            pub fn password<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.password = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for password: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<CreateUserRequest> for super::CreateUserRequest {
            type Error = super::error::ConversionError;
            fn try_from(
                value: CreateUserRequest,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    email: value.email?,
                    password: value.password?,
                })
            }
        }
        impl ::std::convert::From<super::CreateUserRequest> for CreateUserRequest {
            fn from(value: super::CreateUserRequest) -> Self {
                Self {
                    email: Ok(value.email),
                    password: Ok(value.password),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct EmailConfig {
            from_address: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            recipients: ::std::result::Result<
                ::std::vec::Vec<::std::string::String>,
                ::std::string::String,
            >,
            smtp_host: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            smtp_password: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            smtp_port: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            smtp_username: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for EmailConfig {
            fn default() -> Self {
                Self {
                    from_address: Ok(Default::default()),
                    recipients: Err("no value supplied for recipients".to_string()),
                    smtp_host: Ok(Default::default()),
                    smtp_password: Ok(Default::default()),
                    smtp_port: Ok(Default::default()),
                    smtp_username: Ok(Default::default()),
                }
            }
        }
        impl EmailConfig {
            pub fn from_address<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.from_address = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for from_address: {e}")
                    });
                self
            }
            pub fn recipients<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.recipients = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for recipients: {e}")
                    });
                self
            }
            pub fn smtp_host<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.smtp_host = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for smtp_host: {e}")
                    });
                self
            }
            pub fn smtp_password<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.smtp_password = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for smtp_password: {e}")
                    });
                self
            }
            pub fn smtp_port<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.smtp_port = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for smtp_port: {e}")
                    });
                self
            }
            pub fn smtp_username<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.smtp_username = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for smtp_username: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<EmailConfig> for super::EmailConfig {
            type Error = super::error::ConversionError;
            fn try_from(
                value: EmailConfig,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    from_address: value.from_address?,
                    recipients: value.recipients?,
                    smtp_host: value.smtp_host?,
                    smtp_password: value.smtp_password?,
                    smtp_port: value.smtp_port?,
                    smtp_username: value.smtp_username?,
                })
            }
        }
        impl ::std::convert::From<super::EmailConfig> for EmailConfig {
            fn from(value: super::EmailConfig) -> Self {
                Self {
                    from_address: Ok(value.from_address),
                    recipients: Ok(value.recipients),
                    smtp_host: Ok(value.smtp_host),
                    smtp_password: Ok(value.smtp_password),
                    smtp_port: Ok(value.smtp_port),
                    smtp_username: Ok(value.smtp_username),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct ErrorDetail {
            message: ::std::result::Result<::std::string::String, ::std::string::String>,
            type_: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for ErrorDetail {
            fn default() -> Self {
                Self {
                    message: Err("no value supplied for message".to_string()),
                    type_: Err("no value supplied for type_".to_string()),
                }
            }
        }
        impl ErrorDetail {
            pub fn message<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.message = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for message: {e}")
                    });
                self
            }
            pub fn type_<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.type_ = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for type_: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<ErrorDetail> for super::ErrorDetail {
            type Error = super::error::ConversionError;
            fn try_from(
                value: ErrorDetail,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    message: value.message?,
                    type_: value.type_?,
                })
            }
        }
        impl ::std::convert::From<super::ErrorDetail> for ErrorDetail {
            fn from(value: super::ErrorDetail) -> Self {
                Self {
                    message: Ok(value.message),
                    type_: Ok(value.type_),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct ErrorResponse {
            error: ::std::result::Result<super::ErrorDetail, ::std::string::String>,
        }
        impl ::std::default::Default for ErrorResponse {
            fn default() -> Self {
                Self {
                    error: Err("no value supplied for error".to_string()),
                }
            }
        }
        impl ErrorResponse {
            pub fn error<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::ErrorDetail>,
                T::Error: ::std::fmt::Display,
            {
                self.error = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for error: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<ErrorResponse> for super::ErrorResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: ErrorResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self { error: value.error? })
            }
        }
        impl ::std::convert::From<super::ErrorResponse> for ErrorResponse {
            fn from(value: super::ErrorResponse) -> Self {
                Self { error: Ok(value.error) }
            }
        }
        #[derive(Clone, Debug)]
        pub struct EventDetailResponse {
            data: ::std::result::Result<::serde_json::Value, ::std::string::String>,
            environment: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            event_id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            ingested_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            issue_id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            level: ::std::result::Result<::std::string::String, ::std::string::String>,
            platform: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            release: ::std::result::Result<::std::string::String, ::std::string::String>,
            sdk_name: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            sdk_version: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            server_name: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            timestamp: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            title: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for EventDetailResponse {
            fn default() -> Self {
                Self {
                    data: Err("no value supplied for data".to_string()),
                    environment: Err("no value supplied for environment".to_string()),
                    event_id: Err("no value supplied for event_id".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    ingested_at: Err("no value supplied for ingested_at".to_string()),
                    issue_id: Err("no value supplied for issue_id".to_string()),
                    level: Err("no value supplied for level".to_string()),
                    platform: Err("no value supplied for platform".to_string()),
                    release: Err("no value supplied for release".to_string()),
                    sdk_name: Err("no value supplied for sdk_name".to_string()),
                    sdk_version: Err("no value supplied for sdk_version".to_string()),
                    server_name: Err("no value supplied for server_name".to_string()),
                    timestamp: Err("no value supplied for timestamp".to_string()),
                    title: Err("no value supplied for title".to_string()),
                }
            }
        }
        impl EventDetailResponse {
            pub fn data<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::serde_json::Value>,
                T::Error: ::std::fmt::Display,
            {
                self.data = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for data: {e}")
                    });
                self
            }
            pub fn environment<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.environment = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for environment: {e}")
                    });
                self
            }
            pub fn event_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.event_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for event_id: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn ingested_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.ingested_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for ingested_at: {e}")
                    });
                self
            }
            pub fn issue_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.issue_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for issue_id: {e}")
                    });
                self
            }
            pub fn level<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.level = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for level: {e}")
                    });
                self
            }
            pub fn platform<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.platform = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for platform: {e}")
                    });
                self
            }
            pub fn release<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.release = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for release: {e}")
                    });
                self
            }
            pub fn sdk_name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.sdk_name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for sdk_name: {e}")
                    });
                self
            }
            pub fn sdk_version<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.sdk_version = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for sdk_version: {e}")
                    });
                self
            }
            pub fn server_name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.server_name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for server_name: {e}")
                    });
                self
            }
            pub fn timestamp<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.timestamp = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for timestamp: {e}")
                    });
                self
            }
            pub fn title<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.title = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for title: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<EventDetailResponse>
        for super::EventDetailResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: EventDetailResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    data: value.data?,
                    environment: value.environment?,
                    event_id: value.event_id?,
                    id: value.id?,
                    ingested_at: value.ingested_at?,
                    issue_id: value.issue_id?,
                    level: value.level?,
                    platform: value.platform?,
                    release: value.release?,
                    sdk_name: value.sdk_name?,
                    sdk_version: value.sdk_version?,
                    server_name: value.server_name?,
                    timestamp: value.timestamp?,
                    title: value.title?,
                })
            }
        }
        impl ::std::convert::From<super::EventDetailResponse> for EventDetailResponse {
            fn from(value: super::EventDetailResponse) -> Self {
                Self {
                    data: Ok(value.data),
                    environment: Ok(value.environment),
                    event_id: Ok(value.event_id),
                    id: Ok(value.id),
                    ingested_at: Ok(value.ingested_at),
                    issue_id: Ok(value.issue_id),
                    level: Ok(value.level),
                    platform: Ok(value.platform),
                    release: Ok(value.release),
                    sdk_name: Ok(value.sdk_name),
                    sdk_version: Ok(value.sdk_version),
                    server_name: Ok(value.server_name),
                    timestamp: Ok(value.timestamp),
                    title: Ok(value.title),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct EventResponse {
            environment: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            event_id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            issue_id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            level: ::std::result::Result<::std::string::String, ::std::string::String>,
            platform: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            release: ::std::result::Result<::std::string::String, ::std::string::String>,
            timestamp: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            title: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for EventResponse {
            fn default() -> Self {
                Self {
                    environment: Err("no value supplied for environment".to_string()),
                    event_id: Err("no value supplied for event_id".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    issue_id: Err("no value supplied for issue_id".to_string()),
                    level: Err("no value supplied for level".to_string()),
                    platform: Err("no value supplied for platform".to_string()),
                    release: Err("no value supplied for release".to_string()),
                    timestamp: Err("no value supplied for timestamp".to_string()),
                    title: Err("no value supplied for title".to_string()),
                }
            }
        }
        impl EventResponse {
            pub fn environment<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.environment = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for environment: {e}")
                    });
                self
            }
            pub fn event_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.event_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for event_id: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn issue_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.issue_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for issue_id: {e}")
                    });
                self
            }
            pub fn level<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.level = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for level: {e}")
                    });
                self
            }
            pub fn platform<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.platform = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for platform: {e}")
                    });
                self
            }
            pub fn release<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.release = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for release: {e}")
                    });
                self
            }
            pub fn timestamp<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.timestamp = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for timestamp: {e}")
                    });
                self
            }
            pub fn title<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.title = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for title: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<EventResponse> for super::EventResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: EventResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    environment: value.environment?,
                    event_id: value.event_id?,
                    id: value.id?,
                    issue_id: value.issue_id?,
                    level: value.level?,
                    platform: value.platform?,
                    release: value.release?,
                    timestamp: value.timestamp?,
                    title: value.title?,
                })
            }
        }
        impl ::std::convert::From<super::EventResponse> for EventResponse {
            fn from(value: super::EventResponse) -> Self {
                Self {
                    environment: Ok(value.environment),
                    event_id: Ok(value.event_id),
                    id: Ok(value.id),
                    issue_id: Ok(value.issue_id),
                    level: Ok(value.level),
                    platform: Ok(value.platform),
                    release: Ok(value.release),
                    timestamp: Ok(value.timestamp),
                    title: Ok(value.title),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct IssueResponse {
            event_count: ::std::result::Result<i32, ::std::string::String>,
            first_seen: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            id: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            is_muted: ::std::result::Result<bool, ::std::string::String>,
            is_resolved: ::std::result::Result<bool, ::std::string::String>,
            last_seen: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            level: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            platform: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            project_id: ::std::result::Result<i32, ::std::string::String>,
            short_id: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
            title: ::std::result::Result<::std::string::String, ::std::string::String>,
            value: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for IssueResponse {
            fn default() -> Self {
                Self {
                    event_count: Err("no value supplied for event_count".to_string()),
                    first_seen: Err("no value supplied for first_seen".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    is_muted: Err("no value supplied for is_muted".to_string()),
                    is_resolved: Err("no value supplied for is_resolved".to_string()),
                    last_seen: Err("no value supplied for last_seen".to_string()),
                    level: Ok(Default::default()),
                    platform: Ok(Default::default()),
                    project_id: Err("no value supplied for project_id".to_string()),
                    short_id: Err("no value supplied for short_id".to_string()),
                    title: Err("no value supplied for title".to_string()),
                    value: Err("no value supplied for value".to_string()),
                }
            }
        }
        impl IssueResponse {
            pub fn event_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.event_count = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for event_count: {e}")
                    });
                self
            }
            pub fn first_seen<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.first_seen = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for first_seen: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn is_muted<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_muted = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_muted: {e}")
                    });
                self
            }
            pub fn is_resolved<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_resolved = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_resolved: {e}")
                    });
                self
            }
            pub fn last_seen<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.last_seen = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for last_seen: {e}")
                    });
                self
            }
            pub fn level<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.level = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for level: {e}")
                    });
                self
            }
            pub fn platform<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.platform = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for platform: {e}")
                    });
                self
            }
            pub fn project_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.project_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for project_id: {e}")
                    });
                self
            }
            pub fn short_id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.short_id = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for short_id: {e}")
                    });
                self
            }
            pub fn title<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.title = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for title: {e}")
                    });
                self
            }
            pub fn value<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.value = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for value: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<IssueResponse> for super::IssueResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: IssueResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    event_count: value.event_count?,
                    first_seen: value.first_seen?,
                    id: value.id?,
                    is_muted: value.is_muted?,
                    is_resolved: value.is_resolved?,
                    last_seen: value.last_seen?,
                    level: value.level?,
                    platform: value.platform?,
                    project_id: value.project_id?,
                    short_id: value.short_id?,
                    title: value.title?,
                    value: value.value?,
                })
            }
        }
        impl ::std::convert::From<super::IssueResponse> for IssueResponse {
            fn from(value: super::IssueResponse) -> Self {
                Self {
                    event_count: Ok(value.event_count),
                    first_seen: Ok(value.first_seen),
                    id: Ok(value.id),
                    is_muted: Ok(value.is_muted),
                    is_resolved: Ok(value.is_resolved),
                    last_seen: Ok(value.last_seen),
                    level: Ok(value.level),
                    platform: Ok(value.platform),
                    project_id: Ok(value.project_id),
                    short_id: Ok(value.short_id),
                    title: Ok(value.title),
                    value: Ok(value.value),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct LivenessResponse {
            status: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for LivenessResponse {
            fn default() -> Self {
                Self {
                    status: Err("no value supplied for status".to_string()),
                }
            }
        }
        impl LivenessResponse {
            pub fn status<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.status = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for status: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<LivenessResponse> for super::LivenessResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: LivenessResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self { status: value.status? })
            }
        }
        impl ::std::convert::From<super::LivenessResponse> for LivenessResponse {
            fn from(value: super::LivenessResponse) -> Self {
                Self { status: Ok(value.status) }
            }
        }
        #[derive(Clone, Debug)]
        pub struct LoginRequest {
            email: ::std::result::Result<::std::string::String, ::std::string::String>,
            password: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for LoginRequest {
            fn default() -> Self {
                Self {
                    email: Err("no value supplied for email".to_string()),
                    password: Err("no value supplied for password".to_string()),
                }
            }
        }
        impl LoginRequest {
            pub fn email<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.email = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for email: {e}")
                    });
                self
            }
            pub fn password<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.password = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for password: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<LoginRequest> for super::LoginRequest {
            type Error = super::error::ConversionError;
            fn try_from(
                value: LoginRequest,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    email: value.email?,
                    password: value.password?,
                })
            }
        }
        impl ::std::convert::From<super::LoginRequest> for LoginRequest {
            fn from(value: super::LoginRequest) -> Self {
                Self {
                    email: Ok(value.email),
                    password: Ok(value.password),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct NotificationChannel {
            channel_type: ::std::result::Result<
                super::ChannelType,
                ::std::string::String,
            >,
            config: ::std::result::Result<::serde_json::Value, ::std::string::String>,
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            failure_count: ::std::result::Result<i32, ::std::string::String>,
            id: ::std::result::Result<i32, ::std::string::String>,
            is_enabled: ::std::result::Result<bool, ::std::string::String>,
            last_failure_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            last_failure_message: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            last_success_at: ::std::result::Result<
                ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                ::std::string::String,
            >,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
            updated_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for NotificationChannel {
            fn default() -> Self {
                Self {
                    channel_type: Err("no value supplied for channel_type".to_string()),
                    config: Err("no value supplied for config".to_string()),
                    created_at: Err("no value supplied for created_at".to_string()),
                    failure_count: Err(
                        "no value supplied for failure_count".to_string(),
                    ),
                    id: Err("no value supplied for id".to_string()),
                    is_enabled: Err("no value supplied for is_enabled".to_string()),
                    last_failure_at: Ok(Default::default()),
                    last_failure_message: Ok(Default::default()),
                    last_success_at: Ok(Default::default()),
                    name: Err("no value supplied for name".to_string()),
                    updated_at: Err("no value supplied for updated_at".to_string()),
                }
            }
        }
        impl NotificationChannel {
            pub fn channel_type<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::ChannelType>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_type = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_type: {e}")
                    });
                self
            }
            pub fn config<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::serde_json::Value>,
                T::Error: ::std::fmt::Display,
            {
                self.config = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for config: {e}")
                    });
                self
            }
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn failure_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.failure_count = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for failure_count: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn last_failure_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.last_failure_at = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for last_failure_at: {e}"
                        )
                    });
                self
            }
            pub fn last_failure_message<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.last_failure_message = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for last_failure_message: {e}"
                        )
                    });
                self
            }
            pub fn last_success_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<::chrono::DateTime<::chrono::offset::Utc>>,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.last_success_at = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for last_success_at: {e}"
                        )
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
            pub fn updated_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.updated_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for updated_at: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<NotificationChannel>
        for super::NotificationChannel {
            type Error = super::error::ConversionError;
            fn try_from(
                value: NotificationChannel,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    channel_type: value.channel_type?,
                    config: value.config?,
                    created_at: value.created_at?,
                    failure_count: value.failure_count?,
                    id: value.id?,
                    is_enabled: value.is_enabled?,
                    last_failure_at: value.last_failure_at?,
                    last_failure_message: value.last_failure_message?,
                    last_success_at: value.last_success_at?,
                    name: value.name?,
                    updated_at: value.updated_at?,
                })
            }
        }
        impl ::std::convert::From<super::NotificationChannel> for NotificationChannel {
            fn from(value: super::NotificationChannel) -> Self {
                Self {
                    channel_type: Ok(value.channel_type),
                    config: Ok(value.config),
                    created_at: Ok(value.created_at),
                    failure_count: Ok(value.failure_count),
                    id: Ok(value.id),
                    is_enabled: Ok(value.is_enabled),
                    last_failure_at: Ok(value.last_failure_at),
                    last_failure_message: Ok(value.last_failure_message),
                    last_success_at: Ok(value.last_success_at),
                    name: Ok(value.name),
                    updated_at: Ok(value.updated_at),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct OffsetPaginatedIssueResponse {
            items: ::std::result::Result<
                ::std::vec::Vec<super::IssueResponse>,
                ::std::string::String,
            >,
            page: ::std::result::Result<i64, ::std::string::String>,
            per_page: ::std::result::Result<i64, ::std::string::String>,
            total_count: ::std::result::Result<i64, ::std::string::String>,
            total_pages: ::std::result::Result<i64, ::std::string::String>,
        }
        impl ::std::default::Default for OffsetPaginatedIssueResponse {
            fn default() -> Self {
                Self {
                    items: Err("no value supplied for items".to_string()),
                    page: Err("no value supplied for page".to_string()),
                    per_page: Err("no value supplied for per_page".to_string()),
                    total_count: Err("no value supplied for total_count".to_string()),
                    total_pages: Err("no value supplied for total_pages".to_string()),
                }
            }
        }
        impl OffsetPaginatedIssueResponse {
            pub fn items<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<super::IssueResponse>>,
                T::Error: ::std::fmt::Display,
            {
                self.items = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for items: {e}")
                    });
                self
            }
            pub fn page<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.page = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for page: {e}")
                    });
                self
            }
            pub fn per_page<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.per_page = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for per_page: {e}")
                    });
                self
            }
            pub fn total_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.total_count = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for total_count: {e}")
                    });
                self
            }
            pub fn total_pages<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.total_pages = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for total_pages: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<OffsetPaginatedIssueResponse>
        for super::OffsetPaginatedIssueResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: OffsetPaginatedIssueResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    items: value.items?,
                    page: value.page?,
                    per_page: value.per_page?,
                    total_count: value.total_count?,
                    total_pages: value.total_pages?,
                })
            }
        }
        impl ::std::convert::From<super::OffsetPaginatedIssueResponse>
        for OffsetPaginatedIssueResponse {
            fn from(value: super::OffsetPaginatedIssueResponse) -> Self {
                Self {
                    items: Ok(value.items),
                    page: Ok(value.page),
                    per_page: Ok(value.per_page),
                    total_count: Ok(value.total_count),
                    total_pages: Ok(value.total_pages),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct OffsetPaginatedProjectResponse {
            items: ::std::result::Result<
                ::std::vec::Vec<super::ProjectResponse>,
                ::std::string::String,
            >,
            page: ::std::result::Result<i64, ::std::string::String>,
            per_page: ::std::result::Result<i64, ::std::string::String>,
            total_count: ::std::result::Result<i64, ::std::string::String>,
            total_pages: ::std::result::Result<i64, ::std::string::String>,
        }
        impl ::std::default::Default for OffsetPaginatedProjectResponse {
            fn default() -> Self {
                Self {
                    items: Err("no value supplied for items".to_string()),
                    page: Err("no value supplied for page".to_string()),
                    per_page: Err("no value supplied for per_page".to_string()),
                    total_count: Err("no value supplied for total_count".to_string()),
                    total_pages: Err("no value supplied for total_pages".to_string()),
                }
            }
        }
        impl OffsetPaginatedProjectResponse {
            pub fn items<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<super::ProjectResponse>>,
                T::Error: ::std::fmt::Display,
            {
                self.items = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for items: {e}")
                    });
                self
            }
            pub fn page<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.page = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for page: {e}")
                    });
                self
            }
            pub fn per_page<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.per_page = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for per_page: {e}")
                    });
                self
            }
            pub fn total_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.total_count = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for total_count: {e}")
                    });
                self
            }
            pub fn total_pages<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i64>,
                T::Error: ::std::fmt::Display,
            {
                self.total_pages = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for total_pages: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<OffsetPaginatedProjectResponse>
        for super::OffsetPaginatedProjectResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: OffsetPaginatedProjectResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    items: value.items?,
                    page: value.page?,
                    per_page: value.per_page?,
                    total_count: value.total_count?,
                    total_pages: value.total_pages?,
                })
            }
        }
        impl ::std::convert::From<super::OffsetPaginatedProjectResponse>
        for OffsetPaginatedProjectResponse {
            fn from(value: super::OffsetPaginatedProjectResponse) -> Self {
                Self {
                    items: Ok(value.items),
                    page: Ok(value.page),
                    per_page: Ok(value.per_page),
                    total_count: Ok(value.total_count),
                    total_pages: Ok(value.total_pages),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct PaginatedEventResponse {
            has_more: ::std::result::Result<bool, ::std::string::String>,
            items: ::std::result::Result<
                ::std::vec::Vec<super::EventResponse>,
                ::std::string::String,
            >,
            next_cursor: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for PaginatedEventResponse {
            fn default() -> Self {
                Self {
                    has_more: Err("no value supplied for has_more".to_string()),
                    items: Err("no value supplied for items".to_string()),
                    next_cursor: Ok(Default::default()),
                }
            }
        }
        impl PaginatedEventResponse {
            pub fn has_more<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.has_more = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for has_more: {e}")
                    });
                self
            }
            pub fn items<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::vec::Vec<super::EventResponse>>,
                T::Error: ::std::fmt::Display,
            {
                self.items = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for items: {e}")
                    });
                self
            }
            pub fn next_cursor<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.next_cursor = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for next_cursor: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<PaginatedEventResponse>
        for super::PaginatedEventResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: PaginatedEventResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    has_more: value.has_more?,
                    items: value.items?,
                    next_cursor: value.next_cursor?,
                })
            }
        }
        impl ::std::convert::From<super::PaginatedEventResponse>
        for PaginatedEventResponse {
            fn from(value: super::PaginatedEventResponse) -> Self {
                Self {
                    has_more: Ok(value.has_more),
                    items: Ok(value.items),
                    next_cursor: Ok(value.next_cursor),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct ProjectResponse {
            created_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
            digested_event_count: ::std::result::Result<i32, ::std::string::String>,
            dsn: ::std::result::Result<::std::string::String, ::std::string::String>,
            id: ::std::result::Result<i32, ::std::string::String>,
            name: ::std::result::Result<::std::string::String, ::std::string::String>,
            sentry_key: ::std::result::Result<::uuid::Uuid, ::std::string::String>,
            slug: ::std::result::Result<::std::string::String, ::std::string::String>,
            stored_event_count: ::std::result::Result<i32, ::std::string::String>,
            updated_at: ::std::result::Result<
                ::chrono::DateTime<::chrono::offset::Utc>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for ProjectResponse {
            fn default() -> Self {
                Self {
                    created_at: Err("no value supplied for created_at".to_string()),
                    digested_event_count: Err(
                        "no value supplied for digested_event_count".to_string(),
                    ),
                    dsn: Err("no value supplied for dsn".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    name: Err("no value supplied for name".to_string()),
                    sentry_key: Err("no value supplied for sentry_key".to_string()),
                    slug: Err("no value supplied for slug".to_string()),
                    stored_event_count: Err(
                        "no value supplied for stored_event_count".to_string(),
                    ),
                    updated_at: Err("no value supplied for updated_at".to_string()),
                }
            }
        }
        impl ProjectResponse {
            pub fn created_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.created_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for created_at: {e}")
                    });
                self
            }
            pub fn digested_event_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.digested_event_count = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for digested_event_count: {e}"
                        )
                    });
                self
            }
            pub fn dsn<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.dsn = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for dsn: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
            pub fn sentry_key<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::uuid::Uuid>,
                T::Error: ::std::fmt::Display,
            {
                self.sentry_key = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for sentry_key: {e}")
                    });
                self
            }
            pub fn slug<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.slug = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for slug: {e}")
                    });
                self
            }
            pub fn stored_event_count<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.stored_event_count = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for stored_event_count: {e}"
                        )
                    });
                self
            }
            pub fn updated_at<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::chrono::DateTime<::chrono::offset::Utc>>,
                T::Error: ::std::fmt::Display,
            {
                self.updated_at = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for updated_at: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<ProjectResponse> for super::ProjectResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: ProjectResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    created_at: value.created_at?,
                    digested_event_count: value.digested_event_count?,
                    dsn: value.dsn?,
                    id: value.id?,
                    name: value.name?,
                    sentry_key: value.sentry_key?,
                    slug: value.slug?,
                    stored_event_count: value.stored_event_count?,
                    updated_at: value.updated_at?,
                })
            }
        }
        impl ::std::convert::From<super::ProjectResponse> for ProjectResponse {
            fn from(value: super::ProjectResponse) -> Self {
                Self {
                    created_at: Ok(value.created_at),
                    digested_event_count: Ok(value.digested_event_count),
                    dsn: Ok(value.dsn),
                    id: Ok(value.id),
                    name: Ok(value.name),
                    sentry_key: Ok(value.sentry_key),
                    slug: Ok(value.slug),
                    stored_event_count: Ok(value.stored_event_count),
                    updated_at: Ok(value.updated_at),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct ReadinessChecks {
            database: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for ReadinessChecks {
            fn default() -> Self {
                Self {
                    database: Err("no value supplied for database".to_string()),
                }
            }
        }
        impl ReadinessChecks {
            pub fn database<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.database = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for database: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<ReadinessChecks> for super::ReadinessChecks {
            type Error = super::error::ConversionError;
            fn try_from(
                value: ReadinessChecks,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self { database: value.database? })
            }
        }
        impl ::std::convert::From<super::ReadinessChecks> for ReadinessChecks {
            fn from(value: super::ReadinessChecks) -> Self {
                Self {
                    database: Ok(value.database),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct ReadinessResponse {
            checks: ::std::result::Result<super::ReadinessChecks, ::std::string::String>,
            status: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for ReadinessResponse {
            fn default() -> Self {
                Self {
                    checks: Err("no value supplied for checks".to_string()),
                    status: Err("no value supplied for status".to_string()),
                }
            }
        }
        impl ReadinessResponse {
            pub fn checks<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<super::ReadinessChecks>,
                T::Error: ::std::fmt::Display,
            {
                self.checks = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for checks: {e}")
                    });
                self
            }
            pub fn status<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.status = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for status: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<ReadinessResponse> for super::ReadinessResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: ReadinessResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    checks: value.checks?,
                    status: value.status?,
                })
            }
        }
        impl ::std::convert::From<super::ReadinessResponse> for ReadinessResponse {
            fn from(value: super::ReadinessResponse) -> Self {
                Self {
                    checks: Ok(value.checks),
                    status: Ok(value.status),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct SlackConfig {
            channel: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            icon_emoji: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            username: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            webhook_url: ::std::result::Result<
                ::std::string::String,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for SlackConfig {
            fn default() -> Self {
                Self {
                    channel: Ok(Default::default()),
                    icon_emoji: Ok(Default::default()),
                    username: Ok(Default::default()),
                    webhook_url: Err("no value supplied for webhook_url".to_string()),
                }
            }
        }
        impl SlackConfig {
            pub fn channel<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.channel = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel: {e}")
                    });
                self
            }
            pub fn icon_emoji<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.icon_emoji = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for icon_emoji: {e}")
                    });
                self
            }
            pub fn username<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.username = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for username: {e}")
                    });
                self
            }
            pub fn webhook_url<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.webhook_url = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for webhook_url: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<SlackConfig> for super::SlackConfig {
            type Error = super::error::ConversionError;
            fn try_from(
                value: SlackConfig,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    channel: value.channel?,
                    icon_emoji: value.icon_emoji?,
                    username: value.username?,
                    webhook_url: value.webhook_url?,
                })
            }
        }
        impl ::std::convert::From<super::SlackConfig> for SlackConfig {
            fn from(value: super::SlackConfig) -> Self {
                Self {
                    channel: Ok(value.channel),
                    icon_emoji: Ok(value.icon_emoji),
                    username: Ok(value.username),
                    webhook_url: Ok(value.webhook_url),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct TestChannelResponse {
            message: ::std::result::Result<::std::string::String, ::std::string::String>,
            success: ::std::result::Result<bool, ::std::string::String>,
        }
        impl ::std::default::Default for TestChannelResponse {
            fn default() -> Self {
                Self {
                    message: Err("no value supplied for message".to_string()),
                    success: Err("no value supplied for success".to_string()),
                }
            }
        }
        impl TestChannelResponse {
            pub fn message<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.message = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for message: {e}")
                    });
                self
            }
            pub fn success<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.success = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for success: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<TestChannelResponse>
        for super::TestChannelResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: TestChannelResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    message: value.message?,
                    success: value.success?,
                })
            }
        }
        impl ::std::convert::From<super::TestChannelResponse> for TestChannelResponse {
            fn from(value: super::TestChannelResponse) -> Self {
                Self {
                    message: Ok(value.message),
                    success: Ok(value.success),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct UpdateAlertRule {
            channel_ids: ::std::result::Result<
                ::std::option::Option<::std::vec::Vec<i32>>,
                ::std::string::String,
            >,
            conditions: ::std::result::Result<
                ::std::option::Option<::serde_json::Value>,
                ::std::string::String,
            >,
            cooldown_minutes: ::std::result::Result<
                ::std::option::Option<i32>,
                ::std::string::String,
            >,
            is_enabled: ::std::result::Result<
                ::std::option::Option<bool>,
                ::std::string::String,
            >,
            name: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for UpdateAlertRule {
            fn default() -> Self {
                Self {
                    channel_ids: Ok(Default::default()),
                    conditions: Ok(Default::default()),
                    cooldown_minutes: Ok(Default::default()),
                    is_enabled: Ok(Default::default()),
                    name: Ok(Default::default()),
                }
            }
        }
        impl UpdateAlertRule {
            pub fn channel_ids<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::vec::Vec<i32>>>,
                T::Error: ::std::fmt::Display,
            {
                self.channel_ids = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for channel_ids: {e}")
                    });
                self
            }
            pub fn conditions<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::serde_json::Value>>,
                T::Error: ::std::fmt::Display,
            {
                self.conditions = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for conditions: {e}")
                    });
                self
            }
            pub fn cooldown_minutes<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<i32>>,
                T::Error: ::std::fmt::Display,
            {
                self.cooldown_minutes = value
                    .try_into()
                    .map_err(|e| {
                        format!(
                            "error converting supplied value for cooldown_minutes: {e}"
                        )
                    });
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<bool>>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<UpdateAlertRule> for super::UpdateAlertRule {
            type Error = super::error::ConversionError;
            fn try_from(
                value: UpdateAlertRule,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    channel_ids: value.channel_ids?,
                    conditions: value.conditions?,
                    cooldown_minutes: value.cooldown_minutes?,
                    is_enabled: value.is_enabled?,
                    name: value.name?,
                })
            }
        }
        impl ::std::convert::From<super::UpdateAlertRule> for UpdateAlertRule {
            fn from(value: super::UpdateAlertRule) -> Self {
                Self {
                    channel_ids: Ok(value.channel_ids),
                    conditions: Ok(value.conditions),
                    cooldown_minutes: Ok(value.cooldown_minutes),
                    is_enabled: Ok(value.is_enabled),
                    name: Ok(value.name),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct UpdateIssueState {
            is_muted: ::std::result::Result<
                ::std::option::Option<bool>,
                ::std::string::String,
            >,
            is_resolved: ::std::result::Result<
                ::std::option::Option<bool>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for UpdateIssueState {
            fn default() -> Self {
                Self {
                    is_muted: Ok(Default::default()),
                    is_resolved: Ok(Default::default()),
                }
            }
        }
        impl UpdateIssueState {
            pub fn is_muted<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<bool>>,
                T::Error: ::std::fmt::Display,
            {
                self.is_muted = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_muted: {e}")
                    });
                self
            }
            pub fn is_resolved<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<bool>>,
                T::Error: ::std::fmt::Display,
            {
                self.is_resolved = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_resolved: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<UpdateIssueState> for super::UpdateIssueState {
            type Error = super::error::ConversionError;
            fn try_from(
                value: UpdateIssueState,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    is_muted: value.is_muted?,
                    is_resolved: value.is_resolved?,
                })
            }
        }
        impl ::std::convert::From<super::UpdateIssueState> for UpdateIssueState {
            fn from(value: super::UpdateIssueState) -> Self {
                Self {
                    is_muted: Ok(value.is_muted),
                    is_resolved: Ok(value.is_resolved),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct UpdateNotificationChannel {
            config: ::std::result::Result<
                ::std::option::Option<::serde_json::Value>,
                ::std::string::String,
            >,
            is_enabled: ::std::result::Result<
                ::std::option::Option<bool>,
                ::std::string::String,
            >,
            name: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for UpdateNotificationChannel {
            fn default() -> Self {
                Self {
                    config: Ok(Default::default()),
                    is_enabled: Ok(Default::default()),
                    name: Ok(Default::default()),
                }
            }
        }
        impl UpdateNotificationChannel {
            pub fn config<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::serde_json::Value>>,
                T::Error: ::std::fmt::Display,
            {
                self.config = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for config: {e}")
                    });
                self
            }
            pub fn is_enabled<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<bool>>,
                T::Error: ::std::fmt::Display,
            {
                self.is_enabled = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_enabled: {e}")
                    });
                self
            }
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<UpdateNotificationChannel>
        for super::UpdateNotificationChannel {
            type Error = super::error::ConversionError;
            fn try_from(
                value: UpdateNotificationChannel,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    config: value.config?,
                    is_enabled: value.is_enabled?,
                    name: value.name?,
                })
            }
        }
        impl ::std::convert::From<super::UpdateNotificationChannel>
        for UpdateNotificationChannel {
            fn from(value: super::UpdateNotificationChannel) -> Self {
                Self {
                    config: Ok(value.config),
                    is_enabled: Ok(value.is_enabled),
                    name: Ok(value.name),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct UpdateProject {
            name: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
        }
        impl ::std::default::Default for UpdateProject {
            fn default() -> Self {
                Self {
                    name: Ok(Default::default()),
                }
            }
        }
        impl UpdateProject {
            pub fn name<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.name = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for name: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<UpdateProject> for super::UpdateProject {
            type Error = super::error::ConversionError;
            fn try_from(
                value: UpdateProject,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self { name: value.name? })
            }
        }
        impl ::std::convert::From<super::UpdateProject> for UpdateProject {
            fn from(value: super::UpdateProject) -> Self {
                Self { name: Ok(value.name) }
            }
        }
        #[derive(Clone, Debug)]
        pub struct UserResponse {
            email: ::std::result::Result<::std::string::String, ::std::string::String>,
            id: ::std::result::Result<i32, ::std::string::String>,
            is_admin: ::std::result::Result<bool, ::std::string::String>,
        }
        impl ::std::default::Default for UserResponse {
            fn default() -> Self {
                Self {
                    email: Err("no value supplied for email".to_string()),
                    id: Err("no value supplied for id".to_string()),
                    is_admin: Err("no value supplied for is_admin".to_string()),
                }
            }
        }
        impl UserResponse {
            pub fn email<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.email = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for email: {e}")
                    });
                self
            }
            pub fn id<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<i32>,
                T::Error: ::std::fmt::Display,
            {
                self.id = value
                    .try_into()
                    .map_err(|e| format!("error converting supplied value for id: {e}"));
                self
            }
            pub fn is_admin<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<bool>,
                T::Error: ::std::fmt::Display,
            {
                self.is_admin = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for is_admin: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<UserResponse> for super::UserResponse {
            type Error = super::error::ConversionError;
            fn try_from(
                value: UserResponse,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    email: value.email?,
                    id: value.id?,
                    is_admin: value.is_admin?,
                })
            }
        }
        impl ::std::convert::From<super::UserResponse> for UserResponse {
            fn from(value: super::UserResponse) -> Self {
                Self {
                    email: Ok(value.email),
                    id: Ok(value.id),
                    is_admin: Ok(value.is_admin),
                }
            }
        }
        #[derive(Clone, Debug)]
        pub struct WebhookConfig {
            headers: ::std::result::Result<
                ::std::option::Option<
                    ::std::collections::HashMap<
                        ::std::string::String,
                        ::std::string::String,
                    >,
                >,
                ::std::string::String,
            >,
            secret: ::std::result::Result<
                ::std::option::Option<::std::string::String>,
                ::std::string::String,
            >,
            url: ::std::result::Result<::std::string::String, ::std::string::String>,
        }
        impl ::std::default::Default for WebhookConfig {
            fn default() -> Self {
                Self {
                    headers: Ok(Default::default()),
                    secret: Ok(Default::default()),
                    url: Err("no value supplied for url".to_string()),
                }
            }
        }
        impl WebhookConfig {
            pub fn headers<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<
                    ::std::option::Option<
                        ::std::collections::HashMap<
                            ::std::string::String,
                            ::std::string::String,
                        >,
                    >,
                >,
                T::Error: ::std::fmt::Display,
            {
                self.headers = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for headers: {e}")
                    });
                self
            }
            pub fn secret<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::option::Option<::std::string::String>>,
                T::Error: ::std::fmt::Display,
            {
                self.secret = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for secret: {e}")
                    });
                self
            }
            pub fn url<T>(mut self, value: T) -> Self
            where
                T: ::std::convert::TryInto<::std::string::String>,
                T::Error: ::std::fmt::Display,
            {
                self.url = value
                    .try_into()
                    .map_err(|e| {
                        format!("error converting supplied value for url: {e}")
                    });
                self
            }
        }
        impl ::std::convert::TryFrom<WebhookConfig> for super::WebhookConfig {
            type Error = super::error::ConversionError;
            fn try_from(
                value: WebhookConfig,
            ) -> ::std::result::Result<Self, super::error::ConversionError> {
                Ok(Self {
                    headers: value.headers?,
                    secret: value.secret?,
                    url: value.url?,
                })
            }
        }
        impl ::std::convert::From<super::WebhookConfig> for WebhookConfig {
            fn from(value: super::WebhookConfig) -> Self {
                Self {
                    headers: Ok(value.headers),
                    secret: Ok(value.secret),
                    url: Ok(value.url),
                }
            }
        }
    }
}
#[derive(Clone, Debug)]
/**Client for Rustrak API

Ultra-lightweight error tracking server compatible with Sentry SDKs

Version: 0.1.0*/
pub struct Client {
    pub(crate) baseurl: String,
    pub(crate) client: reqwest::Client,
}
impl Client {
    /// Create a new client.
    ///
    /// `baseurl` is the base URL provided to the internal
    /// `reqwest::Client`, and should include a scheme and hostname,
    /// as well as port and a path stem if applicable.
    pub fn new(baseurl: &str) -> Self {
        #[cfg(not(target_arch = "wasm32"))]
        let client = {
            let dur = ::std::time::Duration::from_secs(15u64);
            reqwest::ClientBuilder::new().connect_timeout(dur).timeout(dur)
        };
        #[cfg(target_arch = "wasm32")]
        let client = reqwest::ClientBuilder::new();
        Self::new_with_client(baseurl, client.build().unwrap())
    }
    /// Construct a new client with an existing `reqwest::Client`,
    /// allowing more control over its configuration.
    ///
    /// `baseurl` is the base URL provided to the internal
    /// `reqwest::Client`, and should include a scheme and hostname,
    /// as well as port and a path stem if applicable.
    pub fn new_with_client(baseurl: &str, client: reqwest::Client) -> Self {
        Self {
            baseurl: baseurl.to_string(),
            client,
        }
    }
}
impl ClientInfo<()> for Client {
    fn api_version() -> &'static str {
        "0.1.0"
    }
    fn baseurl(&self) -> &str {
        self.baseurl.as_str()
    }
    fn client(&self) -> &reqwest::Client {
        &self.client
    }
    fn inner(&self) -> &() {
        &()
    }
}
impl ClientHooks<()> for &Client {}
impl Client {
    /**GET /api/alert-channels

Sends a `GET` request to `/api/alert-channels`

```ignore
let response = client.list_channels()
    .send()
    .await;
```*/
    pub fn list_channels(&self) -> builder::ListChannels<'_> {
        builder::ListChannels::new(self)
    }
    /**POST /api/alert-channels

Sends a `POST` request to `/api/alert-channels`

```ignore
let response = client.create_channel()
    .body(body)
    .send()
    .await;
```*/
    pub fn create_channel(&self) -> builder::CreateChannel<'_> {
        builder::CreateChannel::new(self)
    }
    /**GET /api/alert-channels/{id}

Sends a `GET` request to `/api/alert-channels/{id}`

Arguments:
- `id`: Channel ID
```ignore
let response = client.get_channel()
    .id(id)
    .send()
    .await;
```*/
    pub fn get_channel(&self) -> builder::GetChannel<'_> {
        builder::GetChannel::new(self)
    }
    /**DELETE /api/alert-channels/{id}

Sends a `DELETE` request to `/api/alert-channels/{id}`

Arguments:
- `id`: Channel ID
```ignore
let response = client.delete_channel()
    .id(id)
    .send()
    .await;
```*/
    pub fn delete_channel(&self) -> builder::DeleteChannel<'_> {
        builder::DeleteChannel::new(self)
    }
    /**PATCH /api/alert-channels/{id}

Sends a `PATCH` request to `/api/alert-channels/{id}`

Arguments:
- `id`: Channel ID
- `body`
```ignore
let response = client.update_channel()
    .id(id)
    .body(body)
    .send()
    .await;
```*/
    pub fn update_channel(&self) -> builder::UpdateChannel<'_> {
        builder::UpdateChannel::new(self)
    }
    /**POST /api/alert-channels/{id}/test

Sends a `POST` request to `/api/alert-channels/{id}/test`

Arguments:
- `id`: Channel ID
```ignore
let response = client.test_channel()
    .id(id)
    .send()
    .await;
```*/
    pub fn test_channel(&self) -> builder::TestChannel<'_> {
        builder::TestChannel::new(self)
    }
    /**GET /api/projects - List projects with pagination

Sends a `GET` request to `/api/projects`

Arguments:
- `order`: Sort order direction (default: desc = newest first)
- `page`: Page number (1-indexed, default: 1)
- `per_page`: Items per page (default: 20)
```ignore
let response = client.list_projects()
    .order(order)
    .page(page)
    .per_page(per_page)
    .send()
    .await;
```*/
    pub fn list_projects(&self) -> builder::ListProjects<'_> {
        builder::ListProjects::new(self)
    }
    /**POST /api/projects - Create a new project

Sends a `POST` request to `/api/projects`

```ignore
let response = client.create_project()
    .body(body)
    .send()
    .await;
```*/
    pub fn create_project(&self) -> builder::CreateProject<'_> {
        builder::CreateProject::new(self)
    }
    /**GET /api/projects/{id} - Get a project by ID

Sends a `GET` request to `/api/projects/{id}`

Arguments:
- `id`: Project ID
```ignore
let response = client.get_project()
    .id(id)
    .send()
    .await;
```*/
    pub fn get_project(&self) -> builder::GetProject<'_> {
        builder::GetProject::new(self)
    }
    /**DELETE /api/projects/{id} - Delete a project

Sends a `DELETE` request to `/api/projects/{id}`

Arguments:
- `id`: Project ID
```ignore
let response = client.delete_project()
    .id(id)
    .send()
    .await;
```*/
    pub fn delete_project(&self) -> builder::DeleteProject<'_> {
        builder::DeleteProject::new(self)
    }
    /**PATCH /api/projects/{id} - Update a project

Sends a `PATCH` request to `/api/projects/{id}`

Arguments:
- `id`: Project ID
- `body`
```ignore
let response = client.update_project()
    .id(id)
    .body(body)
    .send()
    .await;
```*/
    pub fn update_project(&self) -> builder::UpdateProject<'_> {
        builder::UpdateProject::new(self)
    }
    /**GET /api/projects/{project_id}/alert-history

Sends a `GET` request to `/api/projects/{project_id}/alert-history`

Arguments:
- `project_id`: Project ID
- `limit`
```ignore
let response = client.list_history()
    .project_id(project_id)
    .limit(limit)
    .send()
    .await;
```*/
    pub fn list_history(&self) -> builder::ListHistory<'_> {
        builder::ListHistory::new(self)
    }
    /**GET /api/projects/{project_id}/alert-rules

Sends a `GET` request to `/api/projects/{project_id}/alert-rules`

Arguments:
- `project_id`: Project ID
```ignore
let response = client.list_rules()
    .project_id(project_id)
    .send()
    .await;
```*/
    pub fn list_rules(&self) -> builder::ListRules<'_> {
        builder::ListRules::new(self)
    }
    /**POST /api/projects/{project_id}/alert-rules

Sends a `POST` request to `/api/projects/{project_id}/alert-rules`

Arguments:
- `project_id`: Project ID
- `body`
```ignore
let response = client.create_rule()
    .project_id(project_id)
    .body(body)
    .send()
    .await;
```*/
    pub fn create_rule(&self) -> builder::CreateRule<'_> {
        builder::CreateRule::new(self)
    }
    /**GET /api/projects/{project_id}/alert-rules/{rule_id}

Sends a `GET` request to `/api/projects/{project_id}/alert-rules/{rule_id}`

Arguments:
- `project_id`: Project ID
- `rule_id`: Rule ID
```ignore
let response = client.get_rule()
    .project_id(project_id)
    .rule_id(rule_id)
    .send()
    .await;
```*/
    pub fn get_rule(&self) -> builder::GetRule<'_> {
        builder::GetRule::new(self)
    }
    /**DELETE /api/projects/{project_id}/alert-rules/{rule_id}

Sends a `DELETE` request to `/api/projects/{project_id}/alert-rules/{rule_id}`

Arguments:
- `project_id`: Project ID
- `rule_id`: Rule ID
```ignore
let response = client.delete_rule()
    .project_id(project_id)
    .rule_id(rule_id)
    .send()
    .await;
```*/
    pub fn delete_rule(&self) -> builder::DeleteRule<'_> {
        builder::DeleteRule::new(self)
    }
    /**PATCH /api/projects/{project_id}/alert-rules/{rule_id}

Sends a `PATCH` request to `/api/projects/{project_id}/alert-rules/{rule_id}`

Arguments:
- `project_id`: Project ID
- `rule_id`: Rule ID
- `body`
```ignore
let response = client.update_rule()
    .project_id(project_id)
    .rule_id(rule_id)
    .body(body)
    .send()
    .await;
```*/
    pub fn update_rule(&self) -> builder::UpdateRule<'_> {
        builder::UpdateRule::new(self)
    }
    /**GET /api/projects/{project_id}/issues
Lists issues for a project with offset-based pagination

Sends a `GET` request to `/api/projects/{project_id}/issues`

Arguments:
- `project_id`: Project ID
- `filter`: Filter: open (not resolved, not muted), resolved, muted, all
- `order`: Sort order direction (default: desc)
- `page`: Page number (1-indexed, default: 1)
- `per_page`: Items per page (default: 20)
- `sort`: Sort mode (default: last_seen)
```ignore
let response = client.list_issues()
    .project_id(project_id)
    .filter(filter)
    .order(order)
    .page(page)
    .per_page(per_page)
    .sort(sort)
    .send()
    .await;
```*/
    pub fn list_issues(&self) -> builder::ListIssues<'_> {
        builder::ListIssues::new(self)
    }
    /**GET /api/projects/{project_id}/issues/{issue_id}
Gets a single issue by ID

Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}`

Arguments:
- `project_id`: Project ID
- `issue_id`: Issue ID
```ignore
let response = client.get_issue()
    .project_id(project_id)
    .issue_id(issue_id)
    .send()
    .await;
```*/
    pub fn get_issue(&self) -> builder::GetIssue<'_> {
        builder::GetIssue::new(self)
    }
    /**DELETE /api/projects/{project_id}/issues/{issue_id}
Soft-deletes an issue

Sends a `DELETE` request to `/api/projects/{project_id}/issues/{issue_id}`

Arguments:
- `project_id`: Project ID
- `issue_id`: Issue ID
```ignore
let response = client.delete_issue()
    .project_id(project_id)
    .issue_id(issue_id)
    .send()
    .await;
```*/
    pub fn delete_issue(&self) -> builder::DeleteIssue<'_> {
        builder::DeleteIssue::new(self)
    }
    /**PATCH /api/projects/{project_id}/issues/{issue_id}
Updates issue state (resolve, mute, etc.)

Sends a `PATCH` request to `/api/projects/{project_id}/issues/{issue_id}`

Arguments:
- `project_id`: Project ID
- `issue_id`: Issue ID
- `body`
```ignore
let response = client.update_issue()
    .project_id(project_id)
    .issue_id(issue_id)
    .body(body)
    .send()
    .await;
```*/
    pub fn update_issue(&self) -> builder::UpdateIssue<'_> {
        builder::UpdateIssue::new(self)
    }
    /**GET /api/projects/{project_id}/issues/{issue_id}/events
Lists events for an issue with cursor-based pagination

Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}/events`

Arguments:
- `project_id`: Project ID
- `issue_id`: Issue ID
- `cursor`: Pagination cursor
- `order`: Sort order direction (default: desc = newest first)
```ignore
let response = client.list_events()
    .project_id(project_id)
    .issue_id(issue_id)
    .cursor(cursor)
    .order(order)
    .send()
    .await;
```*/
    pub fn list_events(&self) -> builder::ListEvents<'_> {
        builder::ListEvents::new(self)
    }
    /**GET /api/projects/{project_id}/issues/{issue_id}/events/{event_id}
Gets a single event with full data

Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}/events/{event_id}`

Arguments:
- `project_id`: Project ID
- `issue_id`: Issue ID
- `event_id`: Event ID
```ignore
let response = client.get_event()
    .project_id(project_id)
    .issue_id(issue_id)
    .event_id(event_id)
    .send()
    .await;
```*/
    pub fn get_event(&self) -> builder::GetEvent<'_> {
        builder::GetEvent::new(self)
    }
    /**GET /api/tokens - List all tokens (masked)

Sends a `GET` request to `/api/tokens`

```ignore
let response = client.list_tokens()
    .send()
    .await;
```*/
    pub fn list_tokens(&self) -> builder::ListTokens<'_> {
        builder::ListTokens::new(self)
    }
    /**POST /api/tokens - Create a new token

Sends a `POST` request to `/api/tokens`

```ignore
let response = client.create_token()
    .body(body)
    .send()
    .await;
```*/
    pub fn create_token(&self) -> builder::CreateToken<'_> {
        builder::CreateToken::new(self)
    }
    /**DELETE /api/tokens/{id} - Revoke a token

Sends a `DELETE` request to `/api/tokens/{id}`

Arguments:
- `id`: Token ID
```ignore
let response = client.delete_token()
    .id(id)
    .send()
    .await;
```*/
    pub fn delete_token(&self) -> builder::DeleteToken<'_> {
        builder::DeleteToken::new(self)
    }
    /**POST /auth/login
Authenticate user and create session

Sends a `POST` request to `/auth/login`

```ignore
let response = client.login()
    .body(body)
    .send()
    .await;
```*/
    pub fn login(&self) -> builder::Login<'_> {
        builder::Login::new(self)
    }
    /**POST /auth/logout
Clear session

Sends a `POST` request to `/auth/logout`

```ignore
let response = client.logout()
    .send()
    .await;
```*/
    pub fn logout(&self) -> builder::Logout<'_> {
        builder::Logout::new(self)
    }
    /**GET /auth/me
Get current authenticated user

Sends a `GET` request to `/auth/me`

```ignore
let response = client.get_current_user()
    .send()
    .await;
```*/
    pub fn get_current_user(&self) -> builder::GetCurrentUser<'_> {
        builder::GetCurrentUser::new(self)
    }
    /**POST /auth/register
Create new user account

Sends a `POST` request to `/auth/register`

```ignore
let response = client.register()
    .body(body)
    .send()
    .await;
```*/
    pub fn register(&self) -> builder::Register<'_> {
        builder::Register::new(self)
    }
    /**Liveness check - is the process running?
Returns 200 if the server is alive

Sends a `GET` request to `/health`

```ignore
let response = client.liveness()
    .send()
    .await;
```*/
    pub fn liveness(&self) -> builder::Liveness<'_> {
        builder::Liveness::new(self)
    }
    /**Readiness check - is the service ready to handle requests?
Returns 200 if all dependencies are available, 503 otherwise

Sends a `GET` request to `/health/ready`

```ignore
let response = client.readiness()
    .send()
    .await;
```*/
    pub fn readiness(&self) -> builder::Readiness<'_> {
        builder::Readiness::new(self)
    }
}
/// Types for composing operation parameters.
#[allow(clippy::all)]
pub mod builder {
    use super::types;
    #[allow(unused_imports)]
    use super::{
        encode_path, ByteStream, ClientInfo, ClientHooks, Error, OperationInfo,
        RequestBuilderExt, ResponseValue,
    };
    /**Builder for [`Client::list_channels`]

[`Client::list_channels`]: super::Client::list_channels*/
    #[derive(Debug, Clone)]
    pub struct ListChannels<'a> {
        client: &'a super::Client,
    }
    impl<'a> ListChannels<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `GET` request to `/api/alert-channels`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<::std::vec::Vec<types::NotificationChannel>>,
            Error<()>,
        > {
            let Self { client } = self;
            let url = format!("{}/api/alert-channels", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_channels",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::create_channel`]

[`Client::create_channel`]: super::Client::create_channel*/
    #[derive(Debug, Clone)]
    pub struct CreateChannel<'a> {
        client: &'a super::Client,
        body: Result<types::builder::CreateNotificationChannel, String>,
    }
    impl<'a> CreateChannel<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::CreateNotificationChannel>,
            <V as std::convert::TryInto<
                types::CreateNotificationChannel,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!(
                        "conversion to `CreateNotificationChannel` for body failed: {}",
                        s
                    )
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::CreateNotificationChannel,
            ) -> types::builder::CreateNotificationChannel,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/api/alert-channels`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::NotificationChannel>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, body } = self;
            let body = body
                .and_then(|v| {
                    types::CreateNotificationChannel::try_from(v)
                        .map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!("{}/api/alert-channels", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "create_channel",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                201u16 => ResponseValue::from_response(response).await,
                400u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_channel`]

[`Client::get_channel`]: super::Client::get_channel*/
    #[derive(Debug, Clone)]
    pub struct GetChannel<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> GetChannel<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/alert-channels/{id}`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::NotificationChannel>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/alert-channels/{}", client.baseurl, encode_path(& id
                .to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_channel",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::delete_channel`]

[`Client::delete_channel`]: super::Client::delete_channel*/
    #[derive(Debug, Clone)]
    pub struct DeleteChannel<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> DeleteChannel<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `DELETE` request to `/api/alert-channels/{id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<()>, Error<types::ErrorResponse>> {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/alert-channels/{}", client.baseurl, encode_path(& id
                .to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .delete(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "delete_channel",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::update_channel`]

[`Client::update_channel`]: super::Client::update_channel*/
    #[derive(Debug, Clone)]
    pub struct UpdateChannel<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
        body: Result<types::builder::UpdateNotificationChannel, String>,
    }
    impl<'a> UpdateChannel<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::UpdateNotificationChannel>,
            <V as std::convert::TryInto<
                types::UpdateNotificationChannel,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!(
                        "conversion to `UpdateNotificationChannel` for body failed: {}",
                        s
                    )
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::UpdateNotificationChannel,
            ) -> types::builder::UpdateNotificationChannel,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `PATCH` request to `/api/alert-channels/{id}`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::NotificationChannel>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, id, body } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let body = body
                .and_then(|v| {
                    types::UpdateNotificationChannel::try_from(v)
                        .map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/alert-channels/{}", client.baseurl, encode_path(& id
                .to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .patch(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "update_channel",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::test_channel`]

[`Client::test_channel`]: super::Client::test_channel*/
    #[derive(Debug, Clone)]
    pub struct TestChannel<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> TestChannel<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `POST` request to `/api/alert-channels/{id}/test`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::TestChannelResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/alert-channels/{}/test", client.baseurl, encode_path(& id
                .to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "test_channel",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_projects`]

[`Client::list_projects`]: super::Client::list_projects*/
    #[derive(Debug, Clone)]
    pub struct ListProjects<'a> {
        client: &'a super::Client,
        order: Result<Option<types::SortOrder>, String>,
        page: Result<Option<i64>, String>,
        per_page: Result<Option<i64>, String>,
    }
    impl<'a> ListProjects<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                order: Ok(None),
                page: Ok(None),
                per_page: Ok(None),
            }
        }
        pub fn order<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::SortOrder>,
        {
            self.order = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `SortOrder` for order failed".to_string());
            self
        }
        pub fn page<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i64>,
        {
            self.page = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `i64` for page failed".to_string());
            self
        }
        pub fn per_page<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i64>,
        {
            self.per_page = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `i64` for per_page failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::OffsetPaginatedProjectResponse>, Error<()>> {
            let Self { client, order, page, per_page } = self;
            let order = order.map_err(Error::InvalidRequest)?;
            let page = page.map_err(Error::InvalidRequest)?;
            let per_page = per_page.map_err(Error::InvalidRequest)?;
            let url = format!("{}/api/projects", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .query(&progenitor_client::QueryParam::new("order", &order))
                .query(&progenitor_client::QueryParam::new("page", &page))
                .query(&progenitor_client::QueryParam::new("per_page", &per_page))
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_projects",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::create_project`]

[`Client::create_project`]: super::Client::create_project*/
    #[derive(Debug, Clone)]
    pub struct CreateProject<'a> {
        client: &'a super::Client,
        body: Result<types::builder::CreateProject, String>,
    }
    impl<'a> CreateProject<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::CreateProject>,
            <V as std::convert::TryInto<types::CreateProject>>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `CreateProject` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::CreateProject,
            ) -> types::builder::CreateProject,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/api/projects`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::ProjectResponse>, Error<types::ErrorResponse>> {
            let Self { client, body } = self;
            let body = body
                .and_then(|v| {
                    types::CreateProject::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!("{}/api/projects", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "create_project",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                201u16 => ResponseValue::from_response(response).await,
                400u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                409u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_project`]

[`Client::get_project`]: super::Client::get_project*/
    #[derive(Debug, Clone)]
    pub struct GetProject<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> GetProject<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::ProjectResponse>, Error<types::ErrorResponse>> {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}", client.baseurl, encode_path(& id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_project",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::delete_project`]

[`Client::delete_project`]: super::Client::delete_project*/
    #[derive(Debug, Clone)]
    pub struct DeleteProject<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> DeleteProject<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `DELETE` request to `/api/projects/{id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<()>, Error<types::ErrorResponse>> {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}", client.baseurl, encode_path(& id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .delete(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "delete_project",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::update_project`]

[`Client::update_project`]: super::Client::update_project*/
    #[derive(Debug, Clone)]
    pub struct UpdateProject<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
        body: Result<types::builder::UpdateProject, String>,
    }
    impl<'a> UpdateProject<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::UpdateProject>,
            <V as std::convert::TryInto<types::UpdateProject>>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `UpdateProject` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::UpdateProject,
            ) -> types::builder::UpdateProject,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `PATCH` request to `/api/projects/{id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::ProjectResponse>, Error<types::ErrorResponse>> {
            let Self { client, id, body } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let body = body
                .and_then(|v| {
                    types::UpdateProject::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}", client.baseurl, encode_path(& id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .patch(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "update_project",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_history`]

[`Client::list_history`]: super::Client::list_history*/
    #[derive(Debug, Clone)]
    pub struct ListHistory<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        limit: Result<Option<i64>, String>,
    }
    impl<'a> ListHistory<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                limit: Ok(None),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn limit<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i64>,
        {
            self.limit = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `i64` for limit failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/alert-history`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<::std::vec::Vec<types::AlertHistory>>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, limit } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let limit = limit.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-history", client.baseurl, encode_path(&
                project_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .query(&progenitor_client::QueryParam::new("limit", &limit))
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_history",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_rules`]

[`Client::list_rules`]: super::Client::list_rules*/
    #[derive(Debug, Clone)]
    pub struct ListRules<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
    }
    impl<'a> ListRules<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/alert-rules`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<::std::vec::Vec<types::AlertRuleResponse>>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-rules", client.baseurl, encode_path(&
                project_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_rules",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::create_rule`]

[`Client::create_rule`]: super::Client::create_rule*/
    #[derive(Debug, Clone)]
    pub struct CreateRule<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        body: Result<types::builder::CreateAlertRule, String>,
    }
    impl<'a> CreateRule<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::CreateAlertRule>,
            <V as std::convert::TryInto<
                types::CreateAlertRule,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `CreateAlertRule` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::CreateAlertRule,
            ) -> types::builder::CreateAlertRule,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/api/projects/{project_id}/alert-rules`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::AlertRuleResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, body } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let body = body
                .and_then(|v| {
                    types::CreateAlertRule::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-rules", client.baseurl, encode_path(&
                project_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "create_rule",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                201u16 => ResponseValue::from_response(response).await,
                400u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_rule`]

[`Client::get_rule`]: super::Client::get_rule*/
    #[derive(Debug, Clone)]
    pub struct GetRule<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        rule_id: Result<i32, String>,
    }
    impl<'a> GetRule<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                rule_id: Err("rule_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn rule_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.rule_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for rule_id failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/alert-rules/{rule_id}`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::AlertRuleResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, rule_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let rule_id = rule_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-rules/{}", client.baseurl, encode_path(&
                project_id.to_string()), encode_path(& rule_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_rule",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::delete_rule`]

[`Client::delete_rule`]: super::Client::delete_rule*/
    #[derive(Debug, Clone)]
    pub struct DeleteRule<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        rule_id: Result<i32, String>,
    }
    impl<'a> DeleteRule<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                rule_id: Err("rule_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn rule_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.rule_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for rule_id failed".to_string());
            self
        }
        ///Sends a `DELETE` request to `/api/projects/{project_id}/alert-rules/{rule_id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<()>, Error<types::ErrorResponse>> {
            let Self { client, project_id, rule_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let rule_id = rule_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-rules/{}", client.baseurl, encode_path(&
                project_id.to_string()), encode_path(& rule_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .delete(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "delete_rule",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::update_rule`]

[`Client::update_rule`]: super::Client::update_rule*/
    #[derive(Debug, Clone)]
    pub struct UpdateRule<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        rule_id: Result<i32, String>,
        body: Result<types::builder::UpdateAlertRule, String>,
    }
    impl<'a> UpdateRule<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                rule_id: Err("rule_id was not initialized".to_string()),
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn rule_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.rule_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for rule_id failed".to_string());
            self
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::UpdateAlertRule>,
            <V as std::convert::TryInto<
                types::UpdateAlertRule,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `UpdateAlertRule` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::UpdateAlertRule,
            ) -> types::builder::UpdateAlertRule,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `PATCH` request to `/api/projects/{project_id}/alert-rules/{rule_id}`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::AlertRuleResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, rule_id, body } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let rule_id = rule_id.map_err(Error::InvalidRequest)?;
            let body = body
                .and_then(|v| {
                    types::UpdateAlertRule::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/alert-rules/{}", client.baseurl, encode_path(&
                project_id.to_string()), encode_path(& rule_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .patch(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "update_rule",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_issues`]

[`Client::list_issues`]: super::Client::list_issues*/
    #[derive(Debug, Clone)]
    pub struct ListIssues<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        filter: Result<Option<types::IssueFilter>, String>,
        order: Result<Option<types::SortOrder>, String>,
        page: Result<Option<i64>, String>,
        per_page: Result<Option<i64>, String>,
        sort: Result<Option<types::IssueSort>, String>,
    }
    impl<'a> ListIssues<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                filter: Ok(None),
                order: Ok(None),
                page: Ok(None),
                per_page: Ok(None),
                sort: Ok(None),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn filter<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::IssueFilter>,
        {
            self.filter = value
                .try_into()
                .map(Some)
                .map_err(|_| {
                    "conversion to `IssueFilter` for filter failed".to_string()
                });
            self
        }
        pub fn order<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::SortOrder>,
        {
            self.order = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `SortOrder` for order failed".to_string());
            self
        }
        pub fn page<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i64>,
        {
            self.page = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `i64` for page failed".to_string());
            self
        }
        pub fn per_page<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i64>,
        {
            self.per_page = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `i64` for per_page failed".to_string());
            self
        }
        pub fn sort<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::IssueSort>,
        {
            self.sort = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `IssueSort` for sort failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/issues`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::OffsetPaginatedIssueResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, filter, order, page, per_page, sort } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let filter = filter.map_err(Error::InvalidRequest)?;
            let order = order.map_err(Error::InvalidRequest)?;
            let page = page.map_err(Error::InvalidRequest)?;
            let per_page = per_page.map_err(Error::InvalidRequest)?;
            let sort = sort.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues", client.baseurl, encode_path(& project_id
                .to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .query(&progenitor_client::QueryParam::new("filter", &filter))
                .query(&progenitor_client::QueryParam::new("order", &order))
                .query(&progenitor_client::QueryParam::new("page", &page))
                .query(&progenitor_client::QueryParam::new("per_page", &per_page))
                .query(&progenitor_client::QueryParam::new("sort", &sort))
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_issues",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_issue`]

[`Client::get_issue`]: super::Client::get_issue*/
    #[derive(Debug, Clone)]
    pub struct GetIssue<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        issue_id: Result<::uuid::Uuid, String>,
    }
    impl<'a> GetIssue<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                issue_id: Err("issue_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn issue_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.issue_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for issue_id failed".to_string()
                });
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::IssueResponse>, Error<types::ErrorResponse>> {
            let Self { client, project_id, issue_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let issue_id = issue_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues/{}", client.baseurl, encode_path(& project_id
                .to_string()), encode_path(& issue_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_issue",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::delete_issue`]

[`Client::delete_issue`]: super::Client::delete_issue*/
    #[derive(Debug, Clone)]
    pub struct DeleteIssue<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        issue_id: Result<::uuid::Uuid, String>,
    }
    impl<'a> DeleteIssue<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                issue_id: Err("issue_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn issue_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.issue_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for issue_id failed".to_string()
                });
            self
        }
        ///Sends a `DELETE` request to `/api/projects/{project_id}/issues/{issue_id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<()>, Error<types::ErrorResponse>> {
            let Self { client, project_id, issue_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let issue_id = issue_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues/{}", client.baseurl, encode_path(& project_id
                .to_string()), encode_path(& issue_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .delete(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "delete_issue",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::update_issue`]

[`Client::update_issue`]: super::Client::update_issue*/
    #[derive(Debug, Clone)]
    pub struct UpdateIssue<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        issue_id: Result<::uuid::Uuid, String>,
        body: Result<types::builder::UpdateIssueState, String>,
    }
    impl<'a> UpdateIssue<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                issue_id: Err("issue_id was not initialized".to_string()),
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn issue_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.issue_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for issue_id failed".to_string()
                });
            self
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::UpdateIssueState>,
            <V as std::convert::TryInto<
                types::UpdateIssueState,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `UpdateIssueState` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::UpdateIssueState,
            ) -> types::builder::UpdateIssueState,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `PATCH` request to `/api/projects/{project_id}/issues/{issue_id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::IssueResponse>, Error<types::ErrorResponse>> {
            let Self { client, project_id, issue_id, body } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let issue_id = issue_id.map_err(Error::InvalidRequest)?;
            let body = body
                .and_then(|v| {
                    types::UpdateIssueState::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues/{}", client.baseurl, encode_path(& project_id
                .to_string()), encode_path(& issue_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .patch(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "update_issue",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_events`]

[`Client::list_events`]: super::Client::list_events*/
    #[derive(Debug, Clone)]
    pub struct ListEvents<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        issue_id: Result<::uuid::Uuid, String>,
        cursor: Result<Option<::std::string::String>, String>,
        order: Result<Option<types::SortOrder>, String>,
    }
    impl<'a> ListEvents<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                issue_id: Err("issue_id was not initialized".to_string()),
                cursor: Ok(None),
                order: Ok(None),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn issue_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.issue_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for issue_id failed".to_string()
                });
            self
        }
        pub fn cursor<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::std::string::String>,
        {
            self.cursor = value
                .try_into()
                .map(Some)
                .map_err(|_| {
                    "conversion to `:: std :: string :: String` for cursor failed"
                        .to_string()
                });
            self
        }
        pub fn order<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::SortOrder>,
        {
            self.order = value
                .try_into()
                .map(Some)
                .map_err(|_| "conversion to `SortOrder` for order failed".to_string());
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}/events`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::PaginatedEventResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, issue_id, cursor, order } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let issue_id = issue_id.map_err(Error::InvalidRequest)?;
            let cursor = cursor.map_err(Error::InvalidRequest)?;
            let order = order.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues/{}/events", client.baseurl, encode_path(&
                project_id.to_string()), encode_path(& issue_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .query(&progenitor_client::QueryParam::new("cursor", &cursor))
                .query(&progenitor_client::QueryParam::new("order", &order))
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_events",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_event`]

[`Client::get_event`]: super::Client::get_event*/
    #[derive(Debug, Clone)]
    pub struct GetEvent<'a> {
        client: &'a super::Client,
        project_id: Result<i32, String>,
        issue_id: Result<::uuid::Uuid, String>,
        event_id: Result<::uuid::Uuid, String>,
    }
    impl<'a> GetEvent<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                project_id: Err("project_id was not initialized".to_string()),
                issue_id: Err("issue_id was not initialized".to_string()),
                event_id: Err("event_id was not initialized".to_string()),
            }
        }
        pub fn project_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.project_id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for project_id failed".to_string());
            self
        }
        pub fn issue_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.issue_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for issue_id failed".to_string()
                });
            self
        }
        pub fn event_id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<::uuid::Uuid>,
        {
            self.event_id = value
                .try_into()
                .map_err(|_| {
                    "conversion to `:: uuid :: Uuid` for event_id failed".to_string()
                });
            self
        }
        ///Sends a `GET` request to `/api/projects/{project_id}/issues/{issue_id}/events/{event_id}`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::EventDetailResponse>,
            Error<types::ErrorResponse>,
        > {
            let Self { client, project_id, issue_id, event_id } = self;
            let project_id = project_id.map_err(Error::InvalidRequest)?;
            let issue_id = issue_id.map_err(Error::InvalidRequest)?;
            let event_id = event_id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/projects/{}/issues/{}/events/{}", client.baseurl, encode_path(&
                project_id.to_string()), encode_path(& issue_id.to_string()),
                encode_path(& event_id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_event",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::list_tokens`]

[`Client::list_tokens`]: super::Client::list_tokens*/
    #[derive(Debug, Clone)]
    pub struct ListTokens<'a> {
        client: &'a super::Client,
    }
    impl<'a> ListTokens<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `GET` request to `/api/tokens`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<::std::vec::Vec<types::AuthTokenResponse>>,
            Error<()>,
        > {
            let Self { client } = self;
            let url = format!("{}/api/tokens", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "list_tokens",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::create_token`]

[`Client::create_token`]: super::Client::create_token*/
    #[derive(Debug, Clone)]
    pub struct CreateToken<'a> {
        client: &'a super::Client,
        body: Result<types::builder::CreateAuthToken, String>,
    }
    impl<'a> CreateToken<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::CreateAuthToken>,
            <V as std::convert::TryInto<
                types::CreateAuthToken,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `CreateAuthToken` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::CreateAuthToken,
            ) -> types::builder::CreateAuthToken,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/api/tokens`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::AuthTokenCreatedResponse>, Error<()>> {
            let Self { client, body } = self;
            let body = body
                .and_then(|v| {
                    types::CreateAuthToken::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!("{}/api/tokens", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "create_token",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                201u16 => ResponseValue::from_response(response).await,
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::delete_token`]

[`Client::delete_token`]: super::Client::delete_token*/
    #[derive(Debug, Clone)]
    pub struct DeleteToken<'a> {
        client: &'a super::Client,
        id: Result<i32, String>,
    }
    impl<'a> DeleteToken<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                id: Err("id was not initialized".to_string()),
            }
        }
        pub fn id<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<i32>,
        {
            self.id = value
                .try_into()
                .map_err(|_| "conversion to `i32` for id failed".to_string());
            self
        }
        ///Sends a `DELETE` request to `/api/tokens/{id}`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<()>, Error<types::ErrorResponse>> {
            let Self { client, id } = self;
            let id = id.map_err(Error::InvalidRequest)?;
            let url = format!(
                "{}/api/tokens/{}", client.baseurl, encode_path(& id.to_string()),
            );
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .delete(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "delete_token",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                404u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::login`]

[`Client::login`]: super::Client::login*/
    #[derive(Debug, Clone)]
    pub struct Login<'a> {
        client: &'a super::Client,
        body: Result<types::builder::LoginRequest, String>,
    }
    impl<'a> Login<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::LoginRequest>,
            <V as std::convert::TryInto<types::LoginRequest>>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `LoginRequest` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::LoginRequest,
            ) -> types::builder::LoginRequest,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/auth/login`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::AuthResponse>, Error<types::ErrorResponse>> {
            let Self { client, body } = self;
            let body = body
                .and_then(|v| {
                    types::LoginRequest::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!("{}/auth/login", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "login",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                401u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::logout`]

[`Client::logout`]: super::Client::logout*/
    #[derive(Debug, Clone)]
    pub struct Logout<'a> {
        client: &'a super::Client,
    }
    impl<'a> Logout<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `POST` request to `/auth/logout`
        pub async fn send(self) -> Result<ResponseValue<()>, Error<()>> {
            let Self { client } = self;
            let url = format!("{}/auth/logout", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client.client.post(url).headers(header_map).build()?;
            let info = OperationInfo {
                operation_id: "logout",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                204u16 => Ok(ResponseValue::empty(response)),
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::get_current_user`]

[`Client::get_current_user`]: super::Client::get_current_user*/
    #[derive(Debug, Clone)]
    pub struct GetCurrentUser<'a> {
        client: &'a super::Client,
    }
    impl<'a> GetCurrentUser<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `GET` request to `/auth/me`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::UserResponse>, Error<types::ErrorResponse>> {
            let Self { client } = self;
            let url = format!("{}/auth/me", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "get_current_user",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                401u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::register`]

[`Client::register`]: super::Client::register*/
    #[derive(Debug, Clone)]
    pub struct Register<'a> {
        client: &'a super::Client,
        body: Result<types::builder::CreateUserRequest, String>,
    }
    impl<'a> Register<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self {
                client: client,
                body: Ok(::std::default::Default::default()),
            }
        }
        pub fn body<V>(mut self, value: V) -> Self
        where
            V: std::convert::TryInto<types::CreateUserRequest>,
            <V as std::convert::TryInto<
                types::CreateUserRequest,
            >>::Error: std::fmt::Display,
        {
            self.body = value
                .try_into()
                .map(From::from)
                .map_err(|s| {
                    format!("conversion to `CreateUserRequest` for body failed: {}", s)
                });
            self
        }
        pub fn body_map<F>(mut self, f: F) -> Self
        where
            F: std::ops::FnOnce(
                types::builder::CreateUserRequest,
            ) -> types::builder::CreateUserRequest,
        {
            self.body = self.body.map(f);
            self
        }
        ///Sends a `POST` request to `/auth/register`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::AuthResponse>, Error<types::ErrorResponse>> {
            let Self { client, body } = self;
            let body = body
                .and_then(|v| {
                    types::CreateUserRequest::try_from(v).map_err(|e| e.to_string())
                })
                .map_err(Error::InvalidRequest)?;
            let url = format!("{}/auth/register", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .post(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .json(&body)
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "register",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                201u16 => ResponseValue::from_response(response).await,
                400u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::liveness`]

[`Client::liveness`]: super::Client::liveness*/
    #[derive(Debug, Clone)]
    pub struct Liveness<'a> {
        client: &'a super::Client,
    }
    impl<'a> Liveness<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `GET` request to `/health`
        pub async fn send(
            self,
        ) -> Result<ResponseValue<types::LivenessResponse>, Error<()>> {
            let Self { client } = self;
            let url = format!("{}/health", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "liveness",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
    /**Builder for [`Client::readiness`]

[`Client::readiness`]: super::Client::readiness*/
    #[derive(Debug, Clone)]
    pub struct Readiness<'a> {
        client: &'a super::Client,
    }
    impl<'a> Readiness<'a> {
        pub fn new(client: &'a super::Client) -> Self {
            Self { client: client }
        }
        ///Sends a `GET` request to `/health/ready`
        pub async fn send(
            self,
        ) -> Result<
            ResponseValue<types::ReadinessResponse>,
            Error<types::ReadinessResponse>,
        > {
            let Self { client } = self;
            let url = format!("{}/health/ready", client.baseurl,);
            let mut header_map = ::reqwest::header::HeaderMap::with_capacity(1usize);
            header_map
                .append(
                    ::reqwest::header::HeaderName::from_static("api-version"),
                    ::reqwest::header::HeaderValue::from_static(
                        super::Client::api_version(),
                    ),
                );
            #[allow(unused_mut)]
            let mut request = client
                .client
                .get(url)
                .header(
                    ::reqwest::header::ACCEPT,
                    ::reqwest::header::HeaderValue::from_static("application/json"),
                )
                .headers(header_map)
                .build()?;
            let info = OperationInfo {
                operation_id: "readiness",
            };
            client.pre(&mut request, &info).await?;
            let result = client.exec(request, &info).await;
            client.post(&result, &info).await?;
            let response = result?;
            match response.status().as_u16() {
                200u16 => ResponseValue::from_response(response).await,
                503u16 => {
                    Err(
                        Error::ErrorResponse(
                            ResponseValue::from_response(response).await?,
                        ),
                    )
                }
                _ => Err(Error::UnexpectedResponse(response)),
            }
        }
    }
}
/// Items consumers will typically use such as the Client.
pub mod prelude {
    pub use self::super::Client;
}
