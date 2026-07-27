import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const kbdVariants = cva(
  'inline-flex h-5 w-fit min-w-5 shrink-0 select-none items-center justify-center gap-1 rounded-sm border border-transparent px-1.5 font-sans text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        outline: 'border-border bg-background text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Kbd({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>) {
  return useRender({
    defaultTagName: 'kbd',
    props: mergeProps<'kbd'>(
      {
        className: cn(kbdVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'kbd',
      variant,
    },
  });
}

function KbdGroup({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup, kbdVariants };
