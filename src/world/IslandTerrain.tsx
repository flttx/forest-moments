import { useEffect, useMemo } from 'react'
import { noiseGLSL, islandShape, pathGLSL, groundColourGLSL, seaLevel } from './terrain'
import {pondGLSL} from './pondShape'
import {createTerrainGeometry} from './terrainGeometry'

export function IslandTerrain() {
  const geometry = useMemo(()=>createTerrainGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="island-terrain" geometry={geometry} receiveShadow>
    <meshStandardMaterial color="white" roughness={.96} onBeforeCompile={(shader) => {
      shader.vertexShader = 'varying vec3 vGround;varying vec3 vTerrainNormal;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround=position;vTerrainNormal=normal;')
      shader.fragmentShader = `varying vec3 vGround;varying vec3 vTerrainNormal;\n${noiseGLSL}
${pathGLSL}
${pondGLSL}
${groundColourGLSL}\n` + shader.fragmentShader
      shader.fragmentShader=`
        float stoneHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float stoneNoise(vec3 p){
          vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(stoneHash(i),stoneHash(i+vec3(1,0,0)),f.x),mix(stoneHash(i+vec3(0,1,0)),stoneHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(stoneHash(i+vec3(0,0,1)),stoneHash(i+vec3(1,0,1)),f.x),mix(stoneHash(i+vec3(0,1,1)),stoneHash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
      `+shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        vec2 p=vGround.xz;
        float broad=noise21(p*.38), fleck=noise21(p*14.0);
        vec3 grass=groundColour(p);
        float track=pathAt(p);
        float edge=pathEdgeAt(p);
        float path=1.0-smoothstep(-.09,.20,edge);
        path *= 1.0-smoothstep(33.0,35.0,length(p));
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
        float stream=1.0-smoothstep(.7,2.2,length(vec2(max(-44.0-p.x,max(0.0,p.x+10.0)),p.y+18.0-2.0*sin(clamp(p.x,-44.0,-10.0)*.1))));
        colour=mix(colour,soil*.8,stream);
        float bank=1.0-smoothstep(-.05,.4,pondEdgeAt(p)+(noise21(p*3.0)-.5)*.12);
        vec3 dampSoil=mix(soil*.7,grass*.78,smoothstep(.2,.8,noise21(p*1.7))*.5);
        colour=mix(colour,dampSoil,bank);
        float sand=smoothstep(${(islandShape.plateauRadius+.2).toFixed(1)},${(islandShape.plateauRadius+1.5).toFixed(1)}+(coastAt(p)-${islandShape.coastRadius.toFixed(1)})*.4,length(p)+(broad-.5)*.7);
        float beach=(1.0-smoothstep(6.0,10.5,abs(p.y)))*smoothstep(31.0,35.0,p.x+(broad-.5)*.8);
        float southBeach=smoothstep(22.0,30.0,p.y)*smoothstep(14.0,29.0,length(p))*(1.0-smoothstep(1.0,2.5,vGround.y));
        // Coastal sand only on low ground: cliff tops keep a grass turf right up to the edge.
        sand*=1.0-smoothstep(.6,1.6,vGround.y+(broad-.5)*.5);
        sand=max(sand,max(beach,southBeach));
        colour=mix(colour,vec3(.52,.43,.28)*( .92+fleck*.12),sand);
        // Darker, cooler wet sand just above the tide line, with a ragged upper edge.
        float wet=(1.0-smoothstep(${(seaLevel+.3).toFixed(2)},${(seaLevel+.48).toFixed(2)},vGround.y+(broad-.5)*.18))*sand;
        colour=mix(colour,vec3(.27,.23,.17)*(.92+fleck*.1),wet*.8);
        vec3 groundNormal=normalize(vTerrainNormal);
        // Steep faces stay rock right down to the waterline instead of a strip of sand under the cliff.
        float cliff=smoothstep(.32,.7,1.0-abs(groundNormal.y))*smoothstep(${(seaLevel-.1).toFixed(2)},${(seaLevel+.4).toFixed(2)},vGround.y);
        // Broken, broad mineral patches replace the evenly repeating horizontal bands.
        float stoneWarp=stoneNoise(vGround*.31);
        float mineral=stoneNoise(vGround*.63+stoneWarp*1.8);
        float fineStone=stoneNoise(vGround*7.0+stoneWarp);
        vec3 rock=mix(vec3(.13,.125,.11),vec3(.2,.19,.16),smoothstep(.15,.85,mineral));
        float fissure=1.0-smoothstep(.015,.055,abs(stoneNoise(vGround*vec3(1.1,.22,1.1)+stoneWarp*.6)-.5));
        rock*=.94+fineStone*.09-fissure*.075;
        float moss=smoothstep(.38,.72,groundNormal.y)*smoothstep(.4,.7,noise21(p*.9+vGround.y*.2));
        rock=mix(rock,grass*.72,moss*.4);
        rock*=mix(.7,1.0,smoothstep(-.55,.6,vGround.y));
        colour=mix(colour,rock,cliff);
        colour*=mix(.68,1.0,smoothstep(-.95,-.35,vGround.y));
        diffuseColor.rgb *= colour;
      `)
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
        #include <normal_fragment_maps>
        float earthMask=(1.0-smoothstep(-.1,.25,pathEdgeAt(vGround.xz)))*(1.0-smoothstep(34.0,35.0,length(vGround.xz)));
        float earthBump=(noise21(vGround.xz*4.0)*.024+noise21(vGround.xz*15.0)*.009)*earthMask;
        earthBump+=stoneNoise(vGround*3.0)*.025*cliff;
        vec3 earthQx=dFdx(-vViewPosition),earthQy=dFdy(-vViewPosition);
        vec3 earthRx=cross(earthQy,normal),earthRy=cross(normal,earthQx);
        float earthDet=dot(earthQx,earthRx);
        normal=normalize(abs(earthDet)*normal-sign(earthDet)*(dFdx(earthBump)*earthRx+dFdy(earthBump)*earthRy));
      `)
    }} />
  </mesh>
}
