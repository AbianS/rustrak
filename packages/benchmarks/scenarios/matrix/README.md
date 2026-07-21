# Matrix scenarios

Scenario definitions used by `scripts/run-matrix.sh` when comparing PostgreSQL
major versions.

These are deliberately **separate from** the canonical scenarios in
`scenarios/`. Those exist to characterise Rustrak in absolute terms and their
parameters should stay stable so results remain comparable over time. The ones
here are tuned for a different job: running a 30-cell matrix in a sitting, on
one machine, with enough repeats that the noise floor can be estimated.

Two choices apply to every file here and are worth stating once:

**Every scenario sets `distinct_groups`.** Without it the generator puts a
unique counter in each exception message, so the grouping algorithm gives every
single event its own issue. That is not what an error tracker does under real
traffic, and it changes the database workload fundamentally: one issue per event
is an INSERT-only workload on `issues`, whereas realistic traffic is dominated
by UPDATEs to existing issue rows. Comparing engines on the unrealistic shape
would answer a question nobody has.

**Durations are shorter than the canonical scenarios.** The matrix runs each
cell three times against two engines, and every run starts from a freshly
initialised database. Full-length scenarios would put the matrix well beyond a
day. Shorter runs cost precision, which is exactly why the aggregation reports
the spread across repeats and refuses to call anything smaller than that spread
a result.
