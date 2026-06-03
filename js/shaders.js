// Shader 代码模块
// 导出所有 GLSL Shader 代码

export const Shaders = {
    // Glitch Vertex Shader
    glitchVertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    // Glitch Fragment Shader
    glitchFragment: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uGlitchStrength;
        uniform float uOpacity; 
        uniform float uDarkness; 
        varying vec2 vUv;

        float rand(vec2 co){
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
        }

        void main() {
            vec2 uv = vUv;
            float strength = uGlitchStrength;
            if(strength > 0.0) {
                float sliceY = floor(uv.y * 10.0);
                float noiseVal = rand(vec2(sliceY, floor(uTime * 20.0))); 
                if(noiseVal < 0.3 * strength) {
                    uv.x += (rand(vec2(uTime)) - 0.5) * 0.1 * strength;
                }
            }
            if(strength > 0.5) {
                uv.x += sin(uv.y * 50.0 + uTime * 20.0) * 0.01 * strength;
            }
            float r = texture2D(tDiffuse, uv + vec2(0.01 * strength, 0.0)).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - vec2(0.01 * strength, 0.0)).b;
            float a = texture2D(tDiffuse, uv).a;
            if(strength > 0.0) {
                float noise = rand(uv * uTime) * strength * 0.2;
                r += noise; g += noise; b += noise;
            }
            vec3 finalColor = vec3(r, g, b) * (1.0 - uDarkness);
            gl_FragColor = vec4(finalColor, a * uOpacity); 
        }
    `,

    // Particle Vertex Shader
    particleVertex: `
        uniform float uTime;
        attribute float aRandom;
        attribute float aSize;
        attribute float aSpeed;
        attribute float aOffset; 
        attribute float aBandPosition; 
        varying float vAlpha;
        void main() {
            float speed = 0.15 + aSpeed * 0.02; 
            float t = uTime * speed + aOffset;
            float radius = 35.0;  
            float u = t; 
            float v = aBandPosition; 
            float cosU = cos(u);
            float sinU = sin(u);
            float cosHalfU = cos(u * 0.5);
            float sinHalfU = sin(u * 0.5);
            float x = (radius + v * cosHalfU) * cosU;
            float y = (radius + v * cosHalfU) * sinU;
            float z = v * sinHalfU;
            float wave = sin(u * 2.0); 
            z += wave * 5.0; 
            float hover = sin(uTime * 2.0 + aRandom * 10.0) * 0.5;
            x += hover * cosU;
            y += hover * sinU;
            vec3 pos = vec3(x, y, z);
            float angleX = 0.4; 
            float ca = cos(angleX);
            float sa = sin(angleX);
            vec3 posRotated = vec3(pos.x, pos.y * ca - pos.z * sa, pos.y * sa + pos.z * ca);
            vec4 mvPosition = modelViewMatrix * vec4(posRotated, 1.0);
            gl_PointSize = (aSize * 280.0) / -mvPosition.z;
            gl_Position = projectionMatrix * mvPosition;
            float alphaBase = 0.5 + 0.5 * sin(t * 2.0);
            vAlpha = 0.5 + 0.5 * alphaBase; 
        }
    `,

    // Particle Fragment Shader
    particleFragment: `
        uniform vec3 uColor;
        uniform float uGlobalAlpha; 
        varying float vAlpha;
        void main() {
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(gl_PointCoord, center);
            if (dist > 0.5) discard;
            float glow = 1.0 - (dist * 2.0);
            glow = pow(glow, 1.2); 
            gl_FragColor = vec4(uColor, vAlpha * glow * uGlobalAlpha);
        }
    `
};

