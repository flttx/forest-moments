import { useForestStore } from './game/store'
import { ForestWorld } from './world/ForestWorld'
import { AssetLoadingNotice, WorldErrorBoundary } from './world/ModelAsset'
import {BoatTransferOverlay} from './BoatTransferOverlay'
import {Hud} from './Hud'
import './App.css'

function App() {
  const islandOverview=useForestStore(s=>s.islandOverview)
  const mode=useForestStore(s=>s.mode)
  return <main className={`app-shell${islandOverview?' island-overview':''}${mode==='sleeping'?' sleeping':''}`}>
    <div className="world"><WorldErrorBoundary><ForestWorld /></WorldErrorBoundary></div>
    <AssetLoadingNotice />
    <BoatTransferOverlay/>
    <Hud/>
  </main>
}

export default App
