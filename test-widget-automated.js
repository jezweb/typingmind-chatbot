// Automated test script for TypingMind widget
// Run this in a browser console after loading the widget

async function runAutomatedTests() {
    console.log('=== Starting TypingMind Widget Tests ===');
    
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // Test 1: Check if TypingMindChat is available
    console.log('\nTest 1: Checking if TypingMindChat is loaded...');
    try {
        if (typeof window.TypingMindChat === 'object') {
            console.log('✅ TypingMindChat is available');
            results.passed++;
            results.tests.push({ name: 'Widget loaded', status: 'passed' });
        } else {
            throw new Error('TypingMindChat not found');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'Widget loaded', status: 'failed', error: error.message });
    }
    
    // Test 2: Check available methods
    console.log('\nTest 2: Checking available methods...');
    try {
        const methods = ['init', 'destroy', 'open', 'close'];
        const available = Object.keys(window.TypingMindChat);
        const hasAllMethods = methods.every(method => available.includes(method));
        
        if (hasAllMethods) {
            console.log('✅ All required methods available:', methods.join(', '));
            results.passed++;
            results.tests.push({ name: 'Required methods', status: 'passed' });
        } else {
            throw new Error('Missing required methods');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'Required methods', status: 'failed', error: error.message });
    }
    
    // Test 3: Initialize with valid instanceId
    console.log('\nTest 3: Initializing widget with valid instanceId...');
    try {
        const widget = TypingMindChat.init({
            instanceId: 'seo-assistant'
        });
        
        if (widget) {
            console.log('✅ Widget initialized successfully');
            results.passed++;
            results.tests.push({ name: 'Valid instanceId init', status: 'passed' });
            
            // Clean up
            TypingMindChat.destroy('seo-assistant');
        } else {
            throw new Error('Widget initialization returned null');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'Valid instanceId init', status: 'failed', error: error.message });
    }
    
    // Test 4: Initialize without instanceId (should fail)
    console.log('\nTest 4: Testing error handling without instanceId...');
    try {
        let errorCaught = false;
        const originalError = console.error;
        
        console.error = function(msg) {
            if (msg.includes('instanceId is required')) {
                errorCaught = true;
            }
            originalError.apply(console, arguments);
        };
        
        const widget = TypingMindChat.init({});
        
        console.error = originalError;
        
        if (!widget && errorCaught) {
            console.log('✅ Correctly rejected missing instanceId');
            results.passed++;
            results.tests.push({ name: 'Missing instanceId handling', status: 'passed' });
        } else {
            throw new Error('Should have rejected missing instanceId');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'Missing instanceId handling', status: 'failed', error: error.message });
    }
    
    // Test 5: Initialize with agentId (should fail - no backward compatibility)
    console.log('\nTest 5: Testing that agentId is not accepted...');
    try {
        const widget = TypingMindChat.init({
            agentId: 'seo-assistant'
        });
        
        if (!widget) {
            console.log('✅ Correctly rejected agentId (no backward compatibility)');
            results.passed++;
            results.tests.push({ name: 'No agentId support', status: 'passed' });
        } else {
            throw new Error('agentId should not be accepted');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'No agentId support', status: 'failed', error: error.message });
    }
    
    // Test 6: Widget lifecycle (create, open, close, destroy)
    console.log('\nTest 6: Testing widget lifecycle...');
    try {
        const widget = TypingMindChat.init({
            instanceId: 'support-bot'
        });
        
        if (widget) {
            // Test opening
            TypingMindChat.open('support-bot');
            console.log('✅ Widget opened');
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Test closing
            TypingMindChat.close('support-bot');
            console.log('✅ Widget closed');
            
            // Test destroying
            TypingMindChat.destroy('support-bot');
            console.log('✅ Widget destroyed');
            
            results.passed++;
            results.tests.push({ name: 'Widget lifecycle', status: 'passed' });
        } else {
            throw new Error('Widget creation failed');
        }
    } catch (error) {
        console.error('❌ Failed:', error.message);
        results.failed++;
        results.tests.push({ name: 'Widget lifecycle', status: 'failed', error: error.message });
    }
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Total tests: ${results.passed + results.failed}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log('\nDetailed results:');
    results.tests.forEach(test => {
        const icon = test.status === 'passed' ? '✅' : '❌';
        console.log(`${icon} ${test.name}${test.error ? ' - ' + test.error : ''}`);
    });
    
    return results;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = runAutomatedTests;
} else {
    window.runAutomatedTests = runAutomatedTests;
}