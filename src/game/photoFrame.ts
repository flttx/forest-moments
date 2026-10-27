import type {FrameId} from './photo'
import type {StampId} from './journal'

const paper='#f8f2e4',ink='#2f4632',soft='#5d6a53',amber='#8f5d1f',line='#cbbd9f'
const seal:Record<StampId,string>={pine:'松',koi:'鲤',flame:'火',feather:'羽',boat:'船',moon:'月'}
const face='"LXGW WenKai UI", "KaiTi", serif'

const load=(blob:Blob)=>new Promise<HTMLImageElement>((resolve,reject)=>{
 const url=URL.createObjectURL(blob),img=new Image()
 img.onload=()=>{URL.revokeObjectURL(url);resolve(img)}
 img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image'))}
 img.src=url
})

/** The date the way it is written under a snapshot: 2026-10-27. */
export const captionDate=(at:Date)=>`${at.getFullYear()}-${String(at.getMonth()+1).padStart(2,'0')}-${String(at.getDate()).padStart(2,'0')}`
/** Border widths for a picture of this size: even sides, a wider foot for the caption. */
export const frameMetrics=(width:number,height:number)=>{
 const side=Math.round(Math.min(width,height)*.04),foot=Math.round(side*3.2)
 return{side,foot,width:width+side*2,height:height+side+foot}
}

/** Puts the picture on a paper mount with the title and date; the stamp mount also shows every stamp earned so far. */
export async function composeFrame(image:Blob,frame:FrameId,stamps:readonly StampId[],at:Date,title:string):Promise<Blob>{
 if(frame==='none')return image
 const img=await load(image),{side,foot,width,height}=frameMetrics(img.width,img.height)
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const g=canvas.getContext('2d');if(!g)throw new Error('2d')
 if(document.fonts)await document.fonts.load(`${Math.round(foot*.34)}px "LXGW WenKai UI"`,title).catch(()=>[])
 g.fillStyle=paper;g.fillRect(0,0,canvas.width,canvas.height)
 g.drawImage(img,side,side)
 g.strokeStyle=line;g.lineWidth=Math.max(1,side*.06);g.strokeRect(side-g.lineWidth,side-g.lineWidth,img.width+g.lineWidth*2,img.height+g.lineWidth*2)
 const base=canvas.height-foot*.36,size=Math.round(foot*.34)
 g.textBaseline='alphabetic';g.textAlign='right';g.fillStyle=ink;g.font=`500 ${size}px ${face}`
 g.fillText(title,canvas.width-side,base)
 g.fillStyle=soft;g.font=`400 ${Math.round(size*.62)}px ${face}`
 g.fillText(captionDate(at),canvas.width-side,base-size*1.05)
 if(frame==='stamps'){
  const r=Math.min(foot*.34,side*1.4),gap=r*.5
  const shown=stamps.slice(-Math.floor((canvas.width*.6-side*2)/(r*2+gap)))
  shown.forEach((id,i)=>{
   const cx=side+r+i*(r*2+gap),cy=canvas.height-foot*.5
   g.save();g.translate(cx,cy);g.rotate(((i*37)%11-5)*.025)
   g.strokeStyle=amber;g.lineWidth=Math.max(1.5,r*.1);g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke()
   g.fillStyle=amber;g.textAlign='center';g.textBaseline='middle';g.font=`500 ${Math.round(r*1.15)}px ${face}`;g.fillText(seal[id],0,r*.05)
   g.restore()
  })
 }
 return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('png')),'image/png'))
}
