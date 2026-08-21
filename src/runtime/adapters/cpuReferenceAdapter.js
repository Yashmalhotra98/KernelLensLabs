function assertVectorInputs(inputs) {
  if (!Array.isArray(inputs?.a) || !Array.isArray(inputs?.b)) {
    throw new TypeError('Vector addition requires numeric a and b arrays.')
  }

  if (inputs.a.length !== inputs.b.length) {
    throw new RangeError('Vector inputs must have the same length.')
  }

  if (![...inputs.a, ...inputs.b].every(Number.isFinite)) {
    throw new TypeError('Vector inputs must contain only finite numbers.')
  }
}

export const cpuReferenceAdapter = {
  id: 'cpu-reference',

  async isAvailable() {
    return true
  },

  async execute(request) {
    if (request.operation !== 'vector-add') {
      throw new Error(`CPU reference does not support '${request.operation}'.`)
    }

    assertVectorInputs(request.inputs)

    return {
      backend: this.id,
      output: request.inputs.a.map((value, index) => value + request.inputs.b[index]),
    }
  },
}
