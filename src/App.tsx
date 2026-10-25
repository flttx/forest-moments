import {HomeHud} from './HomeHud'
import {seats,seatOrigin} from './game/expansion'
import { useForestStore } from './game/store'
import { landmarks } from './game/landmarks'
import { ForestWorld } from './world/ForestWorld'
import { AssetLoadingNotice, WorldErrorBoundary } from './world/ModelAsset'
import { canBoard, canLand, seaBoundaryClearance } from './game/rowing'
import { FishBook, FishingHud } from './FishingHud'
import {GrowthStatus} from './GrowthStatus'
import {BoatTransferOverlay} from './BoatTransferOverlay'
import {LookoutHud} from './LookoutHud'
import {WorkshopHud} from './WorkshopHud'
import {canViewLookout} from './game/lookout'
import './App.css'

function App() {
  const inside=useForestStore(s=>s.location!=='island')
  const islandOverview=useForestStore(s=>s.islandOverview)
  const homeUi=useForestStore(s=>s.location==='bedroom'||s.mode==='sitting'||s.mode==='sleeping'||!!s.homeTransfer||s.nearby==='bedroom'||s.nearby==='campfire'||s.location==='island'&&s.mode==='walking'&&seats.some(v=>Math.hypot(s.position.x-seatOrigin(v).x,s.position.z-seatOrigin(v).z)<1.3))
  const nearby = useForestStore((s) => s.nearby)
  const planted = useForestStore((s) => s.planted)
  const inspectingTree=useForestStore(s=>s.inspectingTree)
  const mealActive=useForestStore(s=>s.mealActive)
  const meals=useForestStore(s=>s.farmBook.meals)
  const farmReady=useForestStore(s=>s.farmReady)
  const message = useForestStore((s) => s.message)
  const interact = useForestStore((s) => s.interact)
  const dismiss = useForestStore((s) => s.dismiss)
  const current = landmarks.find((l) => l.id === nearby)
  const mode = useForestStore((s) => s.mode)
  const transferDirection=useForestStore(s=>s.boatTransfer?.direction)
  const lookoutTransfer=useForestStore(s=>s.lookoutTransfer?.direction)
  const lookoutAvailable=useForestStore(s=>s.lookoutReady&&canViewLookout(s.position))
  const boardable = useForestStore((s) => s.boatReady && canBoard(s.position.x, s.position.z, s.boat))
  const landable = useForestStore((s) => canLand(s.boat))
  const nearSeaBoundary=useForestStore(s=>seaBoundaryClearance(s.boat.x,s.boat.z)<2)

  return <main className={`app-shell${islandOverview?' island-overview':''}${mode==='sleeping'?' sleeping':''}${mode==='lookout'||inside?' viewing-lookout':''}`}>
    <div className="world"><WorldErrorBoundary><ForestWorld /></WorldErrorBoundary></div>
    <AssetLoadingNotice />
    <BoatTransferOverlay/>
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
      <small>池塘西岸按 F 钓鱼；沿东岸沙滩到海边码头上船，可绕岛划行。渔获和树苗自动保存在本机。</small>
      <FishBook />
    </aside>
    <footer className="controls">
      <strong>{mode==='sitting'?'林间小憩':mode==='sleeping'?'小岛时光':mode==='crafting'?'木作修整':mode==='gathering'?'收集木料':lookoutTransfer?'切换观景视角':mode==='lookout'?'塔上观景':transferDirection?transferDirection==='board'?'正在上船':'正在下船':mode==='feeding'?'照顾小动物':mode==='planting'?'栽种小苗':mode === 'fishing' ? '池边垂钓' : mode === 'rowing' ? '沿岛泛舟' : inside?'室内漫步':'漫步森林'}</strong>
      {mode==='sleeping'?<span><kbd>F</kbd> / <kbd>Esc</kbd> 跳过过渡</span>:mode==='sitting'?<span><kbd>F</kbd> / <kbd>Esc</kbd> 起身</span>:mode==='gathering'?<span><kbd>Esc</kbd> 暂停收集</span>:mode==='crafting'?<span><kbd>F</kbd> 打磨 · <kbd>Esc</kbd> 暂停</span>:transferDirection||lookoutTransfer?<span>请稍候…</span>:mode==='lookout'?<><span><kbd>A</kbd><kbd>D</kbd> 环顾</span><span><kbd>W</kbd><kbd>S</kbd> 俯仰</span><span><kbd>F</kbd> / <kbd>Esc</kbd> 返回</span></>:mode==='feeding'?<span><kbd>Esc</kbd> 取消添料</span>:mode==='planting'?<span><kbd>Esc</kbd> 取消栽种</span>:mode === 'fishing' ? <><span><kbd>F</kbd> 提竿</span><span><kbd>Space</kbd> 按住收线，松开放线</span><span><kbd>Esc</kbd> 收起</span></> : mode === 'rowing' ? <>
        <span><kbd>W</kbd> 前划 <kbd>S</kbd> 后划</span>
        <span><kbd>A</kbd><kbd>D</kbd> 转向 · 松开停船</span>
        <span><kbd>F</kbd> 靠码头下船</span>
      </> : <>
        <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动</span>
        <span><kbd>Shift</kbd> 奔跑 · 按视角移动</span>
        <span>右键拖动视角 · 滚轮远近 · <kbd>Q</kbd><kbd>E</kbd> 环绕</span>
        <span><kbd>F</kbd> 互动</span>
      </>}
      {(mode==='rowing'||mode==='lookout')&&!transferDirection&&!lookoutTransfer&&<span>右键拖动视角{mode==='rowing'?' · 滚轮远近':''}</span>}
    </footer>
    {homeUi?<HomeHud/>:lookoutTransfer?<div className="interaction" role="status" data-lookout-transfer={lookoutTransfer}><span>{lookoutTransfer==='enter'?'正在进入观景视角':'正在返回塔脚'}</span><button disabled>请稍候…</button></div>:mode==='lookout'?<LookoutHud/>:transferDirection?<div className="interaction" role="status" data-boat-transfer={transferDirection}><span>{transferDirection==='board'?'坐稳后就可以出发':'正在回到码头'}</span><button disabled>{transferDirection==='board'?'上船中':'下船中'}</button></div>:mode === 'fishing' ? <FishingHud /> : mode === 'rowing' ? <div className="interaction" aria-live="polite">
      <span>{landable ? '已靠近海边泊位' : nearSeaBoundary ? '前方是远海边界，请沿岸航行' : '返回东岸码头，船身沿码头停稳后下船'}</span>
      <button type="button" onClick={interact} disabled={!landable}>下船 <kbd>F</kbd></button>
    </div> : nearby==='workshop'?<WorkshopHud/>:current && <div className="interaction" aria-live="polite">
      {nearby==='grove'?<GrowthStatus/>:nearby==='farm'?<span>{mode==='feeding'?'正在撒下谷粒 · Esc 取消':mealActive?'鸡和羊正在吃饭，请留出通道':`森林牧场 · 已喂养 ${meals} 次`}</span>:<span>发现 · {current.name}</span>}
      <button type="button" onClick={interact} disabled={mode==='planting'||mode==='feeding'||(nearby==='farm'&&(mealActive||!farmReady))}>{mode==='feeding'?'添料中':mode==='planting'?'栽种中':nearby==='lookout'?(lookoutAvailable?'进入观景':'走到东侧楼梯脚'):nearby==='farm'?(mealActive?'等它们吃完':'添一份饲料'):nearby === 'pond' ? '到岸边钓鱼' : nearby === 'dock' ? (boardable ? '上船' : '走到码头前端') : nearby === 'grove' ? (planted ? inspectingTree?'返回漫游':'看看小树' : '种一棵树') : '探索地点'} <kbd>F</kbd></button>
    </div>}
    {message && <div className={`notice${mode === 'fishing' ? ' fishing-notice' : ''}`} role="status">
      <p>{message}</p><button type="button" onClick={dismiss} aria-label="关闭提示">×</button>
    </div>}
    <div className="draft-flag">原型阶段 · 森林与玩法持续制作中</div>
  </main>
}

export default App
