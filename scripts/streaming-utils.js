// Streaming Utilities - Reusable functions for handling streaming responses
(function(window) {
    'use strict';

    /**
     * Sanitize HTML response to prevent XSS and clean up formatting
     */
    window.sanitizeResponse = function(html) {
        if (!html) return '';
        
        // Remove script tags and event handlers
        let cleaned = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+="[^"]*"/gi, '')
            .replace(/on\w+='[^']*'/gi, '')
            .replace(/javascript:/gi, '');
        
        // Clean up common markdown artifacts
        cleaned = cleaned
            .replace(/```html\s*/g, '')
            .replace(/```\s*/g, '')
            .replace(/```/g, '');
        
        return cleaned;
    };

    /**
     * Format streaming text with proper line breaks and styling
     */
    window.formatStreamingText = function(text, options = {}) {
        if (!text) return '';
        
        const {
            removePrefix = true,
            prefixText = "Here's a summary of",
            addLineBreaks = true
        } = options;
        
        let formatted = text;
        
        // Remove common prefixes
        if (removePrefix) {
            formatted = formatted
                .replace(new RegExp(`^.*\\b(${prefixText})\\b.*$`, 'gim'), '')
                .replace(/^.*\b(Here|Here's)\b.*\bsummary\b.*$/gim, '')
                .replace(/^.*\b(Here|Here's)\b.*\bclause\b.*$/gim, '')
                .replace(/^.*\b(Here|Here's)\b.*\bobligation\b.*$/gim, '');
        }
        
        // Add line breaks for bullet points
        if (addLineBreaks) {
            formatted = formatted
                .replace(/•\s*/g, '• ')
                .replace(/• (.+?)(?=\s*•|<\/p>)/g, '• $1<br>')
                .replace(/<br><\/p>/g, '</p>');
        }
        
        return formatted.trim();
    };

    /**
     * Create a streaming fetch handler with proper error handling
     */
    window.createStreamHandler = function(options = {}) {
        const {
            onChunk,
            onComplete,
            onError,
            abortController
        } = options;
        
        return async function(response) {
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
            }
            
            if (!response.body) {
                throw new Error('Streaming is not supported in this environment.');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const accumulatedChunks = [];
            
            try {
                while (true) {
                    // Check if aborted
                    if (abortController && abortController.signal.aborted) {
                        break;
                    }
                    
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedChunks.push(chunk);
                    
                    // Call onChunk callback with new chunk
                    if (onChunk) {
                        onChunk(chunk, accumulatedChunks.join(''));
                    }
                }
                
                // Call onComplete with final accumulated data
                if (onComplete && !abortController?.signal.aborted) {
                    const finalData = accumulatedChunks.join('');
                    if (finalData.trim()) {
                        onComplete(finalData);
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError' && onError) {
                    onError(error);
                }
                throw error;
            }
        };
    };

    /**
     * Get plain text from a rendered DOM element so clipboard matches what the user sees.
     * Uses innerText (layout-aware) then normalizes whitespace. Use this for Copy on Summary/Clauses/Obligations.
     * @param {HTMLElement} element - The content element (e.g. #html_summary_text, #html_clauses_text)
     * @returns {string} Plain text matching the rendered format
     */
    window.renderedContentToCopyText = function(element) {
        if (!element || typeof element.innerText === 'undefined') return '';
        var text = element.innerText || element.textContent || '';
        text = text.replace(/[ \t]+/g, ' ');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    };

    /**
     * Scroll container to bottom smoothly
     */
    window.scrollToBottom = function(container, smooth = false) {
        if (!container) return;
        
        const scrollHeight = container.scrollHeight;
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        
        // Only scroll if we're near the bottom (within 100px)
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        
        if (isNearBottom || smooth) {
            container.scrollTop = scrollHeight;
        }
    };

})(window);
