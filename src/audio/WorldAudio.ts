/**
 * The island's WebAudio engine, ported from my-blog (src/world/audio/WorldAudio.ts). Created on the first user input
 * (browsers keep audio locked until then), it fetches the sound list (public/assets/audio/audio.json) and decodes each
 * file the first time it is wanted. Music, ambience and effects buses sit under a master gain; the ambience runs through
 * a low-pass that closes indoors. Recorded loops repeat with a crossfade so MP3 padding never clicks; wind, the indoor
 * room tone and the campfire crackle are synthesised from noise.
 */
import {busLevel,type AudioBus,type AudioSettings,type Mix} from './audioMix'

interface SoundEntry{file:string;kind:'ambience'|'music'|'sfx';seconds:number}
interface AudioList{version:1;sounds:Record<string,SoundEntry>}
export interface PlayOptions{volume?:number;rate?:number;at?:{x:number;y:number;z:number}}

const listUrl='/assets/audio/audio.json'
const crossfade=2.5,smooth=.6

function isAudioList(value:unknown):value is AudioList{
 if(typeof value!=='object'||value===null||(value as AudioList).version!==1)return false
 const sounds=(value as AudioList).sounds
 return typeof sounds==='object'&&sounds!==null&&Object.values(sounds).every(e=>typeof e?.file==='string'&&e.file.startsWith('/assets/audio/')&&typeof e.seconds==='number')
}

/** A recorded loop: overlapping copies of the buffer, each faded in and out over the crossfade. */
class LoopVoice{
 readonly gain:GainNode
 private readonly ctx:AudioContext
 private readonly buffer:AudioBuffer
 private nextStart=0
 private playing=false
 constructor(ctx:AudioContext,buffer:AudioBuffer,destination:AudioNode){
  this.ctx=ctx;this.buffer=buffer
  this.gain=ctx.createGain();this.gain.gain.value=0;this.gain.connect(destination)
 }
 /** Keeps copies scheduled a little ahead while the loop is audible. */
 pump(level:number){
  const now=this.ctx.currentTime
  if(level<=.001){this.playing=false;return}
  if(!this.playing){this.playing=true;this.nextStart=now+.05}
  while(this.nextStart<now+1.5)this.nextStart=this.copyAt(this.nextStart)
 }
 private copyAt(start:number){
  const duration=this.buffer.duration,fade=Math.min(crossfade,duration/4)
  const source=this.ctx.createBufferSource();source.buffer=this.buffer
  const envelope=this.ctx.createGain()
  envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+fade)
  envelope.gain.setValueAtTime(1,start+duration-fade);envelope.gain.linearRampToValueAtTime(0,start+duration)
  source.connect(envelope).connect(this.gain);source.start(start);source.onended=()=>envelope.disconnect()
  return start+duration-fade
 }
}

/** Noise for the synthesised beds: white, integrated toward brown, or a fire's low roar under sparse decaying crackles. */
function noiseBuffer(ctx:AudioContext,seconds:number,kind:'white'|'brown'|'fire'){
 const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate),data=buffer.getChannelData(0)
 let last=0
 for(let i=0;i<data.length;i++){
  const white=Math.random()*2-1
  last=(last+.02*white)/1.02
  data[i]=kind==='white'?white:kind==='brown'?last*3.5:last*1.2
 }
 if(kind==='fire'){
  // about nine pops a second, 3-25 ms each, with random strength
  for(let n=0;n<seconds*9;n++){
   const at=Math.floor(Math.random()*data.length),length=Math.floor(ctx.sampleRate*(.003+Math.random()*.022)),strength=.25+Math.random()*.75
   for(let i=0;i<length&&at+i<data.length;i++)data[at+i]+=(Math.random()*2-1)*strength*Math.exp(-6*i/length)
  }
 }
 return buffer
}

