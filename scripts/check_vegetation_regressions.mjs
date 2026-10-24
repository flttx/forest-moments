// Reuse pond fishing checks. Sea rowing and relocated ground routes use check_coastal_gameplay.mjs / check_coastal_production.mjs.
import { readFile, writeFile, rm, rmdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createProjectTempDirectory } from './browser-session.mjs'
const allowed=['fishing','fishing_production']
const selected=process.argv.slice(2).length?process.argv.slice(2):allowed
const stage=process.env.FOREST_REGRESSION_STAGE??'release'
for(const name of selected){
  if(!allowed.includes(name))throw Error('Unknown regression '+name)
  let s=await readFile(`scripts/aholo/check_${name}_headless.mjs`,'utf8')
  // The generated runner lives in a temporary directory, not scripts/aholo.
  s=s.replace("'../browser-session.mjs'",JSON.stringify(new URL('./browser-session.mjs',import.meta.url).href))
  s=s.replace(/const out = [^\n]+/,`const out = resolve('docs/evidence/vegetation-expansion/2026-10-24/regression-${stage}-${name}')`)
  s=s.replace("'--headless=new',", "'--headless=new', '--disable-features=CalculateNativeWinOcclusion', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',")
  s=s.replace("await cmd('Page.enable'); await cmd('Runtime.enable')", "await cmd('Page.enable'); await cmd('Runtime.enable'); await cmd('Page.bringToFront'); await cmd('Emulation.setFocusEmulationEnabled',{enabled:true})")
  // Capturing a frame takes wall time: release the actual key before recording high tension.
  s=s.replace("await shot('08-high-tension');await key('Space',false)","await key('Space',false);await shot('08-high-tension')")
  s=s.replace("{await shot('04-tension-panel');shotTaken=true}","{await key('Space',false);held=false;await shot('04-tension-panel');shotTaken=true}")
  s=s.replaceAll("await cmd('Page.reload')",'await reloadPage()')
  s=s.replace('const snapshot =', `async function reloadPage(){
    const previous=await evaluate('performance.timeOrigin');await cmd('Page.reload');
    for(let i=0;i<100;i++){await sleep(50);try{if(await evaluate('performance.timeOrigin')!==previous)return}catch{/* The execution context is being replaced. */}}
    throw Error('Reload did not replace the document')
  }
  const snapshot =`)
  const directory=await createProjectTempDirectory('forest-regression-'),path=`${directory}/check_${name}.mjs`
  try{
    await writeFile(path,s)
    const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[path],{stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('exit',resolve)})
    if(code!==0)throw Error(`${name} failed: ${code}`)
  }finally{await rm(path,{force:true});await rmdir(directory)}
}
