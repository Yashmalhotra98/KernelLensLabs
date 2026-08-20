export const MATRIX_SIZE = 8
export const BLOCK_SIZE = 4

export const DEFAULT_MATRIX_A = Array.from(
  { length: MATRIX_SIZE * MATRIX_SIZE },
  (_, index) => ((index * 5 + 3) % 13) - 4,
)

export const DEFAULT_MATRIX_B = Array.from(
  { length: MATRIX_SIZE * MATRIX_SIZE },
  (_, index) => (Math.floor(index / MATRIX_SIZE) === index % MATRIX_SIZE ? 1 : 0),
)

function validateMatrix(matrix, size, name) {
  if (!Array.isArray(matrix) || matrix.length !== size * size) {
    throw new Error(`${name} must contain exactly ${size * size} values.`)
  }

  if (matrix.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error(`${name} may only contain finite numbers.`)
  }
}

function validateBlock(block, gridSize) {
  const isIntegerCoordinate = Number.isInteger(block?.x) && Number.isInteger(block?.y)
  const isInsideGrid = block?.x >= 0 && block?.x < gridSize && block?.y >= 0 && block?.y < gridSize

  if (!isIntegerCoordinate || !isInsideGrid) {
    throw new Error(`Block coordinates must be inside the ${gridSize} × ${gridSize} grid.`)
  }
}

function createThreads({ block, blockSize, threadState, partialSums, k = null }) {
  return Array.from({ length: blockSize * blockSize }, (_, threadId) => {
    const localRow = Math.floor(threadId / blockSize)
    const localColumn = threadId % blockSize
    const row = block.y * blockSize + localRow
    const column = block.x * blockSize + localColumn

    return {
      threadId,
      threadState,
      coordinates: { x: localColumn, y: localRow, z: 0 },
      outputCoordinates: { row, column },
      warpId: 0,
      laneId: threadId,
      registers: { row, column, k, sum: partialSums[threadId] },
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
  block,
  blockSize,
  k = null,
  activeMemory = { A: [], B: [], C: [] },
}) {
  return {
    phase,
    title,
    description,
    sourceKey,
    k,
    threads: createThreads({ block, blockSize, threadState, partialSums, k }),
    activeMemory,
    currentTile: [...partialSums],
    warp: {
      warpId: 0,
      activeLaneMask: threadState === 'idle' ? '0x00000000' : '0x0000ffff',
      laneCount: blockSize * blockSize,
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
  blockSize = BLOCK_SIZE,
  block = { x: 0, y: 0 },
} = {}) {
  validateMatrix(matrixA, size, 'Matrix A')
  validateMatrix(matrixB, size, 'Matrix B')

  if (!Number.isInteger(blockSize) || blockSize <= 0 || size % blockSize !== 0) {
    throw new Error('Block size must be a positive integer that evenly divides the matrix size.')
  }

  const gridSize = size / blockSize
  validateBlock(block, gridSize)

  const frames = []
  const partialSums = Array(blockSize * blockSize).fill(0)

  frames.push(
    createFrame({
      phase: 'ready',
      title: 'Block assigned',
      description: `Block (${block.x}, ${block.y}) is resident and its 16 threads are ready to execute.`,
      sourceKey: null,
      threadState: 'idle',
      partialSums,
      block,
      blockSize,
    }),
  )

  frames.push(
    createFrame({
      phase: 'index-row',
      title: 'Calculate output rows',
      description: 'Each thread combines blockIdx.y and threadIdx.y to find its global output row.',
      sourceKey: 'index',
      threadState: 'compute',
      partialSums,
      block,
      blockSize,
    }),
  )

  frames.push(
    createFrame({
      phase: 'index-column',
      title: 'Calculate output columns',
      description: 'Each thread combines blockIdx.x and threadIdx.x to find its global output column.',
      sourceKey: 'column',
      threadState: 'compute',
      partialSums,
      block,
      blockSize,
    }),
  )

  frames.push(
    createFrame({
      phase: 'bounds',
      title: 'Check matrix bounds',
      description: 'Every thread in this block maps to a valid cell in the 8 × 8 output matrix.',
      sourceKey: 'bounds',
      threadState: 'compute',
      partialSums,
      block,
      blockSize,
    }),
  )

  for (let k = 0; k < size; k += 1) {
    const activeA = []
    const activeB = []

    for (let localIndex = 0; localIndex < blockSize; localIndex += 1) {
      const globalRow = block.y * blockSize + localIndex
      const globalColumn = block.x * blockSize + localIndex
      activeA.push(globalRow * size + k)
      activeB.push(k * size + globalColumn)
    }

    frames.push(
      createFrame({
        phase: 'read',
        title: `Read operands · k = ${k}`,
        description: 'The warp requests A[row, k] and B[k, column] values from global memory.',
        sourceKey: 'read',
        threadState: 'read',
        partialSums,
        block,
        blockSize,
        k,
        activeMemory: { A: activeA, B: activeB, C: [] },
      }),
    )

    for (let threadId = 0; threadId < blockSize * blockSize; threadId += 1) {
      const localRow = Math.floor(threadId / blockSize)
      const localColumn = threadId % blockSize
      const row = block.y * blockSize + localRow
      const column = block.x * blockSize + localColumn
      partialSums[threadId] += matrixA[row * size + k] * matrixB[k * size + column]
    }

    frames.push(
      createFrame({
        phase: 'compute',
        title: `Accumulate products · k = ${k}`,
        description: 'Each active lane performs one multiply-add and keeps its partial sum in a register.',
        sourceKey: 'compute',
        threadState: 'compute',
        partialSums,
        block,
        blockSize,
        k,
      }),
    )
  }

  const outputIndices = Array.from({ length: blockSize * blockSize }, (_, threadId) => {
    const localRow = Math.floor(threadId / blockSize)
    const localColumn = threadId % blockSize
    return (block.y * blockSize + localRow) * size + block.x * blockSize + localColumn
  })

  frames.push(
    createFrame({
      phase: 'write',
      title: 'Write output tile',
      description: 'The block writes its completed 4 × 4 tile into matrix C.',
      sourceKey: 'write',
      threadState: 'write',
      partialSums,
      block,
      blockSize,
      activeMemory: { A: [], B: [], C: outputIndices },
    }),
  )

  frames.push(
    createFrame({
      phase: 'complete',
      title: 'Block complete',
      description: 'The SM releases this block’s resources and can accept another pending block.',
      sourceKey: null,
      threadState: 'complete',
      partialSums,
      block,
      blockSize,
    }),
  )

  return {
    engine: 'deterministic-matmul-model-v2',
    size,
    block: { x: blockSize, y: blockSize, z: 1 },
    blockIndex: { ...block, z: 0 },
    grid: { x: gridSize, y: gridSize, z: 1 },
    matrices: {
      A: [...matrixA],
      B: [...matrixB],
      C: multiplyMatrices(matrixA, matrixB, size),
    },
    frames,
  }
}
