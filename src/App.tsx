import { useForestStore } from './game/store'
import { landmarks } from './game/landmarks'
import { ForestWorld } from './world/ForestWorld'
import { AssetLoadingNotice, WorldErrorBoundary } from './world/ModelAsset'
import { canBoard, canLand } from './game/rowing'
import { FishBook, FishingHud } from './FishingHud'
import './App.css'

function App() {
  const nearby = useForestStore((s) => s.nearby)
  const planted = useForestStore((s) => s.planted)
  const message = useForestStore((s) => s.message)
  const interact = useForestStore((s) => s.interact)
  const dismiss = useForestStore((s) => s.dismiss)
  const current = landmarks.find((l) => l.id === nearby)
  const mode = useForestStore((s) => s.mode)
  const boardable = useForestStore((s) => s.boatReady && canBoard(s.position.x, s.position.z, s.boat))
  const landable = useForestStore((s) => canLand(s.boat))

  return <main className="app-shell">
    <div className="world"><WorldErrorBoundary><ForestWorld /></WorldErrorBoundary></div>
    <AssetLoadingNotice />
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
      <small>池塘西岸按 F 钓鱼，木码头前端按 F 上船。可保存渔获和树苗；工坊玩法仍在制作中。</small>
      <FishBook />
    </aside>
    <footer className="controls">
      <strong>{mode === 'fishing' ? '池边垂钓' : mode === 'rowing' ? '泛舟池塘' : '漫步森林'}</strong>
      {mode === 'fishing' ? <><span><kbd>F</kbd> 提竿</span><span><kbd>Space</kbd> 按住收线，松开放线</span><span><kbd>Esc</kbd> 收起</span></> : mode === 'rowing' ? <>
        <span><kbd>W</kbd> 前划 <kbd>S</kbd> 后划</span>
        <span><kbd>A</kbd><kbd>D</kbd> 转向 · 松开停船</span>
        <span><kbd>F</kbd> 靠码头下船</span>
      </> : <>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span>
        <span><kbd>Shift</kbd> 奔跑</span>
        <span><kbd>F</kbd> 互动</span>
      </>}
    </footer>
    {mode === 'fishing' ? <FishingHud /> : mode === 'rowing' ? <div className="interaction" aria-live="polite">
      <span>{landable ? '已靠近码头' : '回到木码头，停稳后下船'}</span>
      <button type="button" onClick={interact} disabled={!landable}>下船 <kbd>F</kbd></button>
    </div> : current && <div className="interaction" aria-live="polite">
      <span>发现 · {current.name}</span>
      <button type="button" onClick={interact}>{nearby === 'pond' ? '到岸边钓鱼' : nearby === 'dock' ? (boardable ? '上船' : '走到码头前端') : nearby === 'grove' ? (planted ? '看看树苗' : '种一棵树') : '探索地点'} <kbd>F</kbd></button>
    </div>}
    {message && <div className={`notice${mode === 'fishing' ? ' fishing-notice' : ''}`} role="status">
      <p>{message}</p><button type="button" onClick={dismiss} aria-label="关闭提示">×</button>
    </div>}
    <div className="draft-flag">原型阶段 · 森林与玩法持续制作中</div>
  </main>
}

export default App
