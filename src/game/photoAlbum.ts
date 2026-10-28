import {photosToDrop,thumbWidth} from './photo'
import type {SubjectId} from './photoSubjects'

/**
 * The local album: the newest few photos in IndexedDB (localStorage is too small for images).
 * `subjects`: photo-task subjects the picture shows; `day`: the island day (nights slept) it was taken, for the season
 * recap. Older records have neither.
 */
export interface PhotoRecord{id:string;at:string;night:boolean;width:number;height:number;subjects?:SubjectId[];day?:number;image:Blob;thumb:Blob}
const dbName='forest-moments:photos:v1',storeName='photos'

function open():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('no indexedDB'));return}
  const request=indexedDB.open(dbName,1)
  request.onupgradeneeded=()=>{request.result.createObjectStore(storeName,{keyPath:'id'})}
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error)
 })
}
function run<T>(mode:IDBTransactionMode,job:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 return open().then(db=>new Promise<T>((resolve,reject)=>{
  const tx=db.transaction(storeName,mode),request=job(tx.objectStore(storeName))
  tx.oncomplete=()=>{db.close();resolve(request.result)}
  tx.onerror=tx.onabort=()=>{db.close();reject(tx.error)}
 }))
}

export const listPhotos=async()=>(await run('readonly',s=>s.getAll() as IDBRequest<PhotoRecord[]>)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))
export const deletePhoto=(id:string)=>run('readwrite',s=>s.delete(id)).then(()=>true)
/** Stores the photo and drops the oldest beyond the limit. Resolves false when the browser refuses storage. */
export async function savePhoto(record:PhotoRecord):Promise<boolean>{
 try{
  await run('readwrite',s=>s.put(record))
  const all=await run('readonly',s=>s.getAll() as IDBRequest<PhotoRecord[]>)
  for(const id of photosToDrop(all))await deletePhoto(id)
  return true
 }catch{return false}
}

/** A small preview of the photo; falls back to the photo itself where the browser cannot draw one. */
export async function makeThumb(image:Blob):Promise<Blob>{
 try{
  const bitmap=await createImageBitmap(image),scale=Math.min(1,thumbWidth/bitmap.width)
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale))
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
  return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('thumb')),'image/jpeg',.82))
 }catch{return image}
}
