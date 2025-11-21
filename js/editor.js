// js/editor.js

['keydown', 'keyup', 'keypress'].forEach(evt => {
    window.addEventListener(evt, (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') e.stopPropagation();
    }, true);
});

const Editor = {
    creds: { u: "Essam", p: "Yahya.192020" },
    data: { settings: { startRotation: 0 }, audio: {}, hotspots: [] },
    mode: 'select',
    selected: null,
    isMoving: false, // حالة التحريك
    filename: '',

    login: function() {
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        if (u === this.creds.u && p === this.creds.p) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('setup-modal').style.display = 'flex';
            this.initFileListeners();
        } else {
            document.getElementById('login-msg').innerText = "بيانات خاطئة";
        }
    },

    initFileListeners: function() {
        document.getElementById('setup-img-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if(file) {
                const url = URL.createObjectURL(file);
                const asset = document.getElementById('preview-blob');
                asset.onload = () => {
                    document.getElementById('sky').setAttribute('src', '#preview-blob');
                    document.getElementById('sky').removeAttribute('color');
                };
                asset.src = url;
                document.getElementById('setup-img-name').value = file.name.replace(/\.[^/.]+$/, "");
            }
        });
    },

    confirmSetup: function() {
        const name = document.getElementById('setup-img-name').value;
        if(!name) return alert("اختر صورة!");
        this.filename = name;

        this.data.settings = {
            enableFuse: document.getElementById('setup-fuse-enable').value === "true",
            fuseDuration: parseInt(document.getElementById('setup-fuse-dur').value),
            startRotation: 0
        };

        const aud = document.getElementById('setup-audio-file').files[0];
        if(aud) {
            this.data.audio = {
                src: "./sounds/" + aud.name,
                loop: document.getElementById('setup-audio-loop').value === "true",
                volume: parseFloat(document.getElementById('setup-audio-vol').value)
            };
        }

        document.getElementById('setup-modal').style.display = 'none';
        document.getElementById('editor-ui').style.display = 'block';
        document.getElementById('scene-title').innerText = name;
        
        this.initSceneInteractions();
    },

    // === ضبط زاوية البداية ===