export class WorldAudio{
 readonly ctx:AudioContext
 private readonly master:GainNode
 private readonly buses:Record<AudioBus,GainNode>
 private readonly muffle:BiquadFilterNode
 private list:AudioList|null=null
 private readonly buffers=new Map<string,Promise<AudioBuffer|null>>()
 private readonly loops=new Map<string,LoopVoice>()
 private readonly levels=new Map<string,number>()
 private readonly pendingLoops=new Set<string>()
 private readonly beds:Record<'wind'|'room'|'fire',GainNode>
 private disposed=false

 private constructor(ctx:AudioContext){
  this.ctx=ctx
  this.master=ctx.createGain();this.master.connect(ctx.destination)
  this.muffle=ctx.createBiquadFilter();this.muffle.type='lowpass';this.muffle.frequency.value=18000;this.muffle.connect(this.master)
  this.buses={music:ctx.createGain(),ambience:ctx.createGain(),effects:ctx.createGain()}
  this.buses.music.connect(this.master);this.buses.ambience.connect(this.muffle);this.buses.effects.connect(this.master)
  this.beds={wind:this.bed('wind'),room:this.bed('room'),fire:this.bed('fire')}
 }

 /** Null where WebAudio is missing. Call from a user gesture. */
 static create():WorldAudio|null{
  const Context=typeof window!=='undefined'?window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext:undefined
  if(!Context)return null
  try{const audio=new WorldAudio(new Context());void audio.ctx.resume().catch(()=>{});return audio}catch{return null}
 }

 private bed(kind:'wind'|'room'|'fire'){
  const ctx=this.ctx,source=ctx.createBufferSource()
  source.buffer=noiseBuffer(ctx,kind==='fire'?5.7:4.3,kind==='fire'?'fire':'brown');source.loop=true
  const gain=ctx.createGain();gain.gain.value=0
  let node:AudioNode=source
  if(kind==='wind'){
   const band=ctx.createBiquadFilter();band.type='bandpass';band.frequency.value=520;band.Q.value=.6
   // slow gusts: an LFO on the filter and on the level
   const lfo=ctx.createOscillator();lfo.frequency.value=.07
   const depth=ctx.createGain();depth.gain.value=260;lfo.connect(depth).connect(band.frequency)
   const swell=ctx.createGain();swell.gain.value=.7
   const swellLfo=ctx.createOscillator();swellLfo.frequency.value=.11
   const swellDepth=ctx.createGain();swellDepth.gain.value=.3;swellLfo.connect(swellDepth).connect(swell.gain)
   lfo.start();swellLfo.start()
   node=node.connect(band).connect(swell)
  }else if(kind==='room'){
   const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=180
   const trim=ctx.createGain();trim.gain.value=.5
   node=node.connect(low).connect(trim)
  }else{
   const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=180
   const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=5200
   node=node.connect(high).connect(low)
  }
  node.connect(gain).connect(this.buses.ambience);source.start()
  return gain
 }

 /** Fetches the sound list once; failures leave the island silent. */
 async load(){
  if(this.list)return
  try{
   const response=await fetch(listUrl);if(!response.ok)return
   const value:unknown=await response.json();if(isAudioList(value))this.list=value
  }catch{/* no sound list: the island stays silent */}
 }
 get ready(){return Boolean(this.list)}

