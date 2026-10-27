import { useEffect } from 'react'
import { useForestStore } from './game/store'
import { installAudio } from './audio/audioStore'
import { installJournal } from './game/journalStore'
import { installInventory } from './game/inventoryStore'
import { setMadeFurniture } from './game/furniture'
import { madeOf } from './game/recipes'
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
  useEffect(()=>installInventory(),[])
  // Finished workshop pieces block walking where they stand.
  useEffect(()=>{setMadeFurniture(madeOf(useForestStore.getState().workshopBook));return useForestStore.subscribe((s,p)=>{if(s.workshopBook!==p.workshopBook)setMadeFurniture(madeOf(s.workshopBook))})},[])
  return <main className={`app-shell${islandOverview?' island-overview':''}${mode==='sleeping'?' sleeping':''}`}>
    <div className="world"><WorldErrorBoundary><ForestWorld /></WorldErrorBoundary></div>
    <LoadingScreen />
    <BoatTransferOverlay/>
    <Hud/>
  </main>
}

export default App
