export const MATRIX_SIZE = 4

export const DEFAULT_MATRIX_A = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  2, 0, 1, 3,
  4, 1, 2, 1,
]

export const DEFAULT_MATRIX_B = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]

function validateMatrix(matrix, size, name) {
  if (!Array.isArray(matrix) || matrix.length !== size * size) {
    throw new Error(`${name} must contain exactly ${size * size} values.`)
  }

  if (matrix.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${name} may only contain finite numbers.`)
  }
}

function createThreads({ size, threadState, partialSums, k = null }) {
  return Array.from({ length: size * size }, (_, threadId) => {
    const row = Math.floor(threadId / size)
    const column = threadId % size

    return {
      threadId,
      threadState,
      coordinates: { x: column, y: row, z: 0 },
      warpId: 0,
      laneId: threadId,
      registers: {
        row,
        column,
        k,
        sum: partialSums[threadId],
      },
    }
  })
}

function createFrame({
  phase,
  title,
  description,
  sourceKey,
  threadState,
  partialSums,
  size,
  k = null,
  activeMemory = { A: [], B: [], C: [] },
}) {
  return {
    phase,
    title,
    description,
    sourceKey,
    k,
    threads: createThreads({ size, threadState, partialSums, k }),
    activeMemory,
    currentC: [...partialSums],
    warp: {
      warpId: 0,
      activeLaneMask: threadState === 'idle' ? '0x00000000' : '0x0000ffff',
      laneCount: size * size,
    },
  }
}

export function multiplyMatrices(matrixA, matrixB, size = MATRIX_SIZE) {
  validateMatrix(matrixA, size, 'Matrix A')
  validateMatrix(matrixB, size, 'Matrix B')

  const result = Array(size * size).fill(0)

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      for (let k = 0; k < size; k += 1) {
        result[row * size + column] += matrixA[row * size + k] * matrixB[k * size + column]
      }
    }
  }

  return result
}

export function createMatmulSimulation({
  matrixA = DEFAULT_MATRIX_A,
  matrixB = DEFAULT_MATRIX_B,
  size = MATRIX_SIZE,
} = {}) {
  validateMatrix(matrixA, size, 'Matrix A')
  validateMatrix(matrixB, size, 'Matrix B')

  const frames = []
  const partialSums = Array(size * size).fill(0)

  frames.push(
    createFrame({
      phase: 'ready',
      title: 'Ready to launch',
      description: 'Analyze the kernel, then run or single-step the deterministic lesson trace.',
      sourceKey: null,
      threadState: 'idle',
      partialSums,
      size,
    }),
  )

  frames.push(
    createFrame({
      phase: 'index-row',
      title: 'Calculate output rows',
      description: 'Each CUDA thread derives its matrix row from blockIdx, blockDim, and threadIdx.',
      sourceKey: 'index',
      threadState: 'compute',
      partialSums,
      size,
    }),
  )

  frames.push(
    createFrame({
      phase: 'index-column',
      title: 'Calculate output columns',
      description: 'The x coordinate selects the output column owned by each thread.',
      sourceKey: 'column',
      threadState: 'compute',
      partialSums,
      size,
    }),
  )

  frames.push(
    createFrame({
      phase: 'bounds',
      title: 'Check matrix bounds',
      description: 'All 16 threads are inside this 4 × 4 lesson matrix and remain active.',
      sourceKey: 'bounds',
      threadState: 'compute',
      partialSums,
      size,
    }),
  )

  for (let k = 0; k < size; k += 1) {
    const activeA = []
    const activeB = []

    for (let index = 0; index < size; index += 1) {
      activeA.push(index * size + k)
      activeB.push(k * size + index)
    }

    frames.push(
      createFrame({
        phase: 'read',
        title: `Read operands · k = ${k}`,
        description: 'Threads read one A element and one B element from global memory.',
        sourceKey: 'read',
        threadState: 'read',
        partialSums,
        size,
        k,
        activeMemory: { A: activeA, B: activeB, C: [] },
      }),
    )

    for (let threadId = 0; threadId < size * size; threadId += 1) {
      const row = Math.floor(threadId / size)
      const column = threadId % size
      partialSums[threadId] += matrixA[row * size + k] * matrixB[k * size + column]
    }

    frames.push(
      createFrame({
        phase: 'compute',
        title: `Accumulate products · k = ${k}`,
        description: 'Each thread multiplies its operands and accumulates the result in a register.',
        sourceKey: 'compute',
        threadState: 'compute',
        partialSums,
        size,
        k,
      }),
    )
  }

  const outputIndices = Array.from({ length: size * size }, (_, index) => index)

  frames.push(
    createFrame({
      phase: 'write',
      title: 'Write matrix C',
      description: 'Every thread stores its completed accumulator into global memory.',
      sourceKey: 'write',
      threadState: 'write',
      partialSums,
      size,
      activeMemory: { A: [], B: [], C: outputIndices },
    }),
  )

  frames.push(
    createFrame({
      phase: 'complete',
      title: 'Kernel complete',
      description: 'The simulated warp has finished and matrix C is available to the host.',
      sourceKey: null,
      threadState: 'complete',
      partialSums,
      size,
    }),
  )

  return {
    engine: 'deterministic-matmul-model-v1',
    size,
    block: { x: size, y: size, z: 1 },
    grid: { x: 1, y: 1, z: 1 },
    matrices: {
      A: [...matrixA],
      B: [...matrixB],
      C: [...partialSums],
    },
    frames,
  }
}
