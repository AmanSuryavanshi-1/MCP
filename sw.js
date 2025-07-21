/**
 * Service Worker for Caching Strategies
 * Implements intelligent caching for better performance
 */

const CACHE_NAME = 'mcp-docs-v1';
const STATIC_CACHE = 'mcp-static-v1';
const DYNAMIC_CACHE = 'mcp-dynamic-v1';

// Resources to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/performance-monitor.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
    // Cache first, then network for static assets
    static: ['css', 'js', 'font', 'image'],
    // Network first, then cache for API calls
    networkFirst: ['api', 'json'],
    // Cache only for offline resources
    cacheOnly: ['offline'],
    // Network only for analytics and tracking
    networkOnly: ['analytics', 'tracking']
};

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Failed to cache static assets:', error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        // Delete old caches
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Determine cache strategy based on request
    const strategy = getCacheStrategy(request);
    
    switch (strategy) {
        case 'cacheFirst':
            event.respondWith(cacheFirst(request));
            break;
        case 'networkFirst':
            event.respondWith(networkFirst(request));
            break;
        case 'cacheOnly':
            event.respondWith(cacheOnly(request));
            break;
        case 'networkOnly':
            event.respondWith(networkOnly(request));
            break;
        default:
            event.respondWith(staleWhileRevalidate(request));
    }
});

function getCacheStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const hostname = url.hostname;
    
    // Analytics and tracking - network only
    if (hostname.includes('google-analytics.com') || 
        hostname.includes('googletagmanager.com') ||
        pathname.includes('/analytics/')) {
        return 'networkOnly';
    }
    
    // API calls - network first
    if (pathname.includes('/api/') || 
        pathname.includes('.json') ||
        request.headers.get('accept')?.includes('application/json')) {
        return 'networkFirst';
    }
    
    // Static assets - cache first
    if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/i) ||
        hostname.includes('fonts.googleapis.com') ||
        hostname.includes('fonts.gstatic.com') ||
        hostname.includes('cdnjs.cloudflare.com')) {
        return 'cacheFirst';
    }
    
    // HTML pages - stale while revalidate
    return 'staleWhileRevalidate';
}

async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('Cache first strategy failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('Network failed, trying cache:', error);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return new Response('Offline', { status: 503 });
    }
}

async function cacheOnly(request) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Not found in cache', { status: 404 });
}

async function networkOnly(request) {
    return fetch(request);
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in background
    const networkResponsePromise = fetch(request)
        .then(response => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(error => {
            console.log('Network request failed:', error);
            return null;
        });
    
    // Return cached response immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Otherwise wait for network response
    return networkResponsePromise || new Response('Offline', { status: 503 });
}

// Background sync for offline actions
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Sync any pending analytics events
        const events = await getStoredEvents();
        if (events.length > 0) {
            await sendEventsToServer(events);
            await clearStoredEvents();
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

async function getStoredEvents() {
    // This would typically read from IndexedDB
    // For now, return empty array
    return [];
}

async function sendEventsToServer(events) {
    // Send events to analytics server
    if (self.ANALYTICS_ENDPOINT) {
        await fetch(self.ANALYTICS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });
    }
}

async function clearStoredEvents() {
    // Clear stored events after successful sync
}

// Push notifications (if needed)
self.addEventListener('push', event => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: data.tag || 'default',
            requireInteraction: data.requireInteraction || false
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});

// Periodic background sync for cache cleanup
self.addEventListener('periodicsync', event => {
    if (event.tag === 'cache-cleanup') {
        event.waitUntil(cleanupCaches());
    }
});

async function cleanupCaches() {
    const cacheNames = await caches.keys();
    const dynamicCache = await caches.open(DYNAMIC_CACHE);
    const requests = await dynamicCache.keys();
    
    // Remove old entries (older than 7 days)
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
        const response = await dynamicCache.match(request);
        const dateHeader = response.headers.get('date');
        
        if (dateHeader) {
            const responseDate = new Date(dateHeader).getTime();
            if (responseDate < oneWeekAgo) {
                await dynamicCache.delete(request);
            }
        }
    }
}