export const VECTOR_ADD_SOURCE = `__global__ void vectorAdd(
    const float* A,
    const float* B,
    float* C,
    int N)
{
    int index = blockIdx.x * blockDim.x + threadIdx.x;

    if (index < N) {
        C[index] = A[index] + B[index];
    }
}`

const INPUT_A = [1, 2, 3, 4, 5, 6, 7, 8]
const INPUT_B = [8, 7, 6, 5, 4, 3, 2, 1]

function findLine(lines, pattern) {
  const index = lines.findIndex((line) => pattern.test(line))
  return index === -1 ? null : index + 1
}

function diagnostic(code, message, suggestion) {
  return { code, severity: 'error', message, line: 1, column: 1, suggestion }
}

export function analyzeVectorAddSource(source) {
  const lines = source.split('\n')
  const diagnostics = []

  if (!/__global__\s+void\s+vectorAdd\s*\(/.test(source)) {
    diagnostics.push(diagnostic(
      'VEC001',
      "This lesson requires an '__global__ void vectorAdd(...)' kernel.",
      'Restore the sample entry point so the lesson runtime can identify the kernel.',
    ))
  }

  if (!/\bblockIdx\.x\b/.test(source) || !/\bblockDim\.x\b/.test(source) || !/\bthreadIdx\.x\b/.test(source)) {
    diagnostics.push(diagnostic(
      'VEC002',
      'No one-dimensional CUDA thread index was recognized.',
      'Compute index from blockIdx.x, blockDim.x, and threadIdx.x.',
    ))
  }

  if (!/\bC\s*\[[^\]]+\]\s*=\s*A\s*\[[^\]]+\]\s*\+\s*B\s*\[[^\]]+\]\s*;/.test(source)) {
    diagnostics.push(diagnostic(
      'VEC003',
      'No supported element-wise vector addition was recognized.',
      'Assign C[index] = A[index] + B[index].',
    ))
  }

  if (!/\bif\s*\([^)]*index\s*<\s*N/.test(source)) {
    diagnostics.push({
      code: 'VEC101',
      severity: 'warning',
      message: 'No index bounds guard was recognized.',
      line: 1,
      column: 1,
      suggestion: 'Guard index < N before reading or writing a vector element.',
    })
  }

  const hasErrors = diagnostics.some((item) => item.severity === 'error')

  return {
    engine: 'vector-add-lesson-analyzer',
    diagnostics,
    hasErrors,
    canSimulate: !hasErrors,
    lineMap: {
      index: findLine(lines, /\bint\s+index\b/),
      bounds: findLine(lines, /\bif\s*\(/),
      compute: findLine(lines, /\bC\s*\[.*\]\s*=/),
      write: findLine(lines, /\bC\s*\[.*\]\s*=/),
    },
  }
}

function createThreads(state, output = []) {
  return INPUT_A.map((value, index) => ({
    threadId: index,
    index,
    state,
    a: value,
    b: INPUT_B[index],
    result: output[index] ?? null,
  }))
}

export function createVectorAddRecording(output) {
  return {
    engine: 'deterministic-vector-add-v1',
    frames: [
      {
        phase: 'launch',
        title: 'Launch one thread per element',
        description: 'Eight logical threads are assigned to eight output positions.',
        sourceKey: 'index',
        threads: createThreads('idle'),
      },
      {
        phase: 'read',
        title: 'Read A[index] and B[index]',
        description: 'Adjacent threads read adjacent addresses, forming coalesced accesses.',
        sourceKey: 'bounds',
        threads: createThreads('read'),
      },
      {
        phase: 'compute',
        title: 'Add operands in parallel',
        description: 'Each thread performs the same addition instruction on different data.',
        sourceKey: 'compute',
        threads: createThreads('compute', output),
      },
      {
        phase: 'write',
        title: 'Write each result to C',
        description: 'Every active thread writes its result to its own output element.',
        sourceKey: 'write',
        threads: createThreads('write', output),
      },
      {
        phase: 'complete',
        title: 'Kernel complete',
        description: 'The computed vector matches the CPU reference result.',
        sourceKey: null,
        threads: createThreads('complete', output),
      },
    ],
  }
}

export const vectorAddLesson = {
  id: 'vector-add.basic',
  title: 'Vector Addition',
  shortTitle: 'Vector Add',
  description: 'One-dimensional indexing, coalesced reads, arithmetic, and global-memory writes.',
  filename: 'vector_add.cu',
  source: VECTOR_ADD_SOURCE,
  inputs: { a: INPUT_A, b: INPUT_B },
  analyze: analyzeVectorAddSource,
  createRecording: createVectorAddRecording,
}
