import { useForestStore } from './game/store'
import { landmarks } from './game/landmarks'
import { ForestWorld } from './world/ForestWorld'
import './App.css'

function App() {
  const nearby = useForestStore((s) => s.nearby)
  const planted = useForestStore((s) => s.planted)
  const message = useForestStore((s) => s.message)
  const interact = useForestStore((s) => s.interact)
  const dismiss = useForestStore((s) => s.dismiss)
  const current = landmarks.find((l) => l.id === nearby)

  return <main className="app-shell">
    <div className="world"><ForestWorld /></div>
    <header className="hero-panel" aria-label="项目简介">
      <span className="eyebrow">FOREST MOMENTS · EARLY PROTOTYPE</span>
      <h1>森林拾光</h1>
      <p>在一座小小的手绘森林里，慢慢生活。</p>
    </header>
    <aside className="landmarks" aria-label="森林探索地点">
      <span className="eyebrow">A LITTLE WORLD TO GROW IN</span>
      <h2>漫游地图</h2>
      <ul>
        {landmarks.map((point) => <li key={point.id} className={nearby === point.id ? 'active' : undefined}>
          <span className="bullet">✦</span>{point.name}{point.id === 'grove' && planted ? ' · 已种植' : ''}
        </li>)}
      </ul>
      <small>已实现：WASD 行走、Shift 奔跑、F 互动、种树苗存档。其余地点为概念占位。</small>
    </aside>
    <footer className="controls">
      <strong>漫步森林</strong>
      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span>
      <span><kbd>Shift</kbd> 奔跑</span>
      <span><kbd>F</kbd> 互动</span>
    </footer>
    {current && <div className="interaction" aria-live="polite">
      <span>发现 · {current.name}</span>
      <button type="button" onClick={interact}>{nearby === 'grove' ? (planted ? '看看树苗' : '种一棵树') : '探索地点'} <kbd>F</kbd></button>
    </div>}
    {message && <div className="notice" role="status">
      <p>{message}</p><button type="button" onClick={dismiss} aria-label="关闭提示">×</button>
    </div>}
    <div className="draft-flag">原型阶段 · 美术资源待制作</div>
  </main>
}

export default App
