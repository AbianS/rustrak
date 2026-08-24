import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Text } from '../text/text';
import { Checkbox } from './checkbox';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  args: { 'aria-label': 'Select row' },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every state side by side, which is what reveals a drifted border or fill. */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-6">
      {(
        [
          ['empty', {}],
          ['checked', { defaultChecked: true }],
          ['mixed', { indeterminate: true }],
          ['disabled', { disabled: true }],
          ['disabled checked', { disabled: true, defaultChecked: true }],
        ] as const
      ).map(([label, props]) => (
        <div key={label} className="flex items-center gap-2">
          <Checkbox aria-label={label} {...props} />
          <Text variant="meta">{label}</Text>
        </div>
      ))}
    </div>
  ),
};

/**
 * The select-all header state: indeterminate reports a split page. Ticking a
 * mixed header selects everything, which is the convention every file manager
 * and mail client has taught.
 */
export const SelectAll: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: function SelectAllStory() {
    const [selected, setSelected] = useState([true, false, true]);
    const all = selected.every(Boolean);
    const some = selected.some(Boolean);

    return (
      /* Rows, not `<label>`s: a wrapping label hands its text to the hidden
         input and the `aria-label` stops being the accessible name. In the
         product the row's click target is the row, never a label. */
      <div className="flex w-56 flex-col gap-2">
        <div className="flex items-center gap-2 border-border-divider border-b pb-2">
          <Checkbox
            aria-label="Select all rows"
            checked={all}
            indeterminate={some && !all}
            onCheckedChange={(checked) =>
              setSelected(selected.map(() => checked))
            }
          />
          <Text variant="meta">Select all</Text>
        </div>
        {selected.map((checked, index) => (
          <div
            // Fixture rows have no identity beyond their position.
            key={index}
            className="flex items-center gap-2"
          >
            <Checkbox
              aria-label={`Select row ${index + 1}`}
              checked={checked}
              onCheckedChange={(next) =>
                setSelected(selected.map((v, i) => (i === index ? next : v)))
              }
            />
            <Text variant="meta">Row {index + 1}</Text>
          </div>
        ))}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByRole('checkbox', { name: 'Select all rows' });

    // A split page reports itself as mixed.
    await expect(header).toHaveAttribute('aria-checked', 'mixed');

    // Ticking a mixed header selects everything.
    await userEvent.click(header);
    await expect(header).toHaveAttribute('aria-checked', 'true');
    for (const row of canvas.getAllByRole('checkbox', { name: /Select row/ })) {
      await expect(row).toHaveAttribute('aria-checked', 'true');
    }
  },
};

/** Space toggles it from the keyboard, and the ring says where focus is. */
export const Keyboard: Story = {
  args: { 'aria-label': 'Select row' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByRole('checkbox', { name: 'Select row' });

    await userEvent.tab();
    await expect(box).toHaveFocus();

    await userEvent.keyboard(' ');
    await expect(box).toHaveAttribute('aria-checked', 'true');

    await userEvent.keyboard(' ');
    await expect(box).toHaveAttribute('aria-checked', 'false');
  },
};
