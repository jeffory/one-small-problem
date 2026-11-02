#version 300 es
// Surface sky: sparse stars, the Earth disc (phase-lit by the sun, with land, cloud and a thin blue limb), the sun.
precision highp float;
uniform vec3 uF,uR,uU,uSun,uEarth;uniform float uTan,uAsp;in vec2 v;out vec4 o;
float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+1.),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n2(p);p*=2.1;a*=.5;}return s;}
void main(){vec2 q=v*2.-1.;vec3 d=normalize(uF+q.x*uTan*uAsp*uR+q.y*uTan*uU),c=vec3(0);
 vec3 sc=d*220.,ci=floor(sc);float hs=h(ci);if(hs>.9975&&length(fract(sc)-.5)<.35)c=vec3(.5+.5*h(ci+3.))*vec3(.85,.88,1.)*.9;
 vec3 Ed=normalize(uEarth);float R=.075;vec3 rt=normalize(cross(Ed,vec3(0,1,0))),up=cross(rt,Ed);
 vec2 xy=vec2(dot(d,rt),dot(d,up))/R;
 if(dot(d,Ed)>0.&&dot(xy,xy)<1.){float z=sqrt(1.-dot(xy,xy));vec3 n=xy.x*rt+xy.y*up-z*Ed;float li=max(dot(n,uSun),0.);
  vec2 ll=vec2(atan(n.z,n.x),asin(n.y));float land=fb(ll*vec2(1.6,2.4)+4.);
  vec3 ec=land>.56?mix(vec3(.12,.11,.05),vec3(.2,.16,.08),fb(ll*6.)):vec3(.02,.05,.16);
  ec=mix(ec,vec3(.75),smoothstep(.5,.78,fb(ll*vec2(3.,5.)+9.))*.85);
  c=ec*li*2.2+vec3(.05,.12,.35)*pow(1.-z,4.)*smoothstep(-.2,.3,dot(n,uSun))*1.5;}
 float sa=dot(d,uSun);if(sa>.99992)c=vec3(8.);c+=vec3(1.,.93,.8)*.12*pow(max(sa,0.),900.);
 o=vec4(c,1.);}
