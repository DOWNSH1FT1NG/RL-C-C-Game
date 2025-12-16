// psxPostprocess.js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createPSXComposer({ renderer, scene, camera, opts = {} } = {}) {

    if (!renderer || !scene || !camera) throw new Error('renderer, scene, camera required');

    const P = Object.assign({
        lowResScale: 0.35,
        palette: [[12, 14, 20], [88, 103, 144], [196, 128, 96], [220, 220, 220], [24, 160, 24], [200, 180, 60], [255, 128, 32], [255, 255, 255]],
        posterizeLevels: 6, bayerStrength: 1.0, scanlineIntensity: 0.12, chromaAmount: 0.0035,
        intensity: 1.0, vignetteStrength: 0.08, blackLift: 0.02, contrast: 1.0,
        bloomStrength: 0.6, bloomThreshold: 0.99, bloomRadius: 0.4
    }, opts);

    renderer.domElement.style.imageRendering = 'pixelated';
    const GLOW_LAYER = 1;
    const darkenMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
    const _materials = {};
    function darkenNonGlowingObjects(obj) { if (obj.isMesh && !obj.layers.test(GLOW_LAYER)) { _materials[obj.uuid] = obj.material; obj.material = darkenMaterial; } }
    function restoreOriginalMaterials(obj) { if (_materials[obj.uuid]) { obj.material = _materials[obj.uuid]; delete _materials[obj.uuid]; } }

    let lowResTarget = makeLowResTarget();
    function makeLowResTarget() {
        const w = Math.max(2, Math.floor(window.innerWidth * P.lowResScale));
        const h = Math.max(2, Math.floor(window.innerHeight * P.lowResScale));
        const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, stencilBuffer: false });
        rt.texture.generateMipmaps = false;
        return rt;
    }

    const finalComposer = new EffectComposer(renderer);
    finalComposer.setSize(window.innerWidth, window.innerHeight);
    const renderPass = new RenderPass(scene, camera);
    finalComposer.addPass(renderPass);

    const glowComposer = new EffectComposer(renderer);
    glowComposer.setSize(window.innerWidth, window.innerHeight);
    const glowRenderPass = new RenderPass(scene, camera);
    glowComposer.addPass(glowRenderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), P.bloomStrength, P.bloomRadius, P.bloomThreshold);
    glowComposer.addPass(bloomPass);
    glowComposer.renderToScreen = false;

    const PSXShader = {
        uniforms: {
            tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            lowRes: { value: new THREE.Vector2(lowResTarget.width, lowResTarget.height) }, paletteSize: { value: P.palette.length },
            posterize: { value: P.posterizeLevels }, bayerStrength: { value: P.bayerStrength }, scanlineIntensity: { value: P.scanlineIntensity },
            chromaAmount: { value: P.chromaAmount }, time: { value: 0 }, palette: { value: (new Array(16)).fill(new THREE.Vector3(0, 0, 0)) },
            u_psx_intensity: { value: P.intensity }, u_vignette_strength: { value: P.vignetteStrength },
            u_black_lift: { value: P.blackLift }, u_contrast: { value: P.contrast }
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 resolution; uniform vec2 lowRes; uniform float time; uniform int paletteSize; uniform float posterize; uniform float bayerStrength; uniform float scanlineIntensity; uniform float chromaAmount; uniform vec3 palette[16]; uniform float u_psx_intensity; uniform float u_vignette_strength; uniform float u_black_lift; uniform float u_contrast;
          float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
          float bayer4(vec2 uv) { int x = int(mod(floor(uv.x * 4.0), 4.0)); int y = int(mod(floor(uv.y * 4.0), 4.0)); int m = 0; if (x==0 && y==0) m=0; if (x==1 && y==0) m=8; if (x==2 && y==0) m=2; if (x==3 && y==0) m=10; if (x==0 && y==1) m=12; if (x==1 && y==1) m=4; if (x==2 && y==1) m=14; if (x==3 && y==1) m=6; if (x==0 && y==2) m=3; if (x==1 && y==2) m=11; if (x==2 && y==2) m=1; if (x==3 && y==2) m=9; if (x==0 && y==3) m=15; if (x==1 && y==3) m=7; if (x==2 && y==3) m=13; if (x==3 && y==3) m=5; return float(m) / 16.0; }
          vec3 findNearestPalette(vec3 col) { float bestDist = 1e6; vec3 best = vec3(0.0); for (int i=0;i<16;i++){ if(i>=paletteSize) break; vec3 p = palette[i] / 255.0; float d = distance(col,p); if(d<bestDist){ bestDist=d; best=p; } } return best; }
          void main(){
            vec4 originalHigh = texture2D(tDiffuse, vUv);
            vec2 lowUV = floor(vUv * lowRes) / lowRes + 0.5 / lowRes;
            vec4 color = texture2D(tDiffuse, lowUV);
            color.rgb = floor(color.rgb * posterize) / posterize;
            vec2 texelLocal = fract(vUv * lowRes);
            float b = bayer4(texelLocal) * bayerStrength;
            color.r = clamp(color.r + (b - 0.5) / posterize, 0.0, 1.0); color.g = clamp(color.g + (b - 0.5) / posterize, 0.0, 1.0); color.b = clamp(color.b + (b - 0.5) / posterize, 0.0, 1.0);
            vec3 pal = color.rgb;
            float scan = sin((vUv.y * resolution.y) * 1.0) * 0.5 + 0.5; pal *= mix(1.0, 1.0 - scanlineIntensity, scan);
            vec2 cc = vUv - 0.5; float vignette = smoothstep(0.2, 0.8, length(cc)); pal *= mix(1.0, 1.0 - u_vignette_strength, vignette);
            vec2 center = vec2(0.5,0.5); float dist = distance(vUv,center); vec2 dir = normalize(vUv-center); vec2 shift = dir * chromaAmount * dist * 500.0 / resolution.y;
            float r = texture2D(tDiffuse, lowUV + shift * 1.2).r; float g = texture2D(tDiffuse, lowUV).g; float bch = texture2D(tDiffuse, lowUV - shift * 1.2).b;
            vec3 chroma = vec3(r,g,bch);
            vec3 finalCol = mix(pal, chroma, 0.15);
            float grain = (rand(vUv * time) - 0.5) * 0.005;
            vec3 processedColor = finalCol + grain;
            processedColor = max(processedColor, vec3(u_black_lift));
            processedColor = (processedColor - 0.5) * u_contrast + 0.5;
            vec3 mixedColor = mix(originalHigh.rgb, processedColor, clamp(u_psx_intensity, 0.0, 1.0));
            gl_FragColor = vec4(mixedColor, 1.0);
          }`
    };

    const psxPass = new ShaderPass(PSXShader);
    finalComposer.addPass(psxPass);
    const blendPass = new ShaderPass(new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, tGlow: { value: null } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tGlow; void main(){ vec4 base = texture2D(tDiffuse, vUv); vec4 glow = texture2D(tGlow, vUv); gl_FragColor = base + glow; }`
    }), 'tDiffuse');
    finalComposer.addPass(blendPass);



    const paletteUniformArray = [];
    for (let i = 0; i < 16; i++) {
        const p = P.palette[i] || [0, 0, 0];
        paletteUniformArray.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    psxPass.uniforms.palette.value = paletteUniformArray;

    // --- ИСПРАВЛЕННАЯ, УПРОЩЕННАЯ ФУНКЦИЯ РЕНДЕРИНГА ---
    function render(delta) {
        // ШАГ 1: Рендерим свечение (Bloom) на чистом черном фоне.
        // Это ИСПРАВЛЯЕТ баг с "белым/голубым фильтром" раз и навсегда.
        const originalBackground = scene.background;
        scene.background = null; // Временно убираем фон для чистого рендера свечения
        camera.layers.set(GLOW_LAYER);
        scene.traverse(darkenNonGlowingObjects);
        glowComposer.render(delta); // Результат сохраняется в текстуре glowComposer
        scene.traverse(restoreOriginalMaterials);
        scene.background = originalBackground; // Возвращаем оригинальный фон
        camera.layers.enableAll();

        // ШАГ 2: Рендерим сцену в low-res текстуру для PSX-шейдера.
        // Это необходимо для вашего эффекта пикселизации.
        renderer.setRenderTarget(lowResTarget);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);

        // ШАГ 3: Запускаем финальный composer.
        // Он возьмет результат рендера основной сцены, обработает его вашим PSX-шейдером,
        // а затем добавит сверху текстуру свечения.
        psxPass.uniforms.tDiffuse.value = lowResTarget.texture; // Передаем low-res картинку в PSX-шейдер
        psxPass.uniforms.time.value = delta;
        blendPass.uniforms.tGlow.value = glowComposer.renderTarget2.texture; // Передаем текстуру свечения в blend-шейдер

        finalComposer.render(delta);
    }

    function onResize() {
        lowResTarget.dispose();
        lowResTarget = makeLowResTarget();
        psxPass.uniforms.lowRes.value.set(lowResTarget.width, lowResTarget.height);
        psxPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        finalComposer.setSize(window.innerWidth, window.innerHeight);
        glowComposer.setSize(window.innerWidth, window.innerHeight);
        bloomPass.setSize(window.innerWidth, window.innerHeight);
    }

    function dispose() {
        lowResTarget.dispose();
        finalComposer.dispose();
        glowComposer.dispose();
    }

    return { composer: finalComposer, glowComposer, psxPass, render, onResize, dispose, getLowResTarget: () => lowResTarget };
}