import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMatmulSimulation,
  DEFAULT_MATRIX_A,
  DEFAULT_MATRIX_B,
  multiplyMatrices,
} from '../src/lib/matmulSimulation.js'

test('multiplies matrix A by the identity matrix', () => {
  const result = multiplyMatrices(DEFAULT_MATRIX_A, DEFAULT_MATRIX_B)

  assert.deepEqual(result, DEFAULT_MATRIX_A)
})

test('creates a deterministic frame sequence for the 4 × 4 lesson', () => {
  const simulation = createMatmulSimulation()

  assert.equal(simulation.frames.length, 14)
  assert.equal(simulation.frames[0].phase, 'ready')
  assert.equal(simulation.frames.at(-2).phase, 'write')
  assert.equal(simulation.frames.at(-1).phase, 'complete')
  assert.deepEqual(simulation.matrices.C, DEFAULT_MATRIX_A)
})

test('records the global-memory indices used by the first read step', () => {
  const simulation = createMatmulSimulation()
  const firstRead = simulation.frames.find((frame) => frame.phase === 'read')

  assert.deepEqual(firstRead.activeMemory.A, [0, 4, 8, 12])
  assert.deepEqual(firstRead.activeMemory.B, [0, 1, 2, 3])
})

test('maps all 16 threads to one partially occupied hardware warp', () => {
  const simulation = createMatmulSimulation()
  const activeFrame = simulation.frames[1]

  assert.equal(activeFrame.threads.length, 16)
  assert.equal(activeFrame.threads.at(-1).laneId, 15)
  assert.equal(activeFrame.warp.activeLaneMask, '0x0000ffff')
})

test('rejects matrices with the wrong shape', () => {
  assert.throws(
    () => createMatmulSimulation({ matrixA: [1, 2], matrixB: DEFAULT_MATRIX_B }),
    /Matrix A must contain exactly 16 values/,
  )
})
