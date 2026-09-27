// Keep text entry in a visible native input. Safari can open its keyboard from
// the actual user tap without a deferred canvas-to-hidden-input focus request.
(() => {
  const fields = new Map();
  const style = document.createElement('style');
  style.textContent = `
    [data-tickadot-input] { box-sizing: border-box; border: 1px solid var(--border);
      border-radius: 14px; padding: 0 14px; margin: 0; appearance: none;
      font-family: system-ui, sans-serif; pointer-events: auto; touch-action: manipulation; }
    [data-tickadot-input]::placeholder { color: var(--muted); opacity: 1; }
    [data-tickadot-input]:focus { outline: 2px solid var(--accent); outline-offset: -2px; }
  `;
  document.head.appendChild(style);
  function place(record) {
	const data = record.layout;
	if (!data) return;
	const canvas = document.getElementById('canvas').getBoundingClientRect();
	const sx = canvas.width / data.viewport[0], sy = canvas.height / data.viewport[1];
	const [x, y, w, h] = data.rect, [cx, cy, cw, ch] = data.clip;
	Object.assign(record.wrapper.style, {left: `${canvas.left + cx * sx}px`, top: `${canvas.top + cy * sy}px`, width: `${cw * sx}px`, height: `${ch * sy}px`});
	Object.assign(record.input.style, {left: `${(x - cx) * sx}px`, top: `${(y - cy) * sy}px`, width: `${w * sx}px`, height: `${h * sy}px`, fontSize: `${Math.max(16, data.fontSize * sy)}px`});
  }
  const reposition = () => fields.forEach(place);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition);
  window.visualViewport?.addEventListener('resize', reposition);
  window.visualViewport?.addEventListener('scroll', reposition);
  window.TickaDotTextInput = {
    create(key, change) {
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {position: 'fixed', overflow: 'hidden', zIndex: '10', pointerEvents: 'none', display: 'none'});
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.tickadotInput = key;
      input.setAttribute('aria-label', '목표 이름');
      input.autocomplete = 'off';
      input.enterKeyHint = 'done';
      input.style.position = 'absolute';
      wrapper.appendChild(input);
      document.body.appendChild(wrapper);
      const record = {wrapper, input, disposed: false, composing: false, drag: null};
      fields.set(key, record);
      const emit = () => { if (!record.disposed) change(input.value); };
      input.addEventListener('input', emit);
      input.addEventListener('compositionstart', () => { record.composing = true; });
      input.addEventListener('compositionend', () => { record.composing = false; emit(); });
      input.addEventListener('blur', emit);
      for (const name of ['keydown', 'keyup', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click']) {
        input.addEventListener(name, event => {
          event.stopPropagation();
          if (name === 'keydown' && event.key === 'Enter' && !event.isComposing && !record.composing) {
            event.preventDefault();
            input.blur();
          }
        });
      }
      // Preserve scrolling when a drag starts on an unfocused batch name field.
      input.addEventListener('touchstart', event => {
        event.stopPropagation();
        const t = event.touches[0];
        record.drag = {x: t.clientX, y: t.clientY, lastY: t.clientY, scrolling: false, focused: document.activeElement === input};
      }, {passive: true});
      input.addEventListener('touchmove', event => {
        const drag = record.drag;
        if (!drag || drag.focused) return;
        const t = event.touches[0];
        if (Math.hypot(t.clientX - drag.x, t.clientY - drag.y) > 8) drag.scrolling = true;
        if (!drag.scrolling) return;
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('canvas').dispatchEvent(new WheelEvent('wheel', {
          clientX: t.clientX, clientY: t.clientY, deltaY: drag.lastY - t.clientY,
          deltaMode: 0, bubbles: true, cancelable: true,
        }));
        drag.lastY = t.clientY;
      }, {passive: false});
      input.addEventListener('touchend', event => {
        if (record.drag?.scrolling) event.preventDefault();
        event.stopPropagation();
        record.drag = null;
      }, {passive: false});
      input.addEventListener('touchcancel', () => { record.drag = null; });
    },
    update(key, json) {
      const record = fields.get(key);
      if (!record) return;
      const data = JSON.parse(json);
      record.layout = data;
      const {wrapper, input} = record;
      wrapper.style.display = data.visible ? 'block' : 'none';
      place(record);
      Object.assign(input.style, {background: data.background, color: data.color});
      for (const name of ['border', 'muted', 'accent']) input.style.setProperty(`--${name}`, data[name]);
      input.placeholder = data.placeholder;
      input.maxLength = data.maxLength || 524288;
      if (!record.composing && document.activeElement !== input && input.value !== data.text) input.value = data.text;
      if (!data.visible && document.activeElement === input) input.blur();
    },
    remove(key) {
      const record = fields.get(key);
      if (!record) return;
      record.disposed = true;
      record.wrapper.remove();
      fields.delete(key);
    },
  };
})();
