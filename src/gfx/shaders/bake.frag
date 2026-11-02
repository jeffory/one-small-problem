#version 300 es
// Texture generator: every material is a recipe evaluated once on the GPU at load. uLay is the layer index
// (see LAYER in materials.js). oA = albedo rgb + height a, oE = emissive rgb. Later plans append layers.
precision highp float;uniform int uLay;in vec2 v;
layout(location=0) out vec4 oA;layout(location=1) out vec4 oE;
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.103,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
float vn(vec2 p,vec2 P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(mod(i,P)),h21(mod(i+vec2(1,0),P)),f.x),mix(h21(mod(i+vec2(0,1),P)),h21(mod(i+1.,P)),f.x),f.y);}
float fbm(vec2 u,vec2 P,int o){float s=0.,a=.5,n=0.;vec2 p=u*P;for(int k=0;k<7;k++){if(k>=o)break;s+=a*vn(p,P);n+=a;p*=2.;P*=2.;a*=.5;}return s/n;}
vec3 wor(vec2 u,float P){vec2 p=u*P,i=floor(p),f=fract(p);float d1=9.,d2=9.,id=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),c=mod(i+g,P);float d=length(g+h22(c)-f);
  if(d<d1){d2=d1;d1=d;id=h21(c+7.3);}else if(d<d2)d2=d;}return vec3(d1,d2,id);}
vec4 panel(vec2 u,vec3 c0,vec3 c1,vec3 c2,float glow,out vec3 e){
 vec2 g=u*4.,id=floor(g),f=fract(g);float r0=h21(id+3.1);
 if(r0>.6){g=u*8.;id=floor(g)+40.;f=fract(g);}
 float r=h21(id),ed=min(min(f.x,1.-f.x),min(f.y,1.-f.y));
 float seam=smoothstep(0.,.035,ed),bev=smoothstep(0.,.1,ed),riv=0.;
 for(int k=0;k<4;k++){vec2 cn=vec2(float(k&1),float(k>>1));riv=max(riv,smoothstep(.04,.015,length(f-mix(vec2(.09),vec2(.91),cn))));}
 float gr=fbm(u,vec2(8.),5),fine=fbm(u,vec2(64.),2),stk=vn(vec2(u.x*96.,u.y*3.),vec2(96.,3.));
 vec3 c=r<.4?c0:r<.75?c1:c2;
 c*=.55+.7*gr;c*=mix(.45,1.,smoothstep(0.,.65,f.y));
 c=mix(c,vec3(.13,.06,.025),smoothstep(.55,.9,stk)*(1.-f.y)*.85);
 c*=.85+.3*fine;c*=mix(.2,1.,seam);c+=riv*.05;
 float h=bev*.55+riv*.35+r*.1+gr*.15-(1.-seam)*.2;e=vec3(0);
 if(glow>0.&&r>.94){float sx=step(.18,f.x)*step(f.x,.82)*step(abs(f.y-.5),.03);e=vec3(.2,.8,.45)*sx*(.5+.3*fine);c=mix(c,vec3(.05,.12,.08),sx);}
 return vec4(c,h);}
