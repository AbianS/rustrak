import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/button';
import { ExportIcon } from '../icon/icon-catalog';
import { ToastProvider, type ToastTone, useToast } from './toast';

const meta = {
  title: 'Components/Toast',
  component: ToastProvider,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES: Array<[ToastTone, string, string]> = [
  ['success', 'Issue resolved', 'RUSTRAK-1042 marked as resolved'],
  ['info', 'View saved', 'Unresolved fatals, shared with the team'],
  ['warning', 'Quota at 90 %', 'Events will be dropped past the limit'],
  ['danger', 'Alert delivery failed', 'Webhook answered 503 three times'],
  ['neutral', 'Issue deleted', 'RUSTRAK-1042 and its 4,086 events'],
];

/** Every tone, raised by hand: lifetimes and discs side by side. */
export const Tones: Story = {
  render: function TonesStory() {
    const toast = useToast();
    return (
      <div className="flex flex-wrap gap-2">
        {TONES.map(([tone, title, description]) => (
          <Button
            key={tone}
            variant="secondary"
            onClick={() => toast.show({ tone, title, description })}
          >
            {tone}
          </Button>
        ))}
      </div>
    );
  },
};

/**
 * The undo notice: eight seconds of regret, with the action that spends
 * them. Running the action closes the notice -- it resolved it.
 */
export const UndoAction: Story = {
  render: function UndoStory() {
    const toast = useToast();
    const [restored, setRestored] = useState(false);

    return (
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={() =>
            toast.show({
              tone: 'neutral',
              title: 'Issue deleted',
              description: 'RUSTRAK-1042 and its events',
              action: { label: 'Undo', onClick: () => setRestored(true) },
            })
          }
        >
          Delete issue
        </Button>
        {restored ? <span data-testid="restored">restored</span> : null}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Delete issue' }));
    const undo = await body.findByRole('button', { name: 'Undo' });

    await userEvent.click(undo);
    await expect(canvas.getByTestId('restored')).toBeInTheDocument();
    // The action resolves the notice: it leaves with it.
    await waitFor(() =>
      expect(body.queryByText('Issue deleted')).not.toBeInTheDocument(),
    );
  },
};

/** A danger notice stays: what demands action cannot leave on its own. */
export const DangerStays: Story = {
  render: function DangerStory() {
    const toast = useToast();
    return (
      <Button
        variant="secondary"
        onClick={() =>
          toast.show({
            tone: 'danger',
            title: 'Alert delivery failed',
            description: 'Webhook answered 503 three times',
            action: { label: 'Retry', strong: true, onClick: () => {} },
            altAction: { label: 'Dismiss', onClick: () => {} },
          })
        }
      >
        Fail a delivery
      </Button>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Fail a delivery' }),
    );
    await body.findByText('Alert delivery failed');

    // Dismissing by hand is what removes it.
    await userEvent.click(body.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(body.queryByText('Alert delivery failed')).not.toBeInTheDocument(),
    );
  },
};

/**
 * An in-progress notice: it carries its percentage and does not leave until
 * whoever raised it says it is done. `update` with the same id is the whole
 * protocol.
 */
export const Progress: Story = {
  render: function ProgressStory() {
    const toast = useToast();
    const idRef = useRef<string | null>(null);
    const valueRef = useRef(0);

    const start = () => {
      valueRef.current = 0;
      idRef.current = toast.show({
        tone: 'info',
        icon: ExportIcon,
        title: 'Exporting events…',
        progress: 0,
      });
    };

    const advance = () => {
      if (!idRef.current) return;
      valueRef.current = Math.min(valueRef.current + 40, 100);
      if (valueRef.current < 100) {
        toast.update(idRef.current, {
          tone: 'info',
          icon: ExportIcon,
          title: 'Exporting events…',
          progress: valueRef.current,
        });
      } else {
        toast.update(idRef.current, {
          tone: 'success',
          title: 'Export finished',
          description: '12,403 events in events.ndjson',
        });
      }
    };

    return (
      <div className="flex gap-2">
        <Button variant="secondary" onClick={start}>
          Start export
        </Button>
        <Button variant="ghost" onClick={advance}>
          Advance
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(canvas.getByRole('button', { name: 'Start export' }));
    const bar = await body.findByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '0');

    const advance = canvas.getByRole('button', { name: 'Advance' });
    await userEvent.click(advance);
    await waitFor(() =>
      expect(body.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '40',
      ),
    );

    // Two more steps finish it: the same notice becomes the confirmation.
    await userEvent.click(advance);
    await userEvent.click(advance);
    await body.findByText('Export finished');
  },
};

/** One notice that follows a promise: spinner, then the outcome, in place. */
export const FollowsAPromise: Story = {
  render: function PromiseStory() {
    const toast = useToast();
    const resolveRef = useRef<(() => void) | null>(null);

    return (
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const pending = new Promise<void>((resolve) => {
              resolveRef.current = resolve;
            });
            void toast.promise(pending, {
              loading: 'Muting 12 issues…',
              success: '12 issues muted',
              error: 'Muting failed',
            });
          }}
        >
          Mute selection
        </Button>
        <Button variant="ghost" onClick={() => resolveRef.current?.()}>
          Settle
        </Button>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);

    await userEvent.click(
      canvas.getByRole('button', { name: 'Mute selection' }),
    );
    await body.findByText('Muting 12 issues…');

    await userEvent.click(canvas.getByRole('button', { name: 'Settle' }));
    await body.findByText('12 issues muted');
  },
};
