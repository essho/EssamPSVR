// js/core.js

// تسجيل المكونات
AFRAME.registerComponent('look-at', {
    schema: { type: 'selector' },
    tick: function () { if(this.data) this.el.object3D.lookAt(this.data.object3D.position); }
});

AFRAME.registerComponent('zoom-controls', {
    schema: { min: {default: 30}, max: {default: 80} },
    init: function () {
        this.camera = this.el.components.camera.camera;
        window.addEventListener('wheel', (e) => {
            this.camera.fov += e.deltaY * 0.05;
            this.camera.fov = Math.max(30, Math.min(80, this.camera.fov));
            this.camera.updateProjectionMatrix();
        });
    }
});

const Core = {
    // دالة لجعل أي نقطة بعيدة تقترب لتصبح على بعد 10 أمتار فقط
// دالة محسنة: تحافظ على زاوية النظر من ارتفاع العين (1.6m)
    normalizePosition: function(point, radius = 10) {
        // 1. تحديد موقع الكاميرا (العين)
        const eyeY = 1.8; 
        
        // 2. حساب المتجه من العين إلى النقطة البعيدة
        const dx = point.x - 0;
        const dy = point.y - eyeY; // الفرق في الارتفاع عن العين
        const dz = point.z - 0;

        // 3. حساب المسافة الحالية
        const currentDist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        // 4. حساب نسبة التصغير (نريدها أن تصبح على بعد 10 أمتار)
        const ratio = radius / currentDist;

        // 5. حساب الموقع الجديد بناءً على شعاع العين
        return {
            x: dx * ratio,          // (0 + dx * ratio)
            y: eyeY + (dy * ratio), // نضيف ارتفاع العين مرة أخرى
            z: dz * ratio           // (0 + dz * ratio)
        };
    },
	
createVisualEntity: function(data) {
        const el = document.createElement('a-entity');
        
        // تطبيق الموقع والدوران
        el.setAttribute('position', `${data.x} ${data.y} ${data.z}`);
        
        // إذا كانت هناك قيمة دوران في البيانات نستخدمها، وإلا نوجهه للكاميرا
        if (data.rotation) {
            el.setAttribute('rotation', data.rotation);
        } else {
            el.setAttribute('look-at', '[camera]');
        }
		
        let visualElement;

        if (data.geometry) {
            visualElement = document.createElement('a-entity');
            visualElement.setAttribute('geometry', `primitive: ${data.geometry}`);
            visualElement.setAttribute('material', `color: ${data.color || 'white'}; opacity: 0.9`);
        } else if (data.image) {
            visualElement = document.createElement('a-image');
            visualElement.setAttribute('src', data.image);
        } else if (data.char) {
            visualElement = document.createElement('a-image');
            const iconUrl = this.generateTextTexture(data.char, data.color || 'white');
            visualElement.setAttribute('src', iconUrl);
        } else {
            visualElement = document.createElement('a-sphere');
            visualElement.setAttribute('radius', '0.3');
            visualElement.setAttribute('color', 'white');
        }

        // الحجم: نستخدم 1.5 كافتراضي لأن المسافة قريبة الآن
        const scale = data.scale || "1.5 1.5 1.5";
        visualElement.setAttribute('scale', scale);
        visualElement.setAttribute('class', 'clickable');
        
        // أنيميشن بسيط
        visualElement.setAttribute('animation', 'property: scale; dir: alternate; dur: 1500; loop: true; to: ' + this.parseScale(scale, 1.1));

        el.appendChild(visualElement);
        return el;
    },

    generateTextTexture: function(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 160px Arial, sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 15;
        ctx.fillText(text, 128, 128);
        return canvas.toDataURL('image/png');
    },

    parseScale: function(scaleStr, factor) {
        if (typeof scaleStr === 'string') {
            const s = scaleStr.split(' ').map(Number);
            if(s.length === 1) return `${s[0]*factor} ${s[0]*factor} ${s[0]*factor}`;
            return `${s[0]*factor} ${s[1]*factor} ${s[2]*factor}`;
        }
        return `${factor} ${factor} ${factor}`;
    }
};