void main(){vec2 u=v;vec4 a=vec4(0);vec3 e=vec3(0);
 if(uLay==0){ // regolith
  float n1=fbm(u,vec2(6.),6),n2=fbm(u,vec2(28.),3);vec3 w=wor(u,22.);float peb=smoothstep(.32,.05,w.x)*step(.72,w.z);
  vec3 w2=wor(u,7.);float clod=smoothstep(.45,0.,w2.x)*step(.6,w2.z),sp=h21(floor(u*256.));
  float h=n1*.45+n2*.25+peb*.45+clod*.25+sp*.06;
  vec3 c=mix(vec3(.085,.08,.072),vec3(.2,.188,.168),n1*.75+n2*.45);c*=.8+.35*peb+.15*clod;c*=.86+.28*sp;a=vec4(c,h);}
 else if(uLay==1){ // rock
  float rg=1.-abs(fbm(u,vec2(5.),5)*2.-1.);rg*=rg;vec3 w=wor(u,5.);float cr=smoothstep(0.,.07,w.y-w.x);
  float n=fbm(u,vec2(12.),5),sp=h21(floor(u*256.)),h=(n*.6+rg*.4)*(.25+.75*cr);
  vec3 c=mix(vec3(.05,.047,.043),vec3(.17,.155,.14),n*.7+rg*.5);c*=.5+.5*cr;c*=.85+.3*sp;a=vec4(c,h);}
 else if(uLay==2){ // crinkled gold foil
  vec3 w=wor(u,7.);float n=fbm(u,vec2(16.),3),h=(1.-w.x)*.6+n*.25+w.z*.3;
  a=vec4(mix(vec3(.22,.12,.025),vec3(.42,.27,.07),w.z)*(.7+.4*n),h);}
 else if(uLay==3){a=panel(u,vec3(.2,.195,.18),vec3(.17,.165,.15),vec3(.23,.22,.2),0.,e);} // lander hull
 else if(uLay==4){a=vec4(.008,.009,.011,0.);}  // dark glass
 else if(uLay==5){float n=fbm(u,vec2(4.),5);a=vec4(vec3(n),n);} // macro variation
 else if(uLay==6){ // alien flesh
  vec2 wv=vec2(fbm(u,vec2(4.),4),fbm(u+.37,vec2(4.),4));float vv=fbm(u+.12*wv,vec2(5.),4),vein=smoothstep(.035,0.,abs(vv-.5));
  float mo=fbm(u,vec2(10.),4);vec3 w=wor(u,9.);float bump=smoothstep(.5,0.,w.x);
  vec3 c=mix(vec3(.06,.03,.04),vec3(.16,.09,.08),mo);c*=.75+.4*bump;c=mix(c,vec3(.24,.26,.05),vein*.85);
  a=vec4(c,mo*.4+bump*.35+vein*.3);e=vec3(.03,.045,0.)*vein;}
 else if(uLay==7){ // chitin: dark glossy segmented shell
  float b=fract(u.y*5.),seg=smoothstep(0.,.12,b)*smoothstep(1.,.85,b),n=fbm(u,vec2(10.),5);vec3 w=wor(u,12.);float pit=smoothstep(.15,0.,w.x);
  vec3 c=mix(vec3(.04,.03,.022),vec3(.14,.095,.05),n*.8+seg*.3);c*=.55+.45*seg;c*=1.-pit*.5;a=vec4(c,seg*.6+n*.3-pit*.2);}
 else if(uLay==8){a=vec4(.02,.02,.01,0.);e=vec3(.95,1.,.3);} // eyes
 else if(uLay==9){float g=step(.35,fract(u.y*6.));a=vec4(.04,.05,.045,g*.3);e=vec3(.3,1.,.7)*(.35+.65*g);} // coil
 else if(uLay==10){a=panel(u,vec3(.075,.075,.085),vec3(.11,.08,.05),vec3(.085,.06,.1),1.,e);} // alien panel
 else if(uLay==11){ // tape: dull grey cloth, fine diagonal weave
  vec2 d=vec2(u.x+u.y,u.x-u.y);float wv=.5*vn(d*64.,vec2(64.))+.5*vn(d*96.,vec2(96.));
  a=vec4(vec3(.16+.08*wv),wv);}
 else if(uLay==12){ // scorch: charred black-brown, cell edges slightly lighter
  float n=fbm(u,vec2(6.),5);vec3 w=wor(u,9.);float ed=smoothstep(.1,0.,w.y-w.x);
  a=vec4(vec3(.012,.01,.008)+n*vec3(.028,.022,.017)+ed*vec3(.008,.006,.004),n*.5+ed*.3);}
 else if(uLay==13){ // goo: sickly yellow-green with bright bubbles
  float n=fbm(u,vec2(5.),4);vec3 w=wor(u,8.);float bub=smoothstep(.3,.08,w.x);
  a=vec4(vec3(.12,.16,.03)*(.75+.5*n)+bub*vec3(.04,.05,.01),bub*.6+n*.3);e=vec3(.15,.2,.03)*bub;}
 else if(uLay==14){ // floor grate
  vec2 q=fract(u*2.),s=vec2(fract(q.x*7.),q.y);float slot=step(.28,s.x)*step(.12,q.y)*step(q.y,.88);
  float fr=min(min(q.x,1.-q.x),min(q.y,1.-q.y)),sc=smoothstep(.6,1.,vn(vec2(u.x*4.,u.y*160.),vec2(4.,160.))),gr=fbm(u,vec2(8.),5);
  vec3 c=vec3(.085,.08,.075)*(.6+.7*gr)+sc*.05;c*=mix(.3,1.,smoothstep(0.,.05,fr));c=mix(c,vec3(.006,.008,.006),slot);
  a=vec4(c,(1.-slot)*.7+gr*.2);}
 else if(uLay==15){ // pipes
  float y=fract(u.y*5.),pr=max(0.,1.-pow((y-.5)*2.3,2.)),pipe=sqrt(pr),row=floor(u.y*5.);
  float ring=step(.93,fract(u.x*4.+h21(vec2(row)))),gr=fbm(u,vec2(8.),5);
  vec3 c=mix(vec3(.13,.07,.035),vec3(.09,.09,.085),step(.5,h21(vec2(row,3.))))*(.4+.9*gr);
  c*=.25+.75*pipe;c=mix(c,vec3(.2,.15,.06),ring*.7);c=mix(vec3(.004),c,step(.01,pr));a=vec4(c,pipe*.8+ring*.15);}
 else if(uLay==16){float g=step(.35,fract(u.y*6.));a=vec4(.05,.045,.03,g*.3);e=vec3(1.,.5,.12)*(.35+.65*g);} // amber lamp
 else if(uLay==17){a=vec4(.05,.01,.01,0.);e=vec3(1.,.14,.05);} // red lamp
 else if(uLay==18){float n=fbm(u,vec2(6.,3.),5),b=smoothstep(.3,.8,n);a=vec4(.03,.06,.05,n);e=vec3(.15,1.,.65)*(.35+.9*b);} // reactor
 else if(uLay==19){ // golf ball: muddy white, worley dimples
  vec3 w=wor(u,12.);float d=smoothstep(.18,.38,w.x);a=vec4(vec3(.42+.1*d),d*.5);}
 oA=a;oE=vec4(e,1.);}
