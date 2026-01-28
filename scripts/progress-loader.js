// Progress Loader Component - Matches MS Editor ReviewProgressLoader
(function(window) {
    'use strict';

    /**
     * Create and render a progress loader component
     * Matches MS Editor ReviewProgressLoader functionality
     */
    window.createProgressLoader = function(container, options = {}) {
        const {
            title = 'Analyzing your document',
            steps = ['Reading document', 'Identifying main themes', 'Extracting critical information', 'Synthesizing summary'],
            stepDelay = 1000,
            minDisplayTime = 3000,
            titleMarginBottom = '1.5rem'
        } = options;

        // Remove existing loader if present
        const existingLoader = container.querySelector('.progress-loader-container');
        if (existingLoader) {
            existingLoader.remove();
        }

        // Create loader container
        const loaderContainer = document.createElement('div');
        loaderContainer.className = 'progress-loader-container';
        loaderContainer.innerHTML = `
            <div class="progress-loader-content">
                ${title ? `<p class="progress-loader-title">${title}</p>` : ''}
                <div class="progress-loader-steps">
                    ${steps.map((step, index) => `
                        <div class="progress-loader-step" data-step-index="${index}">
                            <div class="progress-loader-icon-wrapper">
                                <div class="progress-loader-spinner" style="display: none;">
                                    <span class="spinner-dot dot1"></span>
                                    <span class="spinner-dot dot2"></span>
                                    <span class="spinner-dot dot3"></span>
                                    <span class="spinner-dot dot4"></span>
                                </div>
                                <div class="progress-loader-check" style="display: none;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2567ff" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <div class="progress-loader-placeholder"></div>
                            </div>
                            <span class="progress-loader-text">${step}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        container.appendChild(loaderContainer);

        // Animation state
        let currentStep = 0;
        const completedSteps = [];
        const startTime = Date.now();
        let stepTimers = [];
        let completionTimer = null;

        // Start animation
        function startAnimation() {
            currentStep = 0;
            completedSteps.length = 0;
            
            // Reset all steps
            const stepElements = loaderContainer.querySelectorAll('.progress-loader-step');
            stepElements.forEach((stepEl, index) => {
                const iconWrapper = stepEl.querySelector('.progress-loader-icon-wrapper');
                const spinner = stepEl.querySelector('.progress-loader-spinner');
                const check = stepEl.querySelector('.progress-loader-check');
                const placeholder = stepEl.querySelector('.progress-loader-placeholder');
                const text = stepEl.querySelector('.progress-loader-text');
                
                spinner.style.display = 'none';
                check.style.display = 'none';
                placeholder.style.display = 'block';
                text.className = 'progress-loader-text text-pending';
            });

            // Animate steps
            function animateStep(stepIndex) {
                if (stepIndex >= steps.length) {
                    // All steps completed, wait for minDisplayTime
                    checkCompletion();
                    return;
                }

                const stepEl = stepElements[stepIndex];
                if (!stepEl) return;

                const iconWrapper = stepEl.querySelector('.progress-loader-icon-wrapper');
                const spinner = stepEl.querySelector('.progress-loader-spinner');
                const check = stepEl.querySelector('.progress-loader-check');
                const placeholder = stepEl.querySelector('.progress-loader-placeholder');
                const text = stepEl.querySelector('.progress-loader-text');

                // Show spinner for current step
                placeholder.style.display = 'none';
                spinner.style.display = 'block';
                text.className = 'progress-loader-text text-current';

                // Complete this step after delay
                const timer = setTimeout(() => {
                    completedSteps.push(stepIndex);
                    spinner.style.display = 'none';
                    
                    // Show check if not last step
                    if (stepIndex < steps.length - 1) {
                        check.style.display = 'block';
                        text.className = 'progress-loader-text text-completed';
                    }
                    
                    currentStep = stepIndex + 1;
                    animateStep(currentStep);
                }, stepDelay);

                stepTimers.push(timer);
            }

            function checkCompletion() {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, minDisplayTime - elapsed);
                
                completionTimer = setTimeout(() => {
                    // Hide loader
                    loaderContainer.style.opacity = '0';
                    loaderContainer.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        if (loaderContainer.parentNode) {
                            loaderContainer.remove();
                        }
                    }, 300);
                }, remaining);
            }

            // Start animation
            animateStep(0);
        }

        // Cleanup function
        function cleanup() {
            stepTimers.forEach(timer => clearTimeout(timer));
            stepTimers = [];
            if (completionTimer) {
                clearTimeout(completionTimer);
                completionTimer = null;
            }
        }

        // Start animation
        startAnimation();

        // Return cleanup function
        return {
            cleanup: cleanup,
            hide: function() {
                cleanup();
                if (loaderContainer.parentNode) {
                    loaderContainer.style.opacity = '0';
                    loaderContainer.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        if (loaderContainer.parentNode) {
                            loaderContainer.remove();
                        }
                    }, 300);
                }
            }
        };
    };

})(window);
