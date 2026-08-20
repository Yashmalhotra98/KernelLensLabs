import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCudaSource } from '../src/lib/cudaAnalyzer.js'
import { DEFAULT_CUDA_SOURCE } from '../src/lib/defaultCudaSource.js'

test('accepts the supported matrix-multiplication lesson', () => {
  const result = analyzeCudaSource(DEFAULT_CUDA_SOURCE)

  assert.equal(result.hasErrors, false)
  assert.equal(result.canSimulate, true)
  assert.equal(result.lineMap.read, 14)
  assert.equal(result.lineMap.write, 17)
})

test('reports an empty editor as an error', () => {
  const result = analyzeCudaSource('  ')

  assert.equal(result.hasErrors, true)
  assert.equal(result.canSimulate, false)
  assert.equal(result.diagnostics[0].code, 'CUDA001')
})

test('reports a case-sensitive CUDA built-in typo', () => {
  const source = DEFAULT_CUDA_SOURCE.replace('threadIdx.x', 'threadIDx.x')
  const result = analyzeCudaSource(source)

  assert.equal(result.hasErrors, true)
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'CUDA005'))
})

test('reports a missing semicolon with its source line', () => {
  const source = DEFAULT_CUDA_SOURCE.replace('float sum = 0.0f;', 'float sum = 0.0f')
  const result = analyzeCudaSource(source)
  const diagnostic = result.diagnostics.find((item) => item.code === 'CUDA006')

  assert.equal(result.hasErrors, true)
  assert.equal(diagnostic.line, 11)
})

test('reports unmatched delimiters', () => {
  const source = DEFAULT_CUDA_SOURCE.slice(0, -1)
  const result = analyzeCudaSource(source)

  assert.equal(result.hasErrors, true)
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'CUDA002'))
})

test('warns when code is valid-looking but outside the supported visualization subset', () => {
  const source = DEFAULT_CUDA_SOURCE.replace(
    'sum += A[row * N + k] * B[k * N + col];',
    'sum += 1.0f;',
  )
  const result = analyzeCudaSource(source)

  assert.equal(result.hasErrors, false)
  assert.equal(result.canSimulate, false)
  assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'CUDA103'))
})
