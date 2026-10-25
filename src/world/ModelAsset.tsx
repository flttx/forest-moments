import {solveWoodwork} from './woodworkRig'
import { Component, useEffect, useMemo, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useProgress } from '@react-three/drei'
import { AnimationMixer, Mesh } from 'three'
import type { Group } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { modelAssets } from './assets'
import { useForestStore } from '../game/store'

export type Locomotion = 'idle' | 'walk' | 'run' | 'interact' | 'fish_cast' | 'fish_hold' | 'fish_reel' | 'fish_land' | 'woodwork' | 'bench_sit_down' | 'bench_sit_idle' | 'bench_stand_up'

export function ModelAsset({ asset, motion, onReadyChange }: {
  asset: keyof typeof modelAssets
  motion?: RefObject<Locomotion>
  onReadyChange?: (ready: boolean) => void
}) {
  const config = modelAssets[asset]
  const gltf = useGLTF(config.url)
  const model = useMemo(() => {
    const object = clone(gltf.scene)
    object.traverse((child) => {
      if (child instanceof Mesh) { child.castShadow = true; child.receiveShadow = true }
    })
    return object
  }, [gltf.scene])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const actions = useMemo(() => Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)])), [gltf.animations, mixer])
  const actionRef = useRef(actions)
  const active = useRef<Locomotion | null>(null)
  const display = useRef<Group>(null)
  useEffect(() => {
    actionRef.current = actions
    onReadyChange?.(true)
    return () => {
      onReadyChange?.(false)
      mixer.stopAllAction()
      active.current = null
    }
  }, [actions, mixer, onReadyChange])
  useFrame((_, delta) => {
    if (!motion) return
    const actions = actionRef.current
    const requested=motion.current
    const next=requested==='woodwork'?'interact':requested
    if (next !== active.current && actions[next]) {
      if (active.current) actions[active.current]?.fadeOut(.2)
      actions[next].reset().fadeIn(.2).play()
      active.current = next
    }
    mixer.update(Math.min(delta, .05))
    if(requested==='woodwork'&&actions.interact){actions.interact.time=.30+Math.sin((useForestStore.getState().craft?.elapsed??0)*2)*.035;mixer.update(0)}
    if(requested!=='woodwork'&&next==='interact'&&actions.interact){const s=useForestStore.getState();const time=s.mode==='feeding'?s.feedingElapsed:s.mode==='gathering'?s.gatheringElapsed:s.mode==='crafting'?.45+(.95-(s.craft?.stroke??0))*.8:s.plantingElapsed;actions.interact.time=Math.min(actions.interact.getClip().duration-.001,time);mixer.update(0)}
    const seat=useForestStore.getState().sitting
    if(seat&&next.startsWith('bench_')&&actions[next]){actions[next].time=next==='bench_sit_idle'?seat.elapsed%actions[next].getClip().duration:Math.min(seat.elapsed,actions[next].getClip().duration-.001);mixer.update(0)}
    const fishing = useForestStore.getState().fishing
    if (fishing && next.startsWith('fish_') && actions[next]) {
      const duration = actions[next].getClip().duration
      const once = next === 'fish_cast' || next === 'fish_land'
      actions[next].time = fishing.phase === 'caught' ? duration - .00001 : once ? Math.min(fishing.elapsed, duration - .00001) : fishing.elapsed % duration
      mixer.update(0)
    }
    if(requested==='woodwork'){const contact=solveWoodwork(model,useForestStore.getState().craft?.stroke??0);if(display.current)display.current.userData.woodwork=contact}
    if(requested!=='woodwork'&&display.current)delete display.current.userData.woodwork
    if (import.meta.env.DEV && display.current) display.current.userData.animation = { clip: active.current, time: active.current ? actions[active.current]?.time : 0 }
  }, -1.5)
  return <group ref={display} name={`asset-${asset}`} scale={config.scale} rotation={[0, asset === 'raccoon' ? Math.PI : 0, 0]}>
    <primitive object={model} position={[0, config.lift, 0]} dispose={null} />
  </group>
}

export function AssetLoadingNotice() {
  const active = useProgress((s) => s.active)
  return active ? <div className="asset-loading" role="status">正在载入森林模型，首次打开可能需要一些时间…</div> : null
}

export class WorldErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="world-error" role="alert">
      <p>森林暂时没有加载成功，请重新载入。</p>
      <button type="button" onClick={() => window.location.reload()}>重新载入</button>
    </div>
    return this.props.children
  }
}