 private buffer(name:string):Promise<AudioBuffer|null>{
  const known=this.buffers.get(name);if(known)return known
  const entry=this.list?.sounds[name]
  const pending=entry?fetch(entry.file).then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error(`HTTP ${r.status}`))).then(data=>this.ctx.decodeAudioData(data)).catch(()=>null):Promise.resolve(null)
  this.buffers.set(name,pending)
  return pending
 }
 /** Decodes sounds ahead of their first use. */
 preload(names:readonly string[]){for(const name of names)void this.buffer(name)}

 applySettings(settings:AudioSettings){
  const t=this.ctx.currentTime
  for(const bus of ['music','ambience','effects'] as const)this.buses[bus].gain.setTargetAtTime(busLevel(settings,bus),t,.1)
 }

 /** Follows the island's mix: loop and bed levels, the indoor muffle. */
 applyMix(mix:Mix){
  const t=this.ctx.currentTime
  const loops:[string,number,AudioBus,number][]=[['amb-birds',mix.birds,'ambience',.9],['amb-crickets',mix.crickets,'ambience',.8],['amb-sea',mix.sea,'ambience',1],['music-day',mix.musicDay,'music',1],['music-night',mix.musicNight,'music',1]]
  for(const [name,level,bus,trim] of loops)this.loop(name,level*trim,bus)
  this.beds.wind.gain.setTargetAtTime(mix.wind*.5,t,smooth)
  this.beds.room.gain.setTargetAtTime(mix.room*.12,t,smooth)
  this.beds.fire.gain.setTargetAtTime(mix.fire*.35,t,smooth)
  this.muffle.frequency.setTargetAtTime(mix.ambienceCutoff,t,.3)
 }

 private loop(name:string,level:number,bus:AudioBus){
  const voice=this.loops.get(name)
  if(voice){
   if(Math.abs((this.levels.get(name)??-1)-level)>.005){voice.gain.gain.setTargetAtTime(level,this.ctx.currentTime,name.startsWith('music')?1.5:smooth);this.levels.set(name,level)}
   voice.pump(level);return
  }
  // not started yet: begin once it is first heard, and only once
  if(level<=.001||this.pendingLoops.has(name))return
  this.pendingLoops.add(name)
  void this.buffer(name).then(buffer=>{if(!buffer||this.disposed||this.loops.has(name))return;this.loops.set(name,new LoopVoice(this.ctx,buffer,this.buses[bus]))})
 }

 /** Plays a one-shot; with `at`, positioned in the world (the listener is the camera). */
 play(name:string,options:PlayOptions={}){
  if(!this.list||this.ctx.state!=='running')return
  void this.buffer(name).then(buffer=>{
   if(!buffer||this.disposed)return
   const source=this.ctx.createBufferSource();source.buffer=buffer;source.playbackRate.value=options.rate??1
   const gain=this.ctx.createGain();gain.gain.value=options.volume??1
   let tail:AudioNode=source.connect(gain)
   if(options.at){
    const panner=this.ctx.createPanner()
    panner.panningModel='equalpower';panner.distanceModel='inverse';panner.refDistance=2.5;panner.rolloffFactor=1.3;panner.maxDistance=60
    panner.positionX.value=options.at.x;panner.positionY.value=options.at.y;panner.positionZ.value=options.at.z
    tail=tail.connect(panner)
   }
   tail.connect(this.buses.effects);source.start();source.onended=()=>tail.disconnect()
  })
 }

 /** Moves the listener to the camera. */
 setListener(p:{x:number;y:number;z:number},f:{x:number;y:number;z:number}){
  const listener=this.ctx.listener
  if(listener.positionX){
   const t=this.ctx.currentTime
   listener.positionX.setValueAtTime(p.x,t);listener.positionY.setValueAtTime(p.y,t);listener.positionZ.setValueAtTime(p.z,t)
   listener.forwardX.setValueAtTime(f.x,t);listener.forwardY.setValueAtTime(f.y,t);listener.forwardZ.setValueAtTime(f.z,t)
   listener.upX.setValueAtTime(0,t);listener.upY.setValueAtTime(1,t);listener.upZ.setValueAtTime(0,t)
  }else{listener.setPosition(p.x,p.y,p.z);listener.setOrientation(f.x,f.y,f.z,0,1,0)}
 }

 /** A hidden tab goes quiet (and costs nothing); coming back resumes. */
 setActive(active:boolean){if(active)void this.ctx.resume().catch(()=>{});else void this.ctx.suspend().catch(()=>{})}
 dispose(){this.disposed=true;void this.ctx.close().catch(()=>{})}
}
