// Apply a waiting PWA update before Godot opens its in-memory save filesystem.
// This only updates app caches. IndexedDB records are never removed or changed.
window.TickaDotUpdate = async function ({required = false, notice = () => {}} = {}) {
  if (!('serviceWorker' in navigator)) return false;
  const deadline = Date.now() + 15000;
  let activationRequested = false;
  function bounded(promise) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Update check timed out')), Math.max(1, deadline - Date.now()));
    })]).finally(() => clearTimeout(timer));
  }
  function settled(worker) {
    if (!worker || ['installed', 'activated', 'redundant'].includes(worker.state)) return Promise.resolve();
    return new Promise(resolve => {
      const change = () => {
        if (['installed', 'activated', 'redundant'].includes(worker.state)) {
          worker.removeEventListener('statechange', change);
          resolve();
        }
      };
      worker.addEventListener('statechange', change);
      change();
    });
  }
  try {
    const registration = await bounded(navigator.serviceWorker.register('index.service.worker.js', {updateViaCache: 'none'}));
    await bounded(registration.update());
    await bounded(settled(registration.installing));
    const waiting = registration.waiting;
    if (!waiting) return false;
    notice('새 버전을 적용하고 있어요…');
    let changed;
    const controlled = new Promise(resolve => {
      changed = () => { if (navigator.serviceWorker.controller === waiting) resolve(); };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      activationRequested = true;
      waiting.postMessage('claim');
      changed();
    });
    try { await bounded(controlled); }
    finally { navigator.serviceWorker.removeEventListener('controllerchange', changed); }
    return true;
  } catch (error) {
    // skipWaiting/claim cannot be cancelled: never start old engine code once sent.
    if (required || activationRequested) throw error;
    // Offline or a slow update must not stop the already cached app from opening.
    return false;
  }
};
