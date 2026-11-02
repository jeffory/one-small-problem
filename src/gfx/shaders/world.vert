#version 300 es
// Shared world vertex shader: wobble (flag 8) and sway (flag 128) animation, horizon curvature.
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in vec4 aM;
uniform mat4 uVP,uMod;uniform float uT,uCurv;uniform vec3 uCam;
out vec3 vW,vO,vN,vNo;flat out vec4 vM;
void main(){vec3 p=aP;int f=int(aM.w+.5);
 if((f&8)!=0)p+=aN*.02*sin(uT*5.+p.y*8.+p.x*5.);
 if((f&128)!=0){float k=max(0.,-p.y-.3);p.x+=sin(uT*1.9+p.y*2.5+p.z*3.)*.16*k;p.z+=cos(uT*1.6+p.y*2.1+p.x*3.)*.12*k;}
 vec4 w=uMod*vec4(p,1.);vW=w.xyz;vO=p;vNo=aN;vN=mat3(uMod)*aN;vM=aM;
 vec3 d=w.xyz-uCam;w.y-=dot(d.xz,d.xz)*uCurv;gl_Position=uVP*w;}
