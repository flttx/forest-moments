import { useEffect } from 'react'
import { useForestStore } from './game/store'
import { installAudio } from './audio/audioStore'
import { installJournal } from './game/journalStore'
import { ForestWorld } from './world/ForestWorld'
import { WorldErrorBoundary } from './world/ModelAsset'
import {LoadingScreen} from './LoadingScreen'
import {BoatTransferOverlay} from './BoatTransferOverlay'
import {Hud} from './Hud'
import './App.css'

function App() {
  const islandOverview=useForestStore(s=>s.islandOverview)
  const mode=useForestStore(s=>s.mode)
  // Audio stays locked until the first click or key press, as browsers require.
  useEffect(()=>installAudio(),[])
  useEffect(()=>installJournal(),[])
  return <main className={`app-shell${islandOverview?' island-overview':''}${mode==='sleeping'?' sleeping':''}`}>
    <div className="world"><WorldErrorBoundary><ForestWorld /></WorldErrorBoundary></div>
    <LoadingScreen />
    <BoatTransferOverlay/>
    <Hud/>
  </main>
}

export default App
