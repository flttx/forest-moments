import {useFrame} from '@react-three/fiber'
import {usePhotoStore} from '../game/photoStore'

/**
 * Reads the canvas right after the frame is composed, in the same task, so the picture is what is on screen
 * (the drawing buffer is not preserved between frames).
 */
export function PhotoCapture(){
 useFrame(({gl})=>{
  if(!usePhotoStore.getState().takePending())return
  const canvas=gl.domElement,{width,height}=canvas
  canvas.toBlob(blob=>void usePhotoStore.getState().finish(blob,width,height),'image/png')
 },3)
 return null
}
