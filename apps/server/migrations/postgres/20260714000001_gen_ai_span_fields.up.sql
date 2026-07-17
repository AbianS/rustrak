-- gen_ai.* span attributes (story-ai-agent-monitoring.md, GH #180).
-- Denormalized columns for the fields the AI Agent Monitoring dashboard
-- filters/aggregates on. All nullable — populated only for spans recognized
-- as AI spans (see services/gen_ai.rs::is_ai_span). The full raw gen_ai.*
-- attribute set (including request/response message bodies) stays in the
-- existing `data` JSONB column verbatim.
ALTER TABLE spans ADD COLUMN gen_ai_operation_type   VARCHAR(32);
ALTER TABLE spans ADD COLUMN gen_ai_agent_name       VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_request_model    VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_response_model   VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_tool_name        VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_conversation_id  VARCHAR(255);

ALTER TABLE spans ADD COLUMN gen_ai_usage_input_tokens  DOUBLE PRECISION;
ALTER TABLE spans ADD COLUMN gen_ai_usage_output_tokens DOUBLE PRECISION;
ALTER TABLE spans ADD COLUMN gen_ai_usage_total_tokens  DOUBLE PRECISION;

CREATE INDEX idx_spans_project_gen_ai_op_type ON spans(project_id, gen_ai_operation_type);
CREATE INDEX idx_spans_project_gen_ai_model   ON spans(project_id, gen_ai_response_model);
CREATE INDEX idx_spans_project_gen_ai_tool    ON spans(project_id, gen_ai_tool_name);
