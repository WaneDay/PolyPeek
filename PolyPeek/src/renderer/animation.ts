import * as THREE from 'three'

/** Sentinel clip name meaning "play every clip that does not conflict". */
export const ALL_CLIPS = '__all__'

// A file can contain several clips (e.g. Idle/Walk/Run). Playing them all at
// once lets them fight over the same nodes, so in ALL_CLIPS mode every clip
// that does not target a node another (earlier) clip already drives is played
// - the first clip wins, truly disjoint clips all play. Track names are
// "<node>.<property>" with the node part sanitized by three's loaders (no
// dots), so splitting at the first dot yields the animated node.
function clipNodes(clip: THREE.AnimationClip): string[] {
  const nodes: string[] = []
  for (const track of clip.tracks) {
    const dot = track.name.indexOf('.')
    nodes.push(dot > 0 ? track.name.slice(0, dot) : track.name)
  }
  return nodes
}

/**
 * Playback timeline over one loaded model: clip selection, non-overlapping
 * multi-clip playback, speed, and absolute seek (scrub). A single clock
 * (this.time) drives every mixer via setTime(), so pausing / scrubbing /
 * speed changes are all exact.
 */
export class Timeline {
  readonly clips: THREE.AnimationClip[]
  clipName: string = ALL_CLIPS
  speed = 1
  playing = true
  scrubbing = false
  time = 0
  duration = 0

  private root: THREE.Object3D
  private mixers: THREE.AnimationMixer[] = []

  constructor(root: THREE.Object3D | null, clips: THREE.AnimationClip[]) {
    this.root = root ?? new THREE.Group()
    this.clips = clips.filter(
      (c) => c && c.tracks.length > 0 && Number.isFinite(c.duration) && c.duration > 0,
    )
    this.selectClip(ALL_CLIPS)
  }

  get hasAnimation(): boolean {
    return this.clips.length > 0
  }

  selectClip(name: string): void {
    this.clipName = name
    this.stopMixers()
    const chosen =
      name === ALL_CLIPS ? this.clips : this.clips.filter((c) => c.name === name)
    if (name === ALL_CLIPS) {
      const claimed = new Set<string>()
      for (const clip of chosen) {
        const nodes = clipNodes(clip)
        if (nodes.some((n) => claimed.has(n))) continue
        for (const n of nodes) claimed.add(n)
        this.addMixer(clip)
      }
    } else {
      for (const clip of chosen) this.addMixer(clip)
    }
    if (this.time > this.duration) this.time = 0
    this.apply()
  }

  setSpeed(v: number): void {
    this.speed = v
  }

  setTime(t: number): void {
    this.time = t
    this.apply()
  }

  update(dt: number): void {
    if (!this.hasAnimation || this.duration <= 0) return
    if (this.playing && !this.scrubbing) {
      this.time += dt * this.speed
      if (this.time >= this.duration) this.time %= this.duration
    }
    this.apply()
  }

  dispose(): void {
    this.stopMixers()
  }

  private addMixer(clip: THREE.AnimationClip): void {
    const mixer = new THREE.AnimationMixer(this.root)
    mixer.clipAction(clip).play()
    this.mixers.push(mixer)
    this.duration = Math.max(this.duration, clip.duration)
  }

  private stopMixers(): void {
    for (const m of this.mixers) m.stopAllAction()
    this.mixers = []
    this.duration = 0
  }

  private apply(): void {
    for (const m of this.mixers) m.setTime(this.time)
  }
}

// ---- morph targets (blend shapes) ------------------------------------------

export interface MorphEntry {
  name: string
  mesh: THREE.Mesh
  index: number
}

export function collectMorphTargets(root: THREE.Object3D): MorphEntry[] {
  const entries: MorphEntry[] = []
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const dict = obj.morphTargetDictionary
    const inf = obj.morphTargetInfluences
    if (!dict || !inf) return
    for (const name of Object.keys(dict)) {
      const index = dict[name]
      if (index >= 0 && index < inf.length) entries.push({ name, mesh: obj, index })
    }
  })
  return entries
}

/** Multi-select state: every selected morph name is set to 1 everywhere,
 *  unselected morphs of those meshes go to 0 - several shapes can be
 *  combined at once. Empty set = reset all to 0. */
export function applyMorphSelection(
  entries: MorphEntry[],
  selected: ReadonlySet<string>,
): void {
  for (const e of entries) {
    const inf = e.mesh.morphTargetInfluences
    if (inf) inf[e.index] = selected.has(e.name) ? 1 : 0
  }
}
