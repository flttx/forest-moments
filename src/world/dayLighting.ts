import {Color,Vector3,MathUtils} from 'three'
// Warm horizon at the sun crossing, followed by blue hour; all values interpolate in linear light.
const keys=[
 {at:0,top:'#111e36',horizon:'#394d64',sun:'#ff9c61',light:'#ff975c',sea:'#203b50',power:0,fill:.65,environment:.23},
 {at:.13,top:'#293552',horizon:'#817280',sun:'#ff8a50',light:'#ff975c',sea:'#2b4659',power:0,fill:.7,environment:.27},
 {at:.30,top:'#65748f',horizon:'#eea06e',sun:'#ffb062',light:'#ffb878',sea:'#385c68',power:1.0,fill:.82,environment:.36},
 {at:.58,top:'#8396ae',horizon:'#f2c79d',sun:'#ffdb9e',light:'#ffd49e',sea:'#377487',power:1.85,fill:.98,environment:.46},
 {at:1,top:'#6e9cb2',horizon:'#c4d6d6',sun:'#fff0ce',light:'#ffe4b8',sea:'#286879',power:2.5,fill:1.1,environment:.55},
] as const
export function dayLighting(value:number,rising=false){
 const d=MathUtils.clamp(value,0,1),hi=keys.findIndex(k=>k.at>=d),b=keys[Math.max(1,hi)],a=keys[Math.max(0,hi-1)],t=(d-a.at)/(b.at-a.at)
 const colour=(key:'top'|'horizon'|'sun'|'light'|'sea')=>new Color(a[key]).lerp(new Color(b[key]),t)
 const number=(key:'power'|'fill'|'environment')=>MathUtils.lerp(a[key],b[key],t)
 const side=rising?1:-1,sunPosition=new Vector3(side*(36-8*d),-8+38*d,side*(34-8*d))
 return{top:colour('top'),horizon:colour('horizon'),sun:colour('sun'),light:colour('light'),sea:colour('sea'),power:number('power'),fill:number('fill'),environment:number('environment'),sunPosition,night:1-MathUtils.smoothstep(d,.04,.4),disc:MathUtils.smoothstep(sunPosition.y,-1.8,.4)}
}
