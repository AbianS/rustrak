import { describe, expect, it } from 'vitest';
import { TEMPLATE_VARIABLES, templatePlaceholder } from './message-template';

describe('TEMPLATE_VARIABLES', () => {
  it('quotes every variable through tojson so a chip cannot break the JSON', () => {
    // The whole point of offering them as chips: the reader never has to
    // learn that a title with a quote in it needs escaping.
    for (const variable of TEMPLATE_VARIABLES) {
      expect(variable.snippet).toBe(`{{ ${variable.path} | tojson }}`);
    }
  });

  it('shows the same discipline in the placeholder', () => {
    expect(templatePlaceholder).toContain('| tojson');
  });
});
