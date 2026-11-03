#version 300 es
// Shared world material: tri-planar texture-array lookup with height-channel bumps, sun shadows marched
// through the occlusion height map (uOcc) plus up to 8 sphere occluders, up to 16 point lights.
// uMode 0 = surface (sun), 1 = base (banded point lights and fog). uFl is the per-mesh hit flash (0-1).
// L_ROCK and L_MACRO are injected defines.
precision highp float;precision highp sampler2DArray;
uniform sampler2DArray uA,uE;uniform sampler2D uOcc;
uniform vec3 uCam,uSun,uFog;uniform float uT,uFogD,uFl;uniform int uMode,uNL;
uniform vec4 uL[16],uLC[16],uSph[8];uniform mat3 uRot;
in vec3 vW,vO,vN,vNo;flat in vec4 vM;out vec4 o;
float occ(vec2 p){return textureLod(uOcc,(p+256.5)/512.,0.).r;}
float sunVis(vec3 p,float t0){
 for(int i=0;i<8;i++){vec3 q=p-uSph[i].xyz;float b=dot(q,uSun),c=dot(q,q)-uSph[i].w*uSph[i].w;if(c>0.&&b<0.&&b*b>c)return 0.;}
 float t=t0;for(int i=0;i<64;i++){vec3 q=p+uSun*t;if(occ(q.xz)>q.y+.04)return 0.;t=t*1.08+.06;if(t>130.)break;}return 1.;}
void main(){
 int f=int(vM.w+.5);float L=vM.x,s=vM.y;vec3 V=normalize(uCam-vW),Ng=normalize(vN);
 vec3 Nf=normalize(cross(dFdx(vW),dFdy(vW)));vec3 N=(f&1)!=0?Nf:Ng;if(dot(N,V)<0.)N=-N;
 vec3 an=abs(vNo);int ax=an.x>an.y&&an.x>an.z?0:an.y>an.z?1:2;
 vec2 uv=(ax==0?vO.zy:ax==1?vO.xz:vO.xy)*s;
 vec4 A=texture(uA,vec3(uv,L));vec3 E=texture(uE,vec3(uv,L)).rgb;
 float e=max(1./256.,max(length(dFdx(uv)),length(dFdy(uv))));
 float hx=texture(uA,vec3(uv+vec2(e,0.),L)).a,hy=texture(uA,vec3(uv+vec2(0.,e),L)).a;
 vec2 g=vec2(hx-A.a,hy-A.a)/e;
 vec4 R=texture(uA,vec3(uv*.61,L_ROCK)),A2=texture(uA,vec3(uv*.237+.31,L));float mac=texture(uA,vec3(vW.xz/96.,L_MACRO)).r;
 if((f&2)!=0){A.rgb=mix(A.rgb,A2.rgb,.45)*mix(.62,1.25,mac);A=mix(A,R,smoothstep(.82,.6,Ng.y));}
 vec3 T=ax==0?vec3(0,0,1):vec3(1,0,0),B=ax==1?vec3(0,0,1):vec3(0,1,0);
 N=normalize(N-.022*(uRot*(g.x*T+g.y*B)));
 vec3 dl=vec3(0),sp=vec3(0);
 for(int i=0;i<16;i++){if(i>=uNL)break;vec3 d=uL[i].xyz-vW;float r=length(d),k=max(0.,1.-r/uL[i].w);d/=r;vec3 lc=uLC[i].rgb*k*k;
  dl+=lc*max(dot(N,d),0.);sp+=lc*pow(max(dot(N,normalize(d+V)),0.),40.);}
 float wet=(f&64)!=0?1.:0.;
 vec3 col;
 if(uMode==0){
  float mu0=max(dot(N,uSun),0.),mu=max(dot(N,V),.05);
  float vis=mu0>0.&&(f&32)==0?sunVis(vW+Ng*.04,(f&1)!=0?1.:.3):0.; // flag 32: never sunlit (the cabin's inside)
  float df=(f&2)!=0?mix(mu0,2.*mu0/(mu0+mu),.6):mu0;
  vec3 sun=vec3(1.,.96,.9)*1.55;
  col=A.rgb*(sun*df*vis+vec3(.018,.024,.04)+dl);
  vec3 h=normalize(uSun+V);
  if((f&4)!=0)col=col*vec3(1.,.8,.45)+sun*vis*pow(max(dot(N,h),0.),48.)*vec3(.8,.55,.15)*.9;
  col+=wet*(sun*vis*pow(max(dot(N,h),0.),60.)*.35+sp*.4);
 }else{
  vec3 Lt=vec3(.012,.013,.012)+dl;Lt=floor(Lt*14.+.5)/14.;col=A.rgb*Lt+wet*sp*.4;
 }
 col+=E*vM.z*((f&16)!=0?.65+.35*sin(uT*3.1+vW.y*1.3):1.);
 col+=uFl*vec3(.9,.75,.5);
 if(uMode==1)col=mix(uFog,col,exp(-length(uCam-vW)*uFogD));
 o=vec4(col,1.);}
