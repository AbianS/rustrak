-- gen_ai.* span attributes (SQLite) — story-ai-agent-monitoring.md, GH #180.
-- Plain nullable ADD COLUMN, no constraint changes — no table recreate needed.
ALTER TABLE spans ADD COLUMN gen_ai_operation_type   VARCHAR(32);
ALTER TABLE spans ADD COLUMN gen_ai_agent_name       VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_request_model    VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_response_model   VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_tool_name        VARCHAR(255);
ALTER TABLE spans ADD COLUMN gen_ai_conversation_id  VARCHAR(255);

ALTER TABLE spans ADD COLUMN gen_ai_usage_input_tokens  REAL;
ALTER TABLE spans ADD COLUMN gen_ai_usage_output_tokens REAL;
ALTER TABLE spans ADD COLUMN gen_ai_usage_total_tokens  REAL;

CREATE INDEX idx_spans_project_gen_ai_op_type ON spans(project_id, gen_ai_operation_type);
CREATE INDEX idx_spans_project_gen_ai_model   ON spans(project_id, gen_ai_response_model);
CREATE INDEX idx_spans_project_gen_ai_tool    ON spans(project_id, gen_ai_tool_name);
