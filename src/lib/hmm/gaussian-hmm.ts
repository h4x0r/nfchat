/**
 * GaussianHMM - Gaussian Hidden Markov Model with diagonal covariance.
 *
 * Implements Baum-Welch (EM) for training and Viterbi for decoding.
 * Ported from the Python hmmlearn-based implementation, with all
 * core algorithms written from scratch for browser compatibility.
 *
 * All computations use log probabilities to prevent underflow.
 * No external dependencies -- runs in any modern browser.
 */

const LOG_2PI = Math.log(2 * Math.PI)
const MIN_VARIANCE = 1e-4

// ============================================================
// Seeded PRNG (mulberry32) for reproducible K-means init
// ============================================================

function createRng(seed: number): () => number {
  let s = seed | 0
  return function rand(): number {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================
// Log-sum-exp for numerical stability
// ============================================================

function logSumExp(arr: Float64Array): number {
  if (arr.length === 0) return -Infinity

  let max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i]
  }
  if (max === -Infinity) return -Infinity

  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += Math.exp(arr[i] - max)
  }
  return max + Math.log(sum)
}

// ============================================================
// Gaussian log emission probability (diagonal covariance)
// ============================================================

/**
 * log p(x | mu, sigma^2) =
 *   -0.5 * [ d*log(2*pi) + sum(log(sigma_i^2)) + sum((x_i - mu_i)^2 / sigma_i^2) ]
 */
function logGaussianPdf(
  x: Float64Array,
  mean: Float64Array,
  variance: Float64Array,
  nFeatures: number,
): number {
  let logDet = 0
  let mahal = 0
  for (let f = 0; f < nFeatures; f++) {
    const v = variance[f]
    logDet += Math.log(v)
    const diff = x[f] - mean[f]
    mahal += (diff * diff) / v
  }
  return -0.5 * (nFeatures * LOG_2PI + logDet + mahal)
}

// ============================================================
// Interfaces
// ============================================================

export interface FitResult {
  logLikelihood: number
  iterations: number
  converged: boolean
}

export interface FitOptions {
  onProgress?: (iteration: number, maxIter: number, logLikelihood: number) => void
}

export interface GaussianHMMJSON {
  nStates: number
  nFeatures: number
  means: number[][]
  variances: number[][]
  transitionMatrix: number[][]
  initialProbs: number[]
}

// ============================================================
// GaussianHMM class
// ============================================================

export class GaussianHMM {
  readonly nStates: number
  readonly nFeatures: number

  private maxIter: number
  private tol: number
  private seed: number

  // Model parameters (set after fit)
  private means_: Float64Array[] | null = null
  private variances_: Float64Array[] | null = null
  private logTransMat_: Float64Array[] | null = null // log transition probs [from][to]
  private logPi_: Float64Array | null = null         // log initial state probs

  constructor(
    nStates: number,
    nFeatures: number,
    options?: { maxIter?: number; tol?: number; seed?: number },
  ) {
    this.nStates = nStates
    this.nFeatures = nFeatures
    this.maxIter = options?.maxIter ?? 100
    this.tol = options?.tol ?? 1e-4
    this.seed = options?.seed ?? 42
  }

  // ----------------------------------------------------------
  // Training (Baum-Welch / EM)
  // ----------------------------------------------------------

