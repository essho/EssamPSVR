const Viewer = {
    elements: {},
    hideTimer: null,

    init: function() {
        this.elements.sky = document.getElementById('sky');
        this.elements.container = document.getElementById('hotspots');
        this.elements.infoPanel = document.getElementById('info-panel');
        this.elements.infoText = document.getElementById('info-text');
        this.elements.audio = document.getElementById('scene-audio');
        this.elements.welcome = document.getElementById('welcome-screen');
        this.elements.gazeCursor = document.getElementById('gaze-cursor');
        this.elements.rig = document.getElementById('rig');
        this.elements.camera = document.getElementById('camera');
        
        console.log("Viewer Initialized");
    },

    start: function() {
        if(this.elements.welcome) this.elements.welcome.style.display = 'none';
        const startImg = document.getElementById('current-img').getAttribute('src');
        this.loadScene(startImg);
    },

    loadScene: function(imagePath) {
        const filename = imagePath.split('/').pop().split('.')[0];
        const jsonPath = `./hotspots/${filename}.json`;

        console.log("Loading Scene:", filename);

        // إيقاف الصوت القديم بأمان
        if(this.elements.audio && this.elements.audio.components && this.elements.audio.components.sound) {
            this.elements.audio.components.sound.stopSound();
        }

        fetch(jsonPath)
            .then(res => { 
                if (!res.ok) throw new Error("JSON File Not Found"); 
                return res.json(); 
            })
            .then(data => {
                console.log("JSON Loaded Successfully");

                // 1. تطبيق زاوية البداية (مع الحماية من الأخطاء)
                try {
                    const startRot = (data.settings && data.settings.startRotation) 
                                    ? data.settings.startRotation 
                                    : { x: 0, y: 0 };
                    this.resetCameraOrientation(startRot.x, startRot.y);
                } catch (e) {
                    console.warn("Camera reset warning:", e);
                }

                // 2. إعدادات المؤشر
                if (data.settings && this.elements.gazeCursor) {
                    this.elements.gazeCursor.setAttribute('fuse', data.settings.enableFuse);
                    if(data.settings.enableFuse) {
                        this.elements.gazeCursor.setAttribute('fuse-timeout', data.settings.fuseDuration || 1500);
                    }
                }

                // 3. الصوت
                if (data.audio && data.audio.src) {
                    this.elements.audio.setAttribute('sound', {
                        src: data.audio.src,
                        loop: data.audio.loop || false,
                        volume: data.audio.volume || 1.0,
                        autoplay: true
                    });
                    // تشغيل الصوت بعد مهلة بسيطة لضمان التحميل
                    setTimeout(() => {
                        if(this.elements.audio.components.sound) {
                            this.elements.audio.components.sound.playSound();
                        }
                    }, 200);
                }

                // 4. رسم النقاط
                this.elements.container.innerHTML = '';
                if (data.hotspots) {
                    data.hotspots.forEach(spot => {
                        // استخدام Core المشترك
                        const el = Core.createVisualEntity(spot);
                        const visual = el.children[0];
                        
                        visual.addEventListener('click', (evt) => {
                            if(evt) evt.stopPropagation();
                            if (spot.type === 'link') this.changeScene(spot.target);
                            else if (spot.type === 'info') this.showInfo(spot.text, el.getAttribute('position'));
                        });

                        this.elements.container.appendChild(el);
                    });
                }
            })
            .catch(err => {
                console.error("Viewer Error (Critical):", err);
                // لا نمسح الحاوية هنا لنرى إذا كانت المشكلة في الشبكة
            });
    },

    // === الدالة المصححة ===
    resetCameraOrientation: function(pitchX, yawY) {
        const rig = this.elements.rig;
        const cam = this.elements.camera;
        
        if(!rig || !cam) return;

        // 1. تصفير الحاوية الأم
        rig.setAttribute('rotation', '0 0 0');

        // 2. الوصول لمكونات الكاميرا الداخلية
        // ننتظر قليلاً للتأكد من أن A-Frame قام بتحميل المكونات
        const controls = cam.components['look-controls'];
        
        if (controls) {
            controls.enabled = false;

            // *** التصحيح هنا: استخدام THREE.MathUtils بدلاً من THREE.Math ***
            // التحقق من وجود MathUtils (للاحتياط حسب إصدار المكتبة)
            const degToRad = (THREE.MathUtils && THREE.MathUtils.degToRad) ? THREE.MathUtils.degToRad : THREE.Math.degToRad;

            if (controls.pitchObject) controls.pitchObject.rotation.x = degToRad(pitchX);
            if (controls.yawObject) controls.yawObject.rotation.y = degToRad(yawY);

            controls.enabled = true;
        }
    },

    changeScene: function(newUrl) {
        this.hideInfo();
        this.elements.sky.setAttribute('color', '#000');
        setTimeout(() => {
            this.elements.sky.setAttribute('src', newUrl);
            this.elements.sky.removeAttribute('color');
            this.loadScene(newUrl);
        }, 300);
    },

    showInfo: function(text, pos) {
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.elements.infoText.setAttribute('value', text);
        
        // التأكد من أن الإحداثيات أرقام
        const x = parseFloat(pos.x);
        const y = parseFloat(pos.y) + 0.8;
        const z = parseFloat(pos.z);
        
        this.elements.infoPanel.setAttribute('position', `${x} ${y} ${z}`);
        this.elements.infoPanel.setAttribute('look-at', '[camera]');
        this.elements.infoPanel.setAttribute('visible', true);
        this.elements.infoPanel.setAttribute('scale', '1 1 1');

        this.hideTimer = setTimeout(() => this.hideInfo(), 3000);
    },

    hideInfo: function() {
        if(!this.elements.infoPanel) return;
        this.elements.infoPanel.setAttribute('visible', false);
        this.elements.infoPanel.setAttribute('scale', '0 0 0');
        if (this.hideTimer) clearTimeout(this.hideTimer);
    }
};

// التأكد من تحميل الصفحة بالكامل قبل التشغيل
window.addEventListener('load', () => Viewer.init());