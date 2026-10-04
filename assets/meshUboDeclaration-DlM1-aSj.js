import{S as e}from"./index-B0HS_YnV.js";const o="sceneUboDeclaration",t=`layout(std140,column_major) uniform;uniform Scene {mat4 viewProjection;
#ifdef MULTIVIEW
mat4 viewProjectionR;
#endif 
mat4 view;mat4 projection;vec4 vEyePosition;mat4 inverseProjection;};
`;e.IncludesShadersStore[o]||(e.IncludesShadersStore[o]=t);const r={name:o,shader:t},n="meshUboDeclaration",i=`#ifdef WEBGL2
uniform mat4 world;uniform float visibility;
#else
layout(std140,column_major) uniform;uniform Mesh
{mat4 world;float visibility;};
#endif
#define WORLD_UBO
`;e.IncludesShadersStore[n]||(e.IncludesShadersStore[n]=i);const s={name:n,shader:i};export{s as m,r as s};