  fit(sequences: number[][][], options?: FitOptions): FitResult {
    if (sequences.length === 0) {
      throw new Error('Cannot fit on empty sequences')
    }

    // Validate feature dimension
    for (const seq of sequences) {
      for (const obs of seq) {
        if (obs.length !== this.nFeatures) {
          throw new Error(
            `Expected ${this.nFeatures} features but got ${obs.length}`,
          )
        }
      }
    }

    // Convert to Float64Arrays for performance
    const seqs = sequences.map(seq =>
      seq.map(obs => Float64Array.from(obs)),
    )

    // Pool all observations for K-means initialization
    const allObs = seqs.flat()

    // Initialize parameters via K-means
    this.initializeKMeans(allObs)

    let prevLL = -Infinity
    let iter = 0
    let converged = false

    for (iter = 1; iter <= this.maxIter; iter++) {
      // E-step: forward-backward on each sequence
      const gamma: Float64Array[][] = []     // gamma[seq][t] = Float64Array(nStates)
      const xi: Float64Array[][][] = []      // xi[seq][t][from] = Float64Array(nStates)
      let totalLL = 0

      for (const seq of seqs) {
        const T = seq.length
        const logEmission = this.computeLogEmission(seq)
        const { logAlpha, logBeta, seqLL } = this.forwardBackward(logEmission, T)
        totalLL += seqLL

        // Compute gamma: P(state=k at time t | observations)
        const seqGamma: Float64Array[] = new Array(T)
        for (let t = 0; t < T; t++) {
          seqGamma[t] = new Float64Array(this.nStates)
          const tmp = new Float64Array(this.nStates)
          for (let k = 0; k < this.nStates; k++) {
            tmp[k] = logAlpha[t][k] + logBeta[t][k]
          }
          const norm = logSumExp(tmp)
          for (let k = 0; k < this.nStates; k++) {
            seqGamma[t][k] = Math.exp(tmp[k] - norm)
          }
        }
        gamma.push(seqGamma)

        // Compute xi: P(state_t=i, state_{t+1}=j | observations)
        const seqXi: Float64Array[][] = new Array(Math.max(0, T - 1))
        for (let t = 0; t < T - 1; t++) {
          seqXi[t] = new Array(this.nStates)
          const vals = new Float64Array(this.nStates * this.nStates)
          for (let i = 0; i < this.nStates; i++) {
            for (let j = 0; j < this.nStates; j++) {
              vals[i * this.nStates + j] =
                logAlpha[t][i] +
                this.logTransMat_![i][j] +
                logEmission[t + 1][j] +
                logBeta[t + 1][j]
            }
          }
          const norm = logSumExp(vals)
          for (let i = 0; i < this.nStates; i++) {
            seqXi[t][i] = new Float64Array(this.nStates)
            for (let j = 0; j < this.nStates; j++) {
              seqXi[t][i][j] = Math.exp(
                vals[i * this.nStates + j] - norm,
              )
            }
          }
        }
        xi.push(seqXi)
      }

      // M-step: update parameters from sufficient statistics
      this.mStep(seqs, gamma, xi)

      // Check convergence
      const llChange = Math.abs(totalLL - prevLL)
      if (options?.onProgress) {
        options.onProgress(iter, this.maxIter, totalLL)
      }

      if (iter > 1 && llChange < this.tol) {
        converged = true
        prevLL = totalLL
        break
      }
      prevLL = totalLL
    }

    return {
      logLikelihood: prevLL,
      iterations: iter > this.maxIter ? this.maxIter : iter,
      converged,
    }
  }

  // ----------------------------------------------------------
  // K-means initialization
  // ----------------------------------------------------------

