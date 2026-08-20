import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMatmulSimulation,
  DEFAULT_MATRIX_A,
  DEFAULT_MATRIX_B,
  multiplyMatrices,
} from '../src/lib/matmulSimulation.js'

test('multiplies the 8 × 8 matrix A by the identity matrix', () => {
  const result = multiplyMatrices(DEFAULT_MATRIX_A, DEFAULT_MATRIX_B)

  assert.deepEqual(result, DEFAULT_MATRIX_A)
})

test('creates the deterministic frame sequence for one 4 × 4 output block', () => {
  const simulation = createMatmulSimulation()

  assert.equal(simulation.frames.length, 22)
  assert.equal(simulation.frames[0].phase, 'ready')
  assert.equal(simulation.frames.at(-2).phase, 'write')
  assert.equal(simulation.frames.at(-1).phase, 'complete')
  assert.deepEqual(simulation.matrices.C, DEFAULT_MATRIX_A)
})

test('records global-memory indices for block zero’s first read', () => {
  const simulation = createMatmulSimulation()
  const firstRead = simulation.frames.find((frame) => frame.phase === 'read')

  assert.deepEqual(firstRead.activeMemory.A, [0, 8, 16, 24])
  assert.deepEqual(firstRead.activeMemory.B, [0, 1, 2, 3])
})

test('offsets thread coordinates and memory indices for another output block', () => {
  const simulation = createMatmulSimulation({ block: { x: 1, y: 1 } })
  const firstRead = simulation.frames.find((frame) => frame.phase === 'read')

  assert.deepEqual(simulation.frames[1].threads[0].registers, {
    row: 4,
    column: 4,
    k: null,
    sum: 0,
  })
  assert.deepEqual(firstRead.activeMemory.A, [32, 40, 48, 56])
  assert.deepEqual(firstRead.activeMemory.B, [4, 5, 6, 7])
})

test('maps the 16 block threads to one partially occupied hardware warp', () => {
  const simulation = createMatmulSimulation()
  const activeFrame = simulation.frames[1]

  assert.equal(activeFrame.threads.length, 16)
  assert.equal(activeFrame.threads.at(-1).laneId, 15)
  assert.equal(activeFrame.warp.activeLaneMask, '0x0000ffff')
})

test('rejects matrices with the wrong shape', () => {
  assert.throws(
    () => createMatmulSimulation({ matrixA: [1, 2], matrixB: DEFAULT_MATRIX_B }),
    /Matrix A must contain exactly 64 values/,
  )
})
