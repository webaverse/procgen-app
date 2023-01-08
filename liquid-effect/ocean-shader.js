export const oceanShader =  /* glsl */`
	if (!cameraInWater) {
		//################################## compute waterColor ##################################
		float opDepthScale = 15.;
		float opDepthFalloff = 3.;
		float opDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, opDepthScale, opDepthFalloff);

		float mask = readDepth(tMask, screenUV);
		float op = mask < 1. ? 1. - opDepth : 1.0;

		float colorDepthScale = 50.;
		float colorDepthFalloff = 3.;
		float colorDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, colorDepthScale, colorDepthFalloff);

		float colorLerp = mask < 1. ? colorDepth : 0.0;
		vec4 cosGradColor = cosGradient(colorLerp, phases, amplitudes, frequencies, offsets);
		cosGradColor = clamp(cosGradColor, vec4(0.), vec4(1.));
		
		vec4 waterColor = vec4(cosGradColor.rgb, op);
		
		//################################## handle foam ##################################
		float fadeoutDistance = 50.;
		float fadeoutScale = 3.;
		float fadeoutLerp = pow(saturate(distance(playerPos, vWorldPosition) / fadeoutDistance), fadeoutScale);

		// foam distortion
		vec4 ds2 = texture2D( 
				tDistortion, 
				vec2(
				0.25 * vWorldPosition.x + uTime * 0.01,
				0.25 * vWorldPosition.z + uTime * 0.01
				) 
		);
		vec4 ds = texture2D( 
				tDistortion, 
				vec2(
				0.3 * vWorldPosition.x + uTime * 0.005,
				0.3 * vWorldPosition.z + uTime * 0.005
				) 
		);
		float foamDistortionDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 8., 2.);
		float foamDistortionScale = 0.2;
		float foamDistortionDegree = pow(clamp((1. - foamDistortionDepth), 0.2, 1.0), foamDistortionScale);
		vec2 foamDistortion = vec2(ds2.r + ds.r, ds2.g + ds.g) * foamDistortionDegree;

		// foam
		float foamDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 8., 2.);
		float foamDiff = saturate( fragmentLinearEyeDepth - linearEyeDepth );
		float foamScale = -0.02;
		float foamSpeed = 0.4;
		float foamUvX = (vWorldPosition.x + vWorldPosition.z) * foamScale;
		float foamUvY = (vWorldPosition.x + vWorldPosition.z) * foamScale + foamDepth * 1.5 - uTime * foamSpeed;
		float foamDistortionLerp = 0.15;
		vec2 foamUv = mix(vec2(foamUvX, foamUvY), foamDistortion, foamDistortionLerp);
		vec4 foamTex = texture2D(foamTexture, foamUv);
		foamTex = step(vec4(0.9), foamTex);
		float foamTextScale = 2.;
		vec4 foamT = vec4(foamTex.r * (1.0 - foamDepth) * foamTextScale);
		foamT = mix(vec4(0.), foamT, foamDepth * fadeoutLerp);
		vec4 foamLineCutOut = saturate(foamT);
		waterColor = waterColor * ((vec4(1.0) - foamLineCutOut)) + foamT;

		//################################## handle mirror ##################################
		float noiseNormalScale = 0.7;
		vec3 noiseNormal = normalize(getNoise(vWorldPosition.xz * 2., uTime * 0.5)).rgb;
		vec3 surfaceNormal = normalize((vNormal + noiseNormal * noiseNormalScale) * vec3(1.5, 1.0, 1.5));

		vec3 worldToEye = eye - vWorldPosition.xyz;
		float worldToEyeDistance = length(worldToEye);
		float distortionScaleDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 200., 1.5);
		float distortionScale = 5. * (1. - distortionScaleDepth);
		vec2 distortion = surfaceNormal.xz * (0.001 + 0.1 / worldToEyeDistance) * distortionScale;
		vec3 reflectionSample = vec3(texture2D(mirror, vUv.xy / vUv.w + distortion));
		float theta = max(dot(eyePosition, surfaceNormal), 0.0);
		float rf0 = 0.1;
		float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
		float reflectanceScale = 1.2;
		vec3 col1 = reflectionSample * 0.2;
		vec3 col2 = vec3(0.8);
		vec3 albedo = mix(col1, col2, clamp(reflectance * reflectanceScale, 0.0, 1.0));
		gl_FragColor = vec4(albedo, waterColor.a);
		gl_FragColor.rgb += waterColor.rgb;

		vec3 eyeDirection = normalize(eye - vWorldPosition);
		vec3 lightDir = normalize(lightPos - vWorldPosition);
		float lightDiffuse = max(0.0, dot(lightDir, noiseNormal));
		float lightDiffuseIntensity = 0.025;
		lightDiffuse *= lightDiffuseIntensity;
		

		vec3 reflection = normalize( reflect( -lightDir, noiseNormal ) );
		float lightSpecular = max( 0.0, dot( eyeDirection, reflection ) );
		float specularShinny = 20.;
		float lightSpecularIntensity = 0.05;
		lightSpecular = pow(lightSpecular, specularShinny);
		lightSpecular *= lightSpecularIntensity;

		gl_FragColor.rgb += (lightSpecular + lightDiffuse) * lightIntensity * col2;
	}
	else{
		//################################## refraction ##################################
		vec3 waterColor = vec3(0.126, 0.47628, 0.6048);
		
		float noiseNormalScale = 0.6;
		vec3 noiseNormal = normalize(getNoise(vWorldPosition.xz * 2., uTime * 0.5)).rgb;
		vec3 surfaceNormal = normalize((vNormal + noiseNormal * noiseNormalScale) * vec3(1.5, 1.0, 1.5));

		vec3 worldToEye = eye - vWorldPosition.xyz;
		float worldToEyeDistance = length(worldToEye);
		float distortionScaleDepth = getDepthFade(fragmentLinearEyeDepth, linearEyeDepth, 200., 1.5);
		float distortionScale = 5. * (1. - distortionScaleDepth);
		vec2 distortion = surfaceNormal.xz * (0.001 + 0.1 / worldToEyeDistance) * distortionScale;
		vec3 reflectionSample = vec3(texture2D(refractionTexture, vUv.xy / vUv.w + distortion));
		float theta = max(dot(eyePosition, surfaceNormal), 0.0);
		float rf0 = 0.1;
		float reflectance = rf0 + (1.0 - rf0) * pow((1.0 - theta), 5.0);
		float reflectanceScale = 5.;
		vec3 col1 = reflectionSample * 0.2;
		vec3 col2 = vec3(0.8);
		vec3 albedo = mix(col1, col2, reflectance);
		gl_FragColor = vec4(albedo, 1.0);
		gl_FragColor.rgb += waterColor.rgb;
	}
`;