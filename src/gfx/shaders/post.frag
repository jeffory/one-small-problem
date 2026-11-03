#version 300 es
// Post pass at low resolution: exposure, exponential tone map, gamma, the hurt vignette (a mix of at most .85 toward blood red
// by uK.x * v^2, v rising from 0 at distance 1 - uK.z from the middle to 1 at the edge, so the middle stays clear), the opening's blast flash (a mix of at most .85 toward warm off-white by uK.y, so the scene stays faintly visible
// under it, pre-flight F14), then (uP 1) 4x4 Bayer dither and (uP 1 or 2) snap to the nearest of the NP palette colours by
// weighted distance. uP 0 = palette off.
precision highp float;uniform sampler2D uS;uniform int uP;uniform float uX;uniform vec3 uK;out vec4 o;
uniform vec3 P[NP];
void main(){ivec2 ip=ivec2(gl_FragCoord.xy);vec3 c=pow(1.-exp(-texelFetch(uS,ip,0).rgb*uX),vec3(1./2.2));
 vec2 q=gl_FragCoord.xy/vec2(textureSize(uS,0))*2.-1.;float v=clamp((length(q)-1.+uK.z)/max(uK.z,.001),0.,1.);
 c=mix(c,vec3(.45,.04,.02),min(.85,uK.x)*v*v);
 c=mix(c,vec3(.94,.91,.86),min(.85,uK.y));
 if(uP>0){int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  if(uP==1)c+=((float(m[(ip.y&3)*4+(ip.x&3)])+.5)/16.-.5)*.075;
  float bd=1e9;vec3 bc=c;for(int i=0;i<NP;i++){vec3 d=P[i]-c;float k=dot(d*d,vec3(2.,4.,3.));if(k<bd){bd=k;bc=P[i];}}c=bc;}
 o=vec4(c,1.);}
