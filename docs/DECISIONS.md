# Architecture decisions

## ADR-001: Browser-first deterministic CUDA lessons

### Context

The project teaches beginner CUDA programmers how source code maps to blocks, warps, threads, registers, and memory. Real GPU execution is not required for the core learning experience, and arbitrary native-code execution would introduce cost and a significant security boundary.

### Decision

Build a deterministic browser simulator around versioned, explicitly supported CUDA lesson subsets. The first subset recognizes a self-contained naïve `matmul` kernel with the controlled arguments `A`, `B`, `C`, and `N`.

Browser analysis and deterministic simulation are separate modules:

```text
Editable CUDA source
        ↓
Browser lesson analyzer
        ↓ recognized structure
Deterministic simulation frames
        ↓
React trace player and inspectors
```

The UI always labels the trace as simulated and the current diagnostics as educational static analysis. It must never imply that NVCC or NVIDIA hardware produced these results.

### Alternatives considered

- Remote arbitrary CUDA execution was rejected as the default because the education goal does not require it and public native-code execution needs strong isolation, quotas, authentication, and paid GPU capacity.
- A purely static animation was rejected because edits, diagnostics, playback controls, and synchronized state are central product requirements.
- A general CUDA interpreter was deferred because C++ and CUDA semantics are too broad for the first useful vertical slice.

### Consequences

- Playback is deterministic and inexpensive enough for a public open-source website.
- Source remains private to the browser and is not persisted.
- The analyzer can catch common lesson-specific mistakes but cannot promise authoritative CUDA compilation.
- Code outside the recognized subset can be analyzed structurally but cannot be visualized.
- A future optional compile-only NVRTC service may add authoritative compiler diagnostics without changing the simulator contract.

### Revisit when

- Multiple lesson kernels require a shared syntax tree or interpreter.
- Users need authoritative NVRTC/NVCC diagnostics.
- A sustainable free or sponsored GPU sandbox is available for an optional hardware-profile mode.
