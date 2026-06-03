// UI 管理模块
import { rgbToHex } from './utils.js';
import { PARTICLE_COLORS, PARTICLE_SHAPES } from './user-system.js';

// 全局变量，将在主文件中设置
let userSystem = null;
let albumData = null;

export function setDependencies(userSystemInstance, albumDataObj) {
    userSystem = userSystemInstance;
    albumData = albumDataObj;
}

export const uiManager = {
    overlay: null,
    modals: {},

    init: function() {
        this.overlay = document.getElementById('overlay-container');
        this.modals = {
            login: document.getElementById('modal-login'),
            register: document.getElementById('modal-register'),
            profile: document.getElementById('modal-profile')
        };

        // 绑定事件
        if (this.overlay) {
            this.overlay.onclick = (e) => {
                if (e.target === e.currentTarget) {
                    this.closeOverlay();
                }
            };
        }

        const userIconBtn = document.getElementById('user-icon-btn');
        if (userIconBtn) {
            userIconBtn.onclick = () => this.openOverlay();
        }

        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) {
            btnLogin.onclick = () => {
                const u = document.getElementById('login-username')?.value;
                const p = document.getElementById('login-password')?.value;
                if (u && p && userSystem) {
                    userSystem.login(u, p);
                }
            };
        }

        const btnRegister = document.getElementById('btn-register');
        if (btnRegister) {
            btnRegister.onclick = () => {
                const u = document.getElementById('reg-username')?.value.trim();
                const p = document.getElementById('reg-password')?.value;
                const pc = document.getElementById('reg-confirm')?.value;
                if (!/^[\u4e00-\u9fa5a-zA-Z_]+$/.test(u)) {
                    alert("格式无效");
                    return;
                }
                if (p !== pc || p.length < 1) {
                    alert("请检查密码");
                    return;
                }
                if (userSystem) {
                    userSystem.register(u, p);
                }
            };
        }

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) {
            btnLogout.onclick = () => {
                if (userSystem) userSystem.logout();
            };
        }
    },

    openOverlay: function() {
        if (!this.overlay) return;
        this.overlay.classList.add('active');
        if (userSystem && userSystem.isLoggedIn) {
            this.initShapePicker();
            this.initColorPicker();
            this.updateProfileUI();
        }
        this.switchModal(userSystem && userSystem.isLoggedIn ? 'profile' : 'login');
    },

    closeOverlay: function() {
        if (!this.overlay) return;
        const activeModal = this.overlay.querySelector('.modal-box.active');
        if (activeModal) {
            activeModal.classList.add('closing');
            setTimeout(() => {
                activeModal.classList.remove('closing');
                this.overlay.classList.remove('active');
            }, 300);
        } else {
            this.overlay.classList.remove('active');
        }
    },

    switchModal: function(name) {
        Object.values(this.modals).forEach(el => {
            if (el) el.classList.remove('active');
        });
        if (this.modals[name]) {
            this.modals[name].classList.add('active');
        }
    },

    initColorPicker: function() {
        const container = document.getElementById('color-picker');
        if (!container) return;
        container.innerHTML = '';
        PARTICLE_COLORS.forEach(c => {
            const div = document.createElement('div');
            div.className = 'color-swatch';
            div.style.backgroundColor = c;
            div.onclick = () => {
                if (userSystem) userSystem.setColor(c);
            };
            container.appendChild(div);
        });
    },

    initShapePicker: function() {
        const container = document.getElementById('shape-picker');
        if (!container) return;
        container.innerHTML = '';
        PARTICLE_SHAPES.forEach(shape => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'shape-option';
            button.dataset.shape = shape.id;
            button.title = shape.label;
            button.textContent = shape.symbol;
            button.onclick = () => {
                if (userSystem) userSystem.toggleShape(shape.id);
            };
            container.appendChild(button);
        });
    },

    updateProfileUI: function() {
        if (!userSystem) return;

        const profileId = document.getElementById('profile-id');
        if (profileId) {
            profileId.textContent = userSystem.username;
        }

        const swatches = document.querySelectorAll('.color-swatch');
        swatches.forEach(s => {
            const bgColor = s.style.backgroundColor;
            if (bgColor) {
                const hex = rgbToHex(bgColor).toUpperCase();
                if (hex === userSystem.userColor.toUpperCase()) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            }
        });

        const shapeOptions = document.querySelectorAll('.shape-option');
        shapeOptions.forEach(option => {
            option.classList.toggle('selected', userSystem.userShapes.includes(option.dataset.shape));
        });

        const slider = document.getElementById('blink-speed-slider');
        if (slider) {
            slider.value = userSystem.userBlinkSpeed;
        }

        const list = userSystem.resonatedList;
        const resonanceList = document.getElementById('resonance-list');
        if (resonanceList) {
            resonanceList.innerHTML = list.length === 0 ?
                '<div style="padding:10px; color:#666; text-align:center;">暂无共鸣数据</div>' :
                list.map(item => {
                    const info = albumData && albumData[item.album] ? albumData[item.album] : { title: item.album, artist: item.artist };
                    // 转义单引号以防止 XSS
                    const safeTitle = item.album.replace(/'/g, "\\'");
                    return `
                        <div class="resonance-item">
                            <div class="info"><strong>${info.title}</strong><span>${item.artist}</span></div>
                            <div class="resonance-controls">
                                <button class="ctrl-btn" onclick="window.userSystem.updateResonanceCount('${safeTitle}', -1)">-</button>
                                <span style="font-size:12px; min-width:20px; text-align:center;">${item.count}</span>
                                <button class="ctrl-btn" onclick="window.userSystem.updateResonanceCount('${safeTitle}', 1)">+</button>
                                <button class="ctrl-btn del-btn" onclick="window.userSystem.deleteResonance('${safeTitle}')">×</button>
                            </div>
                        </div>
                    `;
                }).join('');
        }

        if (window.memoryCards) {
            window.memoryCards.renderProfileList();
        }
    }
};

