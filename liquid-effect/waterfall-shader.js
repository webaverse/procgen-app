export const waterfallShader = /* glsl */ `
  const float WATERFALL_OPACITY = 0.7;

  float mask = readDepth(tMask, screenUV);
  float depthScale = 15.;
  float depthFalloff = 3.;
  float sceneDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, depthScale, depthFalloff);
  sceneDepth = mask < 1. ? sceneDepth : 1. - sceneDepth;

  vec4 cosGradColor = cosGradient(sceneDepth, phases, amplitudes, frequencies, offsets);
  cosGradColor = clamp(cosGradColor, vec4(0.), vec4(1.));
  vec4 waterColor = vec4(cosGradColor.rgb, WATERFALL_OPACITY);

  vec3 surfaceNormal = normalize(getNoise(vWorldPosition.xz * 5., uTime)).rgb;
  vec3 worldToEye = eye - vWorldPosition.xyz;
  vec3 eyeDirection = normalize(worldToEye);
  float distance = length(worldToEye);
  float distortionScale = 3.;
  vec3 distortion = surfaceNormal.xyz * (0.001 + 1.0 / distance) * distortionScale;
  vec3 normalizedVWorldPosition = normalize(vWorldPosition);

  vec3 cameraToFrag = normalize(vWorldPosition.xyz - eye);
  vec3 reflectionSample = textureCube(cubeMap, cameraToFrag + distortion).rgb;
  
  float theta = max(dot(eyePosition, surfaceNormal), 0.0);
  float rf0 = 0.3;
  float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
  vec3 col1 = reflectionSample * 0.6;
  vec3 col2 = reflectionSample * 0.4;
  vec3 albedo = mix(col1, col2, reflectance);
  gl_FragColor = vec4(albedo, waterColor.a);
  gl_FragColor.rgb += waterColor.rgb;    
`;