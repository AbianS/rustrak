/**
 * Base UI accepts `className` as a function of the component's state. This
 * package does not need that: state already travels in `data-*` attributes and
 * the `tv` recipes read it with variants. Narrowing the type to `string` keeps
 * one way of doing one thing, and lets `tv` resolve Tailwind conflicts -- which
 * it could not do with a function.
 */
export type WithClassName<Props> = Omit<Props, 'className'> & {
  className?: string;
};