  private initializeKMeans(allObs: Float64Array[]): void {
    const N = allObs.length
    const K = this.nStates
    const D = this.nFeatures
    const rand = createRng(this.seed)

    // K-means++ initialization
    const centroids: Float64Array[] = new Array(K)
    if (N <= K) {
      // Fewer observations than states -- just cycle
      for (let k = 0; k < K; k++) {
        centroids[k] = new Float64Array(allObs[k % N])
      }
    } else {
      centroids[0] = new Float64Array(allObs[Math.floor(rand() * N)])

      for (let k = 1; k < K; k++) {
        // Compute squared distance from each obs to nearest existing centroid
        const distances = new Float64Array(N)
        let totalDist = 0
        for (let i = 0; i < N; i++) {
          let minDist = Infinity
          for (let c = 0; c < k; c++) {
            let dist = 0
            for (let d = 0; d < D; d++) {
              const diff = allObs[i][d] - centroids[c][d]
              dist += diff * diff
            }
            if (dist < minDist) minDist = dist
          }
          distances[i] = minDist
          totalDist += minDist
        }

        // Pick next centroid proportional to squared distance
        let threshold = rand() * totalDist
        let idx = 0
        for (let i = 0; i < N; i++) {
          threshold -= distances[i]
          if (threshold <= 0) {
            idx = i
            break
          }
        }
        centroids[k] = new Float64Array(allObs[idx])
      }
    }

    // Run 10 iterations of K-means
    const assignments = new Int32Array(N)
    for (let kIter = 0; kIter < 10; kIter++) {
      // Assign each observation to nearest centroid
      for (let i = 0; i < N; i++) {
        let bestK = 0
        let bestDist = Infinity
        for (let k = 0; k < K; k++) {
          let dist = 0
          for (let d = 0; d < D; d++) {
            const diff = allObs[i][d] - centroids[k][d]
            dist += diff * diff
          }
          if (dist < bestDist) {
            bestDist = dist
            bestK = k
          }
        }
        assignments[i] = bestK
      }

      // Recompute centroids
      const counts = new Int32Array(K)
      for (let k = 0; k < K; k++) {
        centroids[k].fill(0)
      }
      for (let i = 0; i < N; i++) {
        const k = assignments[i]
        counts[k]++
        for (let d = 0; d < D; d++) {
          centroids[k][d] += allObs[i][d]
        }
      }
      for (let k = 0; k < K; k++) {
        if (counts[k] > 0) {
          for (let d = 0; d < D; d++) {
            centroids[k][d] /= counts[k]
          }
        }
      }
    }

    // Set means from K-means centroids
    this.means_ = centroids

    // Compute per-state diagonal variance from assignments
    this.variances_ = new Array(K)
    const varCounts = new Int32Array(K)
    for (let k = 0; k < K; k++) {
      this.variances_[k] = new Float64Array(D)
    }
    for (let i = 0; i < N; i++) {
      const k = assignments[i]
      varCounts[k]++
      for (let d = 0; d < D; d++) {
        const diff = allObs[i][d] - centroids[k][d]
        this.variances_[k][d] += diff * diff
      }
    }
    for (let k = 0; k < K; k++) {
      for (let d = 0; d < D; d++) {
        if (varCounts[k] > 1) {
          this.variances_[k][d] /= varCounts[k]
        }
        // Floor variance to prevent degenerate distributions
        if (this.variances_[k][d] < MIN_VARIANCE) {
          this.variances_[k][d] = MIN_VARIANCE
        }
      }
    }

    // Uniform initial state probabilities
    this.logPi_ = new Float64Array(K)
    const logUniform = -Math.log(K)
    for (let k = 0; k < K; k++) {
      this.logPi_[k] = logUniform
    }

    // Sticky transition prior: prefer self-transitions
    this.logTransMat_ = new Array(K)
    const diagProb = 0.7
    const offDiagProb = K > 1 ? 0.3 / (K - 1) : 1.0
    for (let i = 0; i < K; i++) {
      this.logTransMat_[i] = new Float64Array(K)
      for (let j = 0; j < K; j++) {
        this.logTransMat_[i][j] = Math.log(i === j ? diagProb : offDiagProb)
      }
    }
  }

  // ----------------------------------------------------------
  // Compute log emission for all time steps
  // ----------------------------------------------------------

  private computeLogEmission(seq: Float64Array[]): Float64Array[] {
    const T = seq.length
    const K = this.nStates
    const D = this.nFeatures
    const logEmission: Float64Array[] = new Array(T)

    for (let t = 0; t < T; t++) {
      logEmission[t] = new Float64Array(K)
      for (let k = 0; k < K; k++) {
        logEmission[t][k] = logGaussianPdf(
          seq[t],
          this.means_![k],
          this.variances_![k],
          D,
        )
      }
    }

    return logEmission
  }

  // ----------------------------------------------------------
  // Forward-Backward algorithm (log-space)
  // ----------------------------------------------------------

