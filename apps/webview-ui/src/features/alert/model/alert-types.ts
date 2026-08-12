import type { AlertType } from '@rustrak/client';

/**
 * The triggers a rule can fire on, in the order they are offered.
 *
 * Data only: the mark each one carries lives in `AlertTypeIcon`, so this table
 * stays free of React and a build that renders no icons still knows what the
 * triggers are.
 */
export const alertTypes: {
  type: AlertType;
  nameKey: string;
  descriptionKey: string;
}[] = [
  {
    type: 'new_issue',
    nameKey: 'newIssue.name',
    descriptionKey: 'newIssue.description',
  },
  {
    type: 'regression',
    nameKey: 'regression.name',
    descriptionKey: 'regression.description',
  },
  {
    type: 'unmute',
    nameKey: 'unmute.name',
    descriptionKey: 'unmute.description',
  },
];

/**
 * The row for a trigger, or a usable stand-in.
 *
 * The server may name a trigger this build has never heard of, and the caller
 * still has a row to render: the raw type as its own label beats an empty
 * cell.
 */
export function alertTypeInfo(type: string) {
  return (
    alertTypes.find((t) => t.type === type) ?? {
      type,
      nameKey: type,
    }
  );
}
