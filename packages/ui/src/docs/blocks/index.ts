/**
 * The blocks the documentation pages are written with.
 *
 * MDX gives prose, live stories and a props table. What it does not give is a
 * shape for the things a component page has to show and no table ever will:
 * the parts of the component and their names, every variant against every
 * state at once, where the thing is used in the product, and the calls that
 * have already been made about it.
 *
 * Those pages are all the same shape, so this is a set of components rather
 * than a layout pasted twenty-five times and drifting. They are built from the
 * system's own tokens, like everything else here.
 */

export { Anatomy, type AnatomyPart } from './anatomy';
export { Arrow, Flow, Step } from './flow';
export { Card, Cards, Stage } from './frame';
export {
  Do,
  DoDont,
  Dont,
  Guarantee,
  Guarantees,
  Place,
  UsedIn,
} from './guidance';
export { Matrix } from './matrix';
export { MotionDemo } from './motion';
export { Cover, DocPage, P, Rule, Section, Subsection } from './page';
export { Chip, Ramp, ScaleRow, Swatch, TypeRow } from './scales';