  private forwardBackward(
    logEmission: Float64Array[],
    T: number,
  ): {
    logAlpha: Float64Array[]
    logBeta: Float64Array[]
    seqLL: number
  } {
    const K = this.nStates
    const logPi = this.logPi_!
    const logA = this.logTransMat_!

    // Forward pass
    const logAlpha: Float64Array[] = new Array(T)
    logAlpha[0] = new Float64Array(K)
    for (let k = 0; k < K; k++) {
      logAlpha[0][k] = logPi[k] + logEmission[0][k]
    }

    const tmp = new Float64Array(K)
    for (let t = 1; t < T; t++) {
      logAlpha[t] = new Float64Array(K)
      for (let j = 0; j < K; j++) {
        for (let i = 0; i < K; i++) {
          tmp[i] = logAlpha[t - 1][i] + logA[i][j]
        }
        logAlpha[t][j] = logSumExp(tmp) + logEmission[t][j]
      }
    }

    // Sequence log-likelihood = log(sum(alpha_T))
    const seqLL = logSumExp(logAlpha[T - 1])

    // Backward pass
    const logBeta: Float64Array[] = new Array(T)
    logBeta[T - 1] = new Float64Array(K) // log(1) = 0 for all states

    for (let t = T - 2; t >= 0; t--) {
      logBeta[t] = new Float64Array(K)
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          tmp[j] = logA[i][j] + logEmission[t + 1][j] + logBeta[t + 1][j]
        }
        logBeta[t][i] = logSumExp(tmp)
      }
    }

    return { logAlpha, logBeta, seqLL }
  }

  // ----------------------------------------------------------
  // M-step: update all parameters from sufficient statistics
  // ----------------------------------------------------------

  private mStep(
    seqs: Float64Array[][],
    gamma: Float64Array[][],
    xi: Float64Array[][][],
  ): void {
    const K = this.nStates
    const D = this.nFeatures

    // ---- Update initial state probabilities ----
    const piNum = new Float64Array(K)
    for (let s = 0; s < seqs.length; s++) {
      for (let k = 0; k < K; k++) {
        piNum[k] += gamma[s][0][k]
      }
    }
    let piSum = 0
    for (let k = 0; k < K; k++) piSum += piNum[k]
    for (let k = 0; k < K; k++) {
      const prob = piSum > 0 ? piNum[k] / piSum : 1 / K
      this.logPi_![k] = Math.log(Math.max(prob, 1e-300))
    }

    // ---- Update transition matrix ----
    const transNum: Float64Array[] = new Array(K)
    for (let i = 0; i < K; i++) {
      transNum[i] = new Float64Array(K)
    }
    const transDen = new Float64Array(K)

    for (let s = 0; s < seqs.length; s++) {
      const T = seqs[s].length
      for (let t = 0; t < T - 1; t++) {
        for (let i = 0; i < K; i++) {
          transDen[i] += gamma[s][t][i]
          for (let j = 0; j < K; j++) {
            transNum[i][j] += xi[s][t][i][j]
          }
        }
      }
    }

    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) {
        const prob = transDen[i] > 0 ? transNum[i][j] / transDen[i] : 1 / K
        this.logTransMat_![i][j] = Math.log(Math.max(prob, 1e-300))
      }
    }

    // ---- Update means ----
    const newMeans: Float64Array[] = new Array(K)
    const newVars: Float64Array[] = new Array(K)
    const gammaSum = new Float64Array(K)

    for (let k = 0; k < K; k++) {
      newMeans[k] = new Float64Array(D)
      newVars[k] = new Float64Array(D)
    }

    for (let s = 0; s < seqs.length; s++) {
      const T = seqs[s].length
      for (let t = 0; t < T; t++) {
        for (let k = 0; k < K; k++) {
          const g = gamma[s][t][k]
          gammaSum[k] += g
          for (let d = 0; d < D; d++) {
            newMeans[k][d] += g * seqs[s][t][d]
          }
        }
      }
    }

    for (let k = 0; k < K; k++) {
      if (gammaSum[k] > 0) {
        for (let d = 0; d < D; d++) {
          newMeans[k][d] /= gammaSum[k]
        }
      }
    }

    // ---- Update variances: E[(x - new_mu)^2] ----
    for (let s = 0; s < seqs.length; s++) {
      const T = seqs[s].length
      for (let t = 0; t < T; t++) {
        for (let k = 0; k < K; k++) {
          const g = gamma[s][t][k]
          for (let d = 0; d < D; d++) {
            const diff = seqs[s][t][d] - newMeans[k][d]
            newVars[k][d] += g * diff * diff
          }
        }
      }
    }

    for (let k = 0; k < K; k++) {
      if (gammaSum[k] > 0) {
        for (let d = 0; d < D; d++) {
          newVars[k][d] /= gammaSum[k]
          // Floor variance to prevent degenerate distributions
          if (newVars[k][d] < MIN_VARIANCE) {
            newVars[k][d] = MIN_VARIANCE
          }
        }
      } else {
        // Keep previous values if no data assigned to this state
        for (let d = 0; d < D; d++) {
          newVars[k][d] = this.variances_![k][d]
        }
      }
    }

    this.means_ = newMeans
    this.variances_ = newVars
  }

  // ----------------------------------------------------------
  // Viterbi decoding
  // ----------------------------------------------------------

  predict(sequence: number[][]): number[] {
    if (!this.means_ || !this.variances_ || !this.logTransMat_ || !this.logPi_) {
      throw new Error('Model not fitted. Call fit() first.')
    }

    const T = sequence.length
    const K = this.nStates

    const seq = sequence.map(obs => Float64Array.from(obs))
    const logEmission = this.computeLogEmission(seq)

    // Viterbi tables
    const viterbi: Float64Array[] = new Array(T)
    const backpointer: Int32Array[] = new Array(T)

    // Initialize
    viterbi[0] = new Float64Array(K)
    backpointer[0] = new Int32Array(K)
    for (let k = 0; k < K; k++) {
      viterbi[0][k] = this.logPi_[k] + logEmission[0][k]
      backpointer[0][k] = 0
    }

    // Recurse
    for (let t = 1; t < T; t++) {
      viterbi[t] = new Float64Array(K)
      backpointer[t] = new Int32Array(K)
      for (let j = 0; j < K; j++) {
        let bestVal = -Infinity
        let bestI = 0
        for (let i = 0; i < K; i++) {
          const val = viterbi[t - 1][i] + this.logTransMat_[i][j]
          if (val > bestVal) {
            bestVal = val
            bestI = i
          }
        }
        viterbi[t][j] = bestVal + logEmission[t][j]
        backpointer[t][j] = bestI
      }
    }

    // Backtrack
    const states = new Array<number>(T)
    let bestFinalState = 0
    let bestFinalVal = -Infinity
    for (let k = 0; k < K; k++) {
      if (viterbi[T - 1][k] > bestFinalVal) {
        bestFinalVal = viterbi[T - 1][k]
        bestFinalState = k
      }
    }
    states[T - 1] = bestFinalState

    for (let t = T - 2; t >= 0; t--) {
      states[t] = backpointer[t + 1][states[t + 1]]
    }

    return states
  }

  // ----------------------------------------------------------
  // BIC (Bayesian Information Criterion)
  // ----------------------------------------------------------

  bic(sequences: number[][][]): number {
    if (!this.means_ || !this.variances_ || !this.logTransMat_ || !this.logPi_) {
      throw new Error('Model not fitted. Call fit() first.')
    }

    // Compute total log-likelihood
    let totalLL = 0
    let nSamples = 0
    for (const seq of sequences) {
      const floatSeq = seq.map(obs => Float64Array.from(obs))
      const logEmission = this.computeLogEmission(floatSeq)
      const { seqLL } = this.forwardBackward(logEmission, seq.length)
      totalLL += seqLL
      nSamples += seq.length
    }

    // Number of free parameters:
    // - Initial state probs: nStates - 1
    // - Transition matrix: nStates * (nStates - 1)
    // - Means: nStates * nFeatures
    // - Diagonal variances: nStates * nFeatures
    const nParams =
      (this.nStates - 1) +
      this.nStates * (this.nStates - 1) +
      this.nStates * this.nFeatures * 2

    return -2 * totalLL + nParams * Math.log(nSamples)
  }

  // ----------------------------------------------------------
  // Serialization
  // ----------------------------------------------------------

  toJSON(): GaussianHMMJSON {
    if (!this.means_ || !this.variances_ || !this.logTransMat_ || !this.logPi_) {
      throw new Error('Model not fitted. Call fit() first.')
    }

    return {
      nStates: this.nStates,
      nFeatures: this.nFeatures,
      means: this.means_.map(m => Array.from(m)),
      variances: this.variances_.map(v => Array.from(v)),
      transitionMatrix: this.logTransMat_.map(r =>
        Array.from(r).map(v => Math.exp(v)),
      ),
      initialProbs: Array.from(this.logPi_).map(v => Math.exp(v)),
    }
  }

  static fromJSON(json: GaussianHMMJSON): GaussianHMM {
    const hmm = new GaussianHMM(json.nStates, json.nFeatures)
    hmm.means_ = json.means.map(m => Float64Array.from(m))
    hmm.variances_ = json.variances.map(v => Float64Array.from(v))
    hmm.logTransMat_ = json.transitionMatrix.map(r =>
      Float64Array.from(r.map(v => Math.log(Math.max(v, 1e-300)))),
    )
    hmm.logPi_ = Float64Array.from(
      json.initialProbs.map(v => Math.log(Math.max(v, 1e-300))),
    )
    return hmm
  }
}
