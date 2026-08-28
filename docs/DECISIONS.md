# Architecture decisions

## ADR-001: Browser-first deterministic CUDA lessons

Status: Superseded in part by ADR-003 for multi-lesson composition.

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

## ADR-002: Semantic zoom for GPU architecture

### Context

Displaying matrices, SMs, blocks, warps, threads, registers, and memory simultaneously creates excessive cognitive load for beginners. Visual scale alone does not explain the architectural boundaries between those concepts.

### Decision

Use five discrete semantic levels:

```text
Algorithm → GPU → Block → Warp → Thread
```

Changing levels changes the information model, not merely the drawing scale. Simulation time remains controlled separately by Run, Pause, Step, and Reset. Block and thread selection persist while the learner changes levels.

The first multi-SM lesson uses an 8 × 8 output, four 4 × 4 blocks, and three virtual SMs. Three blocks fill the first wave; the fourth block creates a second wave with two idle SMs, exposing the tail effect with minimal visual density.

### Consequences

- Beginners can start with matrix tiles and reveal hardware detail deliberately.
- Each level answers one primary question and has its own contextual memory explanation.
- The three-SM assignment is deterministic teaching data, not a prediction of real CUDA scheduling.
- A 16-thread block occupies lanes 0–15 of one 32-lane warp; lanes 16–31 are shown inactive.
- The virtual device currently models one resident block per SM to keep scheduling waves legible.

### Revisit when

- Lessons introduce multiple resident blocks, occupancy limits, or concurrent kernels.
- User testing shows that five levels are too coarse or too detailed.
- A hardware trace mode can supply measured SM assignments without compromising the deterministic lesson mode.

## ADR-003: Data-driven lesson plugins and independent validation

### Context

The curriculum now includes vector operations, managed memory, coalescing, blocked matrix multiplication, reductions, parallel bitonic sorting, convolutions, and cuBLAS calls. Creating a React screen and execution branch for every algorithm would duplicate playback, diagnostics, memory rendering, and fallback behavior.

Browser APIs also cannot expose CUDA Unified Memory faults, real cuBLAS kernels, NVIDIA cache transactions, or physical SM scheduling. Numerical correctness and architectural explanation therefore require different evidence.

### Decision

Represent every new curriculum item as a lesson plugin with one shared contract:

```text
Lesson definition
    ├── metadata and sample source
    ├── lesson-aware analyzer
    ├── fixed beginner-sized compute request
    ├── topology and memory-space descriptions
    └── deterministic teaching stages
            ↓
Generic lesson runtime
    ├── CPU reference adapter
    ├── optional compatible WebGPU adapter
    └── versioned recording frames
            ↓
Generic React experience and canvas
```

The CPU reference determines the expected mathematical result. WebGPU is an optional independent validator only for operations with a compatible adapter. It never supplies the teaching trace. The original naïve-matmul semantic-zoom experience remains specialized until its richer GPU/block/warp/thread data can be represented without losing information.

### Alternatives considered

- One React component per algorithm was rejected because playback and memory UI would drift across duplicated implementations.
- One universal CUDA interpreter was deferred because safely and accurately interpreting CUDA C++ is outside the current browser-only scope.
- Presenting WebGPU execution as CUDA was rejected because WGSL execution cannot expose NVIDIA-specific scheduling or memory behavior.
- Omitting cuBLAS and Unified Memory was rejected because their programming models are valuable even when their native implementations cannot run in the browser.

### Consequences

- New lessons share selection, analysis, playback, validation, and memory rendering.
- Lesson plugins remain explicit and inspectable; adding an algorithm requires data and trace semantics rather than a new application shell.
- Small fixed inputs make traces readable and reference tests deterministic.
- CPU validation proves mathematics but not CUDA performance or synchronization correctness on hardware.
- Managed-memory movement, cache behavior, and library internals must remain visibly labelled conceptual models.

### Revisit when

- Tree-sitter or another parser replaces lesson-pattern analysis.
- WebGPU adapters are added for matrix multiplication, reduction, or convolution.
- A secure optional NVRTC/cuBLAS service can return authoritative diagnostics or hardware results.
- The specialized naïve-matmul trace can migrate to the shared recording schema without losing semantic zoom.
