import { useEffect, useMemo } from 'react'
import { noiseGLSL, islandShape, pathGLSL, groundColourGLSL } from './terrain'
import {pondGLSL} from './pondShape'
import {createTerrainGeometry} from './terrainGeometry'

export function IslandTerrain() {
  const geometry = useMemo(()=>createTerrainGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="island-terrain" geometry={geometry} receiveShadow>
    <meshStandardMaterial color="white" roughness={.96} onBeforeCompile={(shader) => {
      shader.vertexShader = 'varying vec3 vGround;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;')
      shader.fragmentShader = `varying vec3 vGround;\n${noiseGLSL}
${pathGLSL}
${pondGLSL}
${groundColourGLSL}\n` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        vec2 p=vGround.xz;
        float broad=noise21(p*.38), fleck=noise21(p*14.0);
        vec3 grass=groundColour(p);
        float track=pathAt(p);
        float edge=pathEdgeAt(p);
        float path=1.0-smoothstep(-.09,.20,edge);
        path *= 1.0-smoothstep(21.0,23.0,length(p));
        vec2 soilWarp=p+vec2(noise21(p*.8),noise21(p*.8+8.0))*.22;
        float earth=noise21(soilWarp*2.6),grain=noise21(p*32.0);
        vec3 soil=mix(vec3(.19,.125,.072),vec3(.34,.245,.145),earth*.7+noise21(p*.55)*.3);
        soil*=.83+grain*.27;
        // Exposed compacted earth and irregular mossy shoulders, without a uniform painted border.
        soil+=vec3(.023,.018,.010)*(1.0-smoothstep(.0,.65,track));
        float crumbs=smoothstep(.66,.83,noise21(soilWarp*14.0));
        soil=mix(soil,vec3(.38,.32,.23),crumbs*.32);
        soil=mix(soil,grass*.8,smoothstep(-.35,.22,edge)*noise21(p*5.0)*.55);
        vec3 colour=mix(grass,soil,path);
        float bank=1.0-smoothstep(-.05,.4,pondEdgeAt(p)+(noise21(p*3.0)-.5)*.12);
        vec3 dampSoil=mix(soil*.7,grass*.78,smoothstep(.2,.8,noise21(p*1.7))*.5);
        colour=mix(colour,dampSoil,bank);
        float sand=smoothstep(${(islandShape.plateauRadius+.2).toFixed(1)},${(islandShape.plateauRadius+1.5).toFixed(1)}+(coastAt(p)-${islandShape.coastRadius.toFixed(1)})*.4,length(p)+(broad-.5)*.7);
        float beach=(1.0-smoothstep(4.0,7.5,abs(p.y)))*smoothstep(20.0,23.0,p.x+(broad-.5)*.8);
        sand=max(sand,beach);
        colour=mix(colour,vec3(.52,.43,.28)*( .92+fleck*.12),sand);
        colour*=mix(.68,1.0,smoothstep(-.95,-.35,vGround.y));
        diffuseColor.rgb *= colour;
      `)
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
        #include <normal_fragment_maps>
        float earthMask=(1.0-smoothstep(-.1,.25,pathEdgeAt(vGround.xz)))*(1.0-smoothstep(22.0,23.0,length(vGround.xz)));
        float earthBump=(noise21(vGround.xz*4.0)*.024+noise21(vGround.xz*15.0)*.009)*earthMask;
        vec3 earthQx=dFdx(-vViewPosition),earthQy=dFdy(-vViewPosition);
        vec3 earthRx=cross(earthQy,normal),earthRy=cross(normal,earthQx);
        float earthDet=dot(earthQx,earthRx);
        normal=normalize(abs(earthDet)*normal-sign(earthDet)*(dFdx(earthBump)*earthRx+dFdy(earthBump)*earthRy));
      `)
    }} />
  </mesh>
}
