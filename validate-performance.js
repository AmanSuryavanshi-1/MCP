/**
 * Performance Validation Script
 * Tests the performance monitoring implementation
 */

// Simple validation tests
function validatePerformanceImplementation() {
    const results = {
        performanceMonitorLoaded: false,
        serviceWorkerRegistered: false,
        lazyLoadingActive: false,
        cacheImplemented: false,
        linkValidationActive: false,
        analyticsTracking: false
    };

    // Check if performance monitor is loaded
    if (typeof window.performanceMonitor !== 'undefined') {
        results.performanceMonitorLoaded = true;
        console.log('✅ Performance Monitor loaded successfully');
    } else {
        console.log('❌ Performance Monitor not found');
    }

    // Check service worker registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            if (registrations.length > 0) {
                results.serviceWorkerRegistered = true;
                console.log('✅ Service Worker registered');
            } else {
                console.log('❌ Service Worker not registered');
            }
        });
    }

    // Check lazy loading implementation
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (lazyImages.length > 0) {
        results.lazyLoadingActive = true;
        console.log(`✅ Lazy loading active for ${lazyImages.length} images`);
    } else {
        console.log('❌ No lazy loading images found');
    }

    // Check cache implementation
    if (window.caches) {
        caches.keys().then(cacheNames => {
            if (cacheNames.length > 0) {
                results.cacheImplemented = true;
                console.log(`✅ Cache implemented with ${cacheNames.length} cache(s)`);
            } else {
                console.log('❌ No caches found');
            }
        });
    }

    // Check performance indicators
    const perfIndicator = document.querySelector('.performance-indicator');
    const cacheStatus = document.querySelector('.cache-status');
    
    if (perfIndicator && cacheStatus) {
        console.log('✅ Performance indicators present');
    } else {
        console.log('❌ Performance indicators missing');
    }

    // Test performance metrics collection
    setTimeout(() => {
        if (window.performanceMonitor) {
            const metrics = window.performanceMonitor.getMetrics();
            const report = window.performanceMonitor.getPerformanceReport();
            
            console.log('📊 Performance Metrics:', {
                pageLoadTime: report.pageLoad.total,
                cacheHitRate: report.cache.hitRate,
                imageCount: report.images.total,
                resourceCount: report.resources.total
            });
            
            results.analyticsTracking = metrics.pageLoadTime > 0;
        }
        
        // Final validation report
        console.log('\n🔍 Validation Summary:');
        Object.entries(results).forEach(([key, value]) => {
            console.log(`${value ? '✅' : '❌'} ${key}: ${value}`);
        });
        
        const passedTests = Object.values(results).filter(Boolean).length;
        const totalTests = Object.keys(results).length;
        
        console.log(`\n📈 Overall Score: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All performance optimizations implemented successfully!');
        } else {
            console.log('⚠️ Some optimizations may need attention');
        }
    }, 3000);
}

// Run validation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', validatePerformanceImplementation);
} else {
    validatePerformanceImplementation();
}

// Export for manual testing
window.validatePerformance = validatePerformanceImplementation;