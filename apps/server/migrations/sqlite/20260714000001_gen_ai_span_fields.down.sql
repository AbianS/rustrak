DROP INDEX IF EXISTS idx_spans_project_gen_ai_tool;
DROP INDEX IF EXISTS idx_spans_project_gen_ai_model;
DROP INDEX IF EXISTS idx_spans_project_gen_ai_op_type;

ALTER TABLE spans DROP COLUMN gen_ai_usage_total_tokens;
ALTER TABLE spans DROP COLUMN gen_ai_usage_output_tokens;
ALTER TABLE spans DROP COLUMN gen_ai_usage_input_tokens;

ALTER TABLE spans DROP COLUMN gen_ai_conversation_id;
ALTER TABLE spans DROP COLUMN gen_ai_tool_name;
ALTER TABLE spans DROP COLUMN gen_ai_response_model;
ALTER TABLE spans DROP COLUMN gen_ai_request_model;
ALTER TABLE spans DROP COLUMN gen_ai_agent_name;
ALTER TABLE spans DROP COLUMN gen_ai_operation_type;
