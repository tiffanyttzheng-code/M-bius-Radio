const STORAGE_KEY = 'mobius_memory_cards';
const CARD_COLORS = [
    '#3a849c',
    '#a2496e',
    '#6f5bad',
    '#468f6c',
    '#bb8437',
    '#787878'
];

// 记忆场：以专辑本地原点为中心的 14×10 区域（与 syncMeshes 一致），位于本地 z = 0.18
const FIELD_W = 22;
const FIELD_H = 14;
const FIELD_Z = 0.18;
// 封面禁放区（归一化）
const COVER_RECT = { x: 0.39, y: 0.28, w: 0.22, h: 0.44 };

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hexToRgba(hex, opacity) {
    const value = hex.replace('#', '');
    const number = Number.parseInt(value, 16);
    const red = (number >> 16) & 255;
    const green = (number >> 8) & 255;
    const blue = number & 255;
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

function rgbaToHex(color) {
    const match = color?.match?.(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!match) return CARD_COLORS[0];
    return `#${[match[1], match[2], match[3]].map(value => Number(value).toString(16).padStart(2, '0')).join('')}`;
}

function rgbaOpacity(color) {
    const match = color?.match?.(/rgba\([^)]*,\s*([\d.]+)\s*\)/i);
    return match ? Number(match[1]) : 0.58;
}

function cardBackground(card) {
    return card.noBackground ? 'transparent' : hexToRgba(card.color, card.opacity);
}
function hashStr(str) {
    let h = 0;
    for (const c of String(str)) { h = Math.imul(31, h) + c.charCodeAt(0) | 0; }
    return Math.abs(h);
}

function fakePublishDate(seed) {
    const start = new Date('2025-12-01').getTime();
    const end   = new Date('2026-01-31').getTime();
    const t = start + (Math.abs(Math.round(seed)) % (end - start));
    const d = new Date(t);
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear();
}

function wrapCanvasText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const char of text) {
        const next = line + char;
        if (ctx.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = char;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 7);
}

