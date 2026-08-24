import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Field, FieldError, FieldHint, FieldLabel } from '../field/field';
import { CloseIcon, SearchIcon } from '../icon/icon-catalog';
import { Input, InputAction, Textarea } from './input';

const meta = {
  title: 'Components/Input',
  component: Input,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj;

/** Every state of the box side by side, which is what reveals drift. */
export const States: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <Field>
        <FieldLabel>Project name</FieldLabel>
        <Input placeholder="checkout-api" />
        <FieldHint>Lowercase, hyphens for spaces.</FieldHint>
      </Field>

      <Field>
        <FieldLabel required>Alert name</FieldLabel>
        <Input required placeholder="Fatal errors in checkout" />
      </Field>

      <Field>
        <FieldLabel>DSN</FieldLabel>
        <Input
          readOnly
          value="https://a1b2@ingest.rustrak.dev/42"
          className="font-mono"
        />
        <FieldHint>Read-only: rotate it from project settings.</FieldHint>
      </Field>

      <Field disabled>
        <FieldLabel>Organisation</FieldLabel>
        <Input disabled value="Acme Corp" />
      </Field>

      <Field>
        <FieldLabel>Webhook URL</FieldLabel>
        <Input invalid defaultValue="not-a-url" />
        <FieldError match>Must start with https://</FieldError>
      </Field>

      <Field>
        <FieldLabel>Threshold</FieldLabel>
        <Input numeric defaultValue="500" size="sm" />
        <FieldHint>Events per minute.</FieldHint>
      </Field>

      <Field>
        <FieldLabel>Resolution note</FieldLabel>
        <Textarea
          size="sm"
          rows={4}
          placeholder="What fixed it, for the next reader…"
        />
        <FieldHint>Kept with the issue's history.</FieldHint>
      </Field>
    </div>
  ),
};

/** The box takes a leading symbol and a trailing action without breaking. */
export const Adorned: Story = {
  render: function AdornedStory() {
    const [value, setValue] = useState('timeout');

    return (
      <div className="flex w-96 flex-col gap-4">
        <Field>
          <FieldLabel>Search issues</FieldLabel>
          <Input
            leading={<SearchIcon size="md" />}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            action={
              value ? (
                <InputAction
                  icon={CloseIcon}
                  aria-label="Clear search"
                  onClick={() => setValue('')}
                />
              ) : null
            }
          />
        </Field>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Clear search' }));
    await expect(canvas.getByRole('textbox')).toHaveValue('');
  },
};

/** The label reaches the control: clicking it is clicking the field. */
export const Wired: Story = {
  render: () => (
    <div className="w-96">
      <Field>
        <FieldLabel>Alert name</FieldLabel>
        <Input placeholder="Fatal errors in checkout" />
        <FieldHint>Shown in the notification.</FieldHint>
      </Field>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Alert name' });

    await userEvent.click(canvas.getByText('Alert name'));
    await expect(input).toHaveFocus();

    // The hint is part of the field's description, not loose text.
    await expect(input).toHaveAccessibleDescription(
      'Shown in the notification.',
    );
  },
};
