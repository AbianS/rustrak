/**
 * The five parts of the machine, as data.
 *
 * A table rather than a section of `engine-scene.tsx` because `Engine` reads it
 * too, and a module that exports both a component and a table cannot keep its
 * state across a Fast Refresh.
 */
import { DECK, type Point } from './iso';
import {
  AdmissionForm,
  DecoderForm,
  FoldForm,
  SpoolForm,
  WorkersForm,
} from './parts';

/**
 * `anchor` is where the leader line leaves the part. It is authored per part
 * rather than derived from a bounding box because the point that reads as "this
 * one" is a specific corner of a specific feature — the top of the tallest fin,
 * the outer end of the card — and a bounding box would pick the arithmetic
 * centre of a shape that may be mostly empty air.
 *
 * `depth` is `x + z` at the part's centre, which is exactly how far from the eye
 * it is in this projection, and it is what the draw order is sorted on.
 */
export const PARTS = [
  {
    key: 'admission',
    label: 'Admission control',
    note: 'quota · 429',
    Form: AdmissionForm,
    anchor: [-1.35, DECK + 0.53, -0.04] as Point,
    depth: -1.7,
  },
  {
    key: 'decoder',
    label: 'Envelope decoder',
    note: 'gzip · 8 item kinds',
    Form: DecoderForm,
    anchor: [1.14, DECK + 0.58, -0.16] as Point,
    depth: 0.18,
  },
  {
    key: 'spool',
    label: 'Durable spool',
    note: 'disk · 200 OK',
    Form: SpoolForm,
    anchor: [1.62, DECK + 0.4, -0.97] as Point,
    depth: -0.23,
  },
  {
    key: 'workers',
    label: 'Digest workers',
    note: 'tokio · in-process',
    Form: WorkersForm,
    anchor: [0.11, DECK + 0.67, 0.05] as Point,
    depth: -0.2,
  },
  {
    key: 'fold',
    label: 'Fingerprint',
    note: 'sha-256 · one row',
    Form: FoldForm,
    anchor: [0.35, DECK + 0.69, 1.24] as Point,
    depth: 0.65,
  },
] as const;
