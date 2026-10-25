import {Color,Vector3,MathUtils} from 'three'
// Warm horizon at the sun crossing, followed by blue hour; all values interpolate in linear light.
// Sky colours pass through the ACES composer pass, so day blues are set deeper than they display.
// sky/ground tint the hemisphere fill: cool shade against warm key keeps day, dusk and night distinct.
const keys=[
 {at:0,top:'#111e36',horizon:'#394d64',sun:'#ff9c61',light:'#ff975c',sea:'#1a3349',sky:'#4a6590',ground:'#141a22',power:0,fill:.62,environment:.16},
 {at:.13,top:'#293552',horizon:'#817280',sun:'#ff8a50',light:'#ff975c',sea:'#2b4659',sky:'#5d6d93',ground:'#2a2224',power:0,fill:.55,environment:.2},
 {at:.30,top:'#65748f',horizon:'#eea06e',sun:'#ffb062',light:'#ffa35c',sea:'#385c68',sky:'#8e93b8',ground:'#4c3a2c',power:1.65,fill:.5,environment:.26},
 {at:.58,top:'#6f8cb2',horizon:'#f2c79d',sun:'#ffdb9e',light:'#ffcf94',sea:'#377487',sky:'#b4c6d8',ground:'#5a4c34',power:2.3,fill:.62,environment:.34},
 {at:1,top:'#4f8bbd',horizon:'#b6d2de',sun:'#fff0ce',light:'#ffe8c2',sea:'#286879',sky:'#cde2ee',ground:'#5e5538',power:2.9,fill:.72,environment:.4},
] as const
type ColourKey='top'|'horizon'|'sun'|'light'|'sea'|'sky'|'ground'
export function dayLighting(value:number,rising=false){
 const d=MathUtils.clamp(value,0,1),hi=keys.findIndex(k=>k.at>=d),b=keys[Math.max(1,hi)],a=keys[Math.max(0,hi-1)],t=(d-a.at)/(b.at-a.at)
 const colour=(key:ColourKey)=>new Color(a[key]).lerp(new Color(b[key]),t)
 const number=(key:'power'|'fill'|'environment')=>MathUtils.lerp(a[key],b[key],t)
 // The eased arc lifts the dusk sun to about 10 degrees so it still casts long, readable shadows.
 const side=rising?1:-1,sunPosition=new Vector3(side*(36-8*d),-8+38*Math.pow(d,.75),side*(34-8*d))
 // Distant sea seen through haze: shared by ocean fog and the sky below the horizon line, so the two meet without a band.
 const haze=colour('sea').lerp(colour('horizon'),.45)
 return{haze,top:colour('top'),horizon:colour('horizon'),sun:colour('sun'),light:colour('light'),sea:colour('sea'),sky:colour('sky'),ground:colour('ground'),power:number('power'),fill:number('fill'),environment:number('environment'),sunPosition,night:1-MathUtils.smoothstep(d,.04,.4),disc:MathUtils.smoothstep(sunPosition.y,-1.8,.4)}
}
