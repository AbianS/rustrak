import { describe, expect, it } from 'vitest';
import { templatePlaceholder, webhookPresets } from './webhook-presets';

/**
 * These templates render on the server, so the assertions here are about what
 * the dashboard promises: that picking a preset also selects the response
 * envelope that platform speaks, and that the copy never leaks a rendering
 * artefact. `custom_webhook.rs` holds the mirrored render tests.
 */
describe('webhookPresets', () => {
  it('pairs every preset with the response check its platform speaks', () => {
    expect(webhookPresets.map((p) => [p.id, p.responseCheck])).toEqual([
      ['wecom_text', 'wecom'],
      ['wecom_markdown', 'wecom'],
      ['dingtalk_text', 'dingtalk'],
      ['feishu_text', 'feishu'],
    ]);
  });

  it('gives an absent issue level a readable word', () => {
    // issue.level is optional; interpolated bare the bot message reads
    // "Level: None", which is the template engine talking, not the product.
    const markdown = webhookPresets.find((p) => p.id === 'wecom_markdown');
    expect(markdown?.template).toContain('issue.level or "unknown"');
  });

  it('sends every dynamic string through tojson', () => {
    // A title carrying a quote breaks the surrounding JSON otherwise.
    for (const preset of webhookPresets) {
      expect(preset.template).toContain('| tojson');
    }
    expect(templatePlaceholder).toContain('| tojson');
  });
});
