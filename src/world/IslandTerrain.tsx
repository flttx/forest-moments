import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { noiseGLSL, terrainHeight } from './terrain'

export function IslandTerrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(50, 50, 200, 200).rotateX(-Math.PI / 2)
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="island-terrain" geometry={geometry} receiveShadow>
    <meshStandardMaterial color="white" roughness={.96} onBeforeCompile={(shader) => {
      shader.vertexShader = 'varying vec3 vGround;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;')
      shader.fragmentShader = `varying vec3 vGround;\n${noiseGLSL}\n` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        vec2 p=vGround.xz;
        float broad=noise21(p*.38), fleck=noise21(p*14.0);
        vec3 grass=mix(vec3(.105,.175,.065),vec3(.29,.36,.13),broad);
        grass *= .92 + fleck*.16;
        float track=abs(p.x+1.7-sin(p.y*.23)*1.15);
        if(p.x < -1.5 && p.x > -8.8) track=min(track,abs(p.y-5.8-sin(p.x*.7)*.22));
        if(p.x > -1.7 && p.x < 10.8) track=min(track,abs(p.y-1.4+sin(p.x*.4)*.55));
        if(p.x > 10.2 && p.y < 1.7 && p.y > -9.7) track=min(track,abs(p.x-11.4));
        float path=1.0-smoothstep(.55,.95,track+(noise21(p*3.0)-.5)*.25);
        path *= 1.0-smoothstep(15.0,17.0,length(p));
        vec3 soil=mix(vec3(.30,.225,.13),vec3(.47,.36,.22),noise21(p*1.6));
        vec3 colour=mix(grass,soil,path);
        float bank=1.0-smoothstep(4.04,4.45,length(p-vec2(6,-5))+(broad-.5)*.15);
        colour=mix(colour,soil*.8,bank);
        float sand=smoothstep(17.2,18.5+(coastAt(p)-20.8)*.4,length(p)+(broad-.5)*.7);
        colour=mix(colour,vec3(.52,.43,.28)*( .92+fleck*.12),sand);
        colour*=mix(.68,1.0,smoothstep(-.95,-.35,vGround.y));
        diffuseColor.rgb *= colour;
      `)
    }} />
  </mesh>
}
