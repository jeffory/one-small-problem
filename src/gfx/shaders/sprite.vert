#version 300 es
// Instanced camera-facing sprites: aS = centre xyz + half-size, aC = colour rgb. Corners come from gl_VertexID 0-5
// along the camera's right and up vectors; the centre drops with the same horizon curvature as world.vert. vD is the eye distance, for the base fog.
layout(location=0) in vec4 aS;layout(location=1) in vec4 aC;
uniform mat4 uVP;uniform vec3 uR,uU,uCam;uniform float uCurv;out vec2 v;out vec3 vC;out float vD;
void main(){int i=gl_VertexID;vec2 c=vec2(i==1||i==2||i==4?1.:-1.,i==2||i==4||i==5?1.:-1.);v=c;vC=aC.rgb;
 vec3 d=aS.xyz-uCam,p=aS.xyz+(uR*c.x+uU*c.y)*aS.w;vD=length(d);p.y-=dot(d.xz,d.xz)*uCurv;gl_Position=uVP*vec4(p,1.);}