export const memoryCards = {
    THREE: null,
    albums: [],
    getFocusedAlbum: null,
    focusAlbum: null,
    camera: null,
    renderer: null,
    cards: [],
    editing: false,
    draft: null,
    activeAlbum: null,
    dragState: null,
    proj: null,          // 缓存的投影参考 {ox, oy, fw, fh}
    rafId: null,

    init({ THREE, albums, getFocusedAlbum, focusAlbum, camera, renderer }) {
        this.THREE = THREE;
        this.albums = albums;
        this.getFocusedAlbum = getFocusedAlbum;
        this.focusAlbum = focusAlbum;
        this.camera = camera || null;
        this.renderer = renderer || null;
        this.cards = this.load();
        this.bindUI();
        this.syncMeshes();
        this.renderProfileList();
        window.memoryCards = this;
    },

    load() {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(stored) ? stored.map(card => this.normalizeCard(card)) : [];
        } catch {
            return [];
        }
    },

    normalizeCard(card) {
        const legacyColor = card.color || CARD_COLORS[0];
        return {
            ...card,
            color: legacyColor.startsWith('#') ? legacyColor : rgbaToHex(legacyColor),
            opacity: card.opacity ?? rgbaOpacity(legacyColor),
            noBackground: Boolean(card.noBackground)
        };
    },

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cards));
        this.syncMeshes();
        this.renderProfileList();
    },

    bindUI() {
        const cancelBtn = document.getElementById('memory-cancel-btn');
        const publishBtn = document.getElementById('memory-publish-btn');
        const input = document.getElementById('memory-text-input');
        const opacitySlider = document.getElementById('memory-opacity-slider');
        const transparentToggle = document.getElementById('memory-transparent-toggle');

        if (cancelBtn) cancelBtn.onclick = () => this.closeEditor();
        if (publishBtn) publishBtn.onclick = () => this.publishDraft();
        if (input) input.oninput = () => {
            if (!this.draft) return;
            this.draft.text = input.value;
            this.validate();
        };
        if (opacitySlider) opacitySlider.oninput = () => {
            if (!this.draft) return;
            this.draft.opacity = Number(opacitySlider.value) / 100;
            this.draft.noBackground = false;
            this.syncEditorControls();
            this.applyStyle();
        };
        if (transparentToggle) transparentToggle.onclick = () => {
            if (!this.draft) return;
            this.draft.noBackground = !this.draft.noBackground;
            this.syncEditorControls();
            this.applyStyle();
        };

        const note = document.getElementById('memory-note');
        if (note) {
            note.addEventListener('pointerdown', (event) => this.onPointerDown(event));
            note.addEventListener('pointermove', (event) => this.onPointerMove(event));
            note.addEventListener('pointerup', () => this.onPointerUp());
            note.addEventListener('pointercancel', () => this.onPointerUp());
        }
    },

    getUsername() {
        return window.userSystem?.username || 'guest';
    },

    albumCards(albumLabel) {
        return this.cards.filter(card => card.album === albumLabel);
    },

    defaultDraft(albumLabel) {
        return {
            id: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            album: albumLabel,
            author: this.getUsername(),
            text: '',
            color: CARD_COLORS[0],
            opacity: 0.58,
            noBackground: false,
            x: 0.65,
            y: 0.16,
            w: 0.15,
            h: 0.16,
            createdAt: Date.now()
        };
    },

    openEditor(album = this.getFocusedAlbum?.(), editId = null) {
        if (!album || !window.userSystem?.isLoggedIn) return;
        this.activeAlbum = album;
        const existing = editId ? this.cards.find(card => card.id === editId && card.author === this.getUsername()) : null;
        this.draft = existing ? { ...existing } : this.defaultDraft(album.userData.labelText);
        this.editing = true;
        document.body.classList.add('memory-editing');

        // 隐藏 3D 卡背上的“点击书写”提示，让背面保持干净
        if (album.userData.overlayMesh) album.userData.overlayMesh.visible = false;

        const note = document.getElementById('memory-note');
        const input = document.getElementById('memory-text-input');
        const author = document.getElementById('memory-author');
        if (author) author.textContent = `@${this.draft.author}`;
        if (input) input.value = this.draft.text;
        if (note) {
            note.classList.add('show');
            note.setAttribute('aria-hidden', 'false');
        }
        this.syncEditorControls();
        this.renderColorPicker();
        this.applyStyle();
        this.startLoop();
        this.validate();
        setTimeout(() => input && input.focus(), 360);
    },

    closeEditor() {
        this.editing = false;
        this.draft = null;
        this.dragState = null;
        this.stopLoop();
        document.body.classList.remove('memory-editing');

        // 恢复卡背提示，方便再次书写
        if (this.activeAlbum && this.activeAlbum.userData.overlayMesh && this.activeAlbum.userData.isFlipped) {
            this.activeAlbum.userData.overlayMesh.visible = true;
        }

        const note = document.getElementById('memory-note');
        const keepout = document.getElementById('memory-keepout');
        if (note) {
            note.classList.remove('show', 'invalid');
            note.setAttribute('aria-hidden', 'true');
            note.style.transform = '';
            note.style.opacity = '';
        }
        if (keepout) keepout.classList.remove('show');
    },

    coverPath(album) {
        const label = album.userData.labelText;
        return `assets/${album.userData.groupId}/${label}.jpg`;
    },

    // ---------- 投影：本地坐标 → 屏幕像素 ----------
    worldToScreen(lx, ly, lz) {
        const v = new this.THREE.Vector3(lx, ly, lz);
        this.activeAlbum.localToWorld(v);
        v.project(this.camera);
        return {
            x: (v.x * 0.5 + 0.5) * window.innerWidth,
            y: (-v.y * 0.5 + 0.5) * window.innerHeight
        };
    },

    cacheProjection() {
        if (!this.camera || !this.activeAlbum) return false;
        this.activeAlbum.updateMatrixWorld();
        const tl = this.worldToScreen(-FIELD_W / 2, FIELD_H / 2, FIELD_Z);
        const br = this.worldToScreen(FIELD_W / 2, -FIELD_H / 2, FIELD_Z);
        const fw = br.x - tl.x;
        const fh = br.y - tl.y;
        if (!isFinite(fw) || !isFinite(fh) || Math.abs(fw) < 1 || Math.abs(fh) < 1) return false;
        this.proj = { ox: tl.x, oy: tl.y, fw, fh };
        return true;
    },

    startLoop() {
        this.stopLoop();
        const step = () => {
            if (!this.editing) return;
            this.layoutFromProjection();
            this.rafId = requestAnimationFrame(step);
        };
        this.rafId = requestAnimationFrame(step);
    },

    stopLoop() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = null;
    },

    layoutFromProjection() {
        if (!this.draft || !this.cacheProjection()) return;
        const { ox, oy, fw, fh } = this.proj;
        const note = document.getElementById('memory-note');
        if (note && !this.dragState) {
            note.style.left = `${ox + this.draft.x * fw}px`;
            note.style.top = `${oy + this.draft.y * fh}px`;
            note.style.width = `${this.draft.w * fw}px`;
            note.style.height = `${this.draft.h * fh}px`;
        } else if (note) {
            // 拖拽时尺寸跟随，位置由 draft 实时驱动
            note.style.left = `${ox + this.draft.x * fw}px`;
            note.style.top = `${oy + this.draft.y * fh}px`;
            note.style.width = `${this.draft.w * fw}px`;
            note.style.height = `${this.draft.h * fh}px`;
        }
        const keepout = document.getElementById('memory-keepout');
        if (keepout) {
            keepout.classList.add('show');
            keepout.style.left = `${ox + COVER_RECT.x * fw}px`;
            keepout.style.top = `${oy + COVER_RECT.y * fh}px`;
            keepout.style.width = `${COVER_RECT.w * fw}px`;
            keepout.style.height = `${COVER_RECT.h * fh}px`;
        }
    },

    renderColorPicker() {
        const picker = document.getElementById('memory-color-picker');
        if (!picker || !this.draft) return;
        picker.innerHTML = '';
        CARD_COLORS.forEach(color => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'memory-card-color';
            swatch.classList.toggle('selected', color === this.draft.color && !this.draft.noBackground);
            swatch.style.background = hexToRgba(color, 0.86);
            swatch.title = 'Change card color';
            swatch.onclick = () => {
                this.draft.color = color;
                this.draft.noBackground = false;
                this.syncEditorControls();
                this.renderColorPicker();
                this.applyStyle();
            };
            picker.appendChild(swatch);
        });
    },

    syncEditorControls() {
        if (!this.draft) return;
        const opacitySlider = document.getElementById('memory-opacity-slider');
        const opacityValue = document.getElementById('memory-opacity-value');
        const transparentToggle = document.getElementById('memory-transparent-toggle');
        if (opacitySlider) {
            opacitySlider.value = String(Math.round(this.draft.opacity * 100));
            opacitySlider.disabled = this.draft.noBackground;
        }
        if (opacityValue) opacityValue.textContent = this.draft.noBackground ? 'NONE' : `${Math.round(this.draft.opacity * 100)}%`;
        if (transparentToggle) transparentToggle.classList.toggle('on', this.draft.noBackground);
    },

    applyStyle() {
        const note = document.getElementById('memory-note');
        if (!note || !this.draft) return;
        note.style.background = this.draft.noBackground ? 'transparent' : hexToRgba(this.draft.color, this.draft.opacity);
        note.style.backdropFilter = this.draft.noBackground ? 'none' : 'blur(6px)';
        note.style.webkitBackdropFilter = note.style.backdropFilter;
    },

    getRect(card) {
        return { x: card.x, y: card.y, w: card.w, h: card.h };
    },

    isDraftValid() {
        if (!this.draft || !this.draft.text.trim()) return false;
        const rect = this.getRect(this.draft);
        if (overlap(rect, COVER_RECT)) return false;
        return !this.albumCards(this.draft.album)
            .filter(card => card.id !== this.draft.id)
            .some(card => overlap(rect, this.getRect(card)));
    },

    validate() {
        const valid = this.isDraftValid();
        const note = document.getElementById('memory-note');
        const publish = document.getElementById('memory-publish-btn');
        const status = document.getElementById('memory-editor-status');
        const overlaps = this.draft && overlap(this.getRect(this.draft), COVER_RECT);
        if (note) note.classList.toggle('invalid', !valid && Boolean(this.draft?.text.trim()));
        if (publish) publish.disabled = !valid;
        if (status) {
            status.classList.toggle('bad', !valid && Boolean(this.draft?.text.trim()));
            status.textContent = !this.draft || !this.draft.text.trim()
                ? '写点什么再发布吧'
                : valid
                    ? '位置不错 · 可以发布'
                    : overlaps
                        ? '盖住封面了 · 拖到空白处'
                        : '和其它记忆重叠了 · 换个位置';
        }
    },

    // ---------- 拖拽 / 缩放（屏幕像素 → 归一化）----------
    onPointerDown(event) {
        if (!this.draft || !this.proj) return;
        if (event.target.closest('.note-rail') || event.target.closest('.note-actions') ||
            event.target === document.getElementById('memory-text-input')) {
            if (event.target !== document.getElementById('memory-note-resize')) return;
        }
        const resizing = event.target === document.getElementById('memory-note-resize');
        this.dragState = {
            mode: resizing ? 'resize' : 'move',
            startX: event.clientX,
            startY: event.clientY,
            initial: { ...this.draft }
        };
        const note = document.getElementById('memory-note');
        note && note.setPointerCapture?.(event.pointerId);
        note && note.classList.add('dragging');
        event.preventDefault();
    },

    onPointerMove(event) {
        if (!this.dragState || !this.draft || !this.proj) return;
        const { startX, startY, initial, mode } = this.dragState;
        const dnx = (event.clientX - startX) / this.proj.fw;
        const dny = (event.clientY - startY) / this.proj.fh;
        if (mode === 'move') {
            this.draft.x = clamp(initial.x + dnx, 0, 1 - this.draft.w);
            this.draft.y = clamp(initial.y + dny, 0, 1 - this.draft.h);
        } else {
            this.draft.w = clamp(initial.w + dnx, 0.07, 0.40);
            this.draft.h = clamp(initial.h + dny, 0.06, 0.70);
            this.draft.x = clamp(this.draft.x, 0, 1 - this.draft.w);
            this.draft.y = clamp(this.draft.y, 0, 1 - this.draft.h);
        }
        this.layoutFromProjection();
        this.validate();
    },

    onPointerUp() {
        this.dragState = null;
        const note = document.getElementById('memory-note');
        note && note.classList.remove('dragging');
    },

    publishDraft() {
        if (!this.isDraftValid()) return;
        const index = this.cards.findIndex(card => card.id === this.draft.id);
        if (index >= 0) this.cards[index] = { ...this.draft };
        else this.cards.push({ ...this.draft });
        this.save();
        this.closeEditor();
    },

    deleteCard(cardId) {
        const card = this.cards.find(item => item.id === cardId);
        if (!card || card.author !== this.getUsername()) return;
        this.cards = this.cards.filter(item => item.id !== cardId);
        this.save();
    },

    requestEdit(cardId) {
        const card = this.cards.find(item => item.id === cardId);
        if (!card || card.author !== this.getUsername()) return;
        const album = this.albums.find(item => item.userData.labelText === card.album);
        if (!album) return;
        window.uiManager?.closeOverlay();
        this.focusAlbum?.(album);
        window.setTimeout(() => this.openEditor(album, cardId), 480);
    },

    renderProfileList() {
        const container = document.getElementById('memory-profile-list');
        if (!container) return;
        container.innerHTML = '';
        const mine = this.cards.filter(card => card.author === this.getUsername());
        if (!mine.length) {
            container.innerHTML = '<div class="memory-empty">No memory cards yet.</div>';
            return;
        }
        mine.forEach(card => {
            const item = document.createElement('div');
            item.className = 'memory-profile-item';
            const title = document.createElement('strong');
            const albumInfo = window.albumData?.[card.album];
            title.textContent = albumInfo ? albumInfo.title + '  ' + albumInfo.artist : card.album;
            const text = document.createElement('p');
            text.textContent = card.text;
            const actions = document.createElement('div');
            actions.className = 'memory-profile-actions';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.textContent = 'EDIT';
            edit.onclick = () => this.requestEdit(card.id);
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'DELETE';
            remove.onclick = () => this.deleteCard(card.id);
            actions.append(edit, remove);
            item.append(title, text, actions);
            container.appendChild(item);
        });
    },

    makeTexture(card) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        const normalized = this.normalizeCard(card);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!normalized.noBackground) {
            ctx.fillStyle = hexToRgba(normalized.color, normalized.opacity);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.shadowColor = 'rgba(0,0,0,0.72)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.font = '36px "Microsoft YaHei", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`@${card.author}`, 952, 82);
        ctx.fillStyle = '#fff';
        ctx.font = '44px "Microsoft YaHei", "Noto Sans SC", sans-serif';
        ctx.textAlign = 'left';
        wrapCanvasText(ctx, card.text, 900).forEach((line, index) => ctx.fillText(line, 56, 180 + index * 62));

        // ── 底部信息栏 ──
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        // 分隔线
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(56, 538); ctx.lineTo(968, 538); ctx.stroke();
        // 左：专辑名 + 歌手
        const albumInfo = window.albumData?.[card.album];
        if (albumInfo) {
            ctx.textAlign = 'left';
            ctx.font = 'bold 26px "Microsoft YaHei", "Noto Sans SC", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.90)';
            ctx.fillText(albumInfo.title, 56, 568);
            ctx.font = '22px "Microsoft YaHei", "Noto Sans SC", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.60)';
            ctx.fillText(albumInfo.artist, 56, 600);
        }
        // 右：发布日期
        const dateStr = card.publishedAt || fakePublishDate(hashStr(card.id || String(card.createdAt)));
        ctx.textAlign = 'right';
        ctx.font = '22px "Courier New", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(dateStr, 968, 600);

        const texture = new this.THREE.CanvasTexture(canvas);
        texture.minFilter = this.THREE.LinearMipmapLinearFilter;
        texture.magFilter = this.THREE.LinearFilter;
        texture.needsUpdate = true;
        return texture;
    },

    syncMeshes() {
        if (!this.THREE) return;
        this.albums.forEach(album => {
            if (album.userData.memoryGroup) album.remove(album.userData.memoryGroup);
            const group = new this.THREE.Group();
            this.albumCards(album.userData.labelText).forEach(card => {
                const material = new this.THREE.MeshBasicMaterial({
                    map: this.makeTexture(card),
                    transparent: true,
                    side: this.THREE.DoubleSide,
                    depthWrite: false
                });
                const mesh = new this.THREE.Mesh(
                    new this.THREE.PlaneGeometry(card.w * FIELD_W, card.h * FIELD_H),
                    material
                );
                mesh.position.set((card.x - 0.5 + card.w / 2) * FIELD_W, (0.5 - card.y - card.h / 2) * FIELD_H, FIELD_Z);
                group.add(mesh);
            });
            album.userData.memoryGroup = group;
            album.add(group);
        });
    }
};





