# Surface Refactor Follow-Up

The engine-level refactor intentionally leaves surface geometry unchanged. The current surface classes contain domain-sensitive intersection math, so the next pass should be done only after the extracted engine helpers are stable.

## Candidate Shape

- Keep each surface responsible for `incident(ray)` and its local normal calculation.
- Extract shared Snell refraction and ray continuation into a common helper.
- Preserve current trace history behavior on each `Surface`.
- Add regression tests around grazing hits, coincident ST surfaces, planar fallbacks, and total internal reflection before changing geometry code.

## Suggested Order

1. Add surface-level golden tests for `SphericalSurface`, `ToricSurface`, and `AsphericalSurface`.
2. Extract a pure `refractDirection()` helper that receives incident direction, normal, and refractive indices.
3. Replace duplicated Snell math one surface at a time.
4. Only after that, consider splitting intersection from refraction with a shared `SurfaceHit` shape.
