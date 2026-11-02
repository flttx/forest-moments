/** Requires noiseGLSL. Voronoi slabs: x = per-slab tone, y = crack darkness (1 on the seam), for IT-03-style jointed rock. */
export const rockSlabGLSL=/* glsl */ `
vec2 rockSlab(vec2 p,float size){
 vec2 q=p/size+vec2(noise21(p*.35),noise21(p*.35+7.3))*.6;
 vec2 i=floor(q),f=fract(q);float d1=8.0,d2=8.0,tone=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y)),o=vec2(hash21(i+g),hash21(i+g+19.1))*.8+.1;
  float d=length(g+o-f);
  if(d<d1){d2=d1;d1=d;tone=hash21(i+g+3.7);}else if(d<d2)d2=d;
 }
 return vec2(tone,1.0-smoothstep(.03,.11,d2-d1));
}
`
