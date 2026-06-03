function createParticleShapeTexture(THREE, shapeId) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 96, 96);
    ctx.fillStyle = '#fff';
    ctx.translate(48, 48);

    if (shapeId === 'heart') {
        ctx.beginPath();
        ctx.moveTo(0, 28);
        ctx.bezierCurveTo(-44, 2, -34, -34, -10, -22);
        ctx.bezierCurveTo(-2, -18, 0, -8, 0, -8);
        ctx.bezierCurveTo(0, -8, 2, -18, 10, -22);
        ctx.bezierCurveTo(34, -34, 44, 2, 0, 28);
        ctx.fill();
    } else if (shapeId === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(10, -10);
        ctx.lineTo(40, 0);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, 40);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-40, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();
        ctx.fill();
    } else if (shapeId === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 5;
            const radius = i % 2 === 0 ? 40 : 17;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    } else if (shapeId === 'square') {
        ctx.fillRect(-30, -30, 60, 60);
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function createResonanceGeometry(THREE, count, minRadius, spread) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const r = minRadius + spread * Math.pow(Math.random(), 2);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
}

export function createResonanceParticleGroup(THREE, shapes) {
    const group = new THREE.Group();
    group.visible = false;
    group.userData.shapeSystems = [];

    const textures = {};
    shapes.forEach(shape => {
        textures[shape.id] = createParticleShapeTexture(THREE, shape.id);
    });

    shapes.forEach(shape => {
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: shape.id === 'circle' ? 0.15 : 0.24,
            map: textures[shape.id],
            transparent: true,
            alphaTest: 0.1,
            opacity: 0.6,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const points = new THREE.Points(new THREE.BufferGeometry(), material);
        points.visible = shape.id === 'circle';
        points.userData.shapeId = shape.id;
        group.userData.shapeSystems.push(points);
        group.add(points);
    });

    return group;
}

export function updateResonanceParticleGeometry(THREE, system, count, shapes = ['circle'], options = {}) {
    if (!system) return;

    const minRadius = options.minRadius ?? 0.2;
    const spread = options.spread ?? 1.5;

    if (!system.userData || !system.userData.shapeSystems) {
        if (system.geometry) system.geometry.dispose();
        system.geometry = createResonanceGeometry(THREE, count, minRadius, spread);
        return;
    }

    const selectedShapes = shapes.length ? shapes : ['circle'];
    system.userData.shapeSystems.forEach(shapeSystem => {
        const enabled = selectedShapes.includes(shapeSystem.userData.shapeId);
        shapeSystem.visible = enabled;
        if (shapeSystem.geometry) shapeSystem.geometry.dispose();
        const shapeCount = enabled ? Math.max(1, Math.ceil(count / selectedShapes.length)) : 0;
        shapeSystem.geometry = createResonanceGeometry(THREE, shapeCount, minRadius, spread);
    });
}
