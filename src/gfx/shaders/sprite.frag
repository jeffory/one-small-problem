#version 300 es
// uG 0: opaque disc in a flat colour (goo, dust), cut to the unit circle. uG 1: additive plasma glow with the
// look test's falloff, a coloured halo around a white-hot core. The falloff drops by its edge value exp(-5) so a big
// glow (a boom) doesn't show its square against the black sky once gamma lifts the faint tail.
// In base mode (uMode 1) opaque sprites fade into the fog uFog like world.frag, and glows fade to nothing.
precision highp float;uniform int uG,uMode;uniform float uFogD;uniform vec3 uFog;in vec2 v;in vec3 vC;in float vD;out vec4 o;
void main(){float r=dot(v,v),fg=uMode==1?exp(-vD*uFogD):1.;
 if(uG==0){if(r>1.)discard;o=vec4(mix(uFog,vC,fg),1.);}
 else{float g=max(exp(-r*5.)-.0067,0.);o=vec4((vC*g*1.6+vec3(1.)*pow(g,5.)*2.2*length(vC))*fg,1.);}}