// === تصحيح: حفظ زاوية النظر كاملة (فوق/تحت + يمين/يسار) ===
    setStartView: function() {
        const cam = document.querySelector('[camera]');
        const rot = cam.getAttribute('rotation');
        
        // نحفظ X (فوق/تحت) و Y (يمين/يسار)
        this.data.settings.startRotation = {
            x: parseFloat(rot.x.toFixed(2)),
            y: parseFloat(rot.y.toFixed(2))
        };
        
        alert(`تم حفظ زاوية البداية:\nفوق/تحت (X): ${this.data.settings.startRotation.x}\nيمين/يسار (Y): ${this.data.settings.startRotation.y}`);
    },

    initSceneInteractions: function() {
        const sky = document.getElementById('sky');
        
        // 1. النقر (للإضافة أو تثبيت التحريك)
        sky.addEventListener('click', (evt) => {
            const p = evt.detail.intersection.point;

            // حالة التحريك (Move Mode)
            if (this.isMoving && this.selected) {
                this.confirmMove(p);
                return;
            }

            // حالة التحديد (إغلاق اللوحة)
            if(this.mode === 'select') { 
                this.closePanel(); 
                return; 
            }

            // حالة الإضافة
            this.addSpot(p, this.mode);
            this.setMode('select');
        });

        // 2. حركة الماوس (للمعاينة أثناء التحريك)
        sky.addEventListener('raycaster-intersected', (evt) => {
            // هذه للتحسين المستقبلي (السحب والإفلات)
        });
    },

    setMode: function(m) {
        this.mode = m;
        this.isMoving = false; // إلغاء التحريك عند تغيير الوضع
        document.getElementById('current-mode').innerText = m;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if(m !== 'select') document.getElementById('mode-add-' + m).classList.add('active');
    },

    addSpot: function(rawPoint, type) {
        // *** التصحيح الجذري: تقريب النقطة ***
        const p = Core.normalizePosition(rawPoint, 10); // نصف القطر 10 متر فقط

        const id = 'hs_' + Date.now();
        const spot = {
            id: id, type: type,
            x: parseFloat(p.x.toFixed(3)), y: parseFloat(p.y.toFixed(3)), z: parseFloat(p.z.toFixed(3)),
            geometry: 'sphere', color: type === 'link' ? '#2ecc71' : '#3498db', scale: '1.5 1.5 1.5',
            target: '', text: '', image: '', char: ''
        };
        this.data.hotspots.push(spot);
        this.renderSpot(spot);
        this.openProperties(id);
    },

    renderSpot: function(spotData) {
        const container = document.getElementById('hotspots-container');
        let oldEl = document.getElementById(spotData.id);
        if(oldEl) oldEl.parentNode.removeChild(oldEl);

        const el = Core.createVisualEntity(spotData);
        el.setAttribute('id', spotData.id);

        const visualChild = el.children[0];
        
        visualChild.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isMoving) return; // لا تفتح الخصائص أثناء التحريك
            this.openProperties(spotData.id);
        });

        container.appendChild(el);
    },

    openProperties: function(id) {
        const d = this.data.hotspots.find(h => h.id === id);
        if(!d) return;
        this.selected = d;
        
        // إضافة زر التحريك للوحة إذا لم يكن موجوداً
        this.injectMoveButton();

        this.showSelectionGizmo(id);
        document.getElementById('properties-panel').classList.add('open');

        let vType = d.image ? 'image' : (d.char ? 'char' : 'geometry');
        document.getElementById('prop-visual-type').value = vType;
        this.toggleVisualInputs(vType);

        document.getElementById('prop-geo').value = d.geometry || 'sphere';
        document.getElementById('prop-img-src').value = d.image || '';
        document.getElementById('prop-char').value = d.char || '';
        document.getElementById('prop-color').value = d.color || '#ffffff';
        document.getElementById('prop-scale').value = d.scale || '1.5 1.5 1.5';

        const isLink = d.type === 'link';
        document.getElementById('prop-target-div').style.display = isLink ? 'block' : 'none';
        document.getElementById('prop-text-div').style.display = isLink ? 'none' : 'block';
        
        if(isLink) document.getElementById('prop-target').value = d.target || '';
        else document.getElementById('prop-text').value = d.text || '';
    },

    // === منطق التحريك الجديد ===
    injectMoveButton: function() {
        // نتأكد أن زر التحريك موجود في اللوحة
        const panel = document.getElementById('properties-panel');
        if(!document.getElementById('btn-move')) {
            const btn = document.createElement('button');
            btn.id = 'btn-move';
            btn.innerText = '📍 تحريك الموقع (نقل)';
            btn.style = "background:#e67e22; color:white; width:100%; margin-top:10px; padding:10px; border:none; border-radius:4px; cursor:pointer;";
            btn.onclick = () => this.startMove();
            
            // نضعه قبل زر الحذف
            const deleteBtn = panel.querySelector('button[onclick="Editor.deleteSelected()"]');
            panel.insertBefore(btn, deleteBtn);
        }
    },

    startMove: function() {
        this.isMoving = true;
        this.closePanel(false); // نغلق اللوحة لكن نبقي التحديد
        document.getElementById('current-mode').innerText = ">>> اضغط في المكان الجديد <<<";
        // تغيير لون الصندوق ليعرف المستخدم أنه في وضع التحريك
        const gizmo = document.getElementById('selection-gizmo').children[0];
        if(gizmo) gizmo.setAttribute('material', 'color: #e67e22; wireframe: true');
    },

    confirmMove: function(rawPoint) {
        if (!this.selected) return;

        // تصحيح الإحداثيات الجديدة
        const p = Core.normalizePosition(rawPoint, 10);

        // تحديث البيانات
        this.selected.x = parseFloat(p.x.toFixed(3));
        this.selected.y = parseFloat(p.y.toFixed(3));
        this.selected.z = parseFloat(p.z.toFixed(3));

        // إعادة الرسم
        this.renderSpot(this.selected);
        
        // إنهاء الوضع
        this.isMoving = false;
        document.getElementById('current-mode').innerText = "تم النقل";
        this.openProperties(this.selected.id); // إعادة فتح اللوحة
    },

    showSelectionGizmo: function(id) {
        const oldGizmo = document.getElementById('selection-gizmo');
        if(oldGizmo) oldGizmo.parentNode.removeChild(oldGizmo);

        const targetEl = document.getElementById(id);
        if(!targetEl) return;

        const gizmo = document.createElement('a-entity');
        gizmo.setAttribute('id', 'selection-gizmo');
        const box = document.createElement('a-box');
        box.setAttribute('material', 'color: yellow; wireframe: true');
        // نجعله أكبر قليلاً ليحيط بالعنصر
        box.setAttribute('scale', '1.2 1.2 1.2'); 
        box.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 4000; easing: linear');
        targetEl.appendChild(gizmo);
        gizmo.appendChild(box);
    },

    toggleVisualInputs: function(type) {
        document.getElementById('group-geo').style.display = type === 'geometry' ? 'block' : 'none';
        document.getElementById('group-img').style.display = type === 'image' ? 'block' : 'none';
        document.getElementById('group-char').style.display = type === 'char' ? 'block' : 'none';
    },

    updateSelected: function() {
        if(!this.selected) return;
        const s = this.selected;
        const vType = document.getElementById('prop-visual-type').value;
        this.toggleVisualInputs(vType);

        delete s.geometry; delete s.image; delete s.char;

        if(vType === 'geometry') s.geometry = document.getElementById('prop-geo').value;
        else if(vType === 'image') s.image = document.getElementById('prop-img-src').value;
        else s.char = document.getElementById('prop-char').value;

        s.color = document.getElementById('prop-color').value;
        s.scale = document.getElementById('prop-scale').value;

        if(s.type === 'link') s.target = document.getElementById('prop-target').value;
        else s.text = document.getElementById('prop-text').value;

        this.renderSpot(s);
        setTimeout(() => this.showSelectionGizmo(s.id), 50);
    },

    deleteSelected: function() {
        if(confirm("حذف العنصر؟")) {
            this.data.hotspots = this.data.hotspots.filter(h => h.id !== this.selected.id);
            document.getElementById(this.selected.id).remove();
            this.closePanel();
        }
    },

    closePanel: function(clearSelection = true) {
        document.getElementById('properties-panel').classList.remove('open');
        if (clearSelection) {
            const gizmo = document.getElementById('selection-gizmo');
            if(gizmo) gizmo.parentNode.removeChild(gizmo);
            this.selected = null;
        }
    },

    exportJSON: function() {
        if(!this.data.settings.startRotation) this.data.settings.startRotation = { x: 0, y: 0 };

        const finalData = {
            settings: this.data.settings,
            audio: this.data.audio,
            hotspots: this.data.hotspots.map(h => {
                let s = { type: h.type, x: h.x, y: h.y, z: h.z, color: h.color, scale: h.scale };
                if(h.geometry) s.geometry = h.geometry;
                if(h.image) s.image = h.image;
                if(h.char) s.char = h.char;
                if(h.type === 'link') s.target = h.target;
                else s.text = h.text;
                return s;
            })
        };
        const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalData, null, 2));
        const a = document.createElement('a');
        a.href = str; a.download = (this.filename || "scene") + ".json";
        document.body.appendChild(a); a.click(); a.remove();
    }
};