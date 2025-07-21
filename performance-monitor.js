/**
 * Performance Monitoring and Analytics
 * Implements image optimization, lazy loading, caching, and monitoring
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoadTime: 0,
            imageLoadTimes: [],
            cacheHits: 0,
            cacheMisses: 0,
            linkValidationResults: [],
            performanceEntries: []
        };
        
        this.init();
    }

    init() {
        this.setupImageLazyLoading();
        this.setupCaching();
        this.setupPerformanceTracking();
        this.setupLinkValidation();
        this.startMonitoring();
    }

    /**
     * Image Optimization and Lazy Loading
     */
    setupImageLazyLoading() {
        // Create intersection observer for lazy loading
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.loadImage(img);
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.01
        });

        // Observe all images with data-src attribute
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });

        // Add lazy loading to dynamically created images
        this.observeNewImages(imageObserver);
    }

    loadImage(img) {
        const startTime = performance.now();
        
        img.src = img.dataset.src;
        img.classList.add('loading');
        
        img.onload = () => {
            const loadTime = performance.now() - startTime;
            this.metrics.imageLoadTimes.push(loadTime);
            img.classList.remove('loading');
            img.classList.add('loaded');
            
            // Track image load performance
            this.trackEvent('image_loaded', {
                src: img.src,
                loadTime: loadTime,
                size: img.naturalWidth * img.naturalHeight
            });
        };

        img.onerror = () => {
            img.classList.remove('loading');
            img.classList.add('error');
            this.trackEvent('image_error', { src: img.dataset.src });
        };
    }

    observeNewImages(observer) {
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const images = node.querySelectorAll ? 
                            node.querySelectorAll('img[data-src]') : [];
                        images.forEach(img => observer.observe(img));
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Caching Strategies
     */
    setupCaching() {
        // Service Worker registration for caching
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                    this.trackEvent('sw_registered', { scope: registration.scope });
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                    this.trackEvent('sw_error', { error: error.message });
                });
        }

        // Memory cache for frequently accessed data
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

        // Override fetch for caching
        this.setupFetchInterception();
    }

    setupFetchInterception() {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            const cacheKey = `${url}_${JSON.stringify(options)}`;
            
            // Check memory cache first
            if (this.memoryCache.has(cacheKey)) {
                const cached = this.memoryCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    this.metrics.cacheHits++;
                    this.trackEvent('cache_hit', { url });
                    return Promise.resolve(cached.response.clone());
                } else {
                    this.memoryCache.delete(cacheKey);
                }
            }

            // Fetch from network
            try {
                const response = await originalFetch(url, options);
                
                // Cache successful responses
                if (response.ok && options.method !== 'POST') {
                    this.memoryCache.set(cacheKey, {
                        response: response.clone(),
                        timestamp: Date.now()
                    });
                }
                
                this.metrics.cacheMisses++;
                this.trackEvent('cache_miss', { url });
                return response;
            } catch (error) {
                this.trackEvent('fetch_error', { url, error: error.message });
                throw error;
            }
        };
    }

    /**
     * Performance Tracking
     */
    setupPerformanceTracking() {
        // Track page load performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart;
                
                this.trackEvent('page_loaded', {
                    loadTime: this.metrics.pageLoadTime,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
                    firstPaint: this.getFirstPaint(),
                    firstContentfulPaint: this.getFirstContentfulPaint()
                });
            }, 0);
        });

        // Track Core Web Vitals
        this.trackCoreWebVitals();
        
        // Track resource loading
        this.trackResourcePerformance();
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? firstPaint.startTime : null;
    }

    getFirstContentfulPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : null;
    }

    trackCoreWebVitals() {
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.trackEvent('lcp', { value: lastEntry.startTime });
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
                this.trackEvent('fid', { value: entry.processingStart - entry.startTime });
            });
        }).observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            this.trackEvent('cls', { value: clsValue });
        }).observe({ entryTypes: ['layout-shift'] });
    }

    trackResourcePerformance() {
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
                this.metrics.performanceEntries.push({
                    name: entry.name,
                    type: entry.initiatorType,
                    duration: entry.duration,
                    size: entry.transferSize,
                    timestamp: Date.now()
                });

                // Track slow resources
                if (entry.duration > 1000) { // > 1 second
                    this.trackEvent('slow_resource', {
                        name: entry.name,
                        type: entry.initiatorType,
                        duration: entry.duration
                    });
                }
            });
        }).observe({ entryTypes: ['resource'] });
    }

    /**
     * Link Validation
     */
    setupLinkValidation() {
        this.validateLinks();
        
        // Re-validate links periodically
        setInterval(() => {
            this.validateLinks();
        }, 30 * 60 * 1000); // Every 30 minutes
    }

    async validateLinks() {
        const links = document.querySelectorAll('a[href^="http"]');
        const results = [];

        for (const link of links) {
            try {
                const response = await fetch(link.href, { 
                    method: 'HEAD',
                    mode: 'no-cors'
                });
                
                results.push({
                    url: link.href,
                    status: response.status || 'unknown',
                    valid: response.ok || response.status === 0, // 0 for no-cors
                    timestamp: Date.now()
                });
            } catch (error) {
                results.push({
                    url: link.href,
                    status: 'error',
                    valid: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        }

        this.metrics.linkValidationResults = results;
        
        // Track broken links
        const brokenLinks = results.filter(result => !result.valid);
        if (brokenLinks.length > 0) {
            this.trackEvent('broken_links_found', { 
                count: brokenLinks.length,
                links: brokenLinks.map(link => link.url)
            });
        }
    }

    /**
     * Analytics and Monitoring
     */
    startMonitoring() {
        // Send metrics periodically
        setInterval(() => {
            this.sendMetrics();
        }, 60 * 1000); // Every minute

        // Send metrics before page unload
        window.addEventListener('beforeunload', () => {
            this.sendMetrics();
        });

        // Track user interactions
        this.trackUserInteractions();
    }

    trackUserInteractions() {
        // Track clicks on important elements
        document.addEventListener('click', (event) => {
            const target = event.target.closest('a, button, .toc-link, .copy-btn');
            if (target) {
                this.trackEvent('user_interaction', {
                    type: 'click',
                    element: target.tagName.toLowerCase(),
                    className: target.className,
                    text: target.textContent?.substring(0, 50)
                });
            }
        });

        // Track scroll depth
        let maxScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
            );
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                this.trackEvent('scroll_depth', { percent: scrollPercent });
            }
        });
    }

    trackEvent(eventName, data = {}) {
        const event = {
            name: eventName,
            data: data,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Store in local storage for persistence
        const events = JSON.parse(localStorage.getItem('performance_events') || '[]');
        events.push(event);
        
        // Keep only last 1000 events
        if (events.length > 1000) {
            events.splice(0, events.length - 1000);
        }
        
        localStorage.setItem('performance_events', JSON.stringify(events));

        // Send to analytics service (if configured)
        this.sendToAnalytics(event);
    }

    sendToAnalytics(event) {
        // Example: Send to Google Analytics 4
        if (typeof gtag !== 'undefined') {
            gtag('event', event.name, {
                custom_parameter: JSON.stringify(event.data),
                page_location: event.url
            });
        }

        // Example: Send to custom analytics endpoint
        if (window.ANALYTICS_ENDPOINT) {
            fetch(window.ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            }).catch(error => {
                console.warn('Failed to send analytics:', error);
            });
        }
    }

    sendMetrics() {
        const metrics = {
            ...this.metrics,
            timestamp: Date.now(),
            url: window.location.href,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };

        this.trackEvent('performance_metrics', metrics);
    }

    /**
     * Public API for getting performance data
     */
    getMetrics() {
        return { ...this.metrics };
    }

    getCacheStats() {
        return {
            hits: this.metrics.cacheHits,
            misses: this.metrics.cacheMisses,
            hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
            cacheSize: this.memoryCache.size
        };
    }

    getPerformanceReport() {
        const navigation = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        
        return {
            pageLoad: {
                total: this.metrics.pageLoadTime,
                domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            },
            resources: {
                total: resources.length,
                slow: resources.filter(r => r.duration > 1000).length,
                failed: resources.filter(r => r.responseStatus >= 400).length
            },
            images: {
                total: this.metrics.imageLoadTimes.length,
                averageLoadTime: this.metrics.imageLoadTimes.reduce((a, b) => a + b, 0) / this.metrics.imageLoadTimes.length || 0
            },
            cache: this.getCacheStats(),
            links: {
                total: this.metrics.linkValidationResults.length,
                broken: this.metrics.linkValidationResults.filter(l => !l.valid).length
            }
        };
    }
}

// Initialize performance monitoring
const performanceMonitor = new PerformanceMonitor();

// Expose to global scope for debugging
window.performanceMonitor = performanceMonitor;