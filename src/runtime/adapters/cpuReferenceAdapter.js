function assertFiniteArray(values, label) {
  if (!Array.isArray(values) || !values.every(Number.isFinite)) {
    throw new TypeError(`${label} must be an array of finite numbers.`)
  }
}

function assertSameLength(left, right, operation) {
  if (left.length !== right.length) {
    throw new RangeError(`${operation} inputs must have the same length.`)
  }
}

function vectorAdd(inputs) {
  assertFiniteArray(inputs?.a, 'Vector A')
  assertFiniteArray(inputs?.b, 'Vector B')
  assertSameLength(inputs.a, inputs.b, 'Vector addition')
  return inputs.a.map((value, index) => value + inputs.b[index])
}

function axpy(inputs) {
  assertFiniteArray(inputs?.x, 'Vector x')
  assertFiniteArray(inputs?.y, 'Vector y')
  assertSameLength(inputs.x, inputs.y, 'AXPY')
  if (!Number.isFinite(inputs.alpha)) throw new TypeError('AXPY alpha must be finite.')
  return inputs.x.map((value, index) => inputs.alpha * value + inputs.y[index])
}

function matrixMultiply(inputs) {
  const { a, b, m, k, n } = inputs
  assertFiniteArray(a, 'Matrix A')
  assertFiniteArray(b, 'Matrix B')

  if (![m, k, n].every((dimension) => Number.isInteger(dimension) && dimension > 0)) {
    throw new RangeError('Matrix dimensions must be positive integers.')
  }

  if (a.length !== m * k || b.length !== k * n) {
    throw new RangeError('Matrix storage does not match the supplied dimensions.')
  }

  return Array.from({ length: m * n }, (_, index) => {
    const row = Math.floor(index / n)
    const column = index % n
    let sum = 0

    for (let inner = 0; inner < k; inner += 1) {
      sum += a[row * k + inner] * b[inner * n + column]
    }

    return sum
  })
}

function convolve1d(inputs) {
  const { input, mask } = inputs
  assertFiniteArray(input, 'Convolution input')
  assertFiniteArray(mask, 'Convolution mask')
  if (mask.length === 0 || mask.length % 2 === 0) throw new RangeError('The 1-D mask width must be odd.')
  const radius = Math.floor(mask.length / 2)

  return input.map((_, outputIndex) => mask.reduce((sum, coefficient, maskIndex) => {
    const inputIndex = outputIndex + maskIndex - radius
    const value = inputIndex >= 0 && inputIndex < input.length ? input[inputIndex] : 0
    return sum + value * coefficient
  }, 0))
}

function convolve2d(inputs) {
  const { input, width, height, mask, maskWidth } = inputs
  assertFiniteArray(input, 'Image input')
  assertFiniteArray(mask, 'Image mask')
  if (input.length !== width * height || mask.length !== maskWidth * maskWidth || maskWidth % 2 === 0) {
    throw new RangeError('The image or square odd-width mask dimensions are invalid.')
  }
  const radius = Math.floor(maskWidth / 2)

  return input.map((_, outputIndex) => {
    const row = Math.floor(outputIndex / width)
    const column = outputIndex % width
    let sum = 0

    for (let maskRow = 0; maskRow < maskWidth; maskRow += 1) {
      for (let maskColumn = 0; maskColumn < maskWidth; maskColumn += 1) {
        const imageRow = row + maskRow - radius
        const imageColumn = column + maskColumn - radius
        const insideImage = imageRow >= 0 && imageRow < height && imageColumn >= 0 && imageColumn < width
        if (insideImage) sum += input[imageRow * width + imageColumn] * mask[maskRow * maskWidth + maskColumn]
      }
    }

    return sum
  })
}

function bitonicSort(inputs) {
  const values = inputs?.values
  assertFiniteArray(values, 'Bitonic-sort input')

  const isPowerOfTwo = values.length > 0 && (values.length & (values.length - 1)) === 0
  if (!isPowerOfTwo) {
    throw new RangeError('Bitonic-sort input length must be a non-zero power of two.')
  }

  return [...values].sort((left, right) => left - right)
}

const OPERATIONS = {
  'vector-add': vectorAdd,
  axpy,
  'matrix-multiply': matrixMultiply,
  'memory-copy': (inputs) => {
    assertFiniteArray(inputs?.values, 'Memory-copy input')
    return [...inputs.values]
  },
  'reduction-sum': (inputs) => {
    assertFiniteArray(inputs?.values, 'Reduction input')
    return [inputs.values.reduce((sum, value) => sum + value, 0)]
  },
  'convolution-1d': convolve1d,
  'convolution-2d': convolve2d,
  'bitonic-sort': bitonicSort,
}

export const cpuReferenceAdapter = {
  id: 'cpu-reference',

  async isAvailable() {
    return true
  },

  async execute(request) {
    const executeOperation = OPERATIONS[request.operation]
    if (!executeOperation) {
      throw new Error(`CPU reference does not support '${request.operation}'.`)
    }

    return {
      backend: this.id,
      output: executeOperation(request.inputs),
    }
  },
}
