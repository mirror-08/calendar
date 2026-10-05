// 앱을 고친 뒤 다시 올릴 때는 버전 숫자를 올려 주세요.
const CACHE = 'my-calendar-v59';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // 새 버전을 저장할 때 휴대폰에 남아 있는 예전 파일을 쓰지 않도록 서버에서 다시 받는다
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 앱 화면: 인터넷이 되면 새 버전, 안 되면 저장된 버전
  // (주소 끝에 매번 다른 숫자를 붙여 GitHub 쪽 10분 캐시를 건너뛴다)
  if (req.mode === 'navigate') {
    // 인터넷이 느리면 화면이 흰색으로 오래 멈추지 않도록 4초까지만 기다리고 저장된 화면을 보여 준다
    // (새 버전은 뒤에서 계속 받아 두었다가 다음에 열 때 쓰고, 앱이 새 버전을 알아채면 저절로 새로고침한다)
    const u = new URL(req.url); u.hash = ''; u.searchParams.set('_t', Date.now());
    const net = fetch(u.toString(), { cache: 'no-store' }).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      return r;
    });
    const late = new Promise(res => setTimeout(res, 4000)).then(() => caches.match('./index.html')).then(hit => hit || net);
    e.respondWith(Promise.race([net, late]).catch(() => caches.match('./index.html')).then(r => r || net));
    e.waitUntil(net.catch(() => {}));
    return;
  }

  // 글꼴·아이콘 등: 저장된 것 먼저, 없으면 받아서 저장
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    })));
  }
});